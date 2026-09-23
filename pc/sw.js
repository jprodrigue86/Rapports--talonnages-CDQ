// Balance CDQ — Rapports d’étalonnage — PWA indépendante
const CACHE = 'cdq-pc-v25-25-lecteur-hors-ligne';
const FORCE_BUILD='2026.09.23-v25.25-lecteur-hors-ligne';
const SCOPE=new URL(self.registration.scope);
const ROOT=new URL('../',SCOPE);
const url=p=>new URL(p,SCOPE).href;
const root=p=>new URL(p,ROOT).href;
const APP_SHELL=[root('offline-templates-v2525.mjs'),root('reader-v2525.html'),root('reader-v2525.mjs'),root('reader-host-v2525.mjs'),root('reader-interactions-v2525.mjs'),root('reader-v2523.html'),root('reader-v2523.mjs'),root('reader-host-v2523.mjs'),root('reader-interactions-v2523.mjs'),root('pdf-fill-v2523.html'),root('pdf-fill-v2523.mjs'),root('pdf-fill-client-v2523.mjs'),root('vendor/pdf-lib-1.17.1.min.js'),root('assets/music-wall-android-v2523.webp'),root('reader-v2520.html'),root('reader-v2520.mjs'),root('reader-host-v2520.mjs'),root('reader-interactions-v2520.mjs'),
  root('floor-reader-v2519.html'),root('vendor/pdfjs-6.3.289/web/images/loading-icon.gif'),root('vendor/pdfjs-6.3.289/web/images/checkmark.svg'),root('vendor/pdfjs-6.3.289/wasm/quickjs-eval.js'),root('vendor/pdfjs-6.3.289/wasm/quickjs-eval.wasm'),root('floor-reader-v2519.mjs'),root('vendor/pdfjs-6.3.289/build/pdf.mjs'),root('vendor/pdfjs-6.3.289/build/pdf.sandbox.mjs'),root('vendor/pdfjs-6.3.289/build/pdf.worker.mjs'),root('vendor/pdfjs-6.3.289/standard_fonts/LiberationSans-Bold.ttf'),root('vendor/pdfjs-6.3.289/standard_fonts/LiberationSans-Regular.ttf'),root('vendor/pdfjs-6.3.289/web/pdf_viewer.css'),root('vendor/pdfjs-6.3.289/web/pdf_viewer.mjs'),

  url('./'),url('index.html'),url('manifest.webmanifest'),url('version.json'),
  root('offline-templates-v2519.mjs'),root('offline-templates-v2524.mjs'),root('floor-template-v2519.mjs'),
  root('reader.html'),root('reader.mjs?v=21.33'),root('reader-interactions.mjs?v=21.33'),
  root('firebase-config.js'),root('google-auth-config.js'),
  root('icons/icon-heavy-v3-192.png'),root('icons/icon-heavy-v3-512.png'),
  root('assets/music-wall-pc-v2521.webp')
];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(c=>c.addAll(APP_SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>(k.startsWith('cdq-reports-independent-')||k.startsWith('cdq-pc-'))&&k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('message',event=>{
  if(event.data&&event.data.type==='SKIP_WAITING')self.skipWaiting();
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const u=new URL(event.request.url);
  if(u.origin==='https://cdn.jsdelivr.net'&&u.pathname.startsWith('/npm/pdfjs-dist@6.3.289/')){
    event.respondWith((async()=>{const cache=await caches.open(CACHE),hit=await cache.match(event.request);if(hit)return hit;const response=await fetch(event.request);if(response.ok)event.waitUntil(cache.put(event.request,response.clone()).catch(()=>{}));return response;})());return;
  }
  if(u.origin!==ROOT.origin||!u.pathname.startsWith(ROOT.pathname))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const cached=await cache.match(event.request,{ignoreSearch:false});
    const isStatic=event.request.mode!=='navigate';
    const isReader=/\/(?:reader(?:-host|-interactions)?-v2520\.(?:html|mjs)|vendor\/pdfjs-6\.3\.289\/)/.test(u.pathname);
    if(cached&&isReader)return cached;
    try{
      const response=await fetch(event.request,{cache:'no-store'});
      if(response&&response.ok&&(isStatic||isReader))event.waitUntil(cache.put(event.request,response.clone()).catch(()=>{}));
      return response?.ok?response:(cached||response);
    }catch(e){
      if(cached)return cached;
      if(event.request.mode==='navigate'&&(u.pathname===SCOPE.pathname||u.pathname===SCOPE.pathname+'index.html'))return (await cache.match(url('index.html')))||new Response('Balance CDQ indisponible hors ligne.',{status:503});
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
