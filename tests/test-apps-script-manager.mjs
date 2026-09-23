import puppeteer from 'puppeteer-core';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';

const expectedVersion=readFileSync('apps-script-manager/app.js','utf8').match(/const APP_VERSION = '(V\d+)'/)[1];

const chrome = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const server = spawn('python3',['-m','http.server','8080','--bind','127.0.0.1'],{stdio:'inherit'});
const sleep = ms => new Promise(r=>setTimeout(r,ms));
function assert(cond,msg){ if(!cond) throw new Error(msg); }

let browser;
try {
  await sleep(800);
  browser = await puppeteer.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page = await browser.newPage();
  page.on('pageerror',e=>console.error('PAGEERROR:',e.message));
  page.on('console',m=>console.log('BROWSER:',m.type(),m.text()));
  await page.setRequestInterception(true);
  page.on('request',req=>{
    if(req.url().startsWith('https://accounts.google.com/')) req.abort();
    else req.continue();
  });
  const client = await page.createCDPSession();

  await page.goto('http://127.0.0.1:8080/apps-script-manager/',{waitUntil:'domcontentloaded',timeout:15000});
  await page.waitForSelector('#connect',{timeout:5000});
  const visibleVersion=await page.evaluate(()=>({
    top:document.querySelector('#versionChip')?.textContent,
    badge:document.querySelector('#versionBadge')?.textContent
  }));
  assert(visibleVersion.top===expectedVersion,'Top version chip must show '+expectedVersion);
  assert(visibleVersion.badge?.includes(expectedVersion),'Version badge must show '+expectedVersion);

  const manifest = await client.send('Page.getAppManifest');
  assert(!manifest.errors?.length,'Manifest errors: '+JSON.stringify(manifest.errors));
  const parsed = JSON.parse(manifest.data || '{}');
  const icons = parsed.icons||[];
  assert(icons.some(x=>x.purpose==='any'),'Manifest missing standard icon');
  assert(icons.some(x=>x.purpose==='maskable'),'Manifest missing maskable icon');
  for(const icon of icons){
    const valid=await page.evaluate(async src=>{
      const image=new Image();image.src=src;
      await image.decode();return image.naturalWidth>0&&image.naturalHeight>0;
    },icon.src);
    assert(valid,'Manifest icon does not decode: '+icon.src);
  }

  const dims = await page.evaluate(async()=>{
    async function dim(src){ const r=await fetch(src); if(!r.ok) throw new Error(src+' HTTP '+r.status); const b=await r.blob(); const bm=await createImageBitmap(b); return [bm.width,bm.height]; }
    return {i192:await dim('icon-192.png'), i512:await dim('icon-512.png')};
  });
  assert(dims.i192[0]===192 && dims.i192[1]===192,'192 icon dimensions invalid');
  assert(dims.i512[0]===512 && dims.i512[1]===512,'512 icon dimensions invalid');

  await page.evaluate(()=>{
    window.__mockFetchLog=[];
    window.__mockServerFiles=[
      {name:'Code',type:'SERVER_JS',source:'function oldCode(){ return 0; }'},
      {name:'Selecteur',type:'HTML',source:'<div>ancien</div>'},
      {name:'appsscript',type:'JSON',source:'{"timeZone":"America/Toronto"}'}
    ];
    window.__mockDeployments=[
      {deploymentId:'HEAD_DEP',deploymentConfig:{description:'Head / test'}},
      {deploymentId:'dep1',deploymentConfig:{versionNumber:1,description:'Production'}}
    ];
    window.google={accounts:{oauth2:{
      initTokenClient(opts){
        const tokenClient={
          callback:opts.callback,
          error_callback:opts.error_callback,
          requestAccessToken(config={}){window.__lastTokenConfig=config;setTimeout(()=>tokenClient.callback({access_token:'TEST_TOKEN',expires_in:3600}),10)}
        };
        return tokenClient;
      },
      revoke(token,cb){ if(cb) cb(); }
    }}};
    const realFetch=window.fetch.bind(window);
    window.fetch=async (url,opts={})=>{
      const s=String(url).replace('https://scriptmanagement.googleapis.com/v1','https://script.googleapis.com/v1').split('?')[0],method=opts.method||'GET';
      window.__mockFetchLog.push(method+' '+s);
      const ok=data=>new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
      if(s.startsWith('https://www.googleapis.com/drive/v3/files')) return ok({files:[{id:'TEST_SCRIPT_ID',name:'Projet Test CDQ',modifiedTime:'2026-09-17T16:00:00Z',webViewLink:'https://script.google.com/'}]});
      if(!s.startsWith('https://script.googleapis.com/v1')) return realFetch(url,opts);
      if(s.endsWith('/projects/TEST_SCRIPT_ID') && method==='GET') return ok({scriptId:'TEST_SCRIPT_ID',title:'Projet Test CDQ'});
      if(s.endsWith('/projects/TEST_SCRIPT_ID/content') && method==='GET') return ok({scriptId:'TEST_SCRIPT_ID',files:JSON.parse(JSON.stringify(window.__mockServerFiles))});
      if(s.endsWith('/projects/TEST_SCRIPT_ID/content') && method==='PUT'){
        const body=JSON.parse(opts.body||'{}');
        window.__mockServerFiles=JSON.parse(JSON.stringify(body.files||[]));
        return ok({scriptId:'TEST_SCRIPT_ID',files:window.__mockServerFiles});
      }
      if(s.endsWith('/projects/TEST_SCRIPT_ID/deployments') && method==='GET') return ok({deployments:JSON.parse(JSON.stringify(window.__mockDeployments))});
      if(s.endsWith('/projects/TEST_SCRIPT_ID/deployments') && method==='POST'){
        const body=JSON.parse(opts.body||'{}');
        const created={deploymentId:'depNew',deploymentConfig:{versionNumber:body.versionNumber,manifestFileName:body.manifestFileName,description:body.description}};
        window.__mockDeployments.push(created);
        return ok(created);
      }
      if(s.endsWith('/projects/TEST_SCRIPT_ID/versions') && method==='POST') return ok({scriptId:'TEST_SCRIPT_ID',versionNumber:99,description:'test'});
      if(s.includes('/projects/TEST_SCRIPT_ID/deployments/dep1') && method==='PUT'){
        const body=JSON.parse(opts.body||'{}');
        const i=window.__mockDeployments.findIndex(d=>d.deploymentId==='dep1');
        if(i>=0) window.__mockDeployments[i]={deploymentId:'dep1',deploymentConfig:{...(window.__mockDeployments[i].deploymentConfig||{}),...(body.deploymentConfig||{})}};
        return ok(window.__mockDeployments[i]);
      }
      return new Response(JSON.stringify({error:{message:'Unexpected mocked request '+s+' '+method}}),{status:500,headers:{'Content-Type':'application/json'}});
    };
  });

  await page.waitForFunction(()=>!document.querySelector('#connect')?.disabled,{timeout:8000});
  await page.click('#quickConnect');
  await page.waitForFunction(()=>document.querySelector('#authBadge')?.textContent.includes('connecté'),{timeout:5000});
  await page.waitForFunction(()=>localStorage.getItem('cdqsm_keep_connected')==='1',{timeout:3000});
  const remembered=await page.evaluate(()=>({
    keep:localStorage.getItem('cdqsm_keep_connected'),
    until:Number(localStorage.getItem('cdqsm_auto_connect_until')||0),
    checked:document.querySelector('#keepConnected')?.checked,
    prompt:window.__lastTokenConfig?.prompt
  }));
  assert(remembered.checked===true,'Keep connected must default to enabled');
  assert(remembered.keep==='1','Keep connected preference must be stored');
  assert(remembered.until>Date.now(),'Auto-connect expiration must be in the future');
  assert(remembered.prompt==='select_account','Manual connect should allow account selection');
  const storedToken=await page.evaluate(()=>({
    token:localStorage.getItem('cdqsm_google_access_token'),
    expires:Number(localStorage.getItem('cdqsm_google_access_token_expires')||0)
  }));
  assert(storedToken.token==='TEST_TOKEN','Live Google token should be retained on this device while valid');
  assert(storedToken.expires>Date.now(),'Stored Google token expiry should be in the future');
  await sleep(500);
  const afterAuth = await page.evaluate(()=>({
    topStatus:document.querySelector('#topStatus')?.textContent,
    auth:document.querySelector('#authBadge')?.textContent,
    options:document.querySelector('#projectSelect')?.options.length,
    html:document.querySelector('#projectSelect')?.innerHTML,
    fetchLog:window.__mockFetchLog
  }));
  console.log('STATE_AFTER_AUTH',JSON.stringify(afterAuth));
  await page.waitForFunction(()=>document.querySelector('#projectSelect')?.options.length>1,{timeout:5000});
  await page.waitForFunction(()=>document.querySelector('#projectBadge')?.textContent.includes('Projet Test CDQ'),{timeout:5000});
  const quickLinked=await page.evaluate(()=>({
    project:document.querySelector('#quickProjectStatus')?.textContent,
    connectHidden:document.querySelector('#quickConnect')?.hidden
  }));
  assert(quickLinked.project.includes('Projet Test CDQ'),'Quick mode did not show the linked project');
  assert(quickLinked.connectHidden===true,'Quick Google button should hide after connection');
  await page.waitForFunction(()=>document.querySelector('#deployment')?.options.length>1,{timeout:5000});
  const deployOptions=await page.evaluate(()=>Array.from(document.querySelectorAll('#deployment option')).map(o=>({value:o.value,text:o.textContent,disabled:o.disabled})));
  assert(deployOptions.some(o=>o.value==='__new__'),'Missing New deployment option');
  assert(deployOptions.some(o=>o.value==='dep1'),'Missing versioned deployment option');
  assert(!deployOptions.some(o=>o.value==='HEAD_DEP'),'Read-only HEAD deployment must not be selectable');

  // Regression: a ZIP may match the code already present in HEAD. It still must enable deploy,
  // because the user may only need to create a version/update the existing technician deployment.
  await page.evaluate(async()=>{
    const zip=new JSZip();
    zip.file('Code.gs','function oldCode(){ return 0; }');
    zip.file('Selecteur.html','<div>ancien</div>');
    const blob=await zip.generateAsync({type:'blob'});
    const f=new File([blob],'CDQ_same_code.zip',{type:'application/zip'});
    await importPhoneFiles([f]);
  });
  const sameCodeState=await page.evaluate(()=>({
    disabled:document.querySelector('#quickApply')?.disabled,
    zip:document.querySelector('#quickZipSummary')?.textContent,
    result:document.querySelector('#quickResult')?.textContent,
    changes:document.querySelector('#changeBadge')?.textContent
  }));
  assert(sameCodeState.changes.includes('0'),'Same-code ZIP should have zero textual modifications');
  assert(sameCodeState.disabled===false,'Quick deploy must stay enabled when ZIP is valid but code is already present');
  assert(sameCodeState.zip.includes('code déjà présent'),'Quick ZIP summary must explain that code is already present');
  assert(sameCodeState.result.includes('tu peux quand même'),'Quick result must explain that deployment is still available');
  await page.evaluate(()=>{ S.pkg.clear(); S.pendingBuild=''; clearZipVisual(); renderDiff(); updateQuickUi(); });

  await page.evaluate(async()=>{
    const zip=new JSZip();
    zip.file('patches/Code_PATCH_V12.gs','function fromZip(){ return 12; }');
    zip.file('patches/Selector_PATCH_V12.html','<main>selector zip</main>');
    const blob=await zip.generateAsync({type:'blob'});
    const f=new File([blob],'CDQ_patch.zip',{type:'application/zip'});
    await importPhoneFiles([f]);
  });
  await page.waitForFunction(()=>document.querySelector('#changeBadge')?.textContent.includes('2'),{timeout:3000});
  const zipImport=await page.evaluate(()=>({
    packageResult:document.querySelector('#packageResult')?.textContent,
    tabs:Array.from(document.querySelectorAll('#fileTabs .file-tab')).map(x=>x.textContent)
  }));
  assert(zipImport.packageResult.includes('2 fichier(s) importé(s)'), 'ZIP import did not prepare 2 files: '+zipImport.packageResult);
  const zipVisual=await page.evaluate(()=>({
    hidden:document.querySelector('#zipStatus')?.hidden,
    cls:document.querySelector('#zipStatus')?.className,
    title:document.querySelector('#zipStatusTitle')?.textContent,
    detail:document.querySelector('#zipStatusDetail')?.textContent
  }));
  assert(zipVisual.hidden===false,'ZIP visual status must be visible after decoding');
  assert(zipVisual.cls.includes('success'),'ZIP visual status must end in success');
  assert(zipVisual.title.includes('ZIP décodé'),'ZIP visual title must confirm decode');
  assert(zipVisual.detail.includes('GS trouvé'),'ZIP visual detail must confirm GS detection');
  assert(zipVisual.detail.includes('Selector/HTML trouvé'),'ZIP visual detail must confirm Selector detection');
  const selectedDeployment=await page.$eval('#deployment',el=>el.value);
  assert(selectedDeployment==='dep1','Existing versioned deployment must be selected by default, not New deployment');

  const quickReady=await page.evaluate(()=>({
    disabled:document.querySelector('#quickApply')?.disabled,
    zip:document.querySelector('#quickZipSummary')?.textContent
  }));
  assert(quickReady.disabled===false,'Quick apply must be enabled after ZIP import');
  assert(quickReady.zip.includes('2 modification'),'Quick mode must show ZIP modifications');

  await page.click('#quickApply');
  await page.waitForFunction(()=>document.querySelector('#status')?.textContent.includes('MISE À JOUR TERMINÉE') && document.querySelector('#status')?.textContent.includes('v99'),{timeout:7000});
  await page.waitForFunction(()=>document.querySelector('#quickResult')?.textContent.includes('MISE À JOUR CONFIRMÉE'),{timeout:3000});

  const result = await page.evaluate(()=>({
    status:document.querySelector('#status')?.textContent,
    files:window.__mockServerFiles,
    fetchLog:window.__mockFetchLog
  }));
  assert(result.status.includes('MISE À JOUR TERMINÉE'),'Existing deployment update flow did not complete: '+result.status);
  assert(result.status.includes('v99'),'Deployment flow did not finish on version 99: '+result.status);
  const idbBackups=await page.evaluate(async()=>await listBackupRecords());
  assert(idbBackups.length>0,'Automatic IndexedDB backup was not created');
  const legacyBackupValue=await page.evaluate(()=>localStorage.getItem('cdqsm_backups'));
  assert(legacyBackupValue===null,'Legacy localStorage backup payload should be removed');
  assert(result.fetchLog.some(x=>x.includes('PUT https://script.googleapis.com/v1/projects/TEST_SCRIPT_ID/content')),'Pending files were not written before deployment');
  assert(result.fetchLog.some(x=>x.includes('PUT https://script.googleapis.com/v1/projects/TEST_SCRIPT_ID/deployments/dep1')),'Existing deployment was not updated');
  assert(!result.fetchLog.some(x=>x.includes('POST https://script.googleapis.com/v1/projects/TEST_SCRIPT_ID/deployments')),'A new deployment was incorrectly created');
  const code=result.files.find(f=>f.type==='SERVER_JS'&&f.name==='Code');
  const selector=result.files.find(f=>f.type==='HTML'&&f.name==='Selecteur');
  const manifestFile=result.files.find(f=>f.type==='JSON'&&f.name==='appsscript');
  assert(code?.source==='function fromZip(){ return 12; }','ZIP Code.gs was not written');
  assert(selector?.source==='<main>selector zip</main>','ZIP Selector.html was not written');
  assert(!!manifestFile,'appsscript.json was not preserved');

  const localPatchResult=await page.evaluate(async()=>{
    const before='2026.09.21-v25.09-native-file-open-contract';
    const after='2026.09.21-v25.10-display-document-cleanup';
    S.files=[{name:'Code',type:'SERVER_JS',source:"const CDQ_PACKAGE_BUILD = '"+before+"';"},
      {name:'appsscript',type:'JSON',source:'{"timeZone":"America/Toronto"}'}];
    S.id='TEST_SCRIPT_ID';S.pkg.clear();S.draft.clear();
    const patch={schema:'cdq-script-bundle-v3',projectScriptId:S.id,version:'V25.10',build:after,
      requiresBuild:[before],patches:[{file:'Code.gs',op:'replace_build',from:before,to:after}],removeFiles:[]};
    const file=new File([JSON.stringify(patch)],'Balance_CDQ_V25_10.cdq',{type:'application/json'});
    await importPhoneFiles([file]);
    const imported=Array.from(S.pkg.values()).some(f=>f.source.includes(after));
    S.pkg.clear();
    packageEditor.value=JSON.stringify(patch);
    await preparePackage();
    const pasted=Array.from(S.pkg.values()).some(f=>f.source.includes(after));
    let wrongProject=false,wrongVersion=false;
    try{await importLocalBundleV40(JSON.stringify({...patch,projectScriptId:'OTHER_SCRIPT_ID'}));}catch(_){wrongProject=true;}
    try{await importLocalBundleV40(JSON.stringify({...patch,requiresBuild:['2026.09.21-v25.00-old']}));}catch(_){wrongVersion=true;}
    return {imported,pasted,wrongProject,wrongVersion};
  });
  assert(Object.values(localPatchResult).every(Boolean),'Local .cdq import/paste guards failed: '+JSON.stringify(localPatchResult));
  console.log('PASS: .cdq file import and pasted patch use project/version guards');

  const iconLaunch=await page.evaluate(async()=>{
    const before='2026.09.23-v25.25-lecteur-hors-ligne';
    const after='2026.09.23-v25.26-sheets-retour';
    const originalFetchBundle=fetchBundleTextV24;
    const requestsBefore=window.__mockFetchLog.length;
    S.id=CDQ_PRODUCTION_SCRIPT_ID;S.bundleUrl='';S.pkg.clear();S.draft.clear();S.autoBundleChecked=false;
    S.files=[{name:'Code',type:'SERVER_JS',source:"const CDQ_PACKAGE_BUILD = '"+before+"';"},
      {name:'appsscript',type:'JSON',source:'{}'}];
    const manifest={schema:'cdq-script-bundle-v3',projectScriptId:S.id,version:'V25.26',build:after,
      requiresBuild:[before],patches:[{file:'Code.gs',op:'replace_build',from:before,to:after}],removeFiles:[]};
    fetchBundleTextV24=async()=>JSON.stringify(manifest);
    try{
      const prepared=await prepareLatestBundleV41();
      const staged=Array.from(S.pkg.values()).some(f=>f.source.includes(after));
      const saved=pendingBundleV41();
      const noWrite=window.__mockFetchLog.length===requestsBefore;
      // An explicit selection must not be replaced by the automatic offer.
      S.autoBundleChecked=false;
      const preserved=await prepareLatestBundleV41()===false && Array.from(S.pkg.values()).some(f=>f.source.includes(after));
      LS.setItem(PENDING_BUNDLE_KEY_V41,JSON.stringify({url:'https://evil.invalid/manifest.json',savedAt:Date.now()}));
      const rejected=pendingBundleV41()==='';
      return {prepared,staged,noWrite,preserved,rejected,saved:saved.endsWith('/latest/manifest.json')};
    }finally{fetchBundleTextV24=originalFetchBundle;}
  });
  assert(Object.values(iconLaunch).every(Boolean),'Icon launch/resume checks failed: '+JSON.stringify(iconLaunch));
  console.log('PASS: opening the app prepares the published update without writing, remembers it, and preserves explicit selections');

  console.log('PASS: manager page loaded in Chrome');
  console.log('PASS: manifest and PNG icons valid');
  console.log('PASS: Google OAuth callback path works');
  console.log('PASS: Manager remembers the Google connection preference for 7 days with expiry on the retained access token');
  console.log('PASS: Drive project listing works');
  console.log('PASS: Manager is visibly displayed in the app');
  console.log('PASS: Manager keeps ÉCRIRE + DÉPLOYER enabled when ZIP matches code already present');
  console.log('PASS: ZIP import shows received/decoding/success visual state');
  console.log('PASS: ZIP import finds nested GS and Selector files and maps them to the project');
  console.log('PASS: read-only HEAD deployment is excluded');
  console.log('PASS: existing versioned deployment is selected by default so technician URL stays unchanged');
  console.log('PASS: quick mode links the saved project automatically');
  console.log('PASS: one quick button writes pending ZIP/package changes before creating the version');
  console.log('PASS: deployment version is re-read and confirmed after update');
  console.log('PASS: package -> backup -> write -> readback verification -> new version -> existing deployment update works');
  console.log('PASS: appsscript.json is preserved');
} finally {
  if(browser) await browser.close();
  server.kill('SIGTERM');
}
