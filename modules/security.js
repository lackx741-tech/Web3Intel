(function () {
  function getHost(urlValue) {
    try {
      return new URL(urlValue, location.href).hostname;
    } catch (error) {
      return '';
    }
  }

  function analyzeSecurity() {
    const currentHost = location.hostname;

    const scriptSources = Array.from(document.querySelectorAll('script[src]'))
      .map((script) => script.src)
      .filter(Boolean);

    const thirdPartyScripts = scriptSources.filter((src) => {
      const host = getHost(src);
      return host && host !== currentHost;
    });

    const mixedContentCandidates = [];
    if (location.protocol === 'https:') {
      const mixedSelectors = ['script[src]', 'img[src]', 'link[href]', 'iframe[src]', 'video[src]', 'audio[src]'];
      for (const selector of mixedSelectors) {
        const values = Array.from(document.querySelectorAll(selector))
          .map((el) => el.src || el.href)
          .filter((value) => typeof value === 'string' && value.startsWith('http://'));
        mixedContentCandidates.push(...values);
      }
    }

    const metaCsp = document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || null;

    let permissionsPolicy = null;
    try {
      if (document.permissionsPolicy && typeof document.permissionsPolicy.features === 'function') {
        permissionsPolicy = document.permissionsPolicy.features();
      } else if (document.featurePolicy && typeof document.featurePolicy.features === 'function') {
        permissionsPolicy = document.featurePolicy.features();
      }
    } catch (error) {
      permissionsPolicy = null;
    }

    const accessibleCookies = document.cookie
      ? document.cookie
          .split(';')
          .map((item) => item.trim().split('=')[0])
          .filter(Boolean)
      : [];

    return {
      thirdPartyScripts: {
        count: thirdPartyScripts.length,
        items: Array.from(new Set(thirdPartyScripts)).slice(0, 200)
      },
      mixedContent: {
        count: mixedContentCandidates.length,
        items: Array.from(new Set(mixedContentCandidates)).slice(0, 200)
      },
      cookies: {
        accessibleCount: accessibleCookies.length,
        names: accessibleCookies.slice(0, 200),
        note: 'Only cookies readable via document.cookie are visible. HttpOnly cookies are not exposed.'
      },
      csp: {
        metaTag: metaCsp,
        note: 'HTTP response header CSP is not directly readable from content scripts.'
      },
      permissionsPolicy: {
        value: permissionsPolicy,
        note: 'Only browser-exposed policy interfaces are visible from page context.'
      }
    };
  }

  window.WebsiteIntelModules = window.WebsiteIntelModules || {};
  window.WebsiteIntelModules.security = {
    analyzeSecurity
  };
})();
