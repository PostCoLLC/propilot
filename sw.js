/* Pro Pilot offline service worker — cache-first with background refresh */
const CACHE = 'propilot-v21';
const CORE = [
  './', 'index.html', 'support.js',
  'assets/hero-shop.jpg', 'assets/facility.jpg', 'assets/svc-build.jpg',
  'assets/pc-circle.png', 'assets/pc-horizontal.png'
];
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE).catch(() => {})));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req).then((cached) => {
      const net = fetch(req).then((res) => {
        try { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } catch (_) {}
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
