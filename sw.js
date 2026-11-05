/* TSPL app: opens instantly from the phone's saved copy and updates in the
   background (stale-while-revalidate). Live data from Google is never cached here.
   Bump VERSION whenever app files change - the app then shows "New version". */
const VERSION = 'tspl-app-v7';
const SHELL = ['m.html', 'manifest.webmanifest', 'programs.json',
  'js/tspl-config.js', 'js/tspl-app.js', 'js/home-btn.js', 'js/i18n.js', 'img/app-192.png', 'img/tsilfaviconn.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))));   // waits for the user to tap "Update"
});
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;     // Google / CDN: straight to network
  const base = location.pathname.replace(/sw\.js$/, '');
  const rel = u.pathname.startsWith(base) ? u.pathname.slice(base.length) : u.pathname;
  if (SHELL.indexOf(rel) < 0) return;                                          // portal pages: always fresh from the site
  e.respondWith(caches.open(VERSION).then(c => c.match(e.request, { ignoreSearch: true }).then(hit => {
    const net = fetch(e.request, { cache: 'no-cache' }).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }                                   // instant from phone, refresh in background
    return net.then(r => r || c.match('m.html'));
  })));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(ws => {
    const w = ws.find(x => x.url.indexOf('m.html') > -1);
    return w ? w.focus() : self.clients.openWindow(e.notification.data && e.notification.data.url || 'm.html');
  }));
});
