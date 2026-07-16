/* Pro Pilot offline service worker — network-first for the app page, cache-first for assets */
const CACHE = 'propilot-v44';
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
function isAppShell(req) {
  if (req.mode === 'navigate') return true;
  const u = new URL(req.url);
  if (u.pathname.endsWith('.json')) return true; // live data (rpt-feed.json) — always freshest when online
  return /(?:^|\/)(index\.html)?$/.test(u.pathname) || u.pathname.endsWith('/index.html');
}
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // Network-first for the app page so the newest build always loads when online.
  if (isAppShell(req)) {
    e.respondWith(
      fetch(req).then((res) => {
        try { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } catch (_) {}
        return res;
      }).catch(() => caches.match(req).then((c) => c || caches.match('index.html')))
    );
    return;
  }
  // Cache-first with background refresh for static assets.
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
