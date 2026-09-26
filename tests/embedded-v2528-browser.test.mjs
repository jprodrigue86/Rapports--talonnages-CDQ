import fs from 'node:fs';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
const base='https://jprodrigue86.github.io/Rapports--talonnages-CDQ/';
const prefix=base+'native/v25.47/';
const generated='balance-cdq-android/app/build/generated/cdq-web-assets/cdq-web/';
const files=JSON.parse(fs.readFileSync(generated+'asset-manifest.json')).files;
const bridge=fs.readFileSync('balance-cdq-android/web-source/server-bridge.js','utf8');
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
let allowServer=false,allowSelector=true,finished=false,networkBlocked=false;
try{
  const page=await browser.newPage(),errors=[],unexpected=[],calls=[];
  let bridgeRequested=false;
  let bridgeStarted;
  const bridgeStart=new Promise(resolve=>{bridgeStarted=resolve;});
  page.on('pageerror',error=>errors.push(error.message));
  await page.setViewport({width:393,height:850,isMobile:true,hasTouch:true});
  await page.setUserAgent('Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36 BalanceCDQAndroid/25.47 CDQSafeArea/1');
  await page.exposeFunction('recordRpc',name=>calls.push(name));
  await page.evaluateOnNewDocument(()=>{
    window.testTicketConfirmCount=0;
    window.testTicketClearCount=0;
    window.BalanceCDQNative={
      biometric(id){
        window.testBiometricRequested=id;
        window.testBiometricCount=(window.testBiometricCount||0)+1;
      },
      loginGoogle(){},
      startupBiometricState(email,token){
        if(localStorage.getItem('cdqTestTicketV2540')!=='1')return JSON.stringify({state:'none'});
        return JSON.stringify({
          state:'pending',
          requestId:'native-startup-0123456789abcdef0123456789',
          email,
          expiresAt:Date.now()+3600000,
          message:'',
          grant:''
        });
      },
      localStartupTicket(id,grant,email,token){
        if(localStorage.getItem('cdqTestTicketV2540')!=='1')return JSON.stringify({ok:false});
        return JSON.stringify({ok:true,email,expiresAt:Date.now()+3600000});
      },
      confirmStartupTicket(){window.testTicketConfirmCount++;return true;},
      clearStartupTicket(){window.testTicketClearCount++;},
      updateIdentity(){return JSON.stringify({versionName:'25.47',versionCode:2547});},
      openUpdater(){window.testUpdaterOpenCount=(window.testUpdaterOpenCount||0)+1;}
    };
  });
  await page.setRequestInterception(true);
  page.on('request',async request=>{
    const url=request.url();
    if(url.startsWith('data:')||url.startsWith('blob:'))return request.continue();
    const relative=url.startsWith(prefix)?url.slice(prefix.length).split('?')[0]:url.startsWith(base)?url.slice(base.length).split('?')[0]:'';
    if(files[relative]){
      if(relative==='Selector.html')while(!allowSelector&&!finished)await new Promise(r=>setTimeout(r,20));
      if(finished)return;
      return request.respond({status:200,contentType:files[relative].mime+(files[relative].text?'; charset=utf-8':''),headers:{'Access-Control-Allow-Origin':'https://jprodrigue86.github.io'},body:fs.readFileSync(generated+relative)});
    }
    // Model native shouldInterceptRequest: installed files remain readable while
    // every request requiring the network fails, including the server bridge.
    if(networkBlocked)return request.abort('internetdisconnected');
    if(url.startsWith('https://script.google.com/')&&url.includes('cdq_native_bridge=1')){
      bridgeRequested=true;
      bridgeStarted();
      // Hold only the remote connection: the actual installed UI must still parse.
      while(!allowServer&&!finished)await new Promise(r=>setTimeout(r,30));
      if(finished)return;
      const channel=new URL(url).searchParams.get('channel');
      return request.respond({status:200,contentType:'text/html; charset=utf-8',body:`<iframe src="https://fixture-script.googleusercontent.com/bridge?channel=${channel}"></iframe>`});
    }
    if(url.startsWith('https://fixture-script.googleusercontent.com/bridge')){
      const channel=new URL(url).searchParams.get('channel');
      const fixture=`
      window.google={script:{run:new Proxy({},{get(_target,name){
        if(name==='withSuccessHandler')return fn=>{window.success=fn;return google.script.run;};
        if(name==='withFailureHandler')return fn=>{window.failure=fn;return google.script.run;};
        return (...args)=>{
          const done=window.success;window.recordRpc?.(name);
          if(name==='obtenirEtatAcces'||name==='restaurerSessionApresBiometrie')return setTimeout(()=>done({autorise:true,email:'test@example.invalid',role:'technicien',jetonSession:'fixture-session',compagniesInitiales:[{id:'client_fixture_12345',nom:'Client de vérification'}]}),20);
          if(name==='cdqRpc'){
            if(args[0]==='obtenirDossiersClients')return setTimeout(()=>done([{id:'client_fixture_12345',nom:'Client de vérification'}]),20);
            return setTimeout(()=>done([]),20);
          }
          window.failure?.(Error('Unexpected fixture method '+name));
        };
      }})}};`;
      return request.respond({status:200,contentType:'text/html; charset=utf-8',body:`<script>const CDQ_EMBEDDED_CHANNEL=${JSON.stringify(channel)};${fixture}\n${bridge}</script>`});
    }
    if(url.includes('/downloads/android-release-update.json'))return request.respond({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Cache-Control':'no-store'},body:JSON.stringify({versionName:'25.48',versionCode:2548,apkUrl:'https://example.invalid/Balance-CDQ-Android-25.48.apk',sha256:'deadbeef',channel:'stable'})});
    // The explicitly live version check is allowed; public/static UI downloads are not.
    if(url.includes('/bundles/balance-cdq/latest/manifest.json')||url.includes('/version.json'))return request.respond({status:200,contentType:'application/json',body:JSON.stringify({version:'V25.31',build:'2026.09.26-v25.47-native-update-center'})});
    unexpected.push(url);return request.abort();
  });
  // Puppeteer's navigation lifecycle also waits on child frames. Here the
  // remote child is deliberately held; wait on the local UI below instead.
  const navigation=await page.createCDPSession();
  await navigation.send('Page.navigate',{url:prefix+'index.html'});
  await page.waitForFunction(()=>document.querySelector('#app')?.contentDocument?.querySelector('#accessOverlay'));
  await Promise.race([bridgeStart,new Promise((_,reject)=>setTimeout(()=>reject(Error('Bridge did not start: '+JSON.stringify(errors))),10000))]);
  assert.equal(bridgeRequested,true);
  let selector=page.frames().find(frame=>frame.url()===prefix+'Selector.html');assert.ok(selector);
  assert.equal(await selector.evaluate(()=>cdqAccessState),'pending');
  assert.equal(await selector.evaluate(()=>typeof google.script.run.withSuccessHandler),'function');
  await page.screenshot({path:'/tmp/cdq-v2528-local-startup.png'});
  allowServer=true;
  await selector.waitForFunction(()=>cdqAccessState==='ready',{timeout:20000});
  try{await selector.waitForFunction(()=>document.querySelector('#companyList')?.textContent.includes('Client de vérification'),{timeout:10000});}
  catch(error){console.log({errors,unexpected,calls,state:await selector.evaluate(()=>({access:cdqAccessState,clients:toutesLesCompagnies,list:document.querySelector('#companyList')?.textContent}))});await page.screenshot({path:'/tmp/cdq-v2528-failed.png'});throw error;}
  await page.waitForFunction(()=>getComputedStyle(document.getElementById('app')).visibility==='visible');
  await page.screenshot({path:'/tmp/cdq-v2528-local-ready.png'});
  assert.deepEqual(errors,[]);
  assert.deepEqual(unexpected,[]);
  assert.ok(calls.includes('obtenirEtatAcces'));
  // V25.47 returning startup: Android already owns the biometric prompt and
  // the untouched Selector is allowed to parse while the server is held.
  await page.evaluate(()=>{
    localStorage.setItem('cdq_auth_device_token_v2','fixture-device');
    localStorage.setItem('cdqLastUnlockEmailV2511','test@example.invalid');
    localStorage.removeItem('cdqResumeSessionV2524');
    localStorage.setItem('cdqTestTicketV2540','1');
  });
  allowServer=false;allowSelector=true;
  await navigation.send('Page.reload');
  await page.waitForFunction(()=>document.querySelector('#app')?.contentDocument?.querySelector('#accessOverlay'),{timeout:10000});
  selector=page.frames().find(frame=>frame.url()===prefix+'Selector.html');assert.ok(selector);
  assert.equal(await page.evaluate(()=>window.testBiometricCount||0),0,'WebView must reuse the native prompt');

  const fastStartAt=Date.now();
  await page.evaluate(()=>window.cdqNativeStartupBiometricResultV2539(
    'native-startup-0123456789abcdef0123456789',
    true,'','grant-secret-01234567890123456789'
  ));
  await selector.waitForFunction(()=>cdqAccessState==='ready',{timeout:3000});
  const firstFrameSettleAt=Date.now();
  assert.equal(await page.evaluate(()=>cdqFirstFrameStableV2543),false,
    'Native shell must wait for the Selector stable-frame signal');
  assert.equal(await page.evaluate(()=>getComputedStyle(document.getElementById('app')).visibility),'hidden',
    'Android must keep the first authenticated frame covered while icons settle');
  const lateIconMutation=await selector.evaluate(()=>{
    const offline=[...document.querySelectorAll('button,[role="button"],a')]
      .find(el=>String(el.textContent||'').replace(/\s+/g,' ').trim().toLowerCase().includes('hors ligne'));
    if(!offline)return false;
    setTimeout(()=>{
      const icon=offline.querySelector('span,i,svg')||document.createElement('span');
      if(!icon.parentNode)offline.prepend(icon);
      icon.setAttribute('data-cdq-late-icon-test','1');
    },180);
    return true;
  });
  assert.equal(lateIconMutation,true,'Offline control must exist in the real Selector fixture');
  await page.waitForFunction(()=>getComputedStyle(document.getElementById('app')).visibility==='visible',{timeout:3000});
  const firstFrameSettleMs=Date.now()-firstFrameSettleAt;
  assert.ok(firstFrameSettleMs>=320,'Stable-frame gate revealed too early: '+firstFrameSettleMs+' ms');
  assert.equal(await page.evaluate(()=>cdqFirstFrameStableV2543),true);
  assert.equal(await page.evaluate(()=>cdqFirstFrameStableSourceV2543),'signal',
    'First frame must open from the Selector stability signal, not the safety fallback');
  const fastStartMs=Date.now()-fastStartAt;
  assert.ok(fastStartMs<2200,'Local UI after fingerprint took '+fastStartMs+' ms');
  assert.equal(await selector.evaluate(()=>utilisateurCourantRole),'technicien');
  assert.equal(calls.filter(x=>x==='restaurerSessionApresBiometrie').length,0,'Server is still deliberately held');

  // V25.44: loading progress belongs to the interface flow instead of floating
  // over the lower navigation.
  const integratedProgress=await selector.evaluate(async()=>{
    window.cdqProgressStartV2293?.('Chargement des fichiers',7);
    await new Promise(resolve=>setTimeout(resolve,80));
    const box=document.getElementById('cdqGlobalProgressV2293');
    const files=document.getElementById('filesContainer');
    const style=box?getComputedStyle(box):null;
    const result={
      exists:!!box,
      integrated:box?.dataset.cdqIntegratedV2544==='1',
      beforeFiles:!!box&&!!files&&box.nextElementSibling===files,
      position:style?.position||'',
      display:style?.display||''
    };
    window.cdqProgressDoneV2293?.('Fichiers prêts');
    return result;
  });
  assert.equal(integratedProgress.exists,true);
  assert.equal(integratedProgress.integrated,true);
  assert.equal(integratedProgress.beforeFiles,true);
  assert.notEqual(integratedProgress.position,'fixed');
  assert.notEqual(integratedProgress.display,'none');

  // V25.47: Android settings must compare the installed APK against the
  // durable Android release manifest, not the web/Script Manager bundle.
  const updateUi=await selector.evaluate(async()=>{
    window.ouvrirReglagesAffichage();
    window.cdqCheckUpdate();
    for(let i=0;i<100;i++){
      const latest=document.getElementById('cdqUpdateLatest')?.textContent||'';
      const state=document.getElementById('cdqUpdateStatus')?.textContent||'';
      if(latest==='V25.48'&&/disponible/i.test(state))break;
      await new Promise(resolve=>setTimeout(resolve,25));
    }
    return {
      installed:document.getElementById('cdqUpdateInstalled')?.textContent||'',
      latest:document.getElementById('cdqUpdateLatest')?.textContent||'',
      state:document.getElementById('cdqUpdateStatus')?.textContent||'',
      installText:document.getElementById('cdqInstallUpdateButton')?.textContent||'',
      disabled:!!document.getElementById('cdqInstallUpdateButton')?.disabled
    };
  });
  assert.equal(updateUi.installed,'V25.47');
  assert.equal(updateUi.latest,'V25.48');
  assert.match(updateUi.state,/disponible/i);
  assert.match(updateUi.installText,/Installer V25\.48/);
  assert.equal(updateUi.disabled,false);
  const updaterBinding=await selector.evaluate(()=>({
    bound:document.getElementById('cdqInstallUpdateButton')?.onclick===cdqForceUpdate,
    hasNativeHandoff:/openUpdater/.test(String(cdqForceUpdate)),
    hasFallback:/cdqupdate:\/\/check/.test(String(cdqForceUpdate))
  }));
  assert.equal(updaterBinding.bound,true);
  assert.equal(updaterBinding.hasNativeHandoff,true);
  assert.equal(updaterBinding.hasFallback,true);

  // V25.45: a normal unfiltered company row gets its id on first touch, so
  // cache warming starts before the click handler opens the client.
  const touchWarm=await selector.evaluate(()=>{
    const previous=toutesLesCompagnies;
    toutesLesCompagnies=[{id:'client_touch_fixture_2545',nom:'Client toucher V25.45'}];
    remplirListeCompagnies();
    const row=document.querySelector('#companyList .company-item:not(.company-reset-item)');
    if(!row){toutesLesCompagnies=previous;return null;}
    const before=String(row.dataset.companyId||'');
    row.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
    const after=String(row.dataset.companyId||'');
    toutesLesCompagnies=previous;remplirListeCompagnies();
    return {before,after};
  });
  assert.ok(touchWarm);
  assert.equal(touchWarm.before,'client_touch_fixture_2545');
  assert.equal(touchWarm.after,'client_touch_fixture_2545');

  // V25.45: mobile rendering creates only the visible level. Opening a folder
  // whose data is already cached renders that level instantly without Drive.
  const lazyClientRender=await selector.evaluate(async()=>{
    const previous={
      client:compagnieSelectionnee,
      name:nomCompagnieSelectionnee,
      root:typeof cdqRootContent!=='undefined'?cdqRootContent:null
    };
    const id='client_render_fixture_2545';
    const nested={
      id,nom:'Client rendu',charge:true,fichiers:[{id:'root-file',nom:'Racine.pdf',type:'PDF',dateModification:'2026-09-25T12:00:00Z'}],
      dossiers:[{
        id:'level-1',nom:'Rapports',charge:true,
        fichiers:Array.from({length:40},(_,i)=>({id:'file-'+i,nom:'Rapport '+i+'.pdf',type:'PDF',dateModification:'2026-09-25T12:00:00Z'})),
        dossiers:[{id:'level-2',nom:'Archive',charge:true,fichiers:[{id:'deep-file',nom:'Ancien.pdf',type:'PDF'}],dossiers:[]}]
      }]
    };
    compagnieSelectionnee=id;nomCompagnieSelectionnee='Client rendu';
    cacheContenuCompagnies[id]=nested;cacheDerniereVerificationCompagnies[id]=Date.now();cdqRootContent=nested;
    const host=document.createElement('div');
    afficherDossierRecursif(nested,host);
    const before={rows:host.querySelectorAll('.file-row').length,folders:host.querySelectorAll('.folder-header').length};
    const topFolder=host.querySelector('.folder');
    const topContent=topFolder?.querySelector(':scope > .folder-content');
    if(topContent){
      afficherDossierRecursif(nested.dossiers[0],topContent);
      topFolder.classList.add('open');
    }
    const after={rows:host.querySelectorAll('.file-row').length,folders:host.querySelectorAll('.folder-header').length,open:!!host.querySelector('.folder.open')};
    delete cacheContenuCompagnies[id];delete cacheDerniereVerificationCompagnies[id];
    compagnieSelectionnee=previous.client;nomCompagnieSelectionnee=previous.name;cdqRootContent=previous.root;
    return {before,after};
  });
  assert.deepEqual(lazyClientRender.before,{rows:1,folders:1});
  assert.equal(lazyClientRender.after.rows,41);
  assert.equal(lazyClientRender.after.folders,2);
  assert.equal(lazyClientRender.after.open,true);

  // Exercise the real pre-V25.37 icon theme code. No V25.37/V25.38 icon patch exists.
  await selector.evaluate(()=>{
    const user=String(utilisateurCourantEmail||'').trim().toLowerCase();
    if(!user)throw Error('No current user for icon regression');
    const key='cdqIconThemeV2514:'+user;
    localStorage.setItem(key,JSON.stringify({style:'metal-music',revision:Date.now()+1,pending:false}));
    window.dispatchEvent(new StorageEvent('storage',{key}));
  });
  await selector.waitForFunction(()=>{
    const items=[...document.querySelectorAll('.bottom-nav > .bottom-nav-item')];
    if(items.length!==6)return false;
    return items.every(button=>{
      const host=button.querySelector(':scope > span');
      if(!host)return false;
      const h=getComputedStyle(host),p=getComputedStyle(host,'::after');
      const original=h.visibility!=='hidden'&&h.display!=='none'&&host.getBoundingClientRect().height>8;
      const themed=p.visibility!=='hidden'&&p.display!=='none'&&p.backgroundImage!=='none';
      return original||themed;
    });
  },{timeout:5000});
  await selector.evaluate(()=>window.cdqIconThemesV2514?.synchronize());
  await selector.waitForFunction(()=>{
    const visible=[...document.querySelectorAll('.bottom-nav > .bottom-nav-item')]
      .filter(button=>getComputedStyle(button).display!=='none');
    return visible.length>=5 && visible.every(button=>
      button.querySelector(':scope > span')?.classList.contains('cdq-icon-host-v2514')
    );
  },{timeout:5000});

  const navIcons=await selector.evaluate(async()=>{
    const visible=[...document.querySelectorAll('.bottom-nav > .bottom-nav-item')]
      .filter(button=>getComputedStyle(button).display!=='none');
    const items=visible.map(button=>{
      const host=button.querySelector(':scope > span');
      const p=getComputedStyle(host,'::after'),h=getComputedStyle(host);
      return {
        label:button.querySelector('small')?.textContent.trim(),
        themed:host.classList.contains('cdq-icon-host-v2514'),
        hostVisibility:h.visibility,
        width:host.getBoundingClientRect().width,
        height:host.getBoundingClientRect().height,
        pseudoDisplay:p.display,
        pseudoVisibility:p.visibility,
        pseudoImage:p.backgroundImage
      };
    });
    const spriteUrl=new URL('./bundles/balance-cdq/v25.15/icons-transparent.webp',location.href).href;
    const response=await fetch(spriteUrl);
    return {
      items,
      sprite:{url:spriteUrl,ok:response.ok,bytes:(await response.arrayBuffer()).byteLength},
      artworkCss:[...document.styleSheets].some(sheet=>
        String(sheet.href||'').includes('icon-artwork-baseline-v2540.css')
      )
    };
  });
  await page.screenshot({path:'/tmp/cdq-v2540-metal-music.png'});
  assert.ok(navIcons.items.length>=5);
  assert.ok(navIcons.items.every(x=>x.themed));
  assert.ok(navIcons.items.every(x=>x.width>8&&x.height>8));
  assert.ok(navIcons.items.every(x=>
    x.pseudoDisplay!=='none' &&
    x.pseudoVisibility!=='hidden' &&
    /icons-transparent\.webp/.test(x.pseudoImage)
  ));
  assert.equal(navIcons.artworkCss,true);
  assert.equal(navIcons.sprite.ok,true);
  assert.ok(navIcons.sprite.bytes>500000);
  assert.match(navIcons.sprite.url,/native\/v25\.47\/bundles\/balance-cdq\/v25\.15\/icons-transparent\.webp/);
  assert.equal(await selector.evaluate(()=>typeof window.cdqIconFallbackV2538),'undefined');

  // The server now confirms; held RPC may leave the device only after this point.
  allowServer=true;
  for(let i=0;i<400&&!calls.includes('restaurerSessionApresBiometrie');i++)await new Promise(r=>setTimeout(r,25));
  assert.ok(calls.includes('restaurerSessionApresBiometrie'));
  await selector.waitForFunction(()=>document.querySelector('#companyList')?.textContent.includes('Client de vérification'),{timeout:10000});
  assert.equal(calls.filter(x=>x==='restaurerSessionApresBiometrie').length,1);
  assert.equal(await page.evaluate(()=>window.testBiometricCount||0),0);
  await page.waitForFunction(()=>window.testTicketConfirmCount===1,{timeout:5000});
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);

  // A later unlock on the same loaded WebView must also use the local ticket.
  const repeatAt=Date.now();
  const observed=await page.evaluate(()=>window.cdqWarmUnlockV2540?.observe(
    'warm-reopen-01234567890123456789',
    true,'','grant-repeat-012345678901234567890'
  ));
  assert.equal(observed,true);
  await selector.evaluate(()=>{
    window.testWarmResults=[];
    google.script.run
      .withSuccessHandler(value=>window.testWarmResults.push(value))
      .withFailureHandler(error=>window.testWarmResults.push({error:error?.message||String(error)}))
      .restaurerSessionApresBiometrie(cdqObtenirJetonAppareil());
  });
  await selector.waitForFunction(()=>window.testWarmResults?.length>=1,{timeout:3000});
  const warmFirst=await selector.evaluate(()=>window.testWarmResults[0]);
  assert.equal(warmFirst.cdqWarmReadOnlyV2540,true);
  assert.ok(Date.now()-repeatAt<1000,'Repeated warm unlock did not reveal local UI under 1 second');
  await selector.waitForFunction(()=>window.testWarmResults?.length>=2,{timeout:5000});
  const warmSecond=await selector.evaluate(()=>window.testWarmResults[1]);
  assert.equal(warmSecond.autorise,true);
  assert.equal(warmSecond.cdqWarmReadOnlyV2540,undefined);
  assert.equal(await page.evaluate(()=>window.testTicketConfirmCount),2);

  // Disable all nonpackaged requests at the interception boundary. CDP's global
  // emulateNetworkConditions can hang on detached cross-origin iframe targets
  // after reload, and would also disable HTTPS URLs served by Android assets.
  networkBlocked=true;
  await selector.evaluate(()=>{
    Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false});
    window.dispatchEvent(new Event('offline'));
  });
  assert.equal(await selector.evaluate(()=>navigator.onLine),false);
  assert.equal(await selector.evaluate(async()=>{
    try{await fetch('https://script.google.com/offline-fixture-probe');return false;}
    catch{return true;}
  }),true);
  const template=await selector.evaluate(async()=>{
    const module=await import('./floor-template-v2519.mjs');
    const pdf=await module.floorTemplate();
    const assets=new URL('./vendor/pdfjs-6.3.289/',location.href).href;
    const engine=await import(assets+'build/pdf.mjs');engine.GlobalWorkerOptions.workerSrc=assets+'build/pdf.worker.mjs';
    const loading=engine.getDocument({data:new Uint8Array(await pdf.blob.arrayBuffer()),standardFontDataUrl:assets+'standard_fonts/',cMapUrl:assets+'cmaps/',cMapPacked:true,wasmUrl:assets+'wasm/',isEvalSupported:false});
    const doc=await loading.promise;
    const first=await doc.getPage(1),viewport=first.getViewport({scale:0.8});
    const canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;
    await first.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
    const fields=(await first.getAnnotations()).filter(a=>a.subtype==='Widget').length;
    const result={size:pdf.blob.size,type:pdf.blob.type,pages:doc.numPages,fields,pixels:canvas.toDataURL().length};
    await loading.destroy();return result;
  });
  assert.ok(template.size>500000);assert.equal(template.type,'application/pdf');
  assert.equal(template.pages,1);assert.ok(template.fields>20);assert.ok(template.pixels>10000);
  // Cancelling the early prompt must not authenticate, even with a live server.
  networkBlocked=false;
  await page.evaluate(()=>{window.testBiometricRequested='';localStorage.setItem('cdqTestTicketV2540','0');});
  await navigation.send('Page.reload');
  await page.waitForFunction(()=>window.testBiometricRequested,{timeout:10000});
  await page.evaluate(()=>window.cdqNativeBiometricResultV2507(window.testBiometricRequested,false,'Annulée',''));
  await page.waitForFunction(()=>document.querySelector('#app')?.contentDocument?.querySelector('#accessOverlay'));
  selector=page.frames().find(frame=>frame.url()===prefix+'Selector.html');
  await selector.waitForFunction(()=>cdqAccessState==='input',{timeout:15000});
  assert.equal(calls.filter(x=>x==='restaurerSessionApresBiometrie').length,2);
  assert.equal(await page.evaluate(()=>window.testBiometricCount),1);
  assert.deepEqual(errors,[]);
  console.log('PASS: Metal Music artwork is loaded from packaged V25.15 assets, cold and repeated warm unlocks reveal local UI under 1s, remote RPC waits for server confirmation, cancellation stays locked, installed PDF works offline.');
}finally{finished=true;await browser.close();}
