/* Wafrly service worker: makes the app installable and lets it open offline.
   Scope is ration/ only, so it never touches the other app in this repo. */
var VERSION = 'ration-v17';
var FONTS = 'ration-fonts';
var ASSETS = [
  './', './index.html', './manifest.webmanifest', './vendor/supabase-2.118.0.js', './fonts/tajawal-arabic-400-normal.woff2', './fonts/tajawal-arabic-500-normal.woff2', './fonts/tajawal-arabic-700-normal.woff2', './fonts/tajawal-arabic-800-normal.woff2', './fonts/tajawal-latin-400-normal.woff2', './fonts/tajawal-latin-700-normal.woff2', './fonts/tajawal-latin-800-normal.woff2',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('ration-v') === 0 && k !== VERSION; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // Google Fonts: cache-first so the Arabic font still shows offline.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then(function (c) {
      return c.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; });
      });
    }));
    return;
  }

  if (url.origin !== self.location.origin) return;
  var scope = new URL('./', self.location).pathname;
  if (url.pathname.indexOf(scope) !== 0) return;

  // App files: network first so updates arrive; fall back to cache when offline.
  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); }
      return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (hit) {
        return hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error());
      });
    })
  );
});
