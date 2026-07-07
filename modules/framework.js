(function () {
  function detectFrameworks() {
    const html = document.documentElement?.outerHTML || '';
    const scriptText = Array.from(document.scripts || [])
      .slice(0, 30)
      .map((script) => script.textContent || '')
      .join('\n');

    const checks = [
      {
        name: 'React',
        detected:
          Boolean(window.__REACT_DEVTOOLS_GLOBAL_HOOK__) ||
          Boolean(document.querySelector('[data-reactroot], [data-reactid]')) ||
          /react/i.test(html)
      },
      {
        name: 'Next.js',
        detected:
          Boolean(window.__NEXT_DATA__) ||
          Boolean(document.querySelector('script#__NEXT_DATA__')) ||
          /_next\//i.test(html)
      },
      {
        name: 'Vue',
        detected: Boolean(window.__VUE__) || Boolean(document.querySelector('[data-v-app]')) || /vue/i.test(scriptText)
      },
      {
        name: 'Nuxt',
        detected: Boolean(window.__NUXT__) || /nuxt/i.test(html)
      },
      {
        name: 'Angular',
        detected:
          Boolean(window.ng) ||
          Boolean(document.querySelector('[ng-version], [ng-app], [data-ng-app]')) ||
          /angular/i.test(scriptText)
      },
      {
        name: 'Svelte',
        detected: Boolean(window.__SVELTE_DEVTOOLS_GLOBAL_HOOK__) || /svelte/i.test(scriptText)
      },
      {
        name: 'Solid',
        detected: Boolean(window.__SOLID_DEVTOOLS__) || /solid-js|solidstart/i.test(scriptText)
      },
      {
        name: 'Preact',
        detected: Boolean(window.__PREACT_DEVTOOLS__) || /preact/i.test(scriptText)
      },
      {
        name: 'Astro',
        detected: Boolean(document.querySelector('astro-island')) || /astro/i.test(scriptText)
      }
    ];

    return {
      detected: checks.filter((item) => item.detected).map((item) => item.name),
      checks
    };
  }

  window.WebsiteIntelModules = window.WebsiteIntelModules || {};
  window.WebsiteIntelModules.framework = {
    detectFrameworks
  };
})();
