const CACHE = 'cdq-installable-heavy-v14-biometric-fallback';
const FORCE_BUILD = '2026.09.14.1805-v21.21';
const APP_SHELL = [
  './', './index.html', './manifest.webmanifest', './sw.js', './version.json',
  './icons/icon-heavy-v3-192.png', './icons/icon-heavy-v3-512.png',
  './assets/music-wall-choice1.webp?v=20260911-clean'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await caches.open(CACHE).then(cache => cache.addAll(APP_SHELL));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      try { client.postMessage({ type: 'CDQ_SW_UPDATED', build: FORCE_BUILD }); } catch (e) {}
    }
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  // index/version/sw : toujours privilégier la version réseau pour éviter
  // qu'un ancien pont biométrique reste bloqué dans le cache Android.
  const url = new URL(event.request.url);
  const isCritical =
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('/version.json') ||
    url.pathname.endsWith('/sw.js') ||
    url.pathname.endsWith('/');

  if (isCritical) {
    event.respondWith(
      fetch(event.request, {cache:'no-store'})
        .then(response => {
          if (response && response.ok) {
            caches.open(CACHE).then(cache => cache.put(event.request, response.clone())).catch(()=>{});
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request, {cache:'no-store'})
        .then(response => {
          if (response && response.ok) {
            caches.open(CACHE).then(cache => cache.put(event.request, response.clone())).catch(()=>{});
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
