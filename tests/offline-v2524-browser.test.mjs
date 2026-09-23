import fs from 'node:fs';import http from 'node:http';import assert from 'node:assert/strict';import puppeteer from 'puppeteer-core';
const read=p=>fs.readFileSync(p,'utf8'),dir='bundles/balance-cdq/v25.24';
const full=process.env.CDQ_V2524_SELECTOR?read(process.env.CDQ_V2524_SELECTOR):'';
const styles=(full?[...full.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map(m=>m[0]).join(''):'<style>'+read('bundles/balance-cdq/v25.16/mobile-layout.css')+read(dir+'/interface.css')+'</style>');
const setup=`
let utilisateurCourantEmail='a@example.invalid',utilisateurCourantRole='technicien',cdqAccessState='ready',compagnieSelectionnee='client_one',nomCompagnieSelectionnee='Compagnie Un';
let toutesLesCompagnies=[{id:'client_one',nom:'Compagnie Un'},{id:'client_two',nom:'Compagnie Deux'}];
const CACHE_STORE_NAME='cache';window.queue=[];window.calls=[];window.hold=false;window.release=null;
const cdqReaderOwnerV2520=()=>{if(cdqAccessState!=='ready'||!utilisateurCourantEmail)throw Error('Verrouillé');return utilisateurCourantEmail;};
const cdqReaderGuardV2520=email=>{if(cdqReaderOwnerV2520()!==email)throw Error('Le compte a changé');};
const cleCacheLocale=(type,id)=>'v1|'+utilisateurCourantEmail+'|'+type+'|'+id;
const cdqV19Key=(type,id)=>cleCacheLocale('v19-'+type,id);
function ouvrirBaseCache(){return new Promise((resolve,reject)=>{const r=indexedDB.open('fixture-v24',1);r.onupgradeneeded=()=>r.result.createObjectStore(CACHE_STORE_NAME,{keyPath:'key'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function action(key,value,remove=false){const db=await ouvrirBaseCache();return new Promise((resolve,reject)=>{const t=db.transaction(CACHE_STORE_NAME,value||remove?'readwrite':'readonly'),store=t.objectStore(CACHE_STORE_NAME);const r=remove?store.delete(key):value?store.put({...value,key}):store.get(key);let result;r.onsuccess=()=>result=r.result;t.oncomplete=()=>{db.close();resolve(result)};t.onerror=()=>reject(t.error);});}
const cdqV19GetRecord=(type,id)=>action(cdqV19Key(type,id));const cdqV19PutRecord=(type,id,r)=>action(cdqV19Key(type,id),r);const supprimerCacheLocal=key=>action(key,null,true);
const cdqV19QueueGet=async()=>queue;const CDQ_DOCUMENT_MAX_BYTES=32*1024*1024;
const cdqV2112Base64ToBytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
function cdqV19CreateModal(id,title){let o=document.getElementById(id);if(!o){o=document.createElement('div');o.id=id;o.className='modal-overlay';o.innerHTML='<div class="modal"><h2></h2><div class="cdq-v19-body"></div><button class="cdq-v19-close">Fermer</button></div>';o.querySelector('button').onclick=()=>o.style.display='none';document.body.append(o);}o.querySelector('h2').textContent=title;return o;}
function cdqV19OfflineStatus(label,state){const b=document.getElementById('cdqV19OfflineStatus');b.title=label;}
const cdqPwaAvailable=()=>true,cdqPostToPwa=data=>parent.postMessage(data,location.origin),cdqFromPwa=e=>e.source===parent&&e.origin===location.origin;
const afficherErreur=e=>{window.lastError=e.message||String(e)};const cdqOpenPdf=async id=>{window.opened=id;};
async function cdqV19Gs(name,args){calls.push([name,...args]);if(name==='obtenirManifestHorsLigneClient')return {client:{id:args[0]},fichiers:[{id:'pdf_one',nom:'Un.pdf',type:'PDF'},{id:'pdf_two',nom:'Deux.pdf',type:'PDF'},{id:'sheet_one',nom:'Feuille',type:'GOOGLE_SHEETS'}]};if(name==='obtenirPdfLecteurCDQV2520')return {id:args[0],revision:'rev1',taille:14,chunks:2};if(name==='obtenirChunkDocumentPdfCDQ'){if(hold)await new Promise(r=>release=r);return {revision:'rev1',base64:btoa(args[2]===0?'%PDF-1.':'7 test!')};}throw Error(name);}
function mettreAJourInfosClient(c){document.getElementById('clientNoteButton').classList.toggle('has-note',!!c.notePresente);document.getElementById('clientPhotoButton').classList.toggle('has-photo',!!c.photoPresente);}
function mettreAJourIndicateurNote(type,id,p){if(type==='dossier'&&id===compagnieSelectionnee)document.getElementById('clientNoteButton').classList.toggle('has-note',p);}
function cdqSetPhotoPresence(type,id,p){if(type==='client'&&id===compagnieSelectionnee)document.getElementById('clientPhotoButton').classList.toggle('has-photo',p);}
function ouvrirNoteDossierClient(){window.noteTarget=['dossier',compagnieSelectionnee];}function ouvrirNoteFichier(f){window.noteTarget=['fichier',f.id];}function ouvrirPhotosCible(type,id){window.photoTarget=[type,id];}
`;
const phone=`<!doctype html><html class="android"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8">${styles}<style>body{margin:0;background:#101820;color:#fff;font:14px Arial}.modal-overlay{position:fixed;inset:0;z-index:10001;background:#000a;align-items:center;justify-content:center}.modal{padding:16px;background:#17242e}.bottom-nav{display:flex;background:#17242e}.bottom-nav-item{display:flex;flex-direction:column}#clientInfoBar{display:flex!important}#cdqTopActionsV2204{display:flex}.file-row{padding:16px}.cdq-v19-body{max-height:70vh}#filesContainer{display:block!important}</style></head><body>
<div class="container"><div id="cdqTopActionsV2204">${['clientNoteButton','cdqV19OfflineStatus','clientPhotoButton','cdqTopDisplayButtonV2204'].map((id,i)=>`<button id="${id}" class="cdq-top-action"><span>▣</span><span>${['Note','Hors ligne','Photos','Réglages'][i]}</span></button>`).join('')}</div>
<div id="clientInfoBar"><span class="client-info-name-wrap"><span id="clientInfoName">Compagnie Un</span><span id="clientNoteDot" hidden></span></span><span id="clientStats">2 fichiers</span></div>
<div id="filesContainer">${['one','two'].map(x=>`<div class="file-row" data-file-id="pdf_${x}" data-file-name="${x}.pdf"><input type="checkbox" class="file-checkbox" data-file-id="pdf_${x}"><span class="file-name">Rapport ${x}.pdf</span></div>`).join('')}</div></div>
<nav class="bottom-nav">${['Accueil','Favoris','Dossier','Inventaire','Factures','Corbeille'].map(n=>`<button class="bottom-nav-item active"><span>▣</span><small>${n}</small></button>`).join('')}</nav>
<script>${setup}</script><script>${read('bundles/balance-cdq/v25.16/mobile-layout.js')}</script><script>${read(dir+'/offline.js')}</script><script>${read(dir+'/company.js')}</script><script>document.getElementById('cdqV19OfflineStatus').onclick=()=>cdqOffline24.open().catch(afficherErreur);</script></body></html>`;
const outer=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><iframe id="selector" src="/phone" style="width:100vw;height:100vh;border:0"></iframe><script type="module">
import {createOfflineTemplates} from '/offline-templates-v2524.mjs';window.sent=[];window.opened=[];window.unlocked=0;
window.controller=createOfflineTemplates({send:data=>{sent.push(data);document.getElementById('selector').contentWindow.postMessage(data,location.origin)},unlock:async()=>{unlocked++},openPdf:data=>{opened.push(data)}});
window.addEventListener('message',e=>{if(e.source===document.getElementById('selector').contentWindow&&e.origin===location.origin)controller.handle(e.data)});
if(!location.search.includes('locked'))await controller.handle({type:'CDQ_OFFLINE_SESSION',email:'a@example.invalid',canWrite:true,protocol:38});window.booted=true;
</script></body></html>`;
const server=http.createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname;if(p==='/phone'||p==='/test'){res.setHeader('Content-Type','text/html;charset=utf-8');res.end(p==='/phone'?phone:outer);return;}
const f=p.replace(/^\/Rapports--talonnages-CDQ\//,'').replace(/^\//,'');if(f.includes('..')||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.statusCode=404;res.end();return;}res.setHeader('Content-Type',f.endsWith('.mjs')||f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.html')?'text/html':f.endsWith('.json')?'application/json':'application/octet-stream');res.end(fs.readFileSync(f));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewport({width:393,height:850,isMobile:true,hasTouch:true});
 await page.setRequestInterception(true);page.on('request',r=>/^http:\/\/127\.0\.0\.1:|^(blob|data):/.test(r.url())?r.continue():r.respond({status:200,body:''}));
 await page.goto(origin+'/test');await page.waitForFunction(()=>window.booted).catch(async e=>{console.log('Boot errors',errors,'State',await page.evaluate(()=>({text:document.body.innerText,controller:!!window.controller})));throw e;});let frame=page.frames().find(f=>f.url().endsWith('/phone'));await frame.waitForFunction(()=>window.cdqOffline24);
 await frame.click('#cdqV19OfflineStatus');await frame.waitForSelector('.cdq24-checklist input');
 assert.equal(await frame.$$eval('.cdq24-checklist input',els=>els.length),2);
 await frame.evaluate(()=>{document.querySelector('.cdq24-checklist input[value="pdf_one"]').checked=true;hold=true;[...document.querySelectorAll('#cdqDocumentPrepare button')].find(b=>b.textContent==='Préparer les fichiers cochés').click();});
 await frame.waitForFunction(()=>release);await frame.click('.cdq-v19-close');assert.equal(await frame.$eval('#cdqV19OfflineStatus',b=>b.disabled),false);
 await frame.click('#cdqV19OfflineStatus');await frame.waitForSelector('#cdqDocumentPrepare [data-progress24] progress');assert.match(await frame.$eval('[data-progress24]',e=>e.textContent),/0 %/);
 await frame.evaluate(()=>{const r=release;release=null;hold=false;r();});await frame.waitForFunction(()=>!cdqOffline24.job.running);
 assert.equal(await frame.evaluate(()=>cdqOffline24.job.ready),1);assert.equal(await frame.evaluate(()=>calls.some(c=>c[0]==='obtenirPdfLecteurCDQV2520'&&c[1]==='pdf_two')),false);
 assert.equal(await frame.$eval('[data-progress24] progress',e=>e.value),100);
 assert.equal(await frame.$eval('[data-file-id="pdf_one"] .cdq24-offline-dot',e=>!e.hidden),true);
 await frame.click('.cdq24-file-open');assert.equal(await frame.evaluate(()=>window.opened),'pdf_one');assert.equal(await frame.$eval('#cdqDocumentPrepare',e=>e.style.display),'none');
 // Cancel during a chunk: no incomplete PDF is stored, earlier completed files remain.
 await frame.evaluate(async()=>{await cdqOffline24.open();document.querySelector('.cdq24-checklist input[value="pdf_two"]').checked=true;hold=true;[...document.querySelectorAll('#cdqDocumentPrepare button')].find(b=>b.textContent==='Préparer les fichiers cochés').click();});
 await frame.waitForFunction(()=>release);await frame.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Annuler la préparation').click());
 await frame.evaluate(()=>{hold=false;release();release=null});await frame.waitForFunction(()=>!cdqOffline24.job.running);assert.equal(await frame.evaluate(async()=>!!await cdqV19GetRecord('document-pdf','pdf_two')),false);
 // Actual IndexedDB persists across page closure and reopening; access is locked first.
 await page.goto(origin+'/test?locked');await page.waitForFunction(()=>window.booted);frame=page.frames().find(f=>f.url().endsWith('/phone'));
 await page.waitForSelector('#cdq-offline-launch',{visible:true});await page.click('#cdq-offline-launch');await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Déverrouiller avec la sécurité de l’appareil'));
 assert.equal(await page.evaluate(()=>opened.length),0);await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Déverrouiller avec la sécurité de l’appareil').click());
 await page.waitForFunction(()=>document.body.innerText.includes('Un.pdf'));await page.evaluate(()=>[...document.querySelectorAll('section button')].find(b=>b.textContent==='Ouvrir').click());
 assert.equal(await page.evaluate(()=>opened[0].blob.size),14);assert.equal(await page.evaluate(()=>unlocked),1);
 // Offline edits cannot be removed; reconnection sends the original revision and preserves failures.
 await page.evaluate(async()=>{await opened[0].onSave(new Blob(['%PDF-1.7 changes'],{type:'application/pdf'}),'edit_one');});
 await page.evaluate(()=>[...document.querySelectorAll('section button')].find(b=>b.textContent==='Retirer du mode hors ligne').click());
 await page.waitForFunction(()=>document.body.innerText.includes('Synchronisez les modifications'));
 await page.evaluate(async()=>{await controller.handle({type:'CDQ_OFFLINE_SESSION',email:'a@example.invalid',canWrite:true,protocol:38});});
 const save=await page.evaluate(()=>sent.find(m=>m.type==='CDQ_OFFLINE_SAVE'));assert.equal(save.driveId,'pdf_one');assert.equal(save.revision,'rev1');
 await page.evaluate(async()=>{const s=sent.find(m=>m.type==='CDQ_OFFLINE_SAVE');await controller.handle({type:'CDQ_OFFLINE_SAVE_RESULT',requestId:s.requestId,uploadId:s.uploadId,ok:true,id:s.driveId,revision:'rev2'});});
 await page.evaluate(()=>[...document.querySelectorAll('section button')].find(b=>b.textContent==='Retirer du mode hors ligne').click());await page.waitForFunction(()=>!document.body.innerText.includes('Un.pdf'));
 await frame.evaluate(()=>cdqOffline24.refresh());assert.equal(await frame.evaluate(async()=>!!await cdqV19GetRecord('document-pdf','pdf_one')),false);
 // Company dots always open the company, even when a file is selected.
 await page.evaluate(()=>[...document.querySelectorAll('section button')].find(b=>b.textContent==='Retour').click());
 await frame.evaluate(()=>{mettreAJourInfosClient({notePresente:true,photoPresente:true});document.querySelector('.file-checkbox').checked=true;});
 await frame.click('#clientNoteDot');await frame.click('#clientPhotoDot24');assert.deepEqual(await frame.evaluate(()=>noteTarget),['dossier','client_one']);assert.deepEqual(await frame.evaluate(()=>photoTarget),['client','client_one']);
 await frame.evaluate(()=>document.querySelector('.file-checkbox').checked=false);await frame.click('#clientNoteButton');await frame.click('#clientPhotoButton');assert.deepEqual(await frame.evaluate(()=>noteTarget),['dossier','client_one']);
 // A progress/menu update must not move the bottom navigation.
 const before=await frame.$eval('.bottom-nav',e=>e.getBoundingClientRect().toJSON());await frame.evaluate(()=>cdqOffline24.open());await frame.waitForSelector('.cdq24-checklist');
 const after=await frame.$eval('.bottom-nav',e=>e.getBoundingClientRect().toJSON());assert.equal(after.bottom,before.bottom);assert.equal(after.height,before.height);
 assert.equal(await frame.$eval('.bottom-nav-item',e=>getComputedStyle(e,'::after').display),'none');
 await page.screenshot({path:'/tmp/cdq-v2524-offline.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS V25.24: selective preparation, progress, reopen, cancel, durable restart, unlock, edit/sync/removal, company dots, stable navigation.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
