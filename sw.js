// GitHub/PWA uniquement. Ne jamais coller ce fichier dans Code.gs.
const CACHE = 'cdq-installable-v21-24';
const FORCE_BUILD = '2026.09.15.1200-v21.24';
const SCOPE = new URL(self.registration.scope);
const APP_SHELL = [
  './', './index.html', './manifest.webmanifest', './version.json', './firebase-config.js',
  './icons/icon-heavy-v3-192.png', './icons/icon-heavy-v3-512.png',
  './assets/music-wall-choice1.webp?v=20260911-clean'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('cdq-installable-') && k !== CACHE)
      .map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
function shellKey(url) {
  if (url.pathname === SCOPE.pathname || url.pathname === SCOPE.pathname + 'index.html')
    return new URL('index.html', SCOPE).href;
  if (['version.json', 'firebase-config.js', 'manifest.webmanifest'].some(name => url.pathname === SCOPE.pathname + name))
    return url.origin + url.pathname;
  return url.href;
}
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;
  const key = shellKey(url);
  const critical = event.request.mode === 'navigate' || ['index.html','version.json','firebase-config.js','manifest.webmanifest']
    .some(name => key === new URL(name, SCOPE).href);
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(key);
    if (cached && !critical) return cached;
    try {
      const response = await fetch(event.request, {cache:'no-store'});
      if (response.ok) {
        event.waitUntil(cache.put(key,response.clone()).catch(()=>{}));
        return response;
      }
      return cached || response;
    } catch(e) {
      return cached || new Response('Connexion indisponible. Réessayez lorsque le réseau est revenu.',
        {status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
    }
  })());
});
// Register before the Firebase SDK. Keep notification clicks within CDQ.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  // Firebase processes its own notification clicks, including its fcm_options link.
  if (event.notification.data && event.notification.data.FCM_MSG) return;
  let target = new URL('./', SCOPE);
  try {
    const data = event.notification.data || {};
    const candidate = new URL(data.url || data.link || './', SCOPE);
    if (candidate.origin === SCOPE.origin && candidate.pathname.startsWith(SCOPE.pathname)) target = candidate;
  } catch(e) {}
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const current = clients.find(client => {
      const url = new URL(client.url);
      return url.origin === SCOPE.origin && url.pathname.startsWith(SCOPE.pathname);
    });
    if (current) return current.focus();
    return self.clients.openWindow(target.href);
  })());
});
try {
  importScripts('./firebase-config.js');
  const config = self.CDQ_FIREBASE_CONFIG || {};
  if (config.apiKey && config.projectId && config.messagingSenderId && config.appId) {
    importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
    importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');
    if (!firebase.apps.length) firebase.initializeApp(config);
    firebase.messaging().onBackgroundMessage(payload => {
      if (payload.notification) return;
      const data = payload.data || {};
      return self.registration.showNotification(data.title || 'Balance CDQ', {
        body:data.body || '', tag:data.tag || 'cdq-inventaire',
        icon:new URL('icons/icon-heavy-v3-192.png', SCOPE).href,
        data:{url:SCOPE.href}
      });
    });
  }
} catch(e) {
  console.warn('Notifications Firebase indisponibles; ouverture de CDQ maintenue.');
}
