import http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium,webkit,devices} from 'playwright';
const A='a'.repeat(64),B='b'.repeat(64),scope='/iphone/app/';
const template=fs.readFileSync('iphone-source/sw.js','utf8');
const repair=fs.readFileSync('iphone-source/connection-repair.html','utf8');
const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
const html=release=>'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><h1>'+release+'</h1><script>navigator.serviceWorker.register("./sw.js",{scope:"./",updateViaCache:"none"});</script>';
async function savedState(page,seed=false){
 return page.evaluate(async seed=>{
  // CDQ stores offline records in IndexedDB (RapportsEtalonnagesCDQ/cache).
  // A synthetic Cache API response was not a valid WebKit fixture: it vanished
  // even BEFORE activation. Test the actual storage type rather than assuming
  // that every browser persists an arbitrary synthetic HTTP response.
  const db=await new Promise((resolve,reject)=>{
   const request=indexedDB.open('RapportsEtalonnagesCDQ',1);
   request.onupgradeneeded=()=>request.result.createObjectStore('cache',{keyPath:'key'});
   request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||Error('Open IndexedDB failed'));
  });
  let record;
  try{
   record=await new Promise((resolve,reject)=>{
    const tx=db.transaction('cache',seed?'readwrite':'readonly');let value;
    const request=seed?tx.objectStore('cache').put({key:'test-offline-report',value:'preserved-document'}):tx.objectStore('cache').get('test-offline-report');
    request.onsuccess=()=>{value=seed?{value:'preserved-document'}:request.result;};
    tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error||Error('IndexedDB transaction failed'));tx.onabort=()=>reject(tx.error||Error('IndexedDB transaction aborted'));
   });
  }finally{db.close();}
  if(seed){localStorage.setItem('cdq-test-saved-session','preserved-session');await caches.open('cdq-test-unrelated-cache');}
  return {session:localStorage.getItem('cdq-test-saved-session'),document:record?.value||null,cacheNames:await caches.keys()};
 },seed);
}
for(const [engine,type] of Object.entries({chromium,webkit})){
 let current=A;
 const server=http.createServer((req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname;
  res.setHeader('Cache-Control','no-store');
  if(name===scope||name===scope+'index.html'){res.setHeader('Content-Type','text/html');return res.end(html(current));}
  if(name===scope+'connection-repair.html'){res.setHeader('Content-Type','text/html');return res.end(repair);}
  if(name===scope+'release.json'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({release:current}));}
  if(name===scope+'sw.js'){
   res.setHeader('Content-Type','text/javascript');
   return res.end(template.replace('__CDQ_RELEASE_JSON__',JSON.stringify(current)).replace('__CDQ_ASSETS_JSON__',JSON.stringify({'index.html':digest(html(current))})));
  }
  res.statusCode=404;res.end('Not found');
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port+scope;
 const context=await type.launchPersistentContext('',{...devices['iPhone 13']}),page=context.pages()[0]||await context.newPage();
 try{
  await page.goto(base);
  await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller),{},{timeout:20000});
  const initial=await savedState(page,true);console.log(JSON.stringify({engine,scenario:'saved-before-navigation',state:initial}));
  assert.equal(initial.document,'preserved-document');
  current=B;
  await page.goto(base+'connection-repair.html');
  const before=await savedState(page);assert.equal(before.document,'preserved-document');
  page.once('dialog',d=>d.dismiss());await page.locator('#repair').click();
  assert.equal(page.url(),base+'connection-repair.html');assert.equal(await page.locator('#repair').isEnabled(),true);
  page.once('dialog',d=>d.accept());await page.locator('#repair').click();
  await page.waitForURL(base,{timeout:30000});assert.equal(await page.locator('h1').innerText(),B);
  const saved=await savedState(page);console.log(JSON.stringify({engine,scenario:'saved-after-recovery',state:saved}));
  assert.equal(saved.session,'preserved-session');assert.equal(saved.document,'preserved-document');assert.ok(saved.cacheNames.includes('cdq-test-unrelated-cache'));
  await context.setOffline(true);await page.reload();assert.equal(await page.locator('h1').innerText(),B);
  assert.equal((await savedState(page)).document,'preserved-document');await context.setOffline(false);
  console.log(JSON.stringify({engine,scenario:'repair-confirm-cancel-activate-preserve-indexeddb-and-session-offline',ok:true}));
  const fresh=await type.launchPersistentContext('',{...devices['iPhone 13']}),first=fresh.pages()[0]||await fresh.newPage();
  try{
   await first.goto(base+'connection-repair.html');first.once('dialog',d=>d.accept());await first.locator('#repair').click();
   await first.waitForURL(base,{timeout:30000});assert.equal(await first.locator('h1').innerText(),B);
   console.log(JSON.stringify({engine,scenario:'repair-first-install',ok:true}));
  }finally{await fresh.close();}
 }finally{await context.close();await new Promise(resolve=>server.close(resolve));}
}
