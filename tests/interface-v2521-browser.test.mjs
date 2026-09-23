import fs from 'node:fs';import http from 'node:http';import assert from 'node:assert/strict';import puppeteer from 'puppeteer-core';import {fixture} from './helpers/desktop-ergonomics-fixture.mjs';import {applyPatch} from './helpers/settings-fixture.mjs';
const read=p=>fs.readFileSync(p,'utf8'),dir='bundles/balance-cdq/v25.21',m=JSON.parse(read(dir+'/manifest.json')),actual=process.env.CDQ_V2521_SELECTOR?read(process.env.CDQ_V2521_SELECTOR):'';
const scripts=files=>files.map(f=>'<script>'+read(dir+'/'+f)+'</script>').join('');
const styles=actual?[...actual.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map(x=>x[0]).join(''):'<style>'+read('bundles/balance-cdq/v25.18/desktop.css')+read('bundles/balance-cdq/v25.16/mobile-layout.css')+read(dir+'/interface.css')+'</style>';
let mobile=read('bundles/balance-cdq/v25.16/mobile-layout.js');for(const p of m.patches.filter(p=>['mobile-drive-button','mobile-search-space','mobile-drive-size'].includes(p.id)))mobile=applyPatch(mobile,p);
const setup=`
window.cdqAccessState='ready';window.utilisateurCourantEmail='demo@example.test';window.utilisateurCourantRole='admin';window.afficherErreur=e=>{window.lastError=e.message||String(e)};window.afficherMessage=()=>{};window.cdqSynchroniserTechniciensEtModeles=async()=>{};window.confirm=()=>true;window.alert=()=>{};
window.users=Array.from({length:55},(_,i)=>({email:i===0?'jp.rodrigue86@gmail.com':'tech'+i+'@example.test',nomRapport:'Technicien '+i,role:'technicien',nipDefini:true,actifRapports:true,accesCreateur:i===0}));
window.driveItems=Array.from({length:42},(_,i)=>({id:'folder_'+i,kind:'folder',nom:i===0?'Anhydra':'Dossier '+i,favori:false}));window.pins=new Set();window.holdDrive=false;window.held=[];
window.calls=window.calls||[];
const baseRpc=window.rpcResult||(()=>[]);window.rpcResult=(name,args)=>{
 if(name==='obtenirListeUtilisateurs')return users;
 if(name==='obtenirDossierGeneralCDQV2521')return {items:args[0]==='folder_0'?[{id:'report_1',kind:'file',nom:'Rapport.pdf'}]:driveItems.map(x=>({...x,favori:pins.has(x.id)})),crumbs:[{id:args[0],nom:args[0]==='folder_0'?'Anhydra':'Drive général'}],nextPageToken:args[1]?'':'more'};
 if(name==='obtenirFavorisGenerauxCDQV2521')return {items:driveItems.filter(x=>pins.has(x.id)).map(x=>({...x,favori:true}))};
 if(name==='definirFavoriGeneralCDQV2521'){if(args[1])pins.add(args[0]);else pins.delete(args[0]);return {id:args[0],favori:args[1]}}
 if(name==='ajouterUtilisateur'){users.push({email:args[0],role:args[1],nomRapport:args[2]});return {email:args[0],codeTemporaire:'ESSAI-1234'}}
 if(name==='supprimerUtilisateur'){users=users.filter(x=>x.email!==args[0]);return true}
 if(name==='modifierRoleUtilisateur'){users.find(x=>x.email===args[0]).role=args[1];return true}
 return baseRpc(name,args);
};
window.cdqApiRun=()=>{let ok=()=>{},fail=()=>{};const p=new Proxy({},{get:(_,name)=>name==='withSuccessHandler'?f=>{ok=f;return p}:name==='withFailureHandler'?f=>{fail=f;return p}:(...args)=>{calls.push({name,args});const run=()=>{try{ok(rpcResult(name,args))}catch(e){fail(e)}};if(holdDrive&&name==='obtenirDossierGeneralCDQV2521')held.push(run);else setTimeout(run,10)}});return p;};
document.addEventListener('click',e=>{const action=e.target.closest('.pc16-nav button[data-pc-action]');${m.patches.find(p=>p.id==='pc-navigation').replacement}},true);
`;
let pc=fixture().replace(read('bundles/balance-cdq/v25.18/desktop.js'),()=>read(dir+'/extra-icons.js')+'\n'+read(dir+'/desktop.js'));
pc=pc.replace('</head>',()=>styles+'</head>').replace('</body>',()=>read(dir+'/admin.html')+'<script>'+setup+'</script>'+scripts(['admin-functions.js','drive-browser.js'])+'</body>');
const phone='<!doctype html><html class="android"><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8">'+styles+'<body><div id="accessOverlay" style="display:none"></div><button id="companyButton" onclick="companyMenu.style.display=\'block\';cdqMobileLayout.apply()">Choisir une compagnie</button><div id="companyMenu" class="company-menu" style="display:none"><input id="companySearch" class="company-search" placeholder="Rechercher une compagnie…"><div id="companyList"><div class="company-item">Client</div></div></div>'+read(dir+'/admin.html')+'<script>'+setup+'</script>'+scripts(['admin-functions.js','drive-browser.js'])+'<script>'+mobile+'</script></body></html>';
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(req.url==='/phone'?phone:pc)});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.setRequestInterception(true);page.on('request',r=>{if(r.url().startsWith('http://127.0.0.1:')||r.url().startsWith('data:'))return r.continue();const path=new URL(r.url()).pathname.replace('/Rapports--talonnages-CDQ/','');if(fs.existsSync(path)&&fs.statSync(path).isFile())return r.respond({status:200,contentType:path.endsWith('.webp')?'image/webp':'text/plain',body:fs.readFileSync(path)});r.respond({status:200,body:''})});
const url='http://127.0.0.1:'+server.address().port;
async function admin(){
 await page.evaluate(()=>ouvrirGestionUtilisateurs());await page.waitForSelector('.cdq-user-card');
 const dims=await page.evaluate(()=>{const m=document.querySelector('.cdq-admin-panel').getBoundingClientRect(),s=document.querySelector('.cdq-admin-scroll');s.scrollTop=s.scrollHeight;return {top:m.top,bottom:m.bottom,height:innerHeight,scroll:s.scrollTop,overflow:document.documentElement.scrollWidth>innerWidth}});assert.ok(dims.top>=0&&dims.bottom<=dims.height+1,JSON.stringify(dims));assert.ok(dims.scroll>500,JSON.stringify(dims));assert.equal(dims.overflow,false);
 await page.$eval('.cdq-admin-scroll',e=>e.scrollTop=0);await page.click('.cdq-user-card:first-child summary');assert.equal(await page.$eval('.cdq-user-card:first-child .admin-role',e=>e.disabled),true);assert.equal(await page.$eval('.cdq-user-card:first-child .cdq-user-remove',e=>e.disabled),true);
 await page.type('#cdqAdminSearchV2521','Technicien 54');assert.equal(await page.$$eval('.cdq-user-card:not([hidden])',es=>es.length),1);await page.click('.cdq-user-card:not([hidden]) summary');await page.select('.cdq-user-card:not([hidden]) select','lecture');await page.waitForFunction(()=>calls.some(c=>c.name==='modifierRoleUtilisateur'));
 await page.click('[data-admin-tab="add"]');await page.type('#adminEmailInput','nouveau@example.test');await page.type('#adminNomInput','Nouveau technicien');await page.click('.admin-add-row button');await page.waitForFunction(()=>document.querySelector('#adminCodesOutput').value.includes('ESSAI-1234'));assert.equal(await page.$eval('[data-admin-panel="codes"]',e=>e.hidden),false);await page.screenshot({path:'/tmp/cdq-v2521-admin-'+(await page.viewport()).width+'.png'});
 await page.click('.cdq-admin-close');assert.equal(await page.$eval('#adminCodesOutput',e=>e.value),'');
}
async function drive(){
 await page.waitForSelector('.cdq-drive-row');assert.equal(await page.$eval('.cdq-drive-crumbs',e=>e.textContent),'Drive général');await page.click('[data-drive-id="folder_0"] .cdq-drive-star');await page.waitForFunction(()=>pins.has('folder_0'));await page.click('.cdq-drive-toolbar button:nth-of-type(2)');await page.waitForFunction(()=>document.querySelectorAll('.cdq-drive-row').length===1);assert.ok(await page.$('[data-drive-id="folder_0"]'));
 await page.click('.cdq-drive-open');await page.waitForSelector('[data-drive-id="report_1"]');await page.click('.cdq-drive-toolbar button:nth-of-type(1)');await page.waitForSelector('[data-drive-id="folder_41"]');await page.click('#cdqDriveDialogV2521 [data-more]');await page.waitForFunction(()=>document.querySelector('#cdqDriveDialogV2521 [data-more]').hidden);
 await page.screenshot({path:'/tmp/cdq-v2521-drive-'+(await page.viewport()).width+'.png'});
 await page.evaluate(()=>{holdDrive=true;cdqDriveV2521.open();cdqDriveV2521.openFavorites()});await page.waitForFunction(()=>document.querySelectorAll('.cdq-drive-row').length===1);await page.evaluate(()=>held.shift()());assert.equal(await page.$eval('#cdqDriveTitleV2521',e=>e.textContent),'★ Favoris');
 await page.evaluate(()=>{holdDrive=false;utilisateurCourantEmail='other@example.test';window.dispatchEvent(new Event('cdq:access-ready'))});await page.waitForFunction(()=>!document.querySelector('#cdqDriveDialogV2521').open);await page.evaluate(()=>utilisateurCourantEmail='demo@example.test');
}
try{
 await page.setViewport({width:1440,height:900});await page.goto(url);await page.click('#demoLogin');await page.waitForSelector('.pc16-nav [data-pc-action="drive"]');
 await page.click('[data-pc-action="drive"]');await drive();await admin();
 const themes=['current','minimal','dark-pro','metal-music','isometric'];for(const theme of themes){const result=await page.evaluate(theme=>{window.cdqIconThemesV2514.getStyle=()=>theme;document.dispatchEvent(new Event('cdq:icons-changed'));return ['clients','settings'].map(name=>{const e=document.querySelector('[data-view="'+name+'"] .ico svg');return {name,theme:e?.dataset.iconTheme,width:e?.getBoundingClientRect().width}})},theme);for(const icon of result){assert.equal(icon.theme,theme);assert.ok(icon.width>15)}}
 await page.screenshot({path:'/tmp/cdq-v2521-pc-icons.png'});
 for(const width of [393,320]){await page.setViewport({width,height:width===320?568:851,isMobile:true,hasTouch:true});await page.goto(url+'/phone');await page.click('#companyButton');await page.waitForSelector('.cdq-company-drive');const layout=await page.evaluate(()=>{const f=document.querySelector('.cdq-company-drive').getBoundingClientRect(),x=document.querySelector('.cdq-company-close').getBoundingClientRect();return {folder:f.right,close:x.left,padding:getComputedStyle(companySearch).paddingRight}});assert.ok(Math.abs(layout.folder-layout.close)<2,JSON.stringify(layout));assert.equal(layout.padding,'96px');await page.click('.cdq-company-drive');await drive();await admin();}
 assert.deepEqual(errors,[]);console.log('PASS: PC + 393/320px Android, real CSS, scroll, admin protections/add/role, Drive/favorites/pagination/races, yellow folder and five icon themes.');
}catch(e){await page.screenshot({path:'/tmp/cdq-v2521-interface-failure.png'});console.error(errors,await page.evaluate(()=>({calls:calls.slice(-8),lastError:window.lastError})));throw e}finally{await browser.close();server.close()}
