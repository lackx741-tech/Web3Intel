(function (global) {
  if (global.__WIT_CONTENT_INSTALLED__) {
    return;
  }
  global.__WIT_CONTENT_INSTALLED__ = true;

  const helpers = global.WebsiteIntelContentHelpers;
  const shared = global.WebsiteIntelShared;
  const pendingAnalyses = new Map();
  const INJECTED_SCRIPT_TIMEOUT_MS = 1000;
  const ANALYSIS_TIMEOUT_MS = 4000;
  let injectedReady = !!global.__WIT_PAGE_INSTALLED__;
  let injectedReadyResolver = null;
  let injectedReadyPromise = injectedReady ? Promise.resolve() : new Promise(function (resolve) {
    injectedReadyResolver = resolve;
  });

  if (!global.__WIT_CONTENT_STATE__) {
    global.__WIT_CONTENT_STATE__ = {
      performance: {
        lcp: null,
        cls: 0,
        longTaskCount: 0,
        longTaskTotal: 0,
        longestLongTask: 0,
        longTaskSamples: []
      }
    };
  }

  function updatePerformanceObservers() {
    const state = global.__WIT_CONTENT_STATE__.performance;

    if (typeof PerformanceObserver === 'undefined') {
      return;
    }

    try {
      const lcpObserver = new PerformanceObserver(function (entryList) {
        const entries = entryList.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          state.lcp = {
            startTime: lastEntry.startTime,
            size: lastEntry.size,
            url: lastEntry.url || null,
            element: lastEntry.element ? lastEntry.element.tagName.toLowerCase() : null
          };
        }
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (error) {
      // Browser support varies.
    }

    try {
      const clsObserver = new PerformanceObserver(function (entryList) {
        entryList.getEntries().forEach(function (entry) {
          if (!entry.hadRecentInput) {
            state.cls += entry.value;
          }
        });
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
    } catch (error) {
      // Browser support varies.
    }

    try {
      const longTaskObserver = new PerformanceObserver(function (entryList) {
        entryList.getEntries().forEach(function (entry) {
          state.longTaskCount += 1;
          state.longTaskTotal += entry.duration;
          state.longestLongTask = Math.max(state.longestLongTask, entry.duration);
          if (state.longTaskSamples.length < 10) {
            state.longTaskSamples.push({
              name: entry.name,
              duration: entry.duration,
              startTime: entry.startTime
            });
          }
        });
      });
      longTaskObserver.observe({ type: 'longtask', buffered: true });
    } catch (error) {
      // Browser support varies.
    }
  }

  updatePerformanceObservers();

  function injectPageScript() {
    if (document.documentElement && document.documentElement.dataset.witInjected === 'true') {
      injectedReady = true;
      if (injectedReadyResolver) {
        injectedReadyResolver();
        injectedReadyResolver = null;
      }
      return;
    }

    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected.js');
    script.async = false;
    script.dataset.websiteIntelInjected = 'true';
    script.onload = function () {
      if (document.documentElement) {
        document.documentElement.dataset.witInjected = 'true';
      }
      script.remove();
    };
    (document.head || document.documentElement || document.body).appendChild(script);
  }

  function waitForInjectedReady() {
    if (injectedReady) {
      return Promise.resolve();
    }

    return Promise.race([
      injectedReadyPromise,
      new Promise(function (resolve) {
        global.setTimeout(resolve, INJECTED_SCRIPT_TIMEOUT_MS);
      })
    ]);
  }

  function mergeFrameworks(pageFrameworks, domFrameworks) {
    const byName = new Map();

    function addFramework(framework) {
      if (!framework || !framework.name) {
        return;
      }

      const existing = byName.get(framework.name);
      if (!existing) {
        byName.set(framework.name, {
          name: framework.name,
          detected: true,
          confidence: framework.confidence || 'medium',
          reasons: Array.isArray(framework.reasons) ? framework.reasons.slice() : []
        });
        return;
      }

      existing.reasons = shared.unique(existing.reasons.concat(framework.reasons || []));
      if (framework.confidence === 'high' || existing.confidence !== 'high' && framework.confidence === 'medium') {
        existing.confidence = framework.confidence || existing.confidence;
      }
    }

    (pageFrameworks && pageFrameworks.detected || []).forEach(addFramework);
    (domFrameworks && domFrameworks.detected || []).forEach(addFramework);

    return {
      detected: Array.from(byName.values()),
      limitations: shared.unique([].concat(pageFrameworks && pageFrameworks.limitations || [], domFrameworks && domFrameworks.limitations || []))
    };
  }

  function buildApiSummary(networkEvents) {
    const totalsByKind = {};
    const endpointsByKind = {
      REST: new Set(),
      GraphQL: new Set(),
      'JSON-RPC': new Set(),
      WebSocket: new Set(),
      SSE: new Set()
    };

    (networkEvents || []).forEach(function (event) {
      const kind = event.inferredApiKind || 'REST';
      totalsByKind[kind] = (totalsByKind[kind] || 0) + 1;
      if (event.url && endpointsByKind[kind]) {
        endpointsByKind[kind].add(event.url);
      }
    });

    return {
      totalsByKind: totalsByKind,
      restEndpoints: Array.from(endpointsByKind.REST || []),
      graphqlEndpoints: Array.from(endpointsByKind.GraphQL || []),
      jsonRpcEndpoints: Array.from(endpointsByKind['JSON-RPC'] || []),
      websocketUrls: Array.from(endpointsByKind.WebSocket || []),
      sseUrls: Array.from(endpointsByKind.SSE || [])
    };
  }

  function analyzePageContext() {
    return new Promise(function (resolve, reject) {
      const requestId = 'wit-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      const timeoutId = global.setTimeout(function () {
        pendingAnalyses.delete(requestId);
        reject(new Error('Page-context analysis timed out after 4 seconds. Please reload the page and try again.'));
      }, ANALYSIS_TIMEOUT_MS);

      pendingAnalyses.set(requestId, function (payload) {
        global.clearTimeout(timeoutId);
        pendingAnalyses.delete(requestId);
        resolve(payload);
      });

      global.dispatchEvent(new CustomEvent('WIT_REQUEST_SNAPSHOT', {
        detail: { requestId: requestId }
      }));
    });
  }

  function buildReport(pageSnapshot) {
    const page = helpers.collectPage();
    const dom = helpers.collectDom();
    const resources = helpers.collectResources();
    const performance = helpers.collectPerformance();
    const security = helpers.collectSecurity();
    const frameworks = mergeFrameworks(pageSnapshot.frameworks, helpers.collectFrameworksFromDom());
    const networkEvents = pageSnapshot.network && pageSnapshot.network.events || [];

    return {
      page: page,
      frameworks: frameworks,
      dom: dom,
      resources: resources,
      storage: pageSnapshot.storage || {},
      network: pageSnapshot.network || {
        events: [],
        totals: { count: 0 }
      },
      apis: pageSnapshot.apis || buildApiSummary(networkEvents),
      web3: pageSnapshot.web3 || {},
      performance: performance,
      security: Object.assign({}, security, {
        serviceWorkers: pageSnapshot.storage && pageSnapshot.storage.serviceWorkers ? pageSnapshot.storage.serviceWorkers : null
      }),
      generatedAt: new Date().toISOString()
    };
  }

  function runAnalysis() {
    injectPageScript();
    return waitForInjectedReady().then(analyzePageContext).then(buildReport);
  }

  global.addEventListener('message', function (event) {
    if (event.source !== global || !event.data || event.data.source !== 'WIT_INJECTED') {
      return;
    }

    if (event.data.type === 'WIT_SNAPSHOT_RESPONSE') {
      const resolver = pendingAnalyses.get(event.data.requestId);
      if (resolver) {
        resolver(event.data.payload || {});
      }
      return;
    }

    if (event.data.type === 'WIT_INJECTED_READY') {
      injectedReady = true;
      if (injectedReadyResolver) {
        injectedReadyResolver();
        injectedReadyResolver = null;
      }
    }
  });

  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (!message || message.type !== 'WIT_BEGIN_ANALYSIS') {
      return undefined;
    }

    runAnalysis().then(function (report) {
      sendResponse({ ok: true, report: report });
    }).catch(function (error) {
      sendResponse({ ok: false, error: error && error.message ? error.message : String(error) });
    });

    return true;
  });

  injectPageScript();
})(typeof globalThis !== 'undefined' ? globalThis : window);
