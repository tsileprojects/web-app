/* TSPL app: keeps the phone pages working without internet.
   Pages are fetched fresh when online (network first) and served from
   the phone when offline. Live data (Google) is never cached here. */
const CACHE = 'tspl-app-v1';
const SHELL = ['m.html', 'requests.html', 'report.html', 'tv.html', 'status.html', 'manifest.webmanifest',
  'js/tspl-config.js', 'js/tspl-app.js', 'js/i18n.js', 'img/app-192.png', 'img/tsilfaviconn.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;   // Google / CDN: not cached
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('m.html'))));
});
