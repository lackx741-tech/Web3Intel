(function () {
  const perfState = {
    lcp: null,
    cls: 0,
    longTaskCount: 0,
    longTaskTotalDuration: 0
  };

  function observePerformance() {
    if (!('PerformanceObserver' in window)) return;

    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        if (entries.length) {
          perfState.lcp = entries[entries.length - 1].startTime;
        }
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (error) {
      // ignored intentionally
    }

    try {
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            perfState.cls += entry.value;
          }
        }
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
    } catch (error) {
      // ignored intentionally
    }

    try {
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          perfState.longTaskCount += 1;
          perfState.longTaskTotalDuration += entry.duration;
        }
      });
      longTaskObserver.observe({ type: 'longtask', buffered: true });
    } catch (error) {
      // ignored intentionally
    }
  }

  function analyzePerformance() {
    const navigation = performance.getEntriesByType('navigation')[0] || null;
    const paintEntries = performance.getEntriesByType('paint') || [];

    const paint = {
      firstPaint: null,
      firstContentfulPaint: null
    };

    for (const entry of paintEntries) {
      if (entry.name === 'first-paint') {
        paint.firstPaint = entry.startTime;
      }
      if (entry.name === 'first-contentful-paint') {
        paint.firstContentfulPaint = entry.startTime;
      }
    }

    const memory = performance.memory
      ? {
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          usedJSHeapSize: performance.memory.usedJSHeapSize
        }
      : null;

    return {
      navigation: navigation
        ? {
            type: navigation.type,
            domContentLoaded: navigation.domContentLoadedEventEnd,
            loadEventEnd: navigation.loadEventEnd,
            duration: navigation.duration
          }
        : null,
      paint,
      lcp: perfState.lcp,
      cls: Number(perfState.cls.toFixed(4)),
      longTasks: {
        count: perfState.longTaskCount,
        totalDuration: Number(perfState.longTaskTotalDuration.toFixed(2))
      },
      memory
    };
  }

  window.WebsiteIntelModules = window.WebsiteIntelModules || {};
  window.WebsiteIntelModules.performance = {
    observePerformance,
    analyzePerformance
  };
})();
