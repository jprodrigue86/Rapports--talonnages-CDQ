import fs from 'node:fs';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
const base='https://jprodrigue86.github.io/Rapports--talonnages-CDQ/';
const prefix=base+'native/v25.28/';
const generated='balance-cdq-android/app/build/generated/cdq-web-assets/cdq-web/';
const files=JSON.parse(fs.readFileSync(generated+'asset-manifest.json')).files;
const bridge=fs.readFileSync('balance-cdq-android/web-source/server-bridge.js','utf8');
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
let allowServer=false,finished=false;
try{
  const page=await browser.newPage(),errors=[],unexpected=[],calls=[];
  let bridgeRequested=false;
  let bridgeStarted;
  const bridgeStart=new Promise(resolve=>{bridgeStarted=resolve;});
  page.on('pageerror',error=>errors.push(error.message));
  await page.setViewport({width:393,height:850,isMobile:true,hasTouch:true});
  await page.setUserAgent('Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36 BalanceCDQAndroid/25.28');
  await page.exposeFunction('recordRpc',name=>calls.push(name));
  await page.evaluateOnNewDocument(()=>{
    window.BalanceCDQNative={biometric(id){window.testBiometricRequested=id;window.testBiometricCount=(window.testBiometricCount||0)+1;},loginGoogle(){}};
  });
  await page.setRequestInterception(true);
  page.on('request',async request=>{
    const url=request.url();
    if(url.startsWith('data:')||url.startsWith('blob:'))return request.continue();
    const relative=url.startsWith(prefix)?url.slice(prefix.length).split('?')[0]:url.startsWith(base)?url.slice(base.length).split('?')[0]:'';
    if(files[relative])return request.respond({status:200,contentType:files[relative].mime+(files[relative].text?'; charset=utf-8':''),headers:{'Access-Control-Allow-Origin':'https://jprodrigue86.github.io'},body:fs.readFileSync(generated+relative)});
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
    if(url.includes('/bundles/balance-cdq/latest/manifest.json')||url.includes('/version.json'))return request.respond({status:200,contentType:'application/json',body:JSON.stringify({version:'V25.28',build:'2026.09.23-v25.28-apk-embarquee'})});
    unexpected.push(url);return request.abort();
  });
  await page.goto(prefix+'index.html',{waitUntil:'domcontentloaded'});
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
  // A returning native user can start biometric verification before the network
  // frame has loaded; access still waits for the authenticated server response.
  await page.evaluateOnNewDocument(()=>{
    if(window.top!==window)return;
    localStorage.setItem('cdq_auth_device_token_v2','fixture-device');
    localStorage.setItem('cdqLastUnlockEmailV2511','test@example.invalid');
    localStorage.removeItem('cdqResumeSessionV2524');
  });
  allowServer=false;
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.testBiometricRequested,{timeout:10000});
  selector=page.frames().find(frame=>frame.url()===prefix+'Selector.html');
  assert.equal(await selector.evaluate(()=>cdqAccessState),'pending');
  assert.equal(await page.evaluate(()=>window.testBiometricCount),1);
  await page.evaluate(()=>window.cdqNativeBiometricResultV2507(window.testBiometricRequested,true,''));
  assert.equal(await selector.evaluate(()=>cdqAccessState),'pending');
  allowServer=true;
  await selector.waitForFunction(()=>cdqAccessState==='ready',{timeout:20000});
  assert.ok(calls.includes('restaurerSessionApresBiometrie'));
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
  // The PDF engine and original template can be read with the network disabled.
  await page.setOfflineMode(true);
  const template=await selector.evaluate(async()=>{
    const module=await import('./floor-template-v2519.mjs');
    const pdf=await module.floorTemplate();
    const assets=new URL('./vendor/pdfjs-6.3.289/',location.href).href;
    const engine=await import(assets+'build/pdf.mjs');engine.GlobalWorkerOptions.workerSrc=assets+'build/pdf.worker.mjs';
    const doc=await engine.getDocument({data:new Uint8Array(await pdf.blob.arrayBuffer()),standardFontDataUrl:assets+'standard_fonts/',cMapUrl:assets+'cmaps/',cMapPacked:true,wasmUrl:assets+'wasm/',isEvalSupported:false}).promise;
    const first=await doc.getPage(1),viewport=first.getViewport({scale:0.8});
    const canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;
    await first.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
    const fields=(await first.getAnnotations()).filter(a=>a.subtype==='Widget').length;
    const result={size:pdf.blob.size,type:pdf.blob.type,pages:doc.numPages,fields,pixels:canvas.toDataURL().length};
    await doc.destroy();return result;
  });
  assert.ok(template.size>500000);assert.equal(template.type,'application/pdf');
  assert.equal(template.pages,1);assert.ok(template.fields>20);assert.ok(template.pixels>10000);
  console.log('PASS: local interface before remote data; nested authenticated bridge; clients; biometric requested once before connection, access waits for server; no online static assets; embedded PDF offline.');
}finally{finished=true;await browser.close();}
