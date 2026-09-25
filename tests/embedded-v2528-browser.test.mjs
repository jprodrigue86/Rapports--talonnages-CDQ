import fs from 'node:fs';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
const base='https://jprodrigue86.github.io/Rapports--talonnages-CDQ/';
const prefix=base+'native/v25.38/';
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
  await page.setUserAgent('Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36 BalanceCDQAndroid/25.38 CDQSafeArea/1');
  await page.exposeFunction('recordRpc',name=>calls.push(name));
  await page.evaluateOnNewDocument(()=>{
    window.testLocalConfirmCount=0;
    window.testLocalClearCount=0;
    window.BalanceCDQNative={
      biometric(id){window.testBiometricRequested=id;window.testBiometricCount=(window.testBiometricCount||0)+1;},
      loginGoogle(){},
      startupBiometricState(email,token){
        if(localStorage.getItem('cdqTestEarlyNative')!=='1')return JSON.stringify({state:'none'});
        return JSON.stringify({
          state:'pending',
          requestId:'native-startup-0123456789abcdef0123456789',
          email,
          expiresAt:Date.now()+600000,
          message:'',
          grant:''
        });
      },
      localSessionAfterBiometric(id,grant,email,token){
        if(localStorage.getItem('cdqTestEarlyNative')!=='1')return JSON.stringify({ok:false});
        return JSON.stringify({ok:true,email,expiresAt:Date.now()+600000});
      },
      confirmLocalSession(){window.testLocalConfirmCount++;return true;},
      clearLocalSession(){window.testLocalClearCount++;}
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
    // The explicitly live version check is allowed; public/static UI downloads are not.
    if(url.includes('/bundles/balance-cdq/latest/manifest.json')||url.includes('/version.json'))return request.respond({status:200,contentType:'application/json',body:JSON.stringify({version:'V25.31',build:'2026.09.25-v25.38-persistent-fast-start'})});
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
  // A returning native user already has the Android biometric prompt running
  // while the packaged WebView/Selector loads in parallel.
  await page.evaluate(()=>{
    localStorage.setItem('cdq_auth_device_token_v2','fixture-device');
    localStorage.setItem('cdqLastUnlockEmailV2511','test@example.invalid');
    localStorage.removeItem('cdqResumeSessionV2524');
    localStorage.setItem('cdqTestEarlyNative','1');
  });
  allowServer=false;allowSelector=true;
  await navigation.send('Page.reload');
  await page.waitForFunction(()=>document.querySelector('#app')?.contentDocument?.querySelector('#accessOverlay'),{timeout:10000});
  selector=page.frames().find(frame=>frame.url()===prefix+'Selector.html');assert.ok(selector);
  assert.equal(await page.evaluate(()=>window.testBiometricCount||0),0,'Web JS must not launch a duplicate biometric prompt');

  const fastStartAt=Date.now();
  await page.evaluate(()=>window.cdqNativeStartupBiometricResultV2538(
    'native-startup-0123456789abcdef0123456789',
    true,'','grant-secret-01234567890123456789'
  ));
  await selector.waitForFunction(()=>cdqAccessState==='ready'&&window.cdqLocalProvisionalV2537===true,{timeout:3000});
  await page.waitForFunction(()=>getComputedStyle(document.getElementById('app')).visibility==='visible',{timeout:3000});
  const fastStartMs=Date.now()-fastStartAt;
  assert.ok(fastStartMs<1000,'Local UI after accepted fingerprint took '+fastStartMs+' ms');
  assert.equal(await selector.evaluate(()=>utilisateurCourantRole),'lecture');
  assert.equal(calls.filter(x=>x==='restaurerSessionApresBiometrie').length,0);
  assert.equal(await page.evaluate(()=>window.testLocalConfirmCount),0);

  // Server confirmation upgrades the exact same screen without another fingerprint.
  allowServer=true;
  for(let i=0;i<400&&!calls.includes('restaurerSessionApresBiometrie');i++)await new Promise(r=>setTimeout(r,25));
  assert.ok(calls.includes('restaurerSessionApresBiometrie'));
  await selector.waitForFunction(()=>cdqAccessState==='ready'&&window.cdqLocalProvisionalV2537===false,{timeout:20000});
  await selector.waitForFunction(()=>utilisateurCourantRole==='technicien',{timeout:10000});
  await selector.waitForFunction(()=>document.querySelector('#companyList')?.textContent.includes('Client de vérification'),{timeout:10000});
  assert.equal(calls.filter(x=>x==='restaurerSessionApresBiometrie').length,1);
  assert.equal(await page.evaluate(()=>window.testBiometricCount||0),0);
  assert.equal(await page.evaluate(()=>window.testLocalConfirmCount),1);

  // Custom navigation icons must never leave an empty bar. The packaged sprite
  // is used when available; removing the ready marker exposes the original icon.
  await selector.evaluate(()=>{
    const host=document.querySelector('.bottom-nav > .bottom-nav-item > span');
    if(!host)throw Error('Bottom navigation icon host missing');
    host.classList.add('cdq-icon-host-v2514');
    host.style.setProperty('--cdq-art-size','100% 100%');
    host.style.setProperty('--cdq-art-position','0% 0%');
    window.cdqIconFallbackV2538?.sync();
  });
  await new Promise(r=>setTimeout(r,120));
  const iconState=await selector.evaluate(async()=>{
    const host=document.querySelector('.bottom-nav > .bottom-nav-item > span.cdq-icon-host-v2514');
    if(!host)return null;
    const hostStyle=getComputedStyle(host);
    const pseudo=getComputedStyle(host,'::after');
    const ready=window.cdqIconFallbackV2538?.ready()===true;
    const originalVisible=hostStyle.visibility!=='hidden';
    const replacementVisible=pseudo.display!=='none' &&
      pseudo.visibility!=='hidden' &&
      pseudo.backgroundImage!=='none';
    const response=await fetch('./bundles/balance-cdq/v25.15/icons-transparent.webp');
    const spriteBytes=(await response.arrayBuffer()).byteLength;
    return {
      ready,
      originalVisible,
      replacementVisible,
      hostWidth:host.getBoundingClientRect().width,
      hostHeight:host.getBoundingClientRect().height,
      pseudoImage:pseudo.backgroundImage,
      spriteOk:response.ok,
      spriteBytes
    };
  });
  assert.ok(iconState);
  assert.ok(iconState.originalVisible||iconState.replacementVisible,
    'Bottom navigation icon must never be blank while the custom sprite loads');
  assert.ok(iconState.hostWidth>10&&iconState.hostHeight>10);
  assert.equal(iconState.spriteOk,true);
  assert.ok(iconState.spriteBytes>10000);
  if(iconState.ready){
    assert.equal(iconState.replacementVisible,true);
    assert.match(iconState.pseudoImage,/icons-transparent\.webp/);
  }else{
    assert.equal(iconState.originalVisible,true);
  }

  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
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
  await page.evaluate(()=>{window.testBiometricRequested='';localStorage.setItem('cdqTestEarlyNative','0');});
  await navigation.send('Page.reload');
  await page.waitForFunction(()=>window.testBiometricRequested,{timeout:10000});
  await page.evaluate(()=>window.cdqNativeBiometricResultV2507(window.testBiometricRequested,false,'Annulée',''));
  await page.waitForFunction(()=>document.querySelector('#app')?.contentDocument?.querySelector('#accessOverlay'));
  selector=page.frames().find(frame=>frame.url()===prefix+'Selector.html');
  await selector.waitForFunction(()=>cdqAccessState==='input',{timeout:15000});
  assert.equal(calls.filter(x=>x==='restaurerSessionApresBiometrie').length,1);
  assert.equal(await page.evaluate(()=>window.testBiometricCount),1);
  assert.deepEqual(errors,[]);
  console.log('PASS: native biometric starts before WebView, local UI appears in under 1s after acceptance, server upgrades once, bottom icons always have a local fallback, cancelled fingerprint remains locked, installed assets and PDF work offline.');
}finally{finished=true;await browser.close();}
