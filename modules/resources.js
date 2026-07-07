(function () {
  function absoluteUrl(value) {
    if (!value) return '';
    try {
      return new URL(value, location.href).href;
    } catch (error) {
      return '';
    }
  }

  function collect(selector, attr) {
    return Array.from(document.querySelectorAll(selector))
      .map((el) => absoluteUrl(el.getAttribute(attr)))
      .filter(Boolean);
  }

  function unique(values) {
    return Array.from(new Set(values));
  }

  function analyzeResources() {
    const scripts = unique(collect('script[src]', 'src'));
    const stylesheets = unique(collect('link[rel="stylesheet"]', 'href'));
    const images = unique(collect('img[src], source[src], source[srcset]', 'src'));
    const videos = unique(collect('video[src], source[type^="video/"]', 'src'));

    const performanceEntries = performance.getEntriesByType('resource') || [];
    const fonts = unique(
      performanceEntries
        .filter((entry) => entry.initiatorType === 'css' || /\.(woff2?|ttf|otf)(\?|$)/i.test(entry.name))
        .map((entry) => entry.name)
    );

    const lazyImages = Array.from(document.querySelectorAll('img'))
      .filter((img) => img.loading === 'lazy' || img.hasAttribute('data-src') || img.hasAttribute('data-lazy-src'))
      .map((img) => absoluteUrl(img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-lazy-src')))
      .filter(Boolean);

    return {
      scripts: { count: scripts.length, items: scripts.slice(0, 200) },
      stylesheets: { count: stylesheets.length, items: stylesheets.slice(0, 200) },
      images: { count: images.length, items: images.slice(0, 200) },
      fonts: { count: fonts.length, items: fonts.slice(0, 200) },
      videos: { count: videos.length, items: videos.slice(0, 100) },
      lazyLoadedImages: { count: lazyImages.length, items: lazyImages.slice(0, 200) }
    };
  }

  window.WebsiteIntelModules = window.WebsiteIntelModules || {};
  window.WebsiteIntelModules.resources = {
    analyzeResources
  };
})();
