(function () {
  const modules = window.WebsiteIntelModules || {};
  const runtimeEvents = [];
  let latestPageSignals = {
    web3: {},
    libraries: {},
    frameworks: {}
  };
  const frameworkDisplayName = {
    react: 'React',
    next: 'Next.js',
    vue: 'Vue',
    angular: 'Angular',
    svelte: 'Svelte',
    preact: 'Preact',
    solid: 'Solid',
    astro: 'Astro',
    nuxt: 'Nuxt'
  };

  if (modules.performance && typeof modules.performance.observePerformance === 'function') {
    modules.performance.observePerformance();
  }

  function injectPageScript() {
    if (document.documentElement?.dataset.websiteIntelInjected === '1') {
      return;
    }

    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected.js');
    script.async = false;
    script.onload = () => {
      script.remove();
    };
    (document.head || document.documentElement).appendChild(script);
    document.documentElement.dataset.websiteIntelInjected = '1';
  }

  function handlePageEvent(event) {
    const detail = event.detail || {};

    if (detail.eventType === 'NETWORK_EVENT') {
      const networkEvent = {
        ...detail,
        eventType: undefined
      };
      runtimeEvents.push(networkEvent);
      if (runtimeEvents.length > 500) runtimeEvents.shift();

      chrome.runtime.sendMessage({
        type: 'NETWORK_EVENT',
        event: networkEvent
      });
      return;
    }

    if (detail.eventType === 'PAGE_DETECTION') {
      latestPageSignals = {
        web3: detail.web3 || {},
        libraries: detail.libraries || {},
        frameworks: detail.frameworks || {}
      };

      chrome.runtime.sendMessage({
        type: 'PAGE_SIGNAL',
        signal: latestPageSignals
      });
    }
  }

  function pageSummary() {
    return {
      url: location.href,
      title: document.title,
      origin: location.origin,
      protocol: location.protocol,
      timestamp: new Date().toISOString()
    };
  }

  function getWeb3Snapshot() {
    return {
      providers: {
        metaMask: Boolean(latestPageSignals.web3.metaMask),
        coinbaseWallet: Boolean(latestPageSignals.web3.coinbaseWallet),
        phantom: Boolean(latestPageSignals.web3.phantom),
        walletConnect: Boolean(latestPageSignals.web3.walletConnect)
      },
      libraries: {
        ethers: Boolean(latestPageSignals.libraries.ethers),
        viem: Boolean(latestPageSignals.libraries.viem),
        web3js: Boolean(latestPageSignals.libraries.web3js),
        wagmi: Boolean(latestPageSignals.libraries.wagmi)
      },
      note: 'Provider and library detection depends on globals available when instrumentation is injected.'
    };
  }

  async function runAnalysis() {
    injectPageScript();

    const frameworks = modules.framework.detectFrameworks();
    const dom = modules.dom.analyzeDom();
    const resources = modules.resources.analyzeResources();
    const storage = await modules.storage.analyzeStorage();
    const performanceData = modules.performance.analyzePerformance();
    const security = modules.security.analyzeSecurity();

    const web3 = getWeb3Snapshot();
    const network = {
      observedCount: runtimeEvents.length,
      events: runtimeEvents.slice(-300)
    };

    const apis = modules.report.summarizeApis(network.events);

    const pageFrameworks = Object.entries(latestPageSignals.frameworks || {})
      .filter((entry) => entry[1])
      .map((entry) => entry[0]);

    frameworks.detected = Array.from(
      new Set(
        frameworks.detected.concat(
          pageFrameworks.map((name) => frameworkDisplayName[name] || name)
        )
      )
    );

    return modules.report.buildReport({
      page: pageSummary(),
      frameworks,
      dom,
      resources,
      storage,
      network,
      apis,
      web3,
      performance: performanceData,
      security
    });
  }

  window.addEventListener('website-intel-page-event', handlePageEvent, false);
  injectPageScript();

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.type) return undefined;

    if (message.type === 'ANALYZE_PAGE') {
      runAnalysis()
        .then((report) => sendResponse({ ok: true, report }))
        .catch((error) => sendResponse({ ok: false, error: String(error) }));
      return true;
    }

    if (message.type === 'GET_RUNTIME_EVENTS') {
      sendResponse({ ok: true, events: runtimeEvents.slice(-300), latestPageSignals });
    }

    return undefined;
  });
})();
