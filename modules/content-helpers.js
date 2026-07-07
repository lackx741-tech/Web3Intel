(function (global) {
  const shared = global.WebsiteIntelShared;
  const SAMPLE_TEXT_LIMIT = 80;

  function sampleElements(elements, mapper, limit) {
    return Array.from(elements || []).slice(0, limit || 5).map(function (element) {
      try {
        return mapper(element);
      } catch (error) {
        return 'Unavailable sample';
      }
    });
  }

  function describeElement(element) {
    const parts = [element.tagName.toLowerCase()];
    if (element.id) {
      parts.push('#' + element.id);
    }
    const className = typeof element.className === 'string' ? element.className.trim() : '';
    if (className) {
      parts.push('.' + className.split(/\s+/).slice(0, 2).join('.'));
    }
    if (element.getAttribute('name')) {
      parts.push('[name="' + element.getAttribute('name') + '"]');
    }
    return parts.join('');
  }

  function collectPage() {
    return {
      url: location.href,
      origin: location.origin,
      hostname: location.hostname,
      protocol: location.protocol,
      title: document.title,
      lang: document.documentElement.lang || null,
      referrer: document.referrer || null,
      viewport: {
        width: global.innerWidth,
        height: global.innerHeight
      },
      readyState: document.readyState
    };
  }

  function findAttributeSignal(attributeMatcher) {
    const allElements = document.querySelectorAll('*');
    for (let index = 0; index < allElements.length; index += 1) {
      const element = allElements[index];
      for (let attrIndex = 0; attrIndex < element.attributes.length; attrIndex += 1) {
        const attribute = element.attributes[attrIndex];
        if (attributeMatcher(attribute, element)) {
          return true;
        }
      }
    }
    return false;
  }

  function collectFrameworksFromDom() {
    const scriptSources = Array.from(document.scripts).map(function (script) {
      return script.src || '';
    });

    const detectors = [
      {
        name: 'React',
        confidence: 'medium',
        matches: [
          document.querySelector('[data-reactroot], [data-reactid]') ? 'React root marker found in DOM' : null,
          scriptSources.some(function (src) { return /react/i.test(src); }) ? 'React-like script URL detected' : null
        ]
      },
      {
        name: 'Next.js',
        confidence: 'high',
        matches: [
          document.getElementById('__NEXT_DATA__') ? 'Next.js __NEXT_DATA__ script present' : null,
          scriptSources.some(function (src) { return /\/_next\//.test(src); }) ? 'Next.js asset path detected' : null
        ]
      },
      {
        name: 'Vue',
        confidence: 'medium',
        matches: [
          document.getElementById('__nuxt') ? 'Nuxt/Vue root element present' : null,
          findAttributeSignal(function (attribute) { return /^data-v-/.test(attribute.name); }) ? 'Vue scoped-style attributes detected' : null
        ]
      },
      {
        name: 'Angular',
        confidence: 'high',
        matches: [
          document.querySelector('[ng-version]') ? 'Angular ng-version attribute present' : null,
          document.querySelector('[ng-app]') ? 'Angular ng-app attribute present' : null
        ]
      },
      {
        name: 'Svelte',
        confidence: 'medium',
        matches: [
          findAttributeSignal(function (attribute, element) {
            return /^data-svelte/.test(attribute.name) || /(^|\s)svelte-[\w-]+/.test(element.className || '');
          }) ? 'Svelte-style markers detected' : null,
          scriptSources.some(function (src) { return /svelte/i.test(src); }) ? 'Svelte-like script URL detected' : null
        ]
      },
      {
        name: 'Preact',
        confidence: 'medium',
        matches: [
          scriptSources.some(function (src) { return /preact/i.test(src); }) ? 'Preact-like script URL detected' : null,
          document.querySelector('[data-preactroot]') ? 'Preact root marker found' : null
        ]
      },
      {
        name: 'Solid',
        confidence: 'medium',
        matches: [
          document.querySelector('[data-hk]') ? 'Solid hydration markers found' : null,
          scriptSources.some(function (src) { return /solid/i.test(src); }) ? 'Solid-like script URL detected' : null
        ]
      },
      {
        name: 'Astro',
        confidence: 'high',
        matches: [
          document.querySelector('astro-island') ? 'Astro island component found' : null,
          scriptSources.some(function (src) { return /\/_astro\//.test(src); }) ? 'Astro asset path detected' : null
        ]
      },
      {
        name: 'Nuxt',
        confidence: 'high',
        matches: [
          document.getElementById('__nuxt') ? 'Nuxt root element present' : null,
          scriptSources.some(function (src) { return /\/_nuxt\//.test(src); }) ? 'Nuxt asset path detected' : null
        ]
      }
    ];

    const detected = detectors.map(function (detector) {
      const reasons = detector.matches.filter(Boolean);
      return {
        name: detector.name,
        detected: reasons.length > 0,
        confidence: reasons.length > 1 ? 'high' : detector.confidence,
        reasons: reasons
      };
    }).filter(function (framework) {
      return framework.detected;
    });

    return {
      detected: detected,
      limitations: ['DOM heuristics can miss frameworks that remove markers during hydration or build-time optimization.']
    };
  }

  function collectShadowRoots() {
    const shadowHosts = [];
    const treeWalker = document.createTreeWalker(document.documentElement || document.body, NodeFilter.SHOW_ELEMENT);
    let currentNode = treeWalker.currentNode;

    while (currentNode) {
      if (currentNode.shadowRoot && currentNode.shadowRoot.mode === 'open') {
        shadowHosts.push({
          host: describeElement(currentNode),
          childCount: currentNode.shadowRoot.childElementCount
        });
      }
      currentNode = treeWalker.nextNode();
    }

    return shadowHosts;
  }

  function collectDom() {
    const buttons = document.querySelectorAll('button, input[type="button"], input[type="submit"], input[type="reset"]');
    const inputs = document.querySelectorAll('input, textarea, select');
    const links = document.querySelectorAll('a[href]');
    const images = document.querySelectorAll('img');
    const customElementNames = shared.unique(Array.from(document.querySelectorAll('*')).map(function (element) {
      return element.tagName.toLowerCase();
    }).filter(function (tagName) {
      return tagName.includes('-');
    }));
    const shadowRoots = collectShadowRoots();

    return {
      counts: {
        forms: document.forms.length,
        buttons: buttons.length,
        inputs: inputs.length,
        dialogs: document.querySelectorAll('dialog').length,
        tables: document.querySelectorAll('table').length,
        links: links.length,
        images: images.length,
        iframes: document.querySelectorAll('iframe').length,
        scripts: document.scripts.length,
        stylesheets: document.querySelectorAll('link[rel~="stylesheet"], style').length,
        customElements: customElementNames.length,
        openShadowRoots: shadowRoots.length
      },
      samples: {
        forms: sampleElements(document.forms, describeElement, 3),
        buttons: sampleElements(buttons, describeElement, 5),
        inputs: sampleElements(inputs, describeElement, 5),
        dialogs: sampleElements(document.querySelectorAll('dialog'), describeElement, 3),
        tables: sampleElements(document.querySelectorAll('table'), describeElement, 3),
        links: sampleElements(links, function (element) {
          return {
            text: (element.textContent || '').trim().slice(0, SAMPLE_TEXT_LIMIT) || 'No text',
            href: element.href
          };
        }, 5),
        images: sampleElements(images, function (element) {
          return {
            src: element.currentSrc || element.src,
            alt: element.alt || null,
            loading: element.loading || null
          };
        }, 5),
        iframes: sampleElements(document.querySelectorAll('iframe'), function (element) {
          return element.src || 'about:blank';
        }, 3),
        customElements: customElementNames.slice(0, 15),
        openShadowRoots: shadowRoots.slice(0, 10)
      }
    };
  }

  function collectResources() {
    const baseUrl = location.href;
    const performanceResources = typeof performance.getEntriesByType === 'function' ? performance.getEntriesByType('resource') : [];
    const performanceUrls = performanceResources.map(function (entry) {
      return entry.name;
    });
    const scripts = shared.unique(Array.from(document.querySelectorAll('script[src]')).map(function (element) {
      return shared.normalizeUrl(element.src, baseUrl);
    }).concat(performanceUrls.filter(function (url) {
      return /\.m?js(\?|$)|\/_next\/|\/_nuxt\/|\/_astro\//i.test(url);
    })));
    const stylesheets = shared.unique(Array.from(document.querySelectorAll('link[rel~="stylesheet"][href]')).map(function (element) {
      return shared.normalizeUrl(element.href, baseUrl);
    }).concat(performanceUrls.filter(function (url) {
      return /\.css(\?|$)/i.test(url);
    })));
    const images = shared.unique(Array.from(document.images).map(function (element) {
      return element.currentSrc || element.src;
    }).filter(Boolean).map(function (url) {
      return shared.normalizeUrl(url, baseUrl);
    }).concat(performanceUrls.filter(function (url) {
      return /\.(png|jpe?g|gif|svg|webp|avif)(\?|$)/i.test(url);
    })));
    const fonts = shared.unique(performanceUrls.filter(function (url) {
      return /\.(woff2?|ttf|otf|eot)(\?|$)/i.test(url);
    }));
    const lazyLoadedImages = Array.from(document.images).filter(function (element) {
      return element.loading === 'lazy' || element.hasAttribute('data-src') || element.hasAttribute('data-lazy-src');
    }).map(function (element) {
      return {
        src: element.currentSrc || element.src || element.getAttribute('data-src') || null,
        loading: element.loading || null
      };
    });

    return {
      counts: {
        scripts: scripts.length,
        stylesheets: stylesheets.length,
        images: images.length,
        fonts: fonts.length,
        lazyLoadedImages: lazyLoadedImages.length,
        iframes: document.querySelectorAll('iframe').length
      },
      scripts: scripts.slice(0, 50),
      stylesheets: stylesheets.slice(0, 50),
      images: images.slice(0, 50),
      fonts: fonts.slice(0, 50),
      lazyLoadedImages: lazyLoadedImages.slice(0, 20)
    };
  }

  function collectPerformance() {
    const state = global.__WIT_CONTENT_STATE__ || {};
    const metrics = state.performance || {};
    const navigationEntry = typeof performance.getEntriesByType === 'function' ? performance.getEntriesByType('navigation')[0] : null;
    const paintEntries = typeof performance.getEntriesByType === 'function' ? performance.getEntriesByType('paint') : [];
    const memory = performance.memory ? {
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
      totalJSHeapSize: performance.memory.totalJSHeapSize,
      usedJSHeapSize: performance.memory.usedJSHeapSize
    } : null;

    return {
      navigation: navigationEntry ? {
        type: navigationEntry.type,
        domComplete: navigationEntry.domComplete,
        domInteractive: navigationEntry.domInteractive,
        loadEventEnd: navigationEntry.loadEventEnd,
        responseEnd: navigationEntry.responseEnd,
        transferSize: navigationEntry.transferSize
      } : null,
      paint: paintEntries.map(function (entry) {
        return {
          name: entry.name,
          startTime: entry.startTime
        };
      }),
      lcp: metrics.lcp || null,
      cls: typeof metrics.cls === 'number' ? metrics.cls : null,
      longTasks: {
        count: metrics.longTaskCount || 0,
        totalDuration: metrics.longTaskTotal || 0,
        longestDuration: metrics.longestLongTask || 0,
        samples: (metrics.longTaskSamples || []).slice(0, 10)
      },
      memory: memory,
      limitations: ['Performance metrics depend on browser support and when the extension began observing the page.']
    };
  }

  function collectSecurity() {
    const baseUrl = location.href;
    const scriptUrls = Array.from(document.querySelectorAll('script[src]')).map(function (element) {
      return element.src;
    }).filter(Boolean);
    const mixedContentResources = Array.from(document.querySelectorAll('[src], [href]')).map(function (element) {
      return element.getAttribute('src') || element.getAttribute('href');
    }).filter(function (url) {
      return location.protocol === 'https:' && /^http:\/\//i.test(url || '');
    });

    return {
      thirdPartyScripts: scriptUrls.filter(function (url) {
        return shared.isThirdPartyUrl(url, baseUrl);
      }).slice(0, 50),
      mixedContentResources: shared.unique(mixedContentResources).slice(0, 50),
      csp: {
        meta: sampleElements(document.querySelectorAll('meta[http-equiv="Content-Security-Policy"], meta[http-equiv="content-security-policy"]'), function (element) {
          return element.getAttribute('content') || '';
        }, 5),
        note: 'Only DOM-observable CSP data is available from the page without privileged response-header access.'
      },
      permissionsPolicy: {
        meta: sampleElements(document.querySelectorAll('meta[http-equiv="Permissions-Policy"], meta[http-equiv="permissions-policy"]'), function (element) {
          return element.getAttribute('content') || '';
        }, 5),
        note: 'Only DOM-observable Permissions Policy data is reported here.'
      },
      pageAccessibleCookieNames: shared.unique((document.cookie || '').split(';').map(function (entry) {
        return entry.trim().split('=')[0];
      }).filter(Boolean))
    };
  }

  global.WebsiteIntelContentHelpers = {
    collectDom: collectDom,
    collectFrameworksFromDom: collectFrameworksFromDom,
    collectPage: collectPage,
    collectPerformance: collectPerformance,
    collectResources: collectResources,
    collectSecurity: collectSecurity
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
