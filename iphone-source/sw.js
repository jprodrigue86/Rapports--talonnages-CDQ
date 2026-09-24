/* Generated iPhone static shell. User documents and authentication requests are never cached here. */
const RELEASE=__CDQ_RELEASE_JSON__,ASSETS=__CDQ_ASSETS_JSON__;
const PREFIX='cdq-iphone-shell-',CACHE=PREFIX+RELEASE;
const BASE=new URL(self.registration.scope);
const urlFor=name=>new URL(name,BASE).href;
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE),names=Object.keys(ASSETS);let next=0;
  try{
    await Promise.all(Array.from({length:6},async()=>{
      while(next<names.length){
        const name=names[next++],response=await fetch(urlFor(name),{cache:'reload',credentials:'same-origin'});
        if(!response.ok)throw Error('Asset unavailable: '+name);
        const bytes=await response.clone().arrayBuffer();
        const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
        if(digest!==ASSETS[name])throw Error('Asset checksum mismatch: '+name);
        await cache.put(urlFor(name),response);
      }
    }));
  }catch(error){await caches.delete(CACHE);throw error;}
  // No skipWaiting: never restart a technician's form without consent.
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  await self.clients.claim();
  // Keep the previous static shell; never touch document, session or offline caches.
  const keys=(await caches.keys()).filter(k=>k.startsWith(PREFIX)&&k!==CACHE);
  const windows=await self.clients.matchAll({type:'window'});
  if(windows.filter(c=>c.url.startsWith(BASE.href)).length<=1)await Promise.all(keys.slice(0,-1).map(k=>caches.delete(k)));
})()));
self.addEventListener('message',event=>{
  const u=event.source?.url;let trusted=false;
  try{const source=new URL(u);trusted=source.origin===BASE.origin&&source.pathname.startsWith(BASE.pathname);}catch(_){}
  if(trusted&&event.data?.type==='CDQ_IPHONE_VERSION')event.ports?.[0]?.postMessage({release:RELEASE});
  if(trusted&&event.data?.type==='CDQ_IPHONE_ACTIVATE'&&event.data.release===RELEASE)event.waitUntil(self.skipWaiting());
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==BASE.origin||!url.pathname.startsWith(BASE.pathname))return;
  let name=url.pathname.slice(BASE.pathname.length)||'index.html';
  if(!(name in ASSETS))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE),hit=await cache.match(urlFor(name));
    if(hit)return hit;
    // A lost static cache can be rebuilt online; never return an unrelated document.
    return fetch(event.request);
  })());
});
