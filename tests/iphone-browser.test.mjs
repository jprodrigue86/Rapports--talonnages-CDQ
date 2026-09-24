import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium,webkit,devices} from 'playwright';
const root=process.cwd(),read=p=>fs.readFileSync(p,'utf8');
const publicRoot='https://jprodrigue86.github.io/Rapports--talonnages-CDQ/',app=publicRoot+'iphone/app/';
const mime={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',mjs:'text/javascript; charset=utf-8',json:'application/json; charset=utf-8',webmanifest:'application/manifest+json; charset=utf-8',css:'text/css; charset=utf-8',png:'image/png',webp:'image/webp',jpg:'image/jpeg',svg:'image/svg+xml',wasm:'application/wasm',pdf:'application/pdf',ttf:'font/ttf'};
const type=p=>mime[p.split('.').at(-1)]||'application/octet-stream';
const bridge=read('balance-cdq-android/web-source/server-bridge.js');
fs.mkdirSync('/tmp/cdq-iphone-results',{recursive:true});
async function ui(engine,name){
 const browser=await engine.launch();let page,selector;const errors=[];
 try{
  const context=await browser.newContext({...devices['iPhone 13'],serviceWorkers:'block'});
  await context.addInitScript(()=>{
   Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedLink=text;}}});
   Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.sharedLink=data.url;if(window.cancelShare)throw new DOMException('Cancelled','AbortError');}});
  });
  await context.route('**/*',async route=>{
   const url=route.request().url();
   if(url.startsWith('data:')||url.startsWith('blob:'))return route.continue();
   if(url.startsWith(publicRoot)){
    const relative=new URL(url).pathname.slice(new URL(publicRoot).pathname.length);
    const file=path.join(root,relative.endsWith('/')?relative+'index.html':relative||'index.html');
    if(fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({status:200,contentType:type(file),body:fs.readFileSync(file)});
   }
   if(url.startsWith('https://accounts.google.com/gsi/client'))return route.fulfill({contentType:type('gsi.js'),body:'window.google=window.google||{};window.google.accounts={id:{initialize(){},renderButton(){},prompt(){}}};'});
   if(url.startsWith('https://script.google.com/')&&url.includes('cdq_native_bridge=1')){
    const channel=new URL(url).searchParams.get('channel');
    return route.fulfill({contentType:type('bridge.html'),body:`<iframe src="https://fixture-script.googleusercontent.com/bridge?channel=${channel}"></iframe>`});
   }
   if(url.startsWith('https://fixture-script.googleusercontent.com/bridge')){
    const channel=new URL(url).searchParams.get('channel');
    const fixture=`window.fixtureCalls=[];window.google={script:{run:new Proxy({},{get(_target,name){
     if(name==='withSuccessHandler')return fn=>{window.success=fn;return google.script.run;};
     if(name==='withFailureHandler')return fn=>{window.failure=fn;return google.script.run;};
     return (...args)=>{const done=window.success;window.fixtureCalls.push([name,args]);
      if(name==='obtenirEtatAcces'||name==='restaurerSessionApresBiometrie')return setTimeout(()=>done({autorise:true,email:'test@example.invalid',role:'technicien',jetonSession:'fixture-session',compagniesInitiales:[{id:'client_fixture_12345',nom:'Client de vérification'}]}),20);
      if(name==='cdqRpc'){if(args[0]==='obtenirDossiersClients')return setTimeout(()=>done([{id:'client_fixture_12345',nom:'Client de vérification'}]),20);return setTimeout(()=>done([]),20);}
      window.failure?.(Error('Unexpected fixture method '+name));
     };}})}};`;
    return route.fulfill({contentType:type('fixture.html'),body:`<script>const CDQ_EMBEDDED_CHANNEL=${JSON.stringify(channel)};${fixture}\n${bridge}</script>`});
   }
   return route.abort();
  });
  page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(publicRoot+'installer.html');
  assert.equal(await page.locator('#android-title').innerText(),'Application Android');
  assert.equal(await page.locator('#iphone-title').innerText(),'Application iPhone');
  assert.equal(await page.locator('#android-download').isVisible(),false);
  await page.locator('[data-copy="iphone"]').click();assert.equal(await page.evaluate(()=>window.copiedLink),publicRoot+'iphone/');
  await page.locator('[data-copy="android"]').click();assert.equal(await page.evaluate(()=>window.copiedLink),publicRoot+'installer.html?platform=android');
  await page.evaluate(()=>{window.cancelShare=true;window.copiedLink='unchanged';});
  await page.locator('[data-share="iphone"]').click();assert.equal(await page.evaluate(()=>window.copiedLink),'unchanged');
  await page.screenshot({path:'/tmp/cdq-iphone-results/'+name+'-installer.png',fullPage:true});
  console.log(name+': installer links and share cancellation verified.');
  await page.goto(app,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#app')?.contentDocument?.querySelector('#accessOverlay'),null,{timeout:45000});
  selector=page.frames().find(f=>f.url()===app+'Selector.html');assert(selector);
  await selector.waitForFunction(()=>cdqAccessState==='ready',null,{timeout:45000});
  await selector.waitForFunction(()=>document.querySelector('#companyList')?.textContent.includes('Client de vérification'));
  console.log(name+': authenticated fixture and client list verified.');
  assert.equal(await selector.evaluate(()=>!!window.BalanceCDQNative),false);
  await selector.evaluate(()=>window.cdqOpenShareMenu25());
  const modal=selector.locator('#cdqShareAppModal');await modal.waitFor({state:'visible'});
  assert.equal(await modal.locator('a[href*="platform=android"]').count(),1);
  assert.equal(await modal.locator('a[href$="/iphone/"]').count(),1);
  await modal.locator('.cancel-button').click();assert.equal(await modal.count(),0);
  await selector.evaluate(()=>window.cdqOpenSettingsV2294());
  await selector.waitForFunction(()=>document.getElementById('cdqCheckUpdateButton')?.textContent==='Vérifier la mise à jour iPhone');
  assert.equal(await selector.locator('#cdqAndroidUpdaterBoxV2313').count(),0);
  await page.screenshot({path:'/tmp/cdq-iphone-results/'+name+'-settings.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('PASS '+name+': correct phone links, share cancellation, authenticated Selector, clients, modal close and iPhone update controls.');
 }catch(error){
  console.error(name+' UI diagnostics',errors);
  if(selector)console.error(await selector.evaluate(()=>({access:typeof cdqAccessState==='undefined'?null:cdqAccessState,clients:typeof toutesLesCompagnies==='undefined'?null:toutesLesCompagnies,list:document.querySelector('#companyList')?.textContent,settings:document.getElementById('cdqSettingsModalV2294')?.textContent.slice(0,1000)})).catch(()=>null));
  if(page){await page.screenshot({path:'/tmp/cdq-iphone-results/'+name+'-failure.png',fullPage:true}).catch(()=>{});for(const frame of page.frames())if(frame.url().includes('fixture-script.googleusercontent.com'))console.error('Fixture calls',await frame.evaluate(()=>window.fixtureCalls).catch(()=>null));}
  throw error;
 }finally{await browser.close();}
}
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function fixture(release){
 const files={
  'index.html':Buffer.from(`<!doctype html><html data-cdq-iphone-release="${release}" data-cdq-iphone-version="25.30"><head><script src="./iphone-update.js"></script></head><body><input id="unsaved" value="draft"></body></html>`),
  'iphone-update.js':Buffer.from(read('iphone-source/iphone-update.js')),
  'asset.txt':Buffer.from('immutable fixture '+release)
 };
 const assets=Object.fromEntries(Object.entries(files).map(([n,b])=>[n,hash(b)]));
 files['release.json']=Buffer.from(JSON.stringify({version:'25.30',release}));
 files['sw.js']=Buffer.from(read('iphone-source/sw.js').replace('__CDQ_RELEASE_JSON__',JSON.stringify(release)).replace('__CDQ_ASSETS_JSON__',JSON.stringify(assets)));
 return files;
}
async function updates(engine,name){
 let release='a'.repeat(64),files=fixture(release);
 const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname.slice('/app/'.length)||'index.html';const b=files[name];if(!b){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':type(name),'Cache-Control':'no-store'});res.end(b);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port+'/app/';
 const browser=await engine.launch();let page;const errors=[];
 try{
  const context=await browser.newContext({...devices['iPhone 13']});page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
  console.log(name+': first verified service worker active.');
  await page.evaluate(async()=>{localStorage.setItem('cdq-test-user-data','preserve');const c=await caches.open('existing-client-documents');await c.put('/preserved-document',new Response('preserve'));});
  await page.locator('#unsaved').fill('unsaved work');
  release='b'.repeat(64);files=fixture(release);
  await page.evaluate(()=>window.cdqIphoneUpdates.check());
  await page.waitForFunction(()=>window.cdqIphoneUpdates.status().available,null,{timeout:45000});
  assert.equal(await page.locator('#unsaved').inputValue(),'unsaved work');
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.cdqIphoneRelease),'a'.repeat(64));
  page.once('dialog',d=>d.dismiss());await page.evaluate(()=>window.cdqIphoneUpdates.apply());
  assert.equal(await page.locator('#unsaved').inputValue(),'unsaved work');
  page.once('dialog',d=>d.accept());
  await Promise.all([page.waitForEvent('load'),page.evaluate(()=>window.cdqIphoneUpdates.apply()).catch(e=>{if(!/context|navigation|Target/.test(e.message))throw e;})]);
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.cdqIphoneRelease),'b'.repeat(64));
  assert.equal(await page.evaluate(()=>localStorage.getItem('cdq-test-user-data')),'preserve');
  assert.equal(await page.evaluate(async()=>await (await (await caches.open('existing-client-documents')).match('/preserved-document')).text()),'preserve');
  await context.setOffline(true);await page.reload();
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.cdqIphoneRelease),'b'.repeat(64));
  assert.match(await page.evaluate(async()=>await (await fetch('./asset.txt')).text()),/immutable fixture b/);
  assert.deepEqual(errors,[]);
  console.log('PASS '+name+': verified update staged, no forced reload, cancellation preserves input, confirmation activates new release, existing documents/storage retained, offline reload.');
 }catch(error){console.error(name+' update diagnostics',errors,await page?.evaluate(()=>window.cdqIphoneUpdates?.status()).catch(()=>null));throw error;}
 finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
for(const [name,engine] of [['Chromium',chromium],['WebKit',webkit]]){await ui(engine,name);await updates(engine,name);}
