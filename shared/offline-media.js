/* 网页端媒体缓存。完整响应放进 Cache Storage，下次用 blob 地址播放。 */
(function (root, factory) {
  var api = factory(root.OfflinePolicy);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OfflineMedia = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (policy) {
  var CACHE_NAME = 'ggs-media-v1';
  var INDEX_KEY = 'ggs-offline-index-v1';

  function cacheKey(url) {
    return String(url || '').split('#')[0].split('?')[0];
  }

  function createBrowserOffline(options) {
    var opts = options || {};
    var storage = opts.storage;
    var cachesApi = opts.caches;
    var fetchFn = opts.fetch;
    var rules = opts.policy || policy;
    var createUrl = opts.createObjectURL || function (blob) { return URL.createObjectURL(blob); };
    var blobUrls = {};

    function readIndex() {
      try {
        var parsed = JSON.parse(storage.getItem(INDEX_KEY) || '[]');
        return Array.isArray(parsed) ? parsed : [];
      } catch (err) {
        return [];
      }
    }

    function writeIndex(entries) {
      storage.setItem(INDEX_KEY, JSON.stringify(entries));
    }

    function remember(url, meta, bytes) {
      var key = cacheKey(url);
      var incoming = {
        id: key,
        app: meta && meta.app || '',
        kind: meta && meta.kind || 'audio',
        bytes: Number(bytes) || 0,
        lastUsed: meta && meta.lastUsed || Date.now(),
        url: key
      };
      var decision = rules.plan(readIndex(), incoming);
      return cachesApi.open(CACHE_NAME).then(function (cache) {
        var deletions = decision.evict.map(function (entry) {
          return cache.delete(entry.url || entry.id);
        });
        return Promise.all(deletions).then(function () {
          writeIndex(decision.keep);
          return true;
        });
      });
    }

    if (typeof window !== 'undefined' && window.navigator && window.navigator.serviceWorker && window.location && /^https?:$/.test(window.location.protocol)) {
      window.navigator.serviceWorker.register('sw.js').catch(function () {});
    }

    return {
      cacheKey: cacheKey,
      has: function (url) {
        var key = cacheKey(url);
        return readIndex().some(function (entry) { return entry && (entry.url === key || entry.id === key); });
      },
      resolve: function (url) {
        var key = cacheKey(url);
        if (!key || !cachesApi) return Promise.resolve(url);
        return cachesApi.open(CACHE_NAME).then(function (cache) {
          return cache.match(key);
        }).then(function (hit) {
          if (!hit) return url;
          return hit.blob().then(function (blob) {
            if (blobUrls[key]) return blobUrls[key];
            blobUrls[key] = createUrl(blob);
            return blobUrls[key];
          });
        }).catch(function () { return url; });
      },
      retain: function (url, meta) {
        var key = cacheKey(url);
        if (!key || !cachesApi || !fetchFn) return Promise.resolve(false);
        return cachesApi.open(CACHE_NAME).then(function (cache) {
          return cache.match(key).then(function (hit) {
            if (hit) return hit.blob();
            return fetchFn(key).then(function (response) {
              if (!response || !response.ok) throw new Error('媒体没有下载下来');
              return response.blob().then(function (blob) {
                var stored = (typeof Blob !== 'undefined' && blob instanceof Blob)
                  ? new Response(blob, { status: 200, headers: { 'Content-Type': blob.type || 'application/octet-stream' } })
                  : { blob: function () { return Promise.resolve(blob); } };
                return cache.put(key, stored).then(function () {
                  return blob;
                });
              });
            });
          }).then(function (blob) {
            return remember(key, meta, blob && blob.size).then(function () { return true; });
          });
        }).catch(function () { return false; });
      }
    };
  }

  var browser = null;
  function browserApi() {
    if (browser) return browser;
    if (typeof window === 'undefined' || !window.caches || !window.localStorage || !window.fetch) return null;
    browser = createBrowserOffline({
      storage: window.localStorage,
      caches: window.caches,
      fetch: function (url) { return window.fetch(url); },
      policy: policy
    });
    return browser;
  }

  if (typeof window !== 'undefined' && window.navigator && window.navigator.serviceWorker && window.location && /^https?:$/.test(window.location.protocol)) {
    window.navigator.serviceWorker.register('sw.js').catch(function () {});
  }

  return {
    CACHE_NAME: CACHE_NAME,
    INDEX_KEY: INDEX_KEY,
    createBrowserOffline: createBrowserOffline,
    resolve: function (url) {
      var api = browserApi();
      return api ? api.resolve(url) : Promise.resolve(url);
    },
    has: function (url) {
      var api = browserApi();
      return api ? api.has(url) : false;
    },
    retain: function (url, meta) {
      var api = browserApi();
      return api ? api.retain(url, meta) : Promise.resolve(false);
    }
  };
});
