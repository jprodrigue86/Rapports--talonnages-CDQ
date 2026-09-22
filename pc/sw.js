// Balance CDQ — Rapports d’étalonnage — PWA indépendante
const CACHE='cdq-pc-v25-17-desktop-workspace';
const FORCE_BUILD='2026.09.23-v25.17-desktop-workspace';
const SCOPE=new URL(self.registration.scope);
const ROOT=new URL('../',SCOPE);
const url=p=>new URL(p,SCOPE).href;
const root=p=>new URL(p,ROOT).href;
const APP_SHELL=[
  url('./'),url('index.html'),url('manifest.webmanifest'),url('version.json'),
  root('offline-templates-v2252.mjs'),
  root('reader.html'),root('reader.mjs?v=21.33'),root('reader-interactions.mjs?v=21.33'),
  root('firebase-config.js'),root('google-auth-config.js'),
  root('icons/icon-heavy-v3-192.png'),root('icons/icon-heavy-v3-512.png'),
  root('assets/music-wall-panoramic-v2517.webp')
];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(c=>c.addAll(APP_SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith('cdq-reports-independent-')&&k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('message',event=>{
  if(event.data&&event.data.type==='SKIP_WAITING')self.skipWaiting();
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const u=new URL(event.request.url);
  if(u.origin!=='https://jprodrigue86.github.io')return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const cached=await cache.match(event.request,{ignoreSearch:false});
    const isStatic=!event.request.mode||event.request.mode!=='navigate';
    try{
      const response=await fetch(event.request,{cache:'no-store'});
      if(response&&response.ok&&isStatic)event.waitUntil(cache.put(event.request,response.clone()).catch(()=>{}));
      return response;
    }catch(e){
      if(cached)return cached;
      if(event.request.mode==='navigate')return (await cache.match(url('index.html')))||new Response('Balance CDQ indisponible hors ligne.',{status:503});
      throw e;
    }
  })());
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const current=clients.find(c=>new URL(c.url).pathname.startsWith(SCOPE.pathname));
    if(current){await current.navigate(SCOPE.href);return current.focus();}
    return self.clients.openWindow(SCOPE.href);
  })());
});
try{
  importScripts(root('firebase-config.js'));
  const config=self.CDQ_FIREBASE_CONFIG||{};
  if(config.apiKey&&config.projectId&&config.messagingSenderId&&config.appId){
    importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
    importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');
    if(!firebase.apps.length)firebase.initializeApp(config);
    firebase.messaging().onBackgroundMessage(payload=>{
      if(payload.notification)return;
      const data=payload.data||{};
      return self.registration.showNotification(data.title||'Balance CDQ',{
        body:data.body||'',tag:data.tag||'cdq-inventaire',
        icon:root('icons/icon-heavy-v3-192.png'),
        data:{url:SCOPE.href}
      });
    });
  }
}catch(e){}
