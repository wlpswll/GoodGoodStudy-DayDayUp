var SHELL = 'ggs-shell-english-v1';

self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(SHELL).then(function (cache) {
    return cache.addAll([
      './',
      './index.html',
      './css/style.css',
      './js/platform.js',
      './js/catalog.js',
      './js/progress.js',
      './js/app.js',
      './data/media.json',
      '../shared/offline-policy.js',
      '../shared/offline-media.js'
    ]);
  }).then(function () { return self.skipWaiting(); }).catch(function () {}));
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;
  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (/\.(mp3|m4a|aac|wav|ogg|oga|flac|opus|mp4|m4v|webm|ogv|mov|mkv)(\?|$)/i.test(url.pathname)) return;
  event.respondWith(fetch(request).then(function (response) {
    var copy = response.clone();
    caches.open(SHELL).then(function (cache) { cache.put(request, copy); });
    return response;
  }).catch(function () {
    return caches.match(request, { ignoreSearch: true }).then(function (hit) {
      return hit || caches.match('./index.html');
    });
  }));
});
