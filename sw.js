const CACHE = 'sse-a5f0a47f1f';
const FILES = [
 "./",
 "app.js",
 "apple-touch-icon.png",
 "gl-core.js",
 "gl-earth.js",
 "gl-giants.js",
 "gl-lib.js",
 "gl-map.js",
 "gl-moons.js",
 "gl-rocky.js",
 "icon-192.png",
 "icon-512.png",
 "index.html",
 "manifest.webmanifest",
 "ui.js"
];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request)));
});
