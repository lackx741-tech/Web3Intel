(function () {
  function classifyApiKind(event) {
    const type = (event.type || '').toLowerCase();
    const url = event.url || '';
    const method = (event.method || '').toUpperCase();
    const payloadString = typeof event.payload === 'string' ? event.payload : JSON.stringify(event.payload || {});

    if (type === 'websocket') return 'WebSocket';
    if (type === 'eventsource') return 'SSE';

    if (/graphql/i.test(url) || /"query"\s*:|"mutation"\s*:/i.test(payloadString)) {
      return 'GraphQL';
    }

    if (/"jsonrpc"\s*:\s*"2.0"/i.test(payloadString) || /eth_|wallet_|net_|web3_/i.test(payloadString)) {
      return 'JSON-RPC';
    }

    if (type === 'fetch' || type === 'xhr') {
      if (['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        return 'REST';
      }
    }

    return 'Unknown';
  }

  function summarizeApis(networkEvents) {
    const counts = {
      REST: 0,
      GraphQL: 0,
      'JSON-RPC': 0,
      WebSocket: 0,
      SSE: 0,
      Unknown: 0
    };

    for (const event of networkEvents || []) {
      const kind = classifyApiKind(event);
      counts[kind] += 1;
    }

    return counts;
  }

  function buildReport(input) {
    return {
      page: input.page,
      frameworks: input.frameworks,
      dom: input.dom,
      resources: input.resources,
      storage: input.storage,
      network: input.network,
      apis: input.apis,
      web3: input.web3,
      performance: input.performance,
      security: input.security,
      generatedAt: new Date().toISOString()
    };
  }

  window.WebsiteIntelModules = window.WebsiteIntelModules || {};
  window.WebsiteIntelModules.report = {
    buildReport,
    classifyApiKind,
    summarizeApis
  };
})();
