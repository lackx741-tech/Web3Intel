(function () {
  function count(selector) {
    return document.querySelectorAll(selector).length;
  }

  function sample(selector, attr) {
    return Array.from(document.querySelectorAll(selector))
      .slice(0, 8)
      .map((el) => {
        if (attr) {
          return el.getAttribute(attr) || '';
        }
        return (el.textContent || '').trim().slice(0, 80);
      })
      .filter(Boolean);
  }

  function detectOpenShadowRoots() {
    const openHosts = [];
    const allNodes = document.querySelectorAll('*');
    for (const node of allNodes) {
      if (node.shadowRoot && node.shadowRoot.mode === 'open') {
        openHosts.push(node.tagName.toLowerCase());
      }
    }
    return {
      count: openHosts.length,
      hosts: openHosts.slice(0, 20)
    };
  }

  function detectCustomElements() {
    const names = new Set();
    const allNodes = document.querySelectorAll('*');
    for (const node of allNodes) {
      const tag = node.tagName.toLowerCase();
      if (tag.includes('-')) {
        names.add(tag);
      }
    }
    return {
      count: names.size,
      elements: Array.from(names).slice(0, 50)
    };
  }

  function analyzeDom() {
    return {
      forms: { count: count('form') },
      buttons: { count: count('button') },
      inputs: { count: count('input, textarea, select') },
      dialogs: { count: count('dialog, [role="dialog"]') },
      tables: { count: count('table') },
      links: { count: count('a[href]'), samples: sample('a[href]', 'href') },
      images: { count: count('img'), samples: sample('img', 'src') },
      iframes: { count: count('iframe'), samples: sample('iframe', 'src') },
      scripts: { count: count('script[src]'), samples: sample('script[src]', 'src') },
      stylesheets: { count: count('link[rel="stylesheet"]'), samples: sample('link[rel="stylesheet"]', 'href') },
      customElements: detectCustomElements(),
      shadowRoots: detectOpenShadowRoots(),
      serviceWorker: {
        supported: 'serviceWorker' in navigator,
        controller: Boolean(navigator.serviceWorker && navigator.serviceWorker.controller)
      }
    };
  }

  window.WebsiteIntelModules = window.WebsiteIntelModules || {};
  window.WebsiteIntelModules.dom = {
    analyzeDom
  };
})();
