/* Pro Pilot offline service worker — network-first for the app page, cache-first for assets */
const CACHE = 'propilot-v63';
/* Origins that serve per-user or short-lived data. Requests to these never touch the cache:
   the photos API is scoped to the signed-in operator, and SharePoint thumbnail URLs are
   pre-authenticated and expire — a cached one comes back 403 later. Everything else
   cross-origin (the MSAL script, font files) is a static asset and must stay cacheable, or the
   app cannot start offline. */
const DATA_ORIGINS = [
  'https://propilot-api-dxa5bzd2e8aqcbgm.westus3-01.azurewebsites.net',
  'https://graph.microsoft.com',
  'https://postcompanies.sharepoint.com',
  'https://postcompanies-my.sharepoint.com'
];
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
  // Never handle per-user data. Photos are scoped to the signed-in operator and must not land in
  // a cache that a second person on the same phone could read back offline.
  try {
    if (req.headers.get('authorization')) return;
    const origin = new URL(req.url).origin;
    if (DATA_ORIGINS.indexOf(origin) !== -1) return;
    if (/\.sharepoint\.com$/.test(new URL(req.url).hostname)) return;
  } catch (_) { return; }
  // Network-first for the app page and the well feed so the newest build and data always load
  // when online; a cached feed only ever answers offline.
  if (isAppShell(req) || /rpt-feed\.json$/.test(new URL(req.url).pathname)) {
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
