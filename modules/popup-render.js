(function (global) {
  const shared = global.WebsiteIntelShared;

  function formatList(items, renderer) {
    if (!items || !items.length) {
      return '<p class="empty">None observed.</p>';
    }

    return '<ul class="pill-list">' + items.map(function (item) {
      return '<li>' + renderer(item) + '</li>';
    }).join('') + '</ul>';
  }

  function formatCountRows(counts) {
    return Object.keys(counts || {}).map(function (key) {
      return '<div class="stat"><span>' + shared.escapeHtml(key) + '</span><strong>' + shared.escapeHtml(counts[key]) + '</strong></div>';
    }).join('');
  }

  function card(title, body, subtitle) {
    return '<section class="card"><div class="card-header"><h2>' + shared.escapeHtml(title) + '</h2>' + (subtitle ? '<p>' + shared.escapeHtml(subtitle) + '</p>' : '') + '</div>' + body + '</section>';
  }

  function renderFrameworks(frameworks) {
    const detected = frameworks && frameworks.detected || [];
    return card(
      'Frameworks',
      formatList(detected, function (framework) {
        return '<strong>' + shared.escapeHtml(framework.name) + '</strong><span class="muted">' + shared.escapeHtml(framework.confidence) + '</span><div class="subtext">' + shared.escapeHtml((framework.reasons || []).join(' · ')) + '</div>';
      }) + formatList(frameworks && frameworks.limitations || [], function (item) {
        return '<span class="muted">Note:</span> ' + shared.escapeHtml(item);
      }),
      detected.length ? detected.length + ' detected' : 'No clear signals'
    );
  }

  function renderWeb3(web3) {
    return card(
      'Web3',
      '<div class="split">'
        + '<div><h3>Providers</h3>' + formatList(web3 && web3.providers || [], function (provider) {
          return '<strong>' + shared.escapeHtml(provider.name) + '</strong><div class="subtext">' + shared.escapeHtml(provider.reason) + '</div>';
        }) + '</div>'
        + '<div><h3>Libraries</h3>' + formatList(web3 && web3.libraries || [], function (library) {
          return '<strong>' + shared.escapeHtml(library.name) + '</strong><div class="subtext">' + shared.escapeHtml(library.reason) + '</div>';
        }) + '</div>'
      + '</div>'
      + '<h3>JSON-RPC Methods</h3>'
      + formatList(web3 && web3.rpcMethodsObserved || [], function (method) {
        return shared.escapeHtml(method);
      }),
      (web3 && web3.providers && web3.providers.length || 0) + ' providers · ' + (web3 && web3.libraries && web3.libraries.length || 0) + ' libraries'
    );
  }

  function renderResources(resources) {
    return card(
      'Resources',
      '<div class="stats-grid">' + formatCountRows(resources && resources.counts || {}) + '</div>'
      + '<h3>Scripts</h3>' + formatList(resources && resources.scripts || [], function (item) { return shared.escapeHtml(item); })
      + '<h3>Stylesheets</h3>' + formatList(resources && resources.stylesheets || [], function (item) { return shared.escapeHtml(item); })
      + '<h3>Fonts</h3>' + formatList(resources && resources.fonts || [], function (item) { return shared.escapeHtml(item); })
      + '<h3>Lazy Images</h3>' + formatList(resources && resources.lazyLoadedImages || [], function (item) {
        return shared.escapeHtml(item.src || 'Unknown source') + (item.loading ? '<span class="muted"> (' + shared.escapeHtml(item.loading) + ')</span>' : '');
      })
    );
  }

  function renderDom(dom) {
    return card(
      'DOM',
      '<div class="stats-grid">' + formatCountRows(dom && dom.counts || {}) + '</div>'
      + '<h3>Custom Elements</h3>' + formatList(dom && dom.samples && dom.samples.customElements || [], function (item) { return shared.escapeHtml(item); })
      + '<h3>Open Shadow Roots</h3>' + formatList(dom && dom.samples && dom.samples.openShadowRoots || [], function (item) {
        return '<strong>' + shared.escapeHtml(item.host) + '</strong><div class="subtext">Children: ' + shared.escapeHtml(item.childCount) + '</div>';
      })
    );
  }

  function renderStorage(storage) {
    const localStorageKeys = storage && storage.localStorage && storage.localStorage.keys || [];
    const sessionStorageKeys = storage && storage.sessionStorage && storage.sessionStorage.keys || [];
    const indexedDbNames = storage && storage.indexedDB && storage.indexedDB.databases || [];
    const cacheNames = storage && storage.cacheStorage && storage.cacheStorage.names || [];
    const serviceWorkers = storage && storage.serviceWorkers || {};

    return card(
      'Storage',
      '<div class="split">'
        + '<div><h3>localStorage</h3>' + formatList(localStorageKeys, function (item) { return shared.escapeHtml(item); }) + '</div>'
        + '<div><h3>sessionStorage</h3>' + formatList(sessionStorageKeys, function (item) { return shared.escapeHtml(item); }) + '</div>'
      + '</div>'
      + '<h3>IndexedDB</h3>' + formatList(indexedDbNames, function (item) { return shared.escapeHtml(item); })
      + '<h3>Cache Storage</h3>' + formatList(cacheNames, function (item) { return shared.escapeHtml(item); })
      + '<h3>Service Workers</h3>'
      + '<p class="subtext">Supported: ' + shared.escapeHtml(serviceWorkers.supported) + ' · Controller: ' + shared.escapeHtml(serviceWorkers.controller) + ' · Registrations: ' + shared.escapeHtml(serviceWorkers.registrationsCount == null ? 'Unknown' : serviceWorkers.registrationsCount) + '</p>'
      + formatList(serviceWorkers.scopes || [], function (item) { return shared.escapeHtml(item); })
    );
  }

  function renderNetwork(network, apis) {
    const totals = network && network.totals || {};
    return card(
      'Network & APIs',
      '<div class="stats-grid">'
        + '<div class="stat"><span>events</span><strong>' + shared.escapeHtml(totals.count || 0) + '</strong></div>'
        + formatCountRows(apis && apis.totalsByKind || {})
      + '</div>'
      + '<h3>Interesting Endpoints</h3>'
      + formatList([].concat(apis && apis.graphqlEndpoints || [], apis && apis.jsonRpcEndpoints || [], apis && apis.websocketUrls || [], apis && apis.sseUrls || [], apis && apis.restEndpoints || []).slice(0, 20), function (item) { return shared.escapeHtml(item); })
      + '<h3>Recent Events</h3>'
      + formatList(network && network.events || [], function (event) {
        return '<strong>' + shared.escapeHtml(event.inferredApiKind || event.type || 'Event') + '</strong> '
          + shared.escapeHtml(event.method || event.type || '')
          + '<div class="subtext">' + shared.escapeHtml(event.url || 'Unknown URL') + '</div>'
          + '<div class="subtext">Status: ' + shared.escapeHtml(event.status == null ? 'n/a' : event.status) + ' · Duration: ' + shared.escapeHtml(event.duration == null ? 'n/a' : Math.round(event.duration) + 'ms') + '</div>';
      })
      + formatList(network && network.limitations || [], function (item) {
        return '<span class="muted">Note:</span> ' + shared.escapeHtml(item);
      })
    );
  }

  function renderPerformance(performanceSection) {
    const navigation = performanceSection && performanceSection.navigation;
    const memory = performanceSection && performanceSection.memory;
    const longTasks = performanceSection && performanceSection.longTasks || {};

    return card(
      'Performance',
      '<div class="stats-grid">'
        + '<div class="stat"><span>LCP</span><strong>' + shared.escapeHtml(performanceSection && performanceSection.lcp ? Math.round(performanceSection.lcp.startTime) + 'ms' : 'n/a') + '</strong></div>'
        + '<div class="stat"><span>CLS</span><strong>' + shared.escapeHtml(performanceSection && performanceSection.cls != null ? performanceSection.cls.toFixed(3) : 'n/a') + '</strong></div>'
        + '<div class="stat"><span>Long tasks</span><strong>' + shared.escapeHtml(longTasks.count || 0) + '</strong></div>'
        + '<div class="stat"><span>Heap used</span><strong>' + shared.escapeHtml(memory ? shared.formatBytes(memory.usedJSHeapSize) : 'n/a') + '</strong></div>'
      + '</div>'
      + '<h3>Navigation</h3>'
      + '<p class="subtext">DOM interactive: ' + shared.escapeHtml(navigation ? Math.round(navigation.domInteractive) + 'ms' : 'n/a') + ' · Load end: ' + shared.escapeHtml(navigation ? Math.round(navigation.loadEventEnd) + 'ms' : 'n/a') + '</p>'
      + '<h3>Paint</h3>' + formatList(performanceSection && performanceSection.paint || [], function (item) {
        return shared.escapeHtml(item.name) + '<span class="muted"> ' + shared.escapeHtml(Math.round(item.startTime) + 'ms') + '</span>';
      })
      + formatList(performanceSection && performanceSection.limitations || [], function (item) {
        return '<span class="muted">Note:</span> ' + shared.escapeHtml(item);
      })
    );
  }

  function renderSecurity(security) {
    const cookies = security && security.cookies || { items: [] };
    return card(
      'Security',
      '<h3>Third-Party Scripts</h3>' + formatList(security && security.thirdPartyScripts || [], function (item) { return shared.escapeHtml(item); })
      + '<h3>Mixed Content</h3>' + formatList(security && security.mixedContentResources || [], function (item) { return shared.escapeHtml(item); })
      + '<h3>Cookies</h3>'
      + '<p class="subtext">' + shared.escapeHtml(cookies.note || 'Cookie names and flags only.') + '</p>'
      + formatList(cookies.items || [], function (item) {
        return '<strong>' + shared.escapeHtml(item.name) + '</strong><div class="subtext">'
          + shared.escapeHtml(item.domain + item.path)
          + ' · Secure: ' + shared.escapeHtml(item.secure)
          + ' · HttpOnly: ' + shared.escapeHtml(item.httpOnly)
          + ' · SameSite: ' + shared.escapeHtml(item.sameSite)
          + '</div>';
      })
      + '<h3>CSP</h3>' + formatList(security && security.csp && security.csp.meta || [], function (item) { return shared.escapeHtml(item); })
      + '<h3>Permissions Policy</h3>' + formatList(security && security.permissionsPolicy && security.permissionsPolicy.meta || [], function (item) { return shared.escapeHtml(item); })
    );
  }

  function renderOverview(report) {
    const frameworks = report.frameworks && report.frameworks.detected || [];
    const networkCount = report.network && report.network.totals && report.network.totals.count || 0;
    const cookieCount = report.security && report.security.cookies && report.security.cookies.total || 0;

    return card(
      'Overview',
      '<div class="stats-grid">'
        + '<div class="stat"><span>URL</span><strong>' + shared.escapeHtml(report.page && report.page.hostname || 'Unknown') + '</strong></div>'
        + '<div class="stat"><span>Frameworks</span><strong>' + shared.escapeHtml(frameworks.length) + '</strong></div>'
        + '<div class="stat"><span>Network events</span><strong>' + shared.escapeHtml(networkCount) + '</strong></div>'
        + '<div class="stat"><span>Cookies</span><strong>' + shared.escapeHtml(cookieCount) + '</strong></div>'
      + '</div>'
      + '<p class="subtext">Generated ' + shared.escapeHtml(report.generatedAt) + '</p>'
    );
  }

  function renderReport(report) {
    return [
      renderOverview(report),
      renderFrameworks(report.frameworks),
      renderWeb3(report.web3),
      renderResources(report.resources),
      renderDom(report.dom),
      renderStorage(report.storage),
      renderNetwork(report.network, report.apis),
      renderPerformance(report.performance),
      renderSecurity(report.security)
    ].join('');
  }

  global.WebsiteIntelPopupRenderer = {
    renderReport: renderReport
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
