import fs from 'node:fs';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
const base='https://jprodrigue86.github.io/Rapports--talonnages-CDQ/';
const prefix=base+'native/v25.28/';
const generated='balance-cdq-android/app/build/generated/cdq-web-assets/cdq-web/';
const files=JSON.parse(fs.readFileSync(generated+'asset-manifest.json')).files;
const bridge=fs.readFileSync('balance-cdq-android/web-source/server-bridge.js','utf8');
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
  const page=await browser.newPage(),errors=[],unexpected=[],calls=[];
  let bridgeRequested=false,allowServer=false;
  let bridgeStarted;
  const bridgeStart=new Promise(resolve=>{bridgeStarted=resolve;});
  page.on('pageerror',error=>errors.push(error.message));
  await page.setViewport({width:393,height:850,isMobile:true,hasTouch:true});
  await page.setUserAgent('Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36 BalanceCDQAndroid/25.28');
  await page.exposeFunction('recordRpc',name=>calls.push(name));
  await page.evaluateOnNewDocument(()=>{
    window.BalanceCDQNative={biometric(id){window.testBiometricRequested=id;},loginGoogle(){}};
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
      while(!allowServer)await new Promise(r=>setTimeout(r,30));
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
          if(name==='obtenirEtatAcces')return setTimeout(()=>done({autorise:true,email:'test@example.invalid',role:'technicien',jetonSession:'fixture-session',compagniesInitiales:[{id:'client_fixture_12345',nom:'Client de vérification'}]}),20);
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
  const selector=page.frames().find(frame=>frame.url()===prefix+'Selector.html');assert.ok(selector);
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
  // The PDF engine and original template can be read with the network disabled.
  await page.setOfflineMode(true);
  const template=await selector.evaluate(async()=>{
    const module=await import('./floor-template-v2519.mjs');
    const pdf=await module.floorTemplate();
    return {size:pdf.blob.size,type:pdf.blob.type};
  });
  assert.ok(template.size>500000);assert.equal(template.type,'application/pdf');
  console.log('PASS: installed interface initializes before delayed remote data; nested authenticated bridge unlocks it; clients display; no online static assets; embedded PDF loads offline.');
}finally{await browser.close();}
