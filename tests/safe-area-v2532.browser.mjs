import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
const dir=process.env.CDQ_ASSET_SOURCE||'balance-cdq-android/app/build/generated/cdq-web-assets/cdq-web';
const html=fs.readFileSync(path.join(dir,'Selector.html'),'utf8');
const styles=[...html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map(m=>m[0]).join('\n');
const mobile=html.match(/<script id="cdqMobileLayoutJs">([\s\S]*?)<\/script>/)[1];
const header=html.match(/<header class="app-header[\s\S]*?<\/header>/)[0];
const names=['Accueil','Favoris','Dossier','Inventaire','Factures','Corbeille'];
const kinds=['home','fav','folder','inventory','invoices','trash'];
const nav='<nav class="bottom-nav">'+names.map((n,i)=>'<button type="button" class="bottom-nav-item cdq-nav-'+kinds[i]+(i===0?' active home-nav-button':'')+'"><span class="cdq-icon-host-v2514">★</span><small>'+n+'</small></button>').join('')+'</nav>';
const content='<main class="container">'+header+'<div class="company-wrapper"><button class="company-button" id="companyButton">Choisir une compagnie</button><button class="company-reset-button">↻</button></div><div class="quick-buttons">'+['Balance intermédiaire','Balance à camion','Balance de précision','Balance multi-tête'].map((n,i)=>'<button class="quick-button quick-'+['intermediaire','camion','precision','multitete'][i]+'"><span class="quick-icon">⚖</span><span class="quick-name">'+n+'</span></button>').join('')+'</div><div id="cdqTopActionsV2204">'+['Hors ligne','Note','Photos','Réglages'].map(n=>'<button class="cdq-top-action"><span>✧</span><span>'+n+'</span></button>').join('')+'</div><div id="filesContainer">'+('<p>Contenu de test</p>'.repeat(50))+'</div></main>'+nav;
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost');
 res.setHeader('Content-Type','text/html; charset=utf-8');
 if(u.pathname==='/shell'){
  res.end('<!doctype html><html data-cdq-iphone-version="25.32"><head><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><script src="/safe-viewport-v2532.js" data-cdq-viewport="shell"></script><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:black}#app{border:0;width:100%;height:100%}</style></head><body><iframe id="app" src="/selector?ios=1"></iframe></body></html>');return;
 }
 if(u.pathname==='/selector'){
  res.end('<!doctype html><html class="'+(u.searchParams.has('ios')?'ios':'android')+'"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><script src="/safe-viewport-v2532.js" data-cdq-viewport="selector"></script>'+styles+'</head><body>'+content+'<script>'+mobile+'</script></body></html>');return;
 }
 if(u.pathname==='/safe-viewport-v2532.js'){
  res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync('safe-viewport-v2532.js'));return;
 }
 res.statusCode=404;res.end('not found');
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
const snapshot=()=>({viewport:[innerWidth,innerHeight],safe:document.documentElement.dataset.cdqSafeFrame,dimensions:window.cdqMobileDimensions,bodyPadding:getComputedStyle(document.body).padding,rects:[...document.querySelectorAll('.app-header,.company-wrapper,.quick-buttons,#cdqTopActionsV2204,.bottom-nav,.bottom-nav small')].map(el=>{const r=el.getBoundingClientRect();return {name:el.className||el.id,left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};}),prefs:['General','Text','Icon'].map(k=>localStorage.getItem('cdqUi'+k+'ScaleV89'))});
function fits(s){for(const r of s.rects){assert(r.left>=-1&&r.right<=s.viewport[0]+1,JSON.stringify(r));if(r.name.includes('bottom-nav'))assert(r.bottom<=s.viewport[1]+1&&r.top>=0,JSON.stringify(r));}assert(s.rects[0].top>=0);assert.equal(s.safe,'1');assert(s.bodyPadding.startsWith('0px'),'Safe top is applied once: '+s.bodyPadding);}
const types=process.env.CDQ_ONLY_CHROMIUM?[['Chromium',chromium]]:[['Chromium',chromium],['WebKit',webkit]];
try{for(const [name,type] of types){
 const browser=await type.launch({headless:true,...(name==='Chromium'&&process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH,args:['--no-sandbox']}: {})});
 try{
  const context=await browser.newContext({viewport:{width:393,height:780},userAgent:'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36 BalanceCDQAndroid/25.32 CDQSafeArea/1'});
  await context.route('https://**/*',r=>r.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/selector');await page.waitForFunction(()=>window.cdqMobileDimensions);
  for(const size of [{width:320,height:640},{width:360,height:736},{width:393,height:820},{width:412,height:835},{width:480,height:960},{width:880,height:320}]){
   await page.setViewportSize(size);await page.evaluate(()=>window.cdqMobileLayout.apply());
   const s=await page.evaluate(snapshot);fits(s);assert.deepEqual(s.prefs,[null,null,null],'Initial layout never writes defaults');
   assert(Math.abs(s.dimensions.reference-Math.min(480,size.width)/384)<.001);
   console.log(name,'native-safe viewport',size,s.dimensions.navHeight);
  }
  await page.setViewportSize({width:360,height:650});
  await page.evaluate(()=>{for(const [k,v] of [['General','70'],['Text','85'],['Icon','90']])localStorage.setItem('cdqUi'+k+'ScaleV89',v);window.cdqMobileLayout.apply();});
  fits(await page.evaluate(snapshot));assert.deepEqual((await page.evaluate(snapshot)).prefs,['70','85','90']);
  await page.setViewportSize({width:412,height:350});await page.evaluate(()=>window.cdqMobileLayout.apply());fits(await page.evaluate(snapshot));
  await page.setViewportSize({width:412,height:835});await page.evaluate(()=>window.cdqMobileLayout.apply());fits(await page.evaluate(snapshot));
  assert.deepEqual((await page.evaluate(snapshot)).prefs,['70','85','90']);assert.deepEqual(errors,[]);await context.close();
  const ios=await browser.newContext({viewport:{width:393,height:852},userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18 Mobile Safari/604.1'});
  await ios.route('https://**/*',r=>r.abort());const p=await ios.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'/shell');
  await p.waitForFunction(()=>document.querySelector('#app').contentWindow.cdqMobileDimensions);
  // Explicit insets are test fixtures, not guessed values in production code.
  await p.evaluate(()=>{const r=document.documentElement;r.style.setProperty('--cdq-window-top','59px');r.style.setProperty('--cdq-window-bottom','34px');});
  await p.waitForTimeout(100);
  const r=await p.locator('#app').boundingBox();assert.equal(r.y,59);assert.equal(r.height,852-59-34);
  const f=p.frames().find(f=>f.url().includes('/selector?ios'));fits(await f.evaluate(snapshot));
  assert.deepEqual((await f.evaluate(snapshot)).prefs,[null,null,null]);
  await p.setViewportSize({width:852,height:393});
  await p.evaluate(()=>{const r=document.documentElement;for(const [k,v] of [['top','0px'],['left','59px'],['right','59px'],['bottom','21px']])r.style.setProperty('--cdq-window-'+k,v);});await p.waitForTimeout(100);
  const landscape=await p.locator('#app').boundingBox();assert.equal(landscape.x,59);assert.equal(landscape.width,734);fits(await f.evaluate(snapshot));
  assert.deepEqual(errors,[]);await ios.close();
 }finally{await browser.close();}
}}finally{server.close();}
console.log('PASS: native-safe geometry, gesture/3-button viewport sizes, rotation, narrow widths, large saved settings, keyboard-size resize, iPhone parent/child single-inset ownership; no preference overwrite.');
