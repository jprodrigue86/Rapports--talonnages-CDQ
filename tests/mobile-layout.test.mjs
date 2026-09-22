// Component browser tests use synthetic document data; no private Apps Script source is uploaded.
import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import {buildDisplayControls} from './helpers/settings-fixture.mjs';
const script = fs.readFileSync('bundles/balance-cdq/v25.11/mobile-layout.js', 'utf8');
const css = fs.readFileSync('bundles/balance-cdq/v25.11/mobile-layout.css', 'utf8');
const displayControls = buildDisplayControls();
const fixture = `<!doctype html><html class="android"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box}body{margin:0;background:#07131d;color:white;font:14px Arial}.bottom-nav{position:fixed;bottom:0;width:100%;display:grid;height:78px!important;background:#123;border:1px solid #456}.bottom-nav-item{display:flex;flex-direction:column;align-items:center;color:white;border:1px solid #367;background:#123}.bottom-nav-item>span{height:32px!important;min-height:32px!important}#cdqTopActionsV2204{display:grid;grid-template-columns:repeat(4,1fr)}.cdq-top-action{display:flex;flex-direction:column;align-items:center}.modal-overlay{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#0008}.modal{background:#102536;border:1px solid #456}.cdq-ui-scale-box{padding:5px}.modal-buttons{display:flex}.modal-buttons button{flex:1}button{color:white;background:#18384b;border:1px solid #567}
</style><style>${css}</style></head><body>
<div id="cdqTopActionsV2204">${['clientNoteButton','cdqV19OfflineStatus','clientPhotoButton','cdqTopDisplayButtonV2204'].map((id,i)=>`<button id="${id}" class="cdq-top-action"><span style="font-size:22px!important">${['✎','⇩','▣','⚙'][i]}</span><span>${['Note','Hors ligne','Photos','Réglages'][i]}</span></button>`).join('')}</div>
<button id="createFolderButton">📁+</button><div class="file-row"><span class="file-icon">▤</span><span class="file-name">Rapport d’étalonnage.pdf</span></div>
<nav class="bottom-nav">${['Accueil','Favoris','Dossier','Inventaire','Factures','Corbeille'].map((name,i)=>`<button class="bottom-nav-item" ${i===2?'id="folderActionButton"':''}><span>▣</span><small>${name}</small></button>`).join('')}</nav>
<div id="cdqDisplayModal" style="display:none"><div class="cdq-modal-body"></div></div>
<div id="cdqSettingsModalV2294" class="modal-overlay" style="display:none"><div class="modal"><h2 class="cdq-modal-title">Réglages</h2><div class="cdq-modal-body"><div class="cdq-settings-v2294"><section><div id="cdqDefaultGoogleStatusV2294">Aucun compte par défaut</div><input type="email"></section><section id="cdqAndroidUpdateCardV2315"><button>Mise à jour Android</button></section></div></div><div class="modal-buttons"><button id="cdqSettingsCloseV2294" onclick="document.getElementById('cdqSettingsModalV2294').style.display='none'">Fermer</button></div></div></div>
<script>
window.saved=0;
window.cdqClampScaleV89=v=>Math.max(0,Math.min(100,Number(v)));
for(const name of ['General','Text','Icon']){
 window['cdq'+name+'ValueV89']=()=>Number(localStorage.getItem('cdqUi'+name+'ScaleV89')??50);
 window['cdqApply'+name+'ScaleV89']=(value)=>{localStorage.setItem('cdqUi'+name+'ScaleV89',value);window.cdqMobileLayout.apply()};
}
window.cdqApplyVisibleIconScaleV2208=window.cdqApplyIconScaleV89;
window.cdqMarkDisplayLocalEditV2212=()=>{};
window.cdqSaveDisplayPreferencesNowV2212=()=>window.saved++;
window.cdqScheduleSavePreferencesV72=()=>{};
window.cdqDetachBottomNavV96=()=>window.cdqMobileLayout.apply();
window.cdqFitGeneralScaleV92=()=>window.cdqMobileLayout.apply();
window.utilisateurCourantRole='technicien';window.CDQ_BUILD='V25.11';
window.cdqVersionLabelV87=v=>v;window.cdqRefreshUpdateCenterUI=()=>{};
window.cdqApplyTheme=theme=>localStorage.setItem('cdqTheme',theme);
window.cdqSetLongPress=v=>localStorage.setItem('cdqLongPressMs',v);
window.cdqSetSwipeSensitivity=v=>localStorage.setItem('cdqSwipeSensitivity',v);
window.cdqUpdateInfo={};window.cdqForceUpdate=()=>{};window.cdqCheckUpdate=()=>{};window.afficherMessage=()=>{};
${displayControls}
window.ouvrirReglagesAffichage=cdqOpenDisplaySettings;
</script><script>${script}</script></body></html>`;
const server = http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fixture)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser = await puppeteer.launch({executablePath:process.env.CHROME_PATH || '/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
try {
  const page=await browser.newPage();
  for(const width of [320,360,412]){
    await page.setViewport({width,height:780,isMobile:true,deviceScaleFactor:1});
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const measure=async(g,t,i)=>page.evaluate(([g,t,i])=>{
      for(const [name,value] of [['General',g],['Text',t],['Icon',i]])localStorage.setItem('cdqUi'+name+'ScaleV89',value);
      cdqMobileLayout.apply();
      const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
      return {nav:rect('.bottom-nav'),box:rect('.bottom-nav-item'),folder:rect('#folderActionButton > span'),offline:rect('#cdqV19OfflineStatus > span'),settings:rect('#cdqTopDisplayButtonV2204 > span'),create:rect('#createFolderButton'),overflow:document.documentElement.scrollWidth>innerWidth};
    },[g,t,i]);
    const normal=await measure(50,50,50),small=await measure(0,0,0),big=await measure(100,100,100);
    assert.equal(small.overflow,false);assert.equal(big.overflow,false);
    for(const name of ['folder','offline','settings','create','box','nav'])assert.ok(big[name].height>small[name].height,`${width}: ${name} must resize`);
    assert.ok(normal.nav.height<65,`${width}: compact default footer`);
    const densitySmall=await measure(0,50,50),densityBig=await measure(100,50,50);
    assert.ok(densityBig.box.height>densitySmall.box.height,'density slider changes icon boxes');
    assert.equal(densityBig.folder.height,densitySmall.folder.height,'density does not override icon preference');
    const iconSmall=await measure(50,50,0),iconBig=await measure(50,50,100);
    assert.ok(iconBig.nav.height>iconSmall.nav.height,'footer grows to fit larger icons');
    await page.evaluate(()=>{const m=document.getElementById('cdqSettingsModalV2294');cdqOrganizeSettings(m);m.style.display='flex'});
    await page.click('[data-settings-tab=files]');
    await page.click('#cdq-settings-panel-files [data-pdf-reader=ilovepdf]');
    assert.equal(await page.$eval('[data-pdf-reader=ilovepdf]',el=>el.classList.contains('active')),true,'reader selection remains visible after moving controls');
    assert.equal(await page.evaluate(()=>localStorage.getItem('cdqPdfReaderPreferenceV1')),'ilovepdf');
    await page.click('[data-settings-tab=appearance]');await page.click('[data-theme=light]');
    assert.equal(await page.$eval('[data-theme=light]',el=>el.classList.contains('active')),true);
    await page.click('[data-settings-tab=sizes]');await page.click('.cdq-phone-preset');
    assert.deepEqual(await page.evaluate(()=>['General','Text','Icon'].map(n=>localStorage.getItem('cdqUi'+n+'ScaleV89'))),['25','35','35']);
    assert.equal(await page.evaluate(()=>window.saved),3,'existing save handlers remain connected');
    const bounds=await page.$eval('#cdqSettingsModalV2294 .modal',el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}});
    assert.ok(bounds.left>=0&&bounds.right<=width&&bounds.top>=0&&bounds.bottom<=780,'settings stays in viewport');
    // Reopening must retain the account card and the original event handlers, with no duplicate controls.
    await page.evaluate(()=>cdqOrganizeSettings(document.getElementById('cdqSettingsModalV2294')));
    assert.equal(await page.$$eval('#cdqGeneralScaleRange',els=>els.length),1);
    await page.screenshot({path:`/tmp/cdq-settings-${width}.png`});
    console.log(`PASS ${width}px: all icons and boxes resize; settings navigation, presets and reopen`);
  }
} finally {await browser.close();server.close();}
