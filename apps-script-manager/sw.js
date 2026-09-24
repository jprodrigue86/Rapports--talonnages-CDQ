const CACHE='cdq-apps-script-manager-v43-private-version-diagnostic';
const ASSETS=['./','index.html','style.css?v=43','api.js?v=43','jszip.min.js?v=23','app.js?v=43','diagnostics.js?v=43','diagnostics.css?v=43','version.json','manifest.webmanifest','icon-industrial.svg','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('cdq-apps-script-manager-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  if(u.origin!==self.location.origin||u.searchParams.has('cdq_diag'))return;
  e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./'))));
});
