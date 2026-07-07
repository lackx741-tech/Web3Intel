(function () {
  const MAX_TEXT_LENGTH = 2000;

  function safeStringify(value) {
    try {
      if (typeof value === 'string') {
        return value.slice(0, MAX_TEXT_LENGTH);
      }
      return JSON.stringify(value).slice(0, MAX_TEXT_LENGTH);
    } catch (error) {
      return String(value).slice(0, MAX_TEXT_LENGTH);
    }
  }

  function emit(eventType, detail) {
    window.dispatchEvent(
      new CustomEvent('website-intel-page-event', {
        detail: {
          eventType,
          ...detail,
          timestamp: Date.now()
        }
      })
    );
  }

  function classifyPayload(payload) {
    const serialized = safeStringify(payload);
    if (/"jsonrpc"\s*:\s*"2.0"/i.test(serialized) || /"method"\s*:\s*"(eth_|wallet_|net_|web3_)/i.test(serialized)) {
      return 'json-rpc-like';
    }
    if (/"query"\s*:|"mutation"\s*:/i.test(serialized)) {
      return 'graphql-like';
    }
    return 'generic';
  }

  function detectPageWeb3() {
    const ethereum = window.ethereum || null;
    const providers = (ethereum && ethereum.providers) || [];

    const providerSignals = {
      metaMask: Boolean(ethereum && ethereum.isMetaMask),
      coinbaseWallet: Boolean(ethereum && (ethereum.isCoinbaseWallet || ethereum.isCoinbaseBrowser)),
      phantom: Boolean(window.phantom?.ethereum || window.phantom?.solana || ethereum?.isPhantom),
      walletConnect: Boolean(window.WalletConnect || window.walletConnectProvider || providers.some((p) => p?.isWalletConnect))
    };

    const librarySignals = {
      ethers: Boolean(window.ethers),
      viem: Boolean(window.viem),
      web3js: Boolean(window.Web3 || window.web3),
      wagmi: Boolean(window.wagmi || window.__wagmi)
    };

    const frameworks = {
      react: Boolean(window.__REACT_DEVTOOLS_GLOBAL_HOOK__),
      next: Boolean(window.__NEXT_DATA__),
      vue: Boolean(window.__VUE__),
      angular: Boolean(window.ng),
      svelte: Boolean(window.__SVELTE_DEVTOOLS_GLOBAL_HOOK__),
      preact: Boolean(window.__PREACT_DEVTOOLS__),
      solid: Boolean(window.__SOLID_DEVTOOLS__),
      astro: Boolean(window.Astro),
      nuxt: Boolean(window.__NUXT__)
    };

    emit('PAGE_DETECTION', {
      web3: providerSignals,
      libraries: librarySignals,
      frameworks
    });
  }

  function patchFetch() {
    if (typeof window.fetch !== 'function' || window.fetch.__websiteIntelPatched) return;

    const originalFetch = window.fetch;
    const patchedFetch = async function (...args) {
      const request = args[0] || {};
      const options = args[1] || {};
      const url = typeof request === 'string' ? request : request.url;
      const method = (options.method || request.method || 'GET').toUpperCase();
      const payload = options.body || null;
      const startedAt = performance.now();

      try {
        const response = await originalFetch.apply(this, args);
        emit('NETWORK_EVENT', {
          type: 'fetch',
          url,
          method,
          status: response.status,
          duration: Number((performance.now() - startedAt).toFixed(2)),
          payload: payload ? safeStringify(payload) : null,
          payloadKind: classifyPayload(payload),
          responseType: response.type
        });
        return response;
      } catch (error) {
        emit('NETWORK_EVENT', {
          type: 'fetch',
          url,
          method,
          status: 'error',
          duration: Number((performance.now() - startedAt).toFixed(2)),
          payload: payload ? safeStringify(payload) : null,
          payloadKind: classifyPayload(payload),
          error: String(error)
        });
        throw error;
      }
    };

    patchedFetch.__websiteIntelPatched = true;
    window.fetch = patchedFetch;
  }

  function patchXhr() {
    const proto = window.XMLHttpRequest && window.XMLHttpRequest.prototype;
    if (!proto || proto.__websiteIntelPatched) return;

    const originalOpen = proto.open;
    const originalSend = proto.send;

    proto.open = function (method, url) {
      this.__websiteIntelMethod = method;
      this.__websiteIntelUrl = url;
      return originalOpen.apply(this, arguments);
    };

    proto.send = function (body) {
      const startedAt = performance.now();
      this.addEventListener('loadend', () => {
        emit('NETWORK_EVENT', {
          type: 'xhr',
          url: this.__websiteIntelUrl,
          method: (this.__websiteIntelMethod || 'GET').toUpperCase(),
          status: this.status,
          duration: Number((performance.now() - startedAt).toFixed(2)),
          payload: body ? safeStringify(body) : null,
          payloadKind: classifyPayload(body)
        });
      });
      return originalSend.apply(this, arguments);
    };

    proto.__websiteIntelPatched = true;
  }

  function patchWebSocket() {
    const OriginalWebSocket = window.WebSocket;
    if (!OriginalWebSocket || OriginalWebSocket.__websiteIntelPatched) return;

    const PatchedWebSocket = function (...args) {
      const ws = new OriginalWebSocket(...args);
      emit('NETWORK_EVENT', {
        type: 'websocket',
        url: args[0],
        method: 'CONNECT',
        status: 'opening'
      });

      const originalSend = ws.send;
      ws.send = function (data) {
        emit('NETWORK_EVENT', {
          type: 'websocket',
          url: args[0],
          method: 'SEND',
          payload: safeStringify(data),
          payloadKind: classifyPayload(data)
        });
        return originalSend.apply(this, arguments);
      };

      ws.addEventListener('open', () => {
        emit('NETWORK_EVENT', {
          type: 'websocket',
          url: args[0],
          method: 'OPEN',
          status: 'open'
        });
      });

      ws.addEventListener('close', () => {
        emit('NETWORK_EVENT', {
          type: 'websocket',
          url: args[0],
          method: 'CLOSE',
          status: 'closed'
        });
      });

      return ws;
    };

    PatchedWebSocket.prototype = OriginalWebSocket.prototype;
    PatchedWebSocket.__websiteIntelPatched = true;
    window.WebSocket = PatchedWebSocket;
  }

  function patchEventSource() {
    const OriginalEventSource = window.EventSource;
    if (!OriginalEventSource || OriginalEventSource.__websiteIntelPatched) return;

    const PatchedEventSource = function (...args) {
      const source = new OriginalEventSource(...args);

      emit('NETWORK_EVENT', {
        type: 'eventsource',
        url: args[0],
        method: 'CONNECT',
        status: 'opening'
      });

      source.addEventListener('open', () => {
        emit('NETWORK_EVENT', {
          type: 'eventsource',
          url: args[0],
          method: 'OPEN',
          status: 'open'
        });
      });

      source.addEventListener('error', () => {
        emit('NETWORK_EVENT', {
          type: 'eventsource',
          url: args[0],
          method: 'ERROR',
          status: 'error'
        });
      });

      return source;
    };

    PatchedEventSource.prototype = OriginalEventSource.prototype;
    PatchedEventSource.__websiteIntelPatched = true;
    window.EventSource = PatchedEventSource;
  }

  try {
    patchFetch();
    patchXhr();
    patchWebSocket();
    patchEventSource();
    detectPageWeb3();
  } catch (error) {
    emit('NETWORK_EVENT', {
      type: 'instrumentation',
      status: 'error',
      error: String(error)
    });
  }
})();
