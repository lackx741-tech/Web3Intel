(function () {
  const statusEl = document.getElementById('status');
  const analyzeBtn = document.getElementById('analyzeBtn');
  const exportBtn = document.getElementById('exportBtn');

  const sectionIds = [
    'overview',
    'frameworks',
    'web3',
    'dom',
    'resources',
    'storage',
    'network',
    'apis',
    'performance',
    'security'
  ];

  function pretty(value) {
    return JSON.stringify(value, null, 2);
  }

  function setStatus(message, isError) {
    statusEl.textContent = message;
    statusEl.style.color = isError ? '#fca5a5' : '#94a3b8';
  }

  function sendMessage(payload) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(payload, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(response || { ok: false, error: 'No response.' });
      });
    });
  }

  function renderReport(report) {
    if (!report) {
      sectionIds.forEach((id) => {
        document.getElementById(id).textContent = 'No analysis yet.';
      });
      return;
    }

    const overview = {
      title: report.page?.title,
      url: report.page?.url,
      generatedAt: report.generatedAt,
      frameworks: report.frameworks?.detected || [],
      observedNetworkEvents: report.network?.observedCount || 0
    };

    document.getElementById('overview').textContent = pretty(overview);
    document.getElementById('frameworks').textContent = pretty(report.frameworks);
    document.getElementById('web3').textContent = pretty(report.web3);
    document.getElementById('dom').textContent = pretty(report.dom);
    document.getElementById('resources').textContent = pretty(report.resources);
    document.getElementById('storage').textContent = pretty(report.storage);
    document.getElementById('network').textContent = pretty(report.network);
    document.getElementById('apis').textContent = pretty(report.apis);
    document.getElementById('performance').textContent = pretty(report.performance);
    document.getElementById('security').textContent = pretty(report.security);
  }

  async function analyze() {
    setStatus('Running analysis...');
    const result = await sendMessage({ type: 'ANALYZE_ACTIVE_TAB' });
    if (!result.ok) {
      setStatus(`Analyze failed: ${result.error}`, true);
      return;
    }

    renderReport(result.report);
    setStatus('Analysis complete.');
  }

  async function refreshExisting() {
    const existing = await sendMessage({ type: 'GET_ACTIVE_TAB_DATA' });
    if (!existing.ok) {
      setStatus(`Unable to load existing data: ${existing.error}`, true);
      renderReport(null);
      return;
    }

    renderReport(existing.report);
    if (existing.report) {
      setStatus(`Loaded saved analysis (${existing.networkCount} runtime events).`);
    } else {
      setStatus('No saved analysis for this tab yet.');
    }
  }

  async function exportJson() {
    const result = await sendMessage({ type: 'EXPORT_ACTIVE_TAB_JSON' });
    if (!result.ok) {
      setStatus(result.error || 'Export failed.', true);
      return;
    }

    const blob = new Blob([pretty(result.report)], { type: 'application/json' });
    const blobUrl = URL.createObjectURL(blob);

    const rawTitle = result.report.page?.title || '';
    const sanitizedTitle = rawTitle
      .replace(/[^a-z0-9_-]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50)
      .toLowerCase();
    const filenameBase = sanitizedTitle || 'website-intel-report';

    chrome.downloads.download(
      {
        url: blobUrl,
        filename: `${filenameBase}.json`,
        saveAs: true
      },
      () => {
        URL.revokeObjectURL(blobUrl);
      }
    );

    setStatus('Export started.');
  }

  analyzeBtn.addEventListener('click', analyze);
  exportBtn.addEventListener('click', exportJson);

  refreshExisting();
})();
