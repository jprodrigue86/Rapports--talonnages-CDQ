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
 const browser=await type.launch(),context=await browser.newContext({...devices['iPhone 13']}),page=await context.newPage();
 try{
  await page.goto(base);
  await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller),{},{timeout:20000});
  await page.evaluate(async()=>{
   localStorage.setItem('cdq-test-saved-session','preserved-session');
   const cache=await caches.open('cdq-test-user-documents');await cache.put(new Request(location.origin+'/saved-report'),new Response('preserved-document'));
  });
  current=B;
  await page.goto(base+'connection-repair.html');
  page.once('dialog',d=>d.dismiss());await page.locator('#repair').click();
  assert.equal(page.url(),base+'connection-repair.html');
  assert.equal(await page.locator('#repair').isEnabled(),true);
  page.once('dialog',d=>d.accept());await page.locator('#repair').click();
  await page.waitForURL(base,{timeout:30000});
  assert.equal(await page.locator('h1').innerText(),B);
  const saved=await page.evaluate(async()=>({session:localStorage.getItem('cdq-test-saved-session'),document:await(await(await caches.open('cdq-test-user-documents')).match(location.origin+'/saved-report')).text()}));
  assert.deepEqual(saved,{session:'preserved-session',document:'preserved-document'});
  await context.setOffline(true);await page.reload();assert.equal(await page.locator('h1').innerText(),B);await context.setOffline(false);
  console.log(JSON.stringify({engine,scenario:'repair-old-worker-confirm-cancel-activate-preserve-offline',ok:true}));
  const fresh=await browser.newContext({...devices['iPhone 13']}),first=await fresh.newPage();
  try{
   await first.goto(base+'connection-repair.html');first.once('dialog',d=>d.accept());await first.locator('#repair').click();
   await first.waitForURL(base,{timeout:30000});assert.equal(await first.locator('h1').innerText(),B);
   console.log(JSON.stringify({engine,scenario:'repair-first-install',ok:true}));
  }finally{await fresh.close();}
 }finally{await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));}
}
