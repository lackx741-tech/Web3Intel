(function () {
  async function safeIndexedDbNames() {
    if (!('indexedDB' in window) || typeof indexedDB.databases !== 'function') {
      return { supported: false, names: [] };
    }
    try {
      const dbs = await indexedDB.databases();
      const names = dbs.map((item) => item && item.name).filter(Boolean);
      return { supported: true, names: Array.from(new Set(names)).slice(0, 100) };
    } catch (error) {
      return { supported: true, names: [], error: String(error) };
    }
  }

  async function safeCacheNames() {
    if (!('caches' in window) || typeof caches.keys !== 'function') {
      return { supported: false, names: [] };
    }
    try {
      const names = await caches.keys();
      return { supported: true, names: names.slice(0, 100) };
    } catch (error) {
      return { supported: true, names: [], error: String(error) };
    }
  }

  async function analyzeStorage() {
    const localStorageKeys = Object.keys(localStorage || {}).slice(0, 500);
    const sessionStorageKeys = Object.keys(sessionStorage || {}).slice(0, 500);

    const [indexedDBInfo, cacheInfo] = await Promise.all([safeIndexedDbNames(), safeCacheNames()]);

    return {
      localStorage: {
        count: localStorageKeys.length,
        keys: localStorageKeys
      },
      sessionStorage: {
        count: sessionStorageKeys.length,
        keys: sessionStorageKeys
      },
      indexedDB: {
        count: indexedDBInfo.names.length,
        names: indexedDBInfo.names,
        supported: indexedDBInfo.supported,
        error: indexedDBInfo.error || null
      },
      cacheStorage: {
        count: cacheInfo.names.length,
        names: cacheInfo.names,
        supported: cacheInfo.supported,
        error: cacheInfo.error || null
      }
    };
  }

  window.WebsiteIntelModules = window.WebsiteIntelModules || {};
  window.WebsiteIntelModules.storage = {
    analyzeStorage
  };
})();
