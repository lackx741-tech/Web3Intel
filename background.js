importScripts('modules/shared.js');

const reportsByTabId = new Map();

function isSupportedTab(tab) {
  return !!(tab && tab.id && typeof tab.url === 'string' && /^https?:\/\//i.test(tab.url));
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

async function ensureAnalysisScripts(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: ['modules/shared.js', 'modules/content-helpers.js', 'content.js']
  });
}

async function getCookiesForUrl(url) {
  try {
    const cookies = await chrome.cookies.getAll({ url: url });
    return cookies.map(function (cookie) {
      return {
        name: cookie.name,
        domain: cookie.domain,
        path: cookie.path,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite,
        session: cookie.session,
        expirationDate: cookie.expirationDate || null
      };
    });
  } catch (error) {
    return [];
  }
}

async function analyzeActiveTab() {
  const tab = await getActiveTab();
  if (!isSupportedTab(tab)) {
    throw new Error('Open an HTTP or HTTPS page before running analysis.');
  }

  await ensureAnalysisScripts(tab.id);

  const response = await chrome.tabs.sendMessage(tab.id, { type: 'WIT_BEGIN_ANALYSIS' });
  if (!response || !response.ok) {
    throw new Error(response && response.error ? response.error : 'The content script did not return a report. Reload the page and try again.');
  }

  const report = response.report;
  const cookies = await getCookiesForUrl(tab.url);
  report.security = Object.assign({}, report.security, {
    cookies: {
      source: 'chrome.cookies API',
      note: 'Only cookie names and flags are shown. HttpOnly cookies are not exposed via page JavaScript.',
      total: cookies.length,
      items: cookies
    }
  });
  report.page = Object.assign({}, report.page, {
    tabId: tab.id,
    favIconUrl: tab.favIconUrl || null
  });

  reportsByTabId.set(tab.id, report);
  return report;
}

chrome.tabs.onRemoved.addListener(function (tabId) {
  reportsByTabId.delete(tabId);
});

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (!message || !message.type) {
    return undefined;
  }

  if (message.type === 'WIT_ANALYZE_ACTIVE_TAB') {
    analyzeActiveTab().then(function (report) {
      sendResponse({ ok: true, report: report });
    }).catch(function (error) {
      sendResponse({ ok: false, error: error && error.message ? error.message : String(error) });
    });
    return true;
  }

  if (message.type === 'WIT_GET_LAST_REPORT') {
    getActiveTab().then(function (tab) {
      const report = tab ? reportsByTabId.get(tab.id) : null;
      sendResponse({ ok: true, report: report || null });
    });
    return true;
  }

  return undefined;
});
