import fs from 'node:fs';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import {applyPatch} from './helpers/settings-fixture.mjs';
const read=p=>fs.readFileSync(p,'utf8'),dir='bundles/balance-cdq/v25.27/';
const manifest=JSON.parse(read(dir+'manifest.json'));
const renderer=applyPatch(read('tests/fixtures/folders-v2526.js'),manifest.patches.find(p=>p.id==='mobile-renders-prepared-folder'));
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewport({width:393,height:850,isMobile:true,hasTouch:true});
 await page.setContent('<style>.folder-content{display:none}.folder.open>.folder-content{display:block}</style><main id="files"></main>');
 await page.addScriptTag({content:`
 var cdqAccessState='ready',utilisateurCourantEmail='owner',compagnieSelectionnee='client';
 var cdqRootContent={id:'client',charge:true,dossiers:[{id:'reports',nom:'Rapports',charge:false,dossiers:[],fichiers:[]}]};
 var cacheContenuCompagnies={client:cdqRootContent},cacheDerniereVerificationCompagnies={client:1},requests=[],saved=[];
 var cdqDossierOuvertId=null,cdqDossierOuvertNom='';
 function cdqBuildFolderMaps(){} function sauvegarderCachePersistantClient(...args){saved.push(args);}
 function cdqEnhanceMobileFolders(){} function appliquerFiltresFichiers(){} function mettreAJourInterface(){} function cdqSchedulePhotoPresenceRefresh(){}
 function afficherErreur(e){throw e;}
 function cdqCreerBadgePhoto(){return document.createElement('span');}
 function creerLigneFichier(f){const row=document.createElement('button');row.className='file-row';row.textContent=f.nom;return row;}
 function cdqApiRun(){let success,failure;return {withSuccessHandler(fn){success=fn;return this;},withFailureHandler(fn){failure=fn;return this;},obtenirContenuDossierParesseux(id,client){requests.push({id,client,success,failure});}};}
 function finishRequest(index){const r=requests[index];r.success({contenu:{id:r.id,nom:'Rapports',charge:true,dossiers:[],fichiers:[{id:'sheet',nom:'Feuille étalonnage',type:'GOOGLE_SHEETS'}]}});}
 `+read(dir+'folder-loader.js')+'\n'+read(dir+'folder-integration.js')+'\n'+renderer});
 // The DOM was created BEFORE the background request completed.
 await page.evaluate(()=>{afficherDossierRecursif(cdqRootContent,document.getElementById('files'));cdqFoldersV2527.plan(cdqRootContent);});
 await page.waitForFunction(()=>requests.length===1);await page.evaluate(()=>finishRequest(0));
 await page.waitForFunction(()=>cdqRootContent.dossiers[0].charge===true);
 assert.equal(await page.$('.file-row'),null);
 await page.click('.folder-header');await page.waitForSelector('.folder.open .file-row',{visible:true});
 assert.equal(await page.$eval('.file-row',e=>e.textContent),'Feuille étalonnage');
 assert.equal(await page.evaluate(()=>requests.length),1);
 await page.click('.folder-header');assert.equal(await page.$('.folder.open'),null);
 await page.click('.folder-header');await page.waitForSelector('.folder.open .file-row',{visible:true});
 assert.equal(await page.evaluate(()=>requests.length),1);
 // A tap while the preload is running joins that request and updates the DOM.
 await page.evaluate(()=>{
   cdqFoldersV2527.invalidate();cdqRootContent.dossiers=[{id:'next',nom:'Autre dossier',charge:false,dossiers:[],fichiers:[]}];
   document.getElementById('files').innerHTML='';afficherDossierRecursif(cdqRootContent,document.getElementById('files'));cdqFoldersV2527.plan(cdqRootContent);
 });
 await page.waitForFunction(()=>requests.length===2);await page.click('.folder-header');
 assert.equal(await page.evaluate(()=>requests.length),2);await page.evaluate(()=>finishRequest(1));
 await page.waitForSelector('.folder.open .file-row',{visible:true});
 assert.equal(await page.evaluate(()=>saved.length),2);assert.deepEqual(errors,[]);
 console.log('PASS: real mobile folder renderer displays background-loaded Sheets; tap during preload joins the request; closing/reopening adds no request.');
}finally{await browser.close();}
