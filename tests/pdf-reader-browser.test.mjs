import fs from 'node:fs';import http from 'node:http';import assert from 'node:assert/strict';import puppeteer from 'puppeteer-core';
const read=p=>fs.readFileSync(p,'utf8');const pdf=fs.readFileSync('assets/templates/balance-plancher-v2519.pdf');
const shell=read('index.html'),bridge=shell.slice(shell.indexOf('// Lecteur commun PC/Android'),shell.indexOf('/* =====================================================\nCDQ V21.19'));
const selector=read('bundles/balance-cdq/v25.20/selector-reader.js'),queue=read('tests/fixtures/v25.20-reader-queue.js');
const setup=`
const CDQ_PWA_ORIGIN=location.origin,CDQ_DOCUMENT_MAX_BYTES=32*1024*1024;
let utilisateurCourantEmail='tech@example.invalid',utilisateurCourantRole='technicien',cdqAccessState='ready',modeSelectionFichiers=false;
let cdqV19SyncRunning=false,cdqV19Inventory=null;const cacheContenuCompagnies={},cacheDerniereVerificationCompagnies={};
window.mock={base64:${JSON.stringify(pdf.toString('base64'))},revision:'2026-09-23T00:00:00.000Z',writes:0,reads:0,error:'',messages:[]};
function cdqPwaAvailable(){return top!==window}function cdqPostToPwa(d){top.postMessage(d,location.origin);return true}function cdqFromPwa(e){return e.source===top&&e.origin===location.origin}
const afficherMessage=(s)=>mock.messages.push(s),afficherErreur=e=>mock.messages.push(e.message||String(e)),actualiserCompagnieEnArrierePlan=()=>{};
const cdqV19RefreshSyncPill=async()=>{},cdqV19MaybeDailyReset=async()=>{},cdqV19MaybeAutoUpdate=()=>{},cdqScheduleSavePreferencesV72=()=>{};
const cdqV2112Base64ToBytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
function db(){return new Promise((resolve,reject)=>{const r=indexedDB.open('test-reader',1);r.onupgradeneeded=()=>r.result.createObjectStore('records');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function cdqV19GetRecord(t,id){const key=utilisateurCourantEmail+':'+t+':'+id,d=await db();return new Promise((resolve,reject)=>{const r=d.transaction('records').objectStore('records').get(key);r.onsuccess=()=>{d.close();resolve(r.result)};r.onerror=()=>reject(r.error)})}
async function cdqV19PutRecord(t,id,value){const key=utilisateurCourantEmail+':'+t+':'+id,d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('records','readwrite');tx.objectStore('records').put(value,key);tx.oncomplete=()=>{d.close();resolve(true)};tx.onerror=()=>reject(tx.error)})}
async function cdqV19Gs(name,args){
 if(name==='obtenirPdfLecteurCDQV2520'){mock.reads++;return {id:args[0],nom:'Balance de plancher.pdf',clientId:'CLIENT_123456',taille:atob(mock.base64).length,revision:mock.revision,chunkSize:4194304,chunks:1,...(args[1]===mock.revision?{unchanged:true}:{base64:mock.base64})}}
 if(name==='enregistrerPdfLecteurCDQV2520'){if(mock.error)throw Error(mock.error);if(args[3]!==mock.revision)throw Error('CONFLICT');mock.writes++;mock.base64=args[1];mock.revision=new Date(Date.parse(mock.revision)+1000).toISOString();return {ok:true,id:args[0],nom:'Balance de plancher.pdf',clientId:'CLIENT_123456',revision:mock.revision}}
 throw Error('Unexpected RPC '+name);
}
function cdqV19ProcessAction(a){return cdqReaderProcessSaveV2520(a)}
function cdqV19CreateModal(){const o=document.createElement('div');o.innerHTML='<div class="cdq-v19-body"></div>';document.body.append(o);return o}
function cdqDocumentButton(body,title,fn){const b=document.createElement('button');b.textContent=title;b.onclick=fn;body.append(b);return b}
function cdqDownloadPdf(){}function cdqDocumentMeta(){return {type:'PDF',nom:'Balance de plancher.pdf'}}
localStorage.setItem('cdqPdfReaderPreferenceV1','cdq');
window.modifierFichier=id=>cdqOpenPdfV2520(id);
`;
const child=`<!doctype html><meta charset="utf-8"><div class="file-row" data-file-name="Balance de plancher.pdf" data-file-type="PDF"><span>Balance de plancher.pdf</span><input class="file-checkbox" data-file-id="PDF_CLIENT_123456" type="hidden"></div><script>${setup}\n${queue}\n${selector}\n${read('bundles/balance-cdq/v25.20/document-open.js')}</script>`;
const pc=read('pc/index.html'),pcBridge=pc.slice(pc.indexOf('// Lecteur commun PC/Android'),pc.indexOf('/* =====================================================\nCDQ V21.19'));
const parent=mobile=>`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><iframe id="selector" src="/selector" style="width:100%;height:150px"></iframe><script>function replyToSelector(w,d){w.postMessage(d,location.origin)}\n${mobile?bridge:pcBridge}\nwindow.addEventListener('message',e=>{if(e.source!==document.getElementById('selector').contentWindow||e.origin!==location.origin)return;const d=e.data;if(d.type==='CDQ_OPEN_PDF_V2304')cdqAfficherPdfV2304(d,e.source);if(d.type==='CDQ_PDF_SAVE_RESULT_V2304')cdqPdfSaveResultV2304(d,e.source);});</script>`;
const server=http.createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname;if(p==='/host'||p==='/pc/host'||p==='/selector'){res.setHeader('Content-Type','text/html;charset=utf-8');return res.end(p==='/selector'?child:parent(p==='/host'))}const f=p.slice(1);if(f.includes('..')||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.statusCode=404;return res.end()}res.setHeader('Content-Type',f.endsWith('.mjs')||f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.wasm')?'application/wasm':f.endsWith('.html')?'text/html':'application/octet-stream');res.end(fs.readFileSync(f))});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 for(const mobile of [false,true]){
  const context=await browser.createBrowserContext();const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.log('Browser:',m.text())});
  await page.setViewport(mobile?{width:393,height:851,isMobile:true,hasTouch:true}:{width:1440,height:1000});
  if(mobile)await page.setUserAgent('Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/148.0.0.0 Mobile Safari/537.36 BalanceCDQAndroid/25.15');
  await page.setRequestInterception(true);page.on('request',r=>r.url().startsWith('http://127.0.0.1:')||r.url().startsWith('blob:')||r.url().startsWith('data:')?r.continue():r.abort());
  await page.goto('http://127.0.0.1:'+server.address().port+(mobile?'/host':'/pc/host'));
  const s=page.frames().find(f=>f.url().endsWith('/selector'));await s.waitForFunction(()=>!!window.cdqOpenPdfV2520);
  async function open(){if(mobile)await s.click('.file-row span');else await s.evaluate(()=>cdqOpenPdfV2520('PDF_CLIENT_123456'));await page.waitForSelector('#legacy-pdf-reader');const f=await page.waitForFrame(f=>f.url().includes('reader-v2525.html'));await f.waitForSelector('#viewer[data-ready="true"] input[name="client_nom"]',{timeout:20000});return f;}
  let f=await open();assert.ok(await f.$$eval('.annotationLayer input',x=>x.length)>100);
  const input=async(value)=>{await f.$eval('input[name="client_nom"]',(e,v)=>{e.focus();e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));e.blur();},value);await new Promise(r=>setTimeout(r,120));};
  const colors=await f.$eval('input[name="client_nom"]',e=>({inline:e.style.backgroundColor,computed:getComputedStyle(e).backgroundColor,image:getComputedStyle(e).backgroundImage}));assert.equal(colors.image,'none');assert.equal(colors.computed,colors.inline==='transparent'?'rgba(0, 0, 0, 0)':colors.inline);
  const viewerUi=await f.evaluate(()=>{const green=document.querySelector('input[name*="conforme_vert"]'),red=document.querySelector('input[name*="conforme_rouge"]');
    const fidelity=input=>{if(!input)return null;const host=input.closest('.buttonWidgetAnnotation'),appearance=host?.querySelector('[data-canvas-name]'),style=getComputedStyle(input);return {
      image:style.backgroundImage,background:style.backgroundColor,borderWidth:style.borderWidth,filter:style.filter,
      appearanceFilter:appearance?getComputedStyle(appearance).filter:''
    }};
    return {
      zoomControls:!!document.getElementById('zoomControls'),
      green:fidelity(green),red:fidelity(red),
      headerDisplay:getComputedStyle(document.getElementById('readerTop')).display,
      headerPaddingTop:parseFloat(getComputedStyle(document.getElementById('readerTop')).paddingTop)||0
    }});
  assert.equal(viewerUi.zoomControls,true);
  for(const state of [viewerUi.green,viewerUi.red]){
    assert.ok(state);
    assert.equal(state.image,'none');
    assert.match(state.background,/rgba?\(0, 0, 0(?:, 0)?\)|transparent/i);
    assert.equal(state.borderWidth,'0px');
    assert.equal(state.filter,'none');
    assert.equal(state.appearanceFilter,'none');
  }

  const navigationAudit=await f.evaluate(()=>{
    const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
    const all=[...document.querySelectorAll('.textWidgetAnnotation input,.textWidgetAnnotation textarea,.choiceWidgetAnnotation select')];
    const auto=all.filter(el=>el.dataset.cdqAutoField==='true').map(el=>({name:el.name,tabIndex:el.tabIndex}));
    const echelon=all.find(el=>normalize(el.name)==='echelon');
    const typeBalance=all.find(el=>{const n=normalize(el.name);return n.includes('type')&&n.includes('balance')});
    const calculated=all.filter(el=>/(tolerance|erreur|conforme)/.test(normalize(el.name)));
    const manual=all.filter(el=>/^charge_point_\d+_(charge_utilisee|avant_correction|apres_correction)$/.test(el.name)&&el.dataset.cdqNavIndex!=null)
      .map(el=>{
        const page=el.closest('.page'),pr=page?.getBoundingClientRect(),r=el.getBoundingClientRect();
        return {name:el.name,index:Number(el.dataset.cdqNavIndex),page:Number(page?.dataset.pageNumber||0),y:pr?(r.top-pr.top)/Math.max(1,pr.height):r.top,x:pr?(r.left-pr.left)/Math.max(1,pr.width):r.left};
      }).sort((a,b)=>a.index-b.index);
    const excentricity=all.filter(el=>/^(charge_excentricite|excentricite_)/.test(el.name)&&el.dataset.cdqNavIndex!=null)
      .map(el=>({name:el.name,index:Number(el.dataset.cdqNavIndex)})).sort((a,b)=>a.index-b.index);
    return {auto,echelon:echelon&&{name:echelon.name,tabIndex:echelon.tabIndex,auto:echelon.dataset.cdqAutoField},
      typeBalance:typeBalance&&{name:typeBalance.name,tabIndex:typeBalance.tabIndex,auto:typeBalance.dataset.cdqAutoField},
      calculated:calculated.slice(0,20).map(el=>({name:el.name,tabIndex:el.tabIndex,auto:el.dataset.cdqAutoField})),
      manual,excentricity};
  });
  assert.ok(navigationAudit.echelon,'Le champ échelon doit exister dans le PDF de référence');
  assert.equal(navigationAudit.echelon.auto,'true');
  assert.equal(navigationAudit.echelon.tabIndex,-1);
  if(navigationAudit.typeBalance){
    assert.equal(navigationAudit.typeBalance.auto,'true');
    assert.equal(navigationAudit.typeBalance.tabIndex,-1);
  }
  assert.ok(navigationAudit.calculated.length>0);
  assert.ok(navigationAudit.calculated.every(x=>x.auto==='true'&&x.tabIndex===-1));
  assert.ok(navigationAudit.manual.length>=6);
  for(let i=1;i<navigationAudit.manual.length;i++){
    const a=navigationAudit.manual[i-1],b=navigationAudit.manual[i];
    assert.ok(b.page>a.page || (b.page===a.page && b.y>=a.y-.006),
      'Bloc 3 doit progresser visuellement de haut en bas: '+a.name+' -> '+b.name);
  }
  if(navigationAudit.excentricity.length){
    assert.ok(Math.min(...navigationAudit.excentricity.map(x=>x.index))>Math.max(...navigationAudit.manual.map(x=>x.index)),
      'L’excentricité ne doit pas couper la séquence du bloc 3');
  }
  if(mobile){
    assert.equal(viewerUi.headerDisplay,'grid');assert.ok(viewerUi.headerPaddingTop>=15);
    const keyboardUi=await f.evaluate(async()=>{
      const field=document.querySelector('input[name="client_nom"]');
      const header=document.getElementById('readerTop');
      const normalHeader=header.getBoundingClientRect().height;
      field.focus();
      await new Promise(resolve=>setTimeout(resolve,120));
      const compactHeader=header.getBoundingClientRect().height;
      const zoomDisplay=getComputedStyle(document.getElementById('zoomControls')).display;
      const statusDisplay=getComputedStyle(document.getElementById('status')).display;
      const saveDisplay=getComputedStyle(document.getElementById('save')).display;
      const menuDisplay=getComputedStyle(document.getElementById('menu')).display;
      const active=document.body.classList.contains('cdq-keyboard-field');
      field.blur();
      await new Promise(resolve=>setTimeout(resolve,140));
      return {
        normalHeader,compactHeader,zoomDisplay,statusDisplay,saveDisplay,menuDisplay,active,
        restored:!document.body.classList.contains('cdq-keyboard-field')
      };
    });
    assert.equal(keyboardUi.active,true);
    assert.equal(keyboardUi.zoomDisplay,'none');
    assert.equal(keyboardUi.statusDisplay,'none');
    assert.equal(keyboardUi.saveDisplay,'none');
    assert.equal(keyboardUi.menuDisplay,'none');
    assert.ok(keyboardUi.compactHeader<=keyboardUi.normalHeader-40);
    assert.equal(keyboardUi.restored,true);
  }
  for(const [name,value] of [['echelon','1'],['charge_point_1_charge_utilisee','1000'],['charge_point_1_avant_correction','1003']]){
    await f.$eval('input[name="'+name+'"]',e=>e.focus({preventScroll:true}));
    await new Promise(r=>setTimeout(r,120));await page.keyboard.type(value,{delay:65});await page.keyboard.press('Tab');await new Promise(r=>setTimeout(r,150));
  }
  await f.waitForFunction(()=>document.querySelector('input[name="charge_point_1_tolerance"]').value.includes('1')&&document.querySelector('input[name="charge_point_1_erreur_avant"]').value.includes('3'),{timeout:5000}).catch(async e=>{console.log('Calculations',await f.$$eval('input',es=>es.filter(e=>/echelon|charge_point_1/.test(e.name)).map(e=>({n:e.name,v:e.value}))));throw e});
  assert.equal(await f.$eval('input[name="charge_point_1_conforme_rouge"]',e=>e.checked),true);
  await f.evaluate(()=>document.activeElement?.blur());
  await new Promise(r=>setTimeout(r,120));
  await f.click('#menu');await f.click('#rotate');await f.waitForFunction(()=>(()=>{const p=document.querySelector('.page');return p&&p.clientWidth>p.clientHeight})());
  await f.click('#menu');await f.click('#rotate');await f.click('#menu');await f.click('#rotate');await f.click('#menu');await f.click('#rotate');
  await input('Essai CDQ');await f.click('#plus');await f.click('#plus');await f.click('#minus');
  assert.equal(await f.$eval('input[name="client_nom"]',e=>e.value),'Essai CDQ');
  await f.click('#back');await f.waitForSelector('#closeDialog[open]');await f.click('#keepEditing');assert.equal(await page.$('#legacy-pdf-reader')!==null,true);assert.equal(await s.evaluate(()=>mock.writes),0);
  // Hardware/browser Back goes through the same confirmation.
  await page.evaluate(()=>history.back());await f.waitForSelector('#closeDialog[open]');await f.click('#saveClose');await page.waitForFunction(()=>!document.getElementById('legacy-pdf-reader'),{timeout:25000});
  assert.equal(await s.evaluate(()=>mock.writes),1);
  f=await open();assert.equal(await f.$eval('input[name="client_nom"]',e=>e.value),'Essai CDQ');
  await input('À annuler');await f.click('#back');await f.waitForSelector('#closeDialog[open]');await f.click('#discard');await page.waitForFunction(()=>!document.getElementById('legacy-pdf-reader'));
  assert.equal(await s.evaluate(()=>mock.writes),1);
  f=await open();assert.equal(await f.$eval('input[name="client_nom"]',e=>e.value),'Essai CDQ');
  await input('Copie locale');await s.evaluate(()=>{Object.defineProperty(navigator,'onLine',{value:false,configurable:true})});await f.click('#save');
  await f.waitForFunction(()=>document.getElementById('status').textContent.includes('Conservé'));assert.equal(await s.evaluate(async()=>(await cdqV19QueueGet()).length),1);
  await input('Copie locale suivante');await f.click('#save');await f.waitForFunction(()=>document.getElementById('status').textContent.includes('Conservé'));assert.equal(await s.evaluate(async()=>(await cdqV19QueueGet()).length),2);
  await s.evaluate(async()=>{Object.defineProperty(navigator,'onLine',{value:true,configurable:true});await cdqSynchroniserEnAttente()});
  assert.equal(await s.evaluate(async()=>(await cdqV19QueueGet()).length),0);assert.equal(await s.evaluate(()=>mock.writes),3);
  await input('Après synchronisation');await f.click('#save');await f.waitForFunction(()=>document.getElementById('status').textContent.includes('Enregistré'));assert.equal(await s.evaluate(()=>mock.writes),4);
  await f.click('#back');await page.waitForFunction(()=>!document.getElementById('legacy-pdf-reader'));
  f=await open();assert.equal(await f.$eval('input[name="client_nom"]',e=>e.value),'Après synchronisation');
  await input('Conflit');await s.evaluate(()=>mock.error='Le PDF a été modifié ailleurs.');await f.click('#back');await f.waitForSelector('#closeDialog[open]');await f.click('#saveClose');await f.waitForFunction(()=>document.getElementById('closeError').textContent.includes('modifié ailleurs'));
  assert.ok(await page.$('#legacy-pdf-reader'));assert.equal(await s.evaluate(()=>mock.writes),4);await f.click('#keepEditing');
  if(mobile){const cdp=await page.createCDPSession();for(const [type,points] of [['touchStart',[[110,300],[240,300]]],['touchMove',[[70,300],[290,300]]],['touchEnd',[]]])await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y],id)=>({x,y,id}))});assert.equal(await f.$eval('input[name="client_nom"]',e=>e.value),'Conflit');}
  await page.screenshot({path:'/tmp/cdq-reader-v2520-'+(mobile?'android':'pc')+'.png'});
  await f.click('#back');await f.waitForSelector('#closeDialog[open]');await f.click('#discard');await page.waitForFunction(()=>!document.getElementById('legacy-pdf-reader'));assert.equal(await s.evaluate(async()=>(await cdqV19QueueGet()).length),0);
  assert.deepEqual(errors,[]);console.log('PASS',mobile?'Android integrated route':'PC integrated route',JSON.stringify({colors,saves:4,confirmClose:true,offlineQueue:true,conflictRetainsDocument:true}));
  await context.close();
 }
}finally{await browser.close();await new Promise(r=>server.close(r))}
