const MAX_NETWORK_EVENTS = 500;

const state = {
  analysesByTab: {},
  networkByTab: {},
  pageSignalsByTab: {}
};

function storageGet(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (result) => resolve(result || {}));
  });
}

function storageSet(value) {
  return new Promise((resolve) => {
    chrome.storage.local.set(value, () => resolve());
  });
}

function tabKey(prefix, tabId) {
  return `${prefix}:${tabId}`;
}

async function loadTabState(tabId) {
  const keys = [tabKey('analysis', tabId), tabKey('network', tabId), tabKey('signal', tabId)];
  const stored = await storageGet(keys);

  state.analysesByTab[tabId] = stored[tabKey('analysis', tabId)] || null;
  state.networkByTab[tabId] = stored[tabKey('network', tabId)] || [];
  state.pageSignalsByTab[tabId] = stored[tabKey('signal', tabId)] || {};
}

async function persistTabState(tabId) {
  await storageSet({
    [tabKey('analysis', tabId)]: state.analysesByTab[tabId] || null,
    [tabKey('network', tabId)]: state.networkByTab[tabId] || [],
    [tabKey('signal', tabId)]: state.pageSignalsByTab[tabId] || {}
  });
}

function getActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs[0] || null));
  });
}

function sendTabMessage(tabId, payload) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, payload, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response || { ok: false, error: 'No response from content script.' });
    });
  });
}

function classifyApiKind(event) {
  const type = (event.type || '').toLowerCase();
  const url = event.url || '';
  const payloadText = typeof event.payload === 'string' ? event.payload : JSON.stringify(event.payload || {});

  if (type === 'websocket') return 'WebSocket';
  if (type === 'eventsource') return 'SSE';
  if (/graphql/i.test(url) || /"query"\s*:|"mutation"\s*:/i.test(payloadText)) return 'GraphQL';
  if (/"jsonrpc"\s*:\s*"2.0"|"method"\s*:\s*"(eth_|wallet_|net_|web3_)/i.test(payloadText)) return 'JSON-RPC';
  if (type === 'fetch' || type === 'xhr') return 'REST';
  return 'Unknown';
}

function summarizeApis(events) {
  const summary = {
    REST: 0,
    GraphQL: 0,
    'JSON-RPC': 0,
    WebSocket: 0,
    SSE: 0,
    Unknown: 0
  };

  for (const event of events || []) {
    const kind = classifyApiKind(event);
    summary[kind] += 1;
  }

  return summary;
}

function mergeSignalsIntoReport(report, signal) {
  if (!report) return report;

  const merged = { ...report };
  const web3 = signal?.web3 || {};
  const libraries = signal?.libraries || {};

  merged.web3 = merged.web3 || {};
  merged.web3.providers = {
    ...(merged.web3.providers || {}),
    metaMask: Boolean(merged.web3.providers?.metaMask || web3.metaMask),
    coinbaseWallet: Boolean(merged.web3.providers?.coinbaseWallet || web3.coinbaseWallet),
    phantom: Boolean(merged.web3.providers?.phantom || web3.phantom),
    walletConnect: Boolean(merged.web3.providers?.walletConnect || web3.walletConnect)
  };

  merged.web3.libraries = {
    ...(merged.web3.libraries || {}),
    ethers: Boolean(merged.web3.libraries?.ethers || libraries.ethers),
    viem: Boolean(merged.web3.libraries?.viem || libraries.viem),
    web3js: Boolean(merged.web3.libraries?.web3js || libraries.web3js),
    wagmi: Boolean(merged.web3.libraries?.wagmi || libraries.wagmi)
  };

  return merged;
}

async function runAnalysisOnActiveTab() {
  const tab = await getActiveTab();
  if (!tab || !tab.id) {
    return { ok: false, error: 'No active tab found.' };
  }

  const tabId = tab.id;

  if (!state.networkByTab[tabId]) {
    await loadTabState(tabId);
  }

  const response = await sendTabMessage(tabId, { type: 'ANALYZE_PAGE' });
  if (!response || !response.ok) {
    return { ok: false, error: response?.error || 'Analysis failed.' };
  }

  const networkEvents = state.networkByTab[tabId] || [];
  let report = {
    ...response.report,
    network: {
      observedCount: networkEvents.length,
      events: networkEvents.slice(-300)
    },
    apis: summarizeApis(networkEvents)
  };

  report = mergeSignalsIntoReport(report, state.pageSignalsByTab[tabId]);
  state.analysesByTab[tabId] = report;
  await persistTabState(tabId);

  return { ok: true, tabId, report };
}

async function getActiveTabData() {
  const tab = await getActiveTab();
  if (!tab || !tab.id) {
    return { ok: false, error: 'No active tab found.' };
  }

  const tabId = tab.id;
  if (!state.analysesByTab[tabId] && !state.networkByTab[tabId]) {
    await loadTabState(tabId);
  }

  return {
    ok: true,
    tabId,
    report: state.analysesByTab[tabId] || null,
    networkCount: (state.networkByTab[tabId] || []).length
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return undefined;

  if (message.type === 'NETWORK_EVENT') {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ ok: false, error: 'Missing sender tab.' });
      return undefined;
    }

    state.networkByTab[tabId] = state.networkByTab[tabId] || [];
    state.networkByTab[tabId].push(message.event);
    if (state.networkByTab[tabId].length > MAX_NETWORK_EVENTS) {
      state.networkByTab[tabId] = state.networkByTab[tabId].slice(-MAX_NETWORK_EVENTS);
    }

    persistTabState(tabId).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === 'PAGE_SIGNAL') {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ ok: false, error: 'Missing sender tab.' });
      return undefined;
    }

    state.pageSignalsByTab[tabId] = message.signal || {};
    persistTabState(tabId).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === 'ANALYZE_ACTIVE_TAB') {
    runAnalysisOnActiveTab().then(sendResponse);
    return true;
  }

  if (message.type === 'GET_ACTIVE_TAB_DATA') {
    getActiveTabData().then(sendResponse);
    return true;
  }

  if (message.type === 'EXPORT_ACTIVE_TAB_JSON') {
    getActiveTabData().then((result) => {
      if (!result.ok || !result.report) {
        sendResponse({ ok: false, error: 'No analysis available for export. Run Analyze first.' });
        return;
      }
      sendResponse({ ok: true, report: result.report });
    });
    return true;
  }

  return undefined;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  delete state.analysesByTab[tabId];
  delete state.networkByTab[tabId];
  delete state.pageSignalsByTab[tabId];

  chrome.storage.local.remove([tabKey('analysis', tabId), tabKey('network', tabId), tabKey('signal', tabId)]);
});
