import fs from 'node:fs';import http from 'node:http';import assert from 'node:assert/strict';import puppeteer from 'puppeteer-core';import {applyPatch} from './helpers/settings-fixture.mjs';
const read=p=>fs.readFileSync(p,'utf8');const manifest=JSON.parse(read('bundles/balance-cdq/v25.19/manifest.json'));
let source=read('tests/fixtures/v25.18-floor-copy.js');
for(const patch of manifest.patches.filter(p=>p.file==='Selector.html'&&p.op==='replace_literal'&&source.includes(p.search)))source=applyPatch(source,patch);
for(const patch of JSON.parse(read('bundles/balance-cdq/v25.23/manifest.json')).patches.filter(p=>p.file==='Selector.html'&&p.op==='replace_literal'&&source.includes(p.search)))source=applyPatch(source,patch);
const embedded=manifest.patches.find(p=>p.replacement?.includes('id="cdqV2519PlancherEmbeddedJs"')).replacement;
const setup=`
let cdqAccessState='ready',utilisateurCourantEmail='tech@example.invalid',utilisateurCourantRole='technicien',compagnieSelectionnee='client_1',nomCompagnieSelectionnee='Client test',cdqDossierOuvertId='folder_1',cdqDossierOuvertNom='Atelier';
let cdqCopieEnCours=false,typeCopieEnAttente='intermediaire',modeleCopieEnAttente='plancher',cdqCopieRequestId='',cdqCopieRequestScope='';
const CDQ_MODELES_INTERMEDIAIRES={plancher:'Balance de plancher'},CDQ_TEMPLATE_REVISION='plancher-fillable-v22.91-20260921',records=new Map();
window.sent=[];window.errors=[];window.opened=[];window.rpc=[];const CDQ_PWA_ORIGIN=location.origin,utilisateurCourantNomRapport='Technicien hors ligne';
const cdqModeleIntermediaireId=id=>id||'plancher',cdqTemplateRecord=id=>'master-'+id,cdqPwaAvailable=()=>true,cdqFromPwa=e=>e.origin===location.origin;
const cdqV2112GetCachedTemplate=async id=>records.get('master-'+id),cdqV19PutRecord=async(type,id,rec)=>records.set(id,rec);
const cdqDestinationCreationId=()=>cdqDossierOuvertId,fermerCopie=()=>{},afficherMessage=()=>{},afficherErreur=e=>errors.push(e.message);
function cdqPublierSessionHorsLigne(){cdqPostToPwa({type:'CDQ_OFFLINE_SESSION',email:utilisateurCourantEmail,canWrite:['admin','technicien'].includes(utilisateurCourantRole),protocol:38});}
const cdqPostToPwa=data=>controller.handle(data);
window.cdqAppelServeur=async(...args)=>{rpc.push(args);throw Error('No Drive request allowed');};
function cdqV19Gs(...args){return window.cdqAppelServeur(...args)}
`;
const shell=read('index.html'),reader=shell.slice(shell.indexOf('// Lecteur commun PC/Android'),shell.indexOf('/* =====================================================\nCDQ V21.19'));
const html=`<!doctype html><meta charset="utf-8"><div id="copyModalOverlay"><button class="copy-confirm" onclick="confirmerCopie()">Créer Balance de plancher</button><button class="copy-cancel">Annuler</button></div><p id="copyModalStatus"></p><script>${setup}\n${source}\n${reader}\n${read('bundles/balance-cdq/v25.23/creation.js')}</script>${embedded}<script type="module">import {createOfflineTemplates} from '/offline-templates-v2519.mjs';
window.controller=createOfflineTemplates({send:data=>{sent.push(data);window.postMessage(data,location.origin)},unlock:async()=>{},openPdf:data=>{opened.push(data);cdqAfficherPdf(data)}});window.booted=true;</script>`;
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');if((url.pathname==='/test'||url.pathname==='/')){res.setHeader('Content-Type','text/html;charset=utf-8');return res.end(html)}const path=url.pathname.replace(/^\/Rapports--talonnages-CDQ\//,'/').slice(1);if(!path.includes('..')&&fs.existsSync(path)&&fs.statSync(path).isFile()){res.setHeader('Content-Type',(path.endsWith('.mjs')||path.endsWith('.js'))?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.wasm')?'application/wasm':path.endsWith('.html')?'text/html':path.endsWith('.pdf')?'application/pdf':'text/plain');res.end(fs.readFileSync(path));}else{res.statusCode=404;res.end()}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const page=await browser.newPage();const errors=[];page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push('HTTP '+r.status()+': '+r.url())});page.on('console',m=>{if(m.type()==='error'&&m.text().includes('setDocument:'))errors.push(m.text())});page.on('pageerror',e=>errors.push(e.message));if(process.env.CDQ_TEST_READER==='1'){page.on('requestfailed',r=>console.log('Network:',r.url(),r.failure()?.errorText));page.on('console',m=>{if(m.type()==='error')console.log('Browser:',m.text())});}
 await page.setViewport({width:393,height:851});
 // Offline network flag with the already-loaded app; all Google requests are blocked.
 await page.setRequestInterception(true);page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:')&&!r.url().startsWith('blob:')&&!r.url().startsWith('data:'))return r.abort();return r.continue()});
 await page.goto('http://127.0.0.1:'+server.address().port+'/test');await page.waitForFunction(()=>window.booted);
 await page.evaluate(()=>{Object.defineProperty(navigator,'onLine',{configurable:true,value:false});window.dispatchEvent(new Event('offline'))});
 await page.click('.copy-confirm');await page.waitForFunction(()=>sent.some(m=>m.type==='CDQ_OFFLINE_CREATE_LOCAL_RESULT'&&m.ok),{timeout:30000});assert.equal(await page.evaluate(()=>opened.length),0);
 assert.equal(await page.evaluate(()=>rpc.length),0);assert.equal(await page.evaluate(()=>sent.some(m=>m.type==='CDQ_OFFLINE_COPY')),false);
 assert.equal(await page.evaluate(()=>sent.some(m=>m.type==='CDQ_OFFLINE_CREATE_LOCAL_RESULT'&&m.ok)),true);
 assert.equal(await page.evaluate(()=>document.querySelector('#cdq-offline-launch').hidden),true);
 // Durable IDB copy exists before the viewer starts.
 const inspect=()=>new Promise((resolve,reject)=>{const q=indexedDB.open('cdq-offline-templates-v1',1);q.onsuccess=()=>{const db=q.result,r=db.transaction('copies','readonly').objectStore('copies').getAll();r.onsuccess=()=>{db.close();resolve(r.result.map(c=>({id:c.id,bytes:c.blob.size,templateId:c.templateId,status:c.status})))}};q.onerror=()=>reject(q.error)});
 let copies=await page.evaluate(inspect);assert.equal(copies.length,1);assert.ok(copies[0].bytes>628837);
 await page.evaluate(async()=>{await controller.handle({type:'CDQ_OFFLINE_SHOW_LOCAL'});const b=[...document.querySelectorAll('button')].find(b=>b.textContent==='Ouvrir la copie');b.click()});await page.waitForFunction(()=>opened.length===1);
 // Real reader checks are opt-in for networked validation; unit tests never depend on the CDN.
 if(process.env.CDQ_TEST_READER==='1'){
  await page.waitForFunction(()=>{const f=document.querySelector('#legacy-pdf-reader');return f?.contentDocument?.querySelectorAll('.annotationLayer input').length>100},{timeout:20000}).catch(async e=>{console.log('Reader state',await page.evaluate(()=>document.querySelector('#legacy-pdf-reader')?.contentDocument?.body.innerText));throw e;});
  const frame=page.frames().find(f=>f.url().includes('/reader-v2523.html'));
  assert.ok((await frame.$$eval('.annotationLayer input',e=>e.length))>100);
  await frame.$eval('input[name="client_nom"]',e=>{e.value='Essai hors ligne';e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))});
  await frame.click('#save');await frame.waitForFunction(()=>document.querySelector('#status').textContent.includes('Conservé'),{timeout:20000});
  await page.screenshot({path:'/tmp/cdq-plancher-v2519.png'});
 }
 // Install the real app service worker, cache this test route, then restart with the network disabled.
 await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready});
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await page.reload();await page.waitForFunction(()=>window.booted);
 await page.setOfflineMode(true);await page.reload();await page.waitForFunction(()=>window.booted);
 await page.evaluate(()=>Object.defineProperty(navigator,'onLine',{configurable:true,value:false}));
 copies=await page.evaluate(inspect);assert.equal(copies.length,1);assert.equal(copies[0].status,'pending');
 await page.click('.copy-confirm');await page.waitForFunction(()=>sent.some(m=>m.type==='CDQ_OFFLINE_CREATE_LOCAL_RESULT'&&m.ok),{timeout:30000});assert.equal(await page.evaluate(()=>opened.length),0);
 assert.equal(await page.evaluate(()=>opened.length),0);copies=await page.evaluate(inspect);assert.equal(copies.length,2);
 assert.equal(await page.evaluate(()=>rpc.length),0);assert.deepEqual(await page.evaluate(()=>errors),[]);assert.deepEqual(errors,[]);
 console.log('PASS: actual copy handler, offline first-use, no Drive/RPC, approved template, prefilled copies without auto-open, manual reader access, durable IDB after reload.');
}finally{await browser.close();await new Promise(r=>server.close(r))}
