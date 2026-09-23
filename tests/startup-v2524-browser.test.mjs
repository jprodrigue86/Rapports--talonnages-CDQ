import fs from 'node:fs';import http from 'node:http';import assert from 'node:assert/strict';import puppeteer from 'puppeteer-core';
const server=http.createServer((req,res)=>{let path=new URL(req.url,'http://local').pathname.replace(/^\/Rapports--talonnages-CDQ\//,'/').slice(1)||'index.html';if(path.includes('..')||!fs.existsSync(path)||!fs.statSync(path).isFile()){res.statusCode=404;return res.end()}
res.setHeader('Content-Type',/\.(mjs|js)$/.test(path)?'text/javascript':path.endsWith('.html')?'text/html':path.endsWith('.wasm')?'application/wasm':path.endsWith('.css')?'text/css':path.endsWith('.json')?'application/json':path.endsWith('.webp')?'image/webp':'application/octet-stream');res.end(fs.readFileSync(path));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
async function prepare(page){await page.setViewport({width:393,height:850,isMobile:true,hasTouch:true});await page.setUserAgent('Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/148 Mobile Safari/537.36 BalanceCDQAndroid/25.21');
await page.setRequestInterception(true);page.on('request',r=>/^http:\/\/127\.0\.0\.1:|^(data|blob):/.test(r.url())?r.continue():r.respond({status:200,contentType:'text/html',body:'<p>Accès distant simulé</p>'}));
await page.evaluateOnNewDocument(()=>{window.BalanceCDQNative={biometric:id=>setTimeout(()=>window.cdqNativeBiometricResultV2507(id,true,''),20)};});}
try{
 let page=await browser.newPage();await prepare(page);await page.goto(origin+'/index.html');
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.waitForFunction(()=>navigator.serviceWorker.controller);
 // Inspect the actual shell: no masking layer can obscure the loader at the bottom.
 await page.evaluate(()=>{document.getElementById('app').style.visibility='hidden';document.getElementById('loading').style.display='grid';});
 assert.equal(await page.$eval('#cdq-auth-bottom-mask-v2507',e=>getComputedStyle(e).display),'none');
 const box=await page.evaluate(()=>{document.getElementById('loading').style.display='grid';return document.querySelector('#loading .box').getBoundingClientRect().toJSON();});assert.ok(box.top>650&&box.bottom<=850&&box.height>20,JSON.stringify(box));
 assert.equal(await page.$eval('#loading .music-wall-image',e=>getComputedStyle(e).backgroundSize),'100% 100%');
 await page.screenshot({path:'/tmp/cdq-v2524-startup.png'});
 await page.evaluate(async()=>{const ctl=await cdqOffline;const {floorTemplate}=await import('./floor-template-v2519.mjs');const pdf=await floorTemplate();await ctl.handle({type:'CDQ_OFFLINE_SESSION',email:'a@example.invalid',canWrite:true,protocol:38});await ctl.handle({type:'CDQ_OFFLINE_DOCUMENT_STORE',requestId:'prepare',fileId:'report_floor',clientId:'client_one',clientName:'Compagnie Un',revision:'r1',name:'Rapport préparé.pdf',blob:pdf.blob});});
 await page.close();page=await browser.newPage();await prepare(page);await page.setOfflineMode(true);await page.goto(origin+'/index.html');
 await page.evaluate(()=>{Object.defineProperty(navigator,'onLine',{configurable:true,value:false});window.dispatchEvent(new Event('offline'));});
 await page.waitForSelector('#cdq-offline-launch',{visible:true});await page.click('#cdq-offline-launch');await page.waitForFunction(()=>[...document.querySelectorAll('section button')].some(b=>b.textContent==='Déverrouiller avec la sécurité de l’appareil'));
 await page.evaluate(()=>[...document.querySelectorAll('section button')].find(b=>b.textContent==='Déverrouiller avec la sécurité de l’appareil').click());
 await page.waitForFunction(()=>[...document.querySelectorAll('section button')].some(b=>b.textContent==='Ouvrir'));
 await page.evaluate(()=>[...document.querySelectorAll('section button')].find(b=>b.textContent==='Ouvrir').click());
 await page.waitForFunction(()=>document.querySelector('#legacy-pdf-reader')?.contentDocument?.querySelectorAll('.annotationLayer input').length>100,{timeout:25000});
 assert.equal(await page.evaluate(()=>navigator.onLine),false);await page.screenshot({path:'/tmp/cdq-v2524-offline-restart-reader.png'});
 console.log('PASS V25.24: actual startup loader, service-worker offline restart after closing tab, native unlock bridge and actual PDF reader.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
