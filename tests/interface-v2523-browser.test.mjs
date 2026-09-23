import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import {fixture} from './helpers/desktop-ergonomics-fixture.mjs';
const read=p=>fs.readFileSync(p,'utf8'),dir='bundles/balance-cdq/v25.23';
const full=process.env.CDQ_V2523_SELECTOR?read(process.env.CDQ_V2523_SELECTOR):'';
const styles=full?[...full.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map(m=>m[0]).join(''):'<style>'+read('bundles/balance-cdq/v25.18/desktop.css')+read('bundles/balance-cdq/v25.22/interface.css')+read(dir+'/interface.css')+'</style>';
const setup=`
window.cdqAccessState='ready';window.utilisateurCourantRole='admin';window.CDQ_PWA_ORIGIN=location.origin;window.isOwner=true;window.holdDrive=false;window.driveReplies=[];
window.estProprietairePrincipalInterface=()=>isOwner;window.afficherErreur=e=>{window.lastError=e.message};window.utilisateurCourantNomRapport='Technicien test';
window.cdqAppelServeur=async(name,args=[])=>{
 if(name==='obtenirConversionPlancherCDQV2523')return {exists:false};
 if(name==='obtenirContexteCreationCDQV2523')return {client_nom:'Ancien nom',client_ville:'Ville test',client_adresse:'10 rue Test',client_technicien:'Technicien serveur'};
 if(name==='obtenirEmplacementGeneralCDQV2523')return {parentId:'drive_root',kind:'file'};
 if(name==='definirFavoriGeneralCDQV2521')return {favori:args[1]};
 if(name==='obtenirDossierGeneralCDQV2521'){
  const value={id:args[0],nom:'Rapports de test',crumbs:[{id:'drive_root',nom:'Drive général'},{id:args[0],nom:'Rapports de test'}],items:Array.from({length:args[1]?2:24},(_,i)=>({id:(args[1]?'next_':'file_')+i,nom:'Balance de plancher '+i+'.pdf',kind:'file',mimeType:'application/pdf',favori:false})),nextPageToken:args[1]?'':'next'};
  if(holdDrive)return new Promise(r=>driveReplies.push(()=>r(value)));return value;
 }
 throw Error('Unexpected RPC '+name);
};
window.cdqOpenPdfV2520=async id=>{window.lastPdf=id};
`;
const modules=['row-loading','creation','drive-main','migration'].map(n=>'<script>'+read(dir+'/'+n+'.js')+'</script>').join('');
const extras='<script>'+setup+'</script>'+modules;
const pc=fixture().replace(read('bundles/balance-cdq/v25.18/desktop.js'),()=>read(dir+'/desktop.js')).replace('</head>',()=>styles+'</head>').replace('</body>',()=>extras+'</body>');
const phone='<!doctype html><html class="android"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8">'+styles+'<style>body{margin:0;background:#121921;color:white;font-family:Arial}#filesContainer{padding:8px}#accessOverlay{position:static;background:none!important}.access-card{margin:12px auto}#accessOverlay .access-card button{color:inherit}</style></head><body><div id="accessOverlay" data-state="pin"><div class="access-card"><h2>Entrer le NIP</h2><input placeholder="••••••"><button>Continuer</button></div></div><div><button id="cdqAdminSettingsButton">Gestion utilisateurs</button></div><div id="filesContainer"><p>Liste clients initiale</p></div><nav class="bottom-nav"><button class="bottom-nav-item">Clients</button></nav><script>window.utilisateurCourantEmail="owner@example.invalid";window.compagnieSelectionnee="c0";window.nomCompagnieSelectionnee="Client actuel";</script>'+extras+'</body></html>';
const server=http.createServer((req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/pc'||path==='/phone'){res.setHeader('Content-Type','text/html;charset=utf-8');return res.end(path==='/pc'?pc:phone)}
 const f=path.replace(/^\/Rapports--talonnages-CDQ\//,'').replace(/^\//,'');
 if(f.includes('..')||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.statusCode=404;return res.end()}
 res.setHeader('Content-Type',f.endsWith('.mjs')||f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.wasm')?'application/wasm':f.endsWith('.html')?'text/html':'application/octet-stream');res.end(fs.readFileSync(f));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 for(const width of [1440,393,320]){
  const page=await browser.newPage(),errors=[],mobile=width<1000;page.on('pageerror',e=>errors.push(e.message));
  await page.setViewport({width,height:900,isMobile:mobile,hasTouch:mobile});
  await page.setRequestInterception(true);page.on('request',r=>/^http:\/\/127\.0\.0\.1:|^(blob|data):/.test(r.url())?r.continue():r.respond({status:200,body:''}));
  await page.goto('http://127.0.0.1:'+server.address().port+(mobile?'/phone':'/pc'));
  if(!mobile){await page.click('#demoLogin');await page.click('[data-view="settings"]');}else{const w=await page.$eval('.access-card',e=>e.getBoundingClientRect().width);assert.ok(w<=320);await page.$eval('#accessOverlay',e=>e.style.display='none');}
  await page.waitForSelector('[data-migration23]');
  await page.click('[data-migration23]');await page.waitForSelector('#cdqMigration23[open]');assert.match(await page.$eval('#cdqMigration23 [data-status]',e=>e.textContent),/Prêt/);
  await page.evaluate(()=>{document.getElementById('cdqMigration23').close();isOwner=false;document.body.append(document.createElement('span'));});
  await page.waitForFunction(()=>document.querySelector('[data-migration23]').hidden);
  await page.evaluate(async()=>{compagnieSelectionnee='c0';nomCompagnieSelectionnee='Client actuel';window.createdContext=await cdqCreationV2523.context('c0');});
  assert.deepEqual(await page.evaluate(()=>createdContext),{client_nom:'Client actuel',client_ville:'Ville test',client_adresse:'10 rue Test',client_technicien:'Technicien test'});
  if(mobile)await page.$eval('#filesContainer',e=>e.classList.add('cdq-empty-v2210'));
  await page.evaluate(()=>cdqDriveMain23.open('drive_root'));await page.waitForSelector('.cdq23-drive-row',{visible:true});
  assert.equal(await page.$$eval('.cdq23-drive-row',es=>es.length),24);
  await page.click('.cdq23-drive-item');assert.equal(await page.evaluate(()=>lastPdf),'file_0');
  await page.evaluate(()=>cdqDriveMain23.open('drive_root','',true));assert.equal(await page.$$eval('.cdq23-drive-row',es=>es.length),26);
  const size=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,list:getComputedStyle(document.querySelector('.cdq23-drive-list')).overflowY}));assert.equal(size.overflow,false);if(mobile)assert.equal(size.list,'visible');
  await page.evaluate(()=>{window.endLoading=cdqRowLoading23.start('file_0')});assert.equal(await page.$$eval('.cdq23-row-spinner',es=>es.length),1);await page.evaluate(()=>endLoading());assert.equal(await page.$('.cdq23-row-spinner'),null);
  await page.screenshot({path:'/tmp/cdq-v2523-interface-'+width+'.png',fullPage:false});
  // A delayed Drive response must not replace the view selected after it started.
  await page.evaluate(()=>{holdDrive=true;cdqDriveMain23.open('slow_folder')});
  await page.click(mobile?'.cdq23-drive-main header button':'#cdqPcV16 [data-view="clients"]');
  await page.evaluate(()=>{driveReplies.shift()()});await new Promise(r=>setTimeout(r,50));
  assert.equal(await page.evaluate(()=>cdqDriveMain23.active()),false);if(!mobile)assert.ok(await page.$('#pc17ClientSearch'));
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: PC and 393/320px Drive main view, pagination, PDF opening, stale replies, owner-only conversion, row loading, client prefill.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
