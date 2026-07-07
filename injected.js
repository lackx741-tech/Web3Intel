(function (global) {
  if (global.__WIT_PAGE_INSTALLED__) {
    return;
  }
  global.__WIT_PAGE_INSTALLED__ = true;
  const rpcMethodPatternSource = global.WebsiteIntelShared && global.WebsiteIntelShared.rpcMethodPatternSource || '(?:eth_[A-Za-z0-9_]+|wallet_[A-Za-z0-9_]+|personal_[A-Za-z0-9_]+|net_[A-Za-z0-9_]+)';

  const shared = global.WebsiteIntelShared || {
    extractRpcMethods: function (value) {
      try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        if (parsed && typeof parsed.method === 'string') {
          return [parsed.method];
        }
      } catch (error) {
        const matches = String(value || '').match(new RegExp(rpcMethodPatternSource, 'g'));
        return matches || [];
      }
      return [];
    },
    inferApiKind: function (details) {
      const payload = String(details && details.requestPayloadPreview || '').toLowerCase();
      const url = String(details && details.url || '').toLowerCase();
      if (/eventsource/.test(details && details.channel || '')) {
        return 'SSE';
      }
      if (/websocket/.test(details && details.channel || '')) {
        return 'WebSocket';
      }
      if (/jsonrpc|eth_|wallet_/.test(payload) || /\/rpc\b/.test(url)) {
        return 'JSON-RPC';
      }
      if (/graphql/.test(url) || /\bquery\b|\bmutation\b/.test(payload)) {
        return 'GraphQL';
      }
      return 'REST';
    },
    previewValue: function (value) {
      if (value == null) {
        return null;
      }
      if (typeof value === 'string') {
        return value.length > 320 ? value.slice(0, 320) + '…' : value;
      }
      try {
        const serialized = JSON.stringify(value);
        return serialized.length > 320 ? serialized.slice(0, 320) + '…' : serialized;
      } catch (error) {
        return Object.prototype.toString.call(value);
      }
    },
    safeJsonParse: function (value) {
      try {
        return JSON.parse(value);
      } catch (error) {
        return null;
      }
    },
    unique: function (values) {
      return Array.from(new Set((values || []).filter(Boolean)));
    }
  };

  const state = global.__WIT_PAGE_STATE__ = global.__WIT_PAGE_STATE__ || {
    networkEvents: [],
    maxNetworkEvents: 250
  };

  function recordNetworkEvent(event) {
    const rpcMethods = shared.extractRpcMethods(event.requestPayloadPreview);
    const normalizedEvent = Object.assign({}, event, {
      inferredApiKind: event.inferredApiKind || shared.inferApiKind(event),
      rpcMethods: rpcMethods
    });
    state.networkEvents.push(normalizedEvent);
    if (state.networkEvents.length > state.maxNetworkEvents) {
      state.networkEvents.splice(0, state.networkEvents.length - state.maxNetworkEvents);
    }
  }

  async function measureResponseSize(response) {
    try {
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        return Number(contentLength);
      }
    } catch (error) {
      // Continue with best-effort measurement.
    }

    try {
      const clone = response.clone();
      const buffer = await clone.arrayBuffer();
      return buffer.byteLength;
    } catch (error) {
      return null;
    }
  }

  function patchFetch() {
    if (typeof global.fetch !== 'function' || global.fetch.__witPatched) {
      return;
    }

    const originalFetch = global.fetch;

    async function wrappedFetch(input, init) {
      const startedAt = Date.now();
      const startedPerf = performance.now();
      const request = typeof Request !== 'undefined' && input instanceof Request ? input : null;
      const url = request ? request.url : String(input);
      const method = (init && init.method) || (request && request.method) || 'GET';
      const requestPayloadPreview = shared.previewValue(init && init.body);

      try {
        const response = await originalFetch.apply(this, arguments);
        const eventRecord = {
          channel: 'fetch',
          type: 'fetch',
          url: url,
          method: method,
          timestamp: startedAt,
          duration: performance.now() - startedPerf,
          status: response.status,
          requestPayloadPreview: requestPayloadPreview,
          responseSize: null
        };
        recordNetworkEvent(eventRecord);
        measureResponseSize(response).then(function (responseSize) {
          eventRecord.responseSize = responseSize;
        });
        return response;
      } catch (error) {
        recordNetworkEvent({
          channel: 'fetch',
          type: 'fetch',
          url: url,
          method: method,
          timestamp: startedAt,
          duration: performance.now() - startedPerf,
          status: null,
          requestPayloadPreview: requestPayloadPreview,
          error: error && error.message ? error.message : String(error)
        });
        throw error;
      }
    }

    wrappedFetch.__witPatched = true;
    global.fetch = wrappedFetch;
  }

  function patchXhr() {
    if (typeof XMLHttpRequest === 'undefined' || XMLHttpRequest.prototype.__witPatched) {
      return;
    }

    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
      this.__witMeta = {
        method: method,
        url: url,
        startedAt: 0,
        startedPerf: 0,
        requestPayloadPreview: null
      };
      return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (body) {
      if (!this.__witMeta) {
        this.__witMeta = {
          method: 'GET',
          url: '',
          startedAt: Date.now(),
          startedPerf: performance.now(),
          requestPayloadPreview: null
        };
      }
      this.__witMeta.startedAt = Date.now();
      this.__witMeta.startedPerf = performance.now();
      this.__witMeta.requestPayloadPreview = shared.previewValue(body);

      this.addEventListener('loadend', function () {
        let responseSize = null;
        try {
          if (typeof this.responseText === 'string') {
            responseSize = this.responseText.length;
          } else if (this.response instanceof ArrayBuffer) {
            responseSize = this.response.byteLength;
          } else if (this.response && typeof this.response.size === 'number') {
            responseSize = this.response.size;
          }
        } catch (error) {
          responseSize = null;
        }

        recordNetworkEvent({
          channel: 'xhr',
          type: 'xhr',
          url: this.__witMeta.url,
          method: this.__witMeta.method || 'GET',
          timestamp: this.__witMeta.startedAt,
          duration: this.__witMeta.startedPerf ? performance.now() - this.__witMeta.startedPerf : null,
          status: this.status,
          requestPayloadPreview: this.__witMeta.requestPayloadPreview,
          responseSize: responseSize
        });
      }, { once: true });

      return originalSend.apply(this, arguments);
    };

    XMLHttpRequest.prototype.__witPatched = true;
  }

  function patchWebSocket() {
    if (typeof WebSocket === 'undefined' || WebSocket.__witPatched) {
      return;
    }

    const OriginalWebSocket = WebSocket;

    function WrappedWebSocket(url, protocols) {
      const socket = protocols !== undefined ? new OriginalWebSocket(url, protocols) : new OriginalWebSocket(url);
      recordNetworkEvent({
        channel: 'websocket',
        type: 'websocket-open',
        url: socket.url || String(url),
        method: 'CONNECT',
        timestamp: Date.now()
      });

      const originalSend = socket.send;
      socket.send = function (data) {
        recordNetworkEvent({
          channel: 'websocket',
          type: 'websocket-send',
          url: socket.url || String(url),
          method: 'SEND',
          timestamp: Date.now(),
          requestPayloadPreview: shared.previewValue(data)
        });
        return originalSend.apply(this, arguments);
      };

      return socket;
    }

    WrappedWebSocket.prototype = Object.create(OriginalWebSocket.prototype);
    WrappedWebSocket.prototype.constructor = WrappedWebSocket;
    Object.keys(OriginalWebSocket).forEach(function (key) {
      WrappedWebSocket[key] = OriginalWebSocket[key];
    });
    WrappedWebSocket.__witPatched = true;
    global.WebSocket = WrappedWebSocket;
  }

  function patchEventSource() {
    if (typeof EventSource === 'undefined' || EventSource.__witPatched) {
      return;
    }

    const OriginalEventSource = EventSource;

    function WrappedEventSource(url, configuration) {
      const instance = new OriginalEventSource(url, configuration);
      recordNetworkEvent({
        channel: 'eventsource',
        type: 'eventsource-open',
        url: instance.url || String(url),
        method: 'CONNECT',
        timestamp: Date.now()
      });
      return instance;
    }

    WrappedEventSource.prototype = Object.create(OriginalEventSource.prototype);
    WrappedEventSource.prototype.constructor = WrappedEventSource;
    Object.keys(OriginalEventSource).forEach(function (key) {
      WrappedEventSource[key] = OriginalEventSource[key];
    });
    WrappedEventSource.__witPatched = true;
    global.EventSource = WrappedEventSource;
  }

  function detectFrameworks() {
    const reasonsByName = new Map();

    function add(name, confidence, reason) {
      const entry = reasonsByName.get(name) || {
        name: name,
        detected: true,
        confidence: confidence,
        reasons: []
      };
      if (reason) {
        entry.reasons.push(reason);
      }
      if (confidence === 'high') {
        entry.confidence = 'high';
      }
      reasonsByName.set(name, entry);
    }

    if (global.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      add('React', 'high', 'React DevTools global hook present');
    }
    if (global.__NEXT_DATA__ || document.getElementById('__NEXT_DATA__')) {
      add('Next.js', 'high', 'Next.js data payload found on page');
      add('React', 'medium', 'Next.js implies React runtime');
    }
    if (global.__VUE__ || global.__VUE_DEVTOOLS_GLOBAL_HOOK__) {
      add('Vue', 'high', 'Vue global/devtools hook present');
    }
    if (global.ng || document.querySelector('[ng-version]')) {
      add('Angular', 'high', 'Angular runtime marker present');
    }
    if (global.__SVELTE_HMR || global.__svelte) {
      add('Svelte', 'medium', 'Svelte runtime marker present');
    }
    if (global.preact || global.__PREACT_DEVTOOLS__) {
      add('Preact', 'high', 'Preact runtime marker present');
    }
    if (global.Solid || global.__SOLID_DEVTOOLS__) {
      add('Solid', 'medium', 'Solid runtime marker present');
    }
    if (global.__NUXT__) {
      add('Nuxt', 'high', 'Nuxt global state present');
      add('Vue', 'medium', 'Nuxt implies Vue runtime');
    }
    if (document.querySelector('astro-island')) {
      add('Astro', 'high', 'Astro island component present');
    }

    return {
      detected: Array.from(reasonsByName.values()),
      limitations: ['Global runtime hooks are not guaranteed in production builds.']
    };
  }

  async function collectStorage() {
    function safeKeys(storageArea) {
      try {
        return Object.keys(storageArea);
      } catch (error) {
        return null;
      }
    }

    let indexedDbNames = null;
    let indexedDbSupported = typeof indexedDB !== 'undefined';
    if (indexedDbSupported && indexedDB && typeof indexedDB.databases === 'function') {
      try {
        indexedDbNames = (await indexedDB.databases()).map(function (database) {
          return database && database.name;
        }).filter(Boolean);
      } catch (error) {
        indexedDbNames = null;
      }
    }

    let cacheNames = null;
    let cacheSupported = typeof caches !== 'undefined' && caches && typeof caches.keys === 'function';
    if (cacheSupported) {
      try {
        cacheNames = await caches.keys();
      } catch (error) {
        cacheNames = null;
      }
    }

    let serviceWorkers = {
      supported: typeof navigator !== 'undefined' && !!navigator.serviceWorker,
      controller: !!(navigator.serviceWorker && navigator.serviceWorker.controller),
      registrationsCount: null,
      scopes: []
    };

    if (navigator.serviceWorker && typeof navigator.serviceWorker.getRegistrations === 'function') {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        serviceWorkers.registrationsCount = registrations.length;
        serviceWorkers.scopes = registrations.map(function (registration) {
          return registration.scope;
        }).slice(0, 10);
      } catch (error) {
        serviceWorkers.registrationsCount = null;
      }
    }

    return {
      localStorage: {
        accessible: typeof localStorage !== 'undefined',
        keys: safeKeys(localStorage)
      },
      sessionStorage: {
        accessible: typeof sessionStorage !== 'undefined',
        keys: safeKeys(sessionStorage)
      },
      indexedDB: {
        supported: indexedDbSupported,
        databases: indexedDbNames,
        note: indexedDbSupported && typeof indexedDB.databases !== 'function' ? 'indexedDB.databases() is not supported in this browser context.' : null
      },
      cacheStorage: {
        supported: cacheSupported,
        names: cacheNames,
        note: cacheSupported ? null : 'Cache Storage enumeration is unavailable in this browser context.'
      },
      serviceWorkers: serviceWorkers
    };
  }

  function detectWeb3() {
    const providers = [];
    const libraries = [];
    const signals = [];

    if (global.ethereum) {
      signals.push('window.ethereum present');
      if (global.ethereum.isMetaMask) {
        providers.push({ name: 'MetaMask', reason: 'window.ethereum.isMetaMask === true' });
      }
      if (global.ethereum.isCoinbaseWallet) {
        providers.push({ name: 'Coinbase Wallet', reason: 'window.ethereum.isCoinbaseWallet === true' });
      }
      if (global.ethereum.isPhantom) {
        providers.push({ name: 'Phantom (EVM)', reason: 'window.ethereum.isPhantom === true' });
      }
      if (global.ethereum.isWalletConnect || global.ethereum.connector && /walletconnect/i.test(global.ethereum.connector.name || '')) {
        providers.push({ name: 'WalletConnect', reason: 'WalletConnect-like provider marker found on window.ethereum' });
      }
      if (Array.isArray(global.ethereum.providers)) {
        global.ethereum.providers.forEach(function (provider) {
          if (provider && provider.isMetaMask) {
            providers.push({ name: 'MetaMask', reason: 'window.ethereum.providers contains MetaMask-like provider' });
          }
          if (provider && provider.isCoinbaseWallet) {
            providers.push({ name: 'Coinbase Wallet', reason: 'window.ethereum.providers contains Coinbase provider' });
          }
        });
      }
    }

    if (global.phantom && global.phantom.solana && global.phantom.solana.isPhantom || global.solana && global.solana.isPhantom) {
      providers.push({ name: 'Phantom', reason: 'Phantom Solana provider marker detected' });
    }

    if (global.ethers) {
      libraries.push({ name: 'ethers.js', reason: 'window.ethers detected' });
    }
    if (global.viem) {
      libraries.push({ name: 'viem', reason: 'window.viem detected' });
    }
    if (global.Web3) {
      libraries.push({ name: 'web3.js', reason: 'window.Web3 detected' });
    }
    if (global.wagmi || global.__wagmi) {
      libraries.push({ name: 'wagmi', reason: 'wagmi runtime marker detected' });
    }

    state.networkEvents.forEach(function (event) {
      if (event.requestPayloadPreview) {
        if (/ethers/i.test(event.requestPayloadPreview)) {
          libraries.push({ name: 'ethers.js', reason: 'Observed ethers-like network payload marker' });
        }
        if (/walletconnect/i.test(event.requestPayloadPreview)) {
          providers.push({ name: 'WalletConnect', reason: 'Observed WalletConnect marker in runtime payload' });
        }
      }
    });

    return {
      providers: shared.unique(providers.map(function (provider) {
        return provider.name + '|' + provider.reason;
      })).map(function (entry) {
        const parts = entry.split('|');
        return { name: parts[0], reason: parts[1] };
      }),
      libraries: shared.unique(libraries.map(function (library) {
        return library.name + '|' + library.reason;
      })).map(function (entry) {
        const parts = entry.split('|');
        return { name: parts[0], reason: parts[1] };
      }),
      rpcMethodsObserved: shared.unique(state.networkEvents.reduce(function (allMethods, event) {
        return allMethods.concat(event.rpcMethods || []);
      }, [])),
      signals: signals
    };
  }

  function summarizeApis(events) {
    const summary = {
      totalsByKind: {},
      restEndpoints: [],
      graphqlEndpoints: [],
      jsonRpcEndpoints: [],
      websocketUrls: [],
      sseUrls: []
    };
    const buckets = {
      REST: new Set(),
      GraphQL: new Set(),
      'JSON-RPC': new Set(),
      WebSocket: new Set(),
      SSE: new Set()
    };

    events.forEach(function (event) {
      const kind = event.inferredApiKind || 'REST';
      summary.totalsByKind[kind] = (summary.totalsByKind[kind] || 0) + 1;
      if (event.url && buckets[kind]) {
        buckets[kind].add(event.url);
      }
    });

    summary.restEndpoints = Array.from(buckets.REST);
    summary.graphqlEndpoints = Array.from(buckets.GraphQL);
    summary.jsonRpcEndpoints = Array.from(buckets['JSON-RPC']);
    summary.websocketUrls = Array.from(buckets.WebSocket);
    summary.sseUrls = Array.from(buckets.SSE);
    return summary;
  }

  async function buildSnapshot() {
    const frameworks = detectFrameworks();
    const storage = await collectStorage();
    const web3 = detectWeb3();
    const networkEvents = state.networkEvents.slice();

    return {
      frameworks: frameworks,
      storage: storage,
      network: {
        events: networkEvents,
        totals: {
          count: networkEvents.length,
          byKind: summarizeApis(networkEvents).totalsByKind
        },
        limitations: ['Only runtime activity observed after extension injection is available for fetch/XHR/WebSocket/EventSource instrumentation.']
      },
      apis: summarizeApis(networkEvents),
      web3: web3
    };
  }

  global.addEventListener('WIT_REQUEST_SNAPSHOT', function (event) {
    const requestId = event.detail && event.detail.requestId;
    buildSnapshot().then(function (payload) {
      global.postMessage({
        source: 'WIT_INJECTED',
        type: 'WIT_SNAPSHOT_RESPONSE',
        requestId: requestId,
        payload: payload
      }, '*');
    }).catch(function (error) {
      global.postMessage({
        source: 'WIT_INJECTED',
        type: 'WIT_SNAPSHOT_RESPONSE',
        requestId: requestId,
        payload: {
          frameworks: { detected: [], limitations: ['Page-context analysis failed: ' + (error && error.message ? error.message : String(error))] },
          storage: {},
          network: { events: [], totals: { count: 0 }, limitations: ['Page-context analysis failed.'] },
          apis: { totalsByKind: {} },
          web3: { providers: [], libraries: [], rpcMethodsObserved: [], signals: [] }
        }
      }, '*');
    });
  });

  patchFetch();
  patchXhr();
  patchWebSocket();
  patchEventSource();
  global.postMessage({
    source: 'WIT_INJECTED',
    type: 'WIT_INJECTED_READY'
  }, '*');
})(typeof globalThis !== 'undefined' ? globalThis : window);
