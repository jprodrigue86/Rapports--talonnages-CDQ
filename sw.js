const CACHE = 'cdq-installable-heavy-v11-force-musicwall-choice1';
const FORCE_BUILD = '2026.09.11.0209';
const APP_SHELL = [
  './', './index.html', './manifest.webmanifest', './sw.js', './version.json',
  './icons/icon-heavy-v3-192.png', './icons/icon-heavy-v3-512.png',
  './assets/music-wall-choice1.webp'
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

    await self.clients.claim();

    const windows = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });

    for (const client of windows) {
      try {
        const url = new URL(client.url);
        if (url.searchParams.get('cdq_refresh') !== FORCE_BUILD) {
          url.searchParams.set('cdq_refresh', FORCE_BUILD);
          await client.navigate(url.href);
        }
      } catch (e) {}
    }
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'reload' })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .catch(() => caches.match(event.request))
  );
});
