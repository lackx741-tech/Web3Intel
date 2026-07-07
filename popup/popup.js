(function () {
  const analyzeButton = document.getElementById('analyzeButton');
  const exportButton = document.getElementById('exportButton');
  const statusElement = document.getElementById('status');
  const reportRoot = document.getElementById('reportRoot');
  let currentReport = null;

  function setStatus(message, isError) {
    statusElement.textContent = message;
    statusElement.classList.toggle('error', !!isError);
  }

  function getExportFilename(report) {
    const rawHostname = report && report.page && report.page.hostname ? report.page.hostname : 'site';
    return 'website-intelligence-' + rawHostname.replace(/[^a-z0-9.-]+/gi, '_') + '.json';
  }

  function renderReport(report) {
    currentReport = report;
    exportButton.disabled = !report;
    reportRoot.innerHTML = report ? WebsiteIntelPopupRenderer.renderReport(report) : '<p class="empty">No report yet.</p>';
  }

  async function analyze() {
    analyzeButton.disabled = true;
    exportButton.disabled = true;
    setStatus('Analyzing active tab…');

    try {
      const response = await chrome.runtime.sendMessage({ type: 'WIT_ANALYZE_ACTIVE_TAB' });
      if (!response || !response.ok) {
        throw new Error(response && response.error ? response.error : 'Analysis failed.');
      }
      renderReport(response.report);
      setStatus('Analysis complete.');
    } catch (error) {
      renderReport(null);
      setStatus(error && error.message ? error.message : String(error), true);
    } finally {
      analyzeButton.disabled = false;
      exportButton.disabled = !currentReport;
    }
  }

  function exportJson() {
    if (!currentReport) {
      return;
    }
    const blob = new Blob([JSON.stringify(currentReport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = getExportFilename(currentReport);
    anchor.click();
    URL.revokeObjectURL(url);
  }

  analyzeButton.addEventListener('click', analyze);
  exportButton.addEventListener('click', exportJson);

  chrome.runtime.sendMessage({ type: 'WIT_GET_LAST_REPORT' }).then(function (response) {
    if (response && response.ok && response.report) {
      renderReport(response.report);
      setStatus('Showing the last report for this tab.');
      return;
    }
    analyze();
  }).catch(function () {
    analyze();
  });
})();
