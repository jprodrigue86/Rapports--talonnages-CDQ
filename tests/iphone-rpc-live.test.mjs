// This test uses real Google HtmlService, without an account or client data.
// Own-site static files may be served from the checkout before publication.
import {chromium,webkit,devices} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const base='https://jprodrigue86.github.io/Rapports--talonnages-CDQ/iphone/app/';
const root=path.resolve('iphone/app');
const published=process.env.CDQ_TEST_PUBLISHED==='1';
const expected=JSON.parse(fs.readFileSync(path.join(root,'release.json'),'utf8'));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.pdf':'application/pdf','.woff2':'font/woff2'};
await Promise.all(Object.entries({chromium,webkit}).map(async([engine,type])=>{
 const browser=await type.launch(),context=await browser.newContext({...devices['iPhone 13'],serviceWorkers:'block'});
 try{
  if(!published)await context.route(base+'**',async route=>{
   const requestUrl=new URL(route.request().url());
   const relative=decodeURIComponent(requestUrl.pathname.slice(new URL(base).pathname.length))||'index.html';
   const file=path.resolve(root,relative);
   if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.fulfill({status:404,body:'Not found'});
   await route.fulfill({status:200,contentType:mime[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
  });
  const probe=await context.newPage();
  await probe.route(base+'__read_only_rpc_test__',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><script src="./embedded-rpc.js"></script><body>Read-only anonymous connectivity test</body>'}));
  await probe.goto(base+'__read_only_rpc_test__',{waitUntil:'domcontentloaded',timeout:45000});
  const result=await probe.evaluate(()=>new Promise(resolve=>{
   let done=false;const started=Date.now();const finish=v=>{if(done)return;done=true;resolve({...v,ms:Date.now()-started});};
   google.script.run.withSuccessHandler(v=>finish({ok:true,authorized:v?.autorise===true})).withFailureHandler(()=>finish({ok:false,error:'SERVER_OR_TRANSPORT_FAILURE'})).obtenirEtatAcces('','');
   setTimeout(()=>finish({ok:false,error:'NO_RESULT_45S'}),45000);
  }));
  console.log(JSON.stringify({engine,mode:published?'published':'checkout',scenario:'anonymous-real-google-read',result}));
  assert.equal(result.ok,true,engine+': real Google response must reach the callback');
  assert.equal(result.authorized,false,'Anonymous diagnostic must not gain access');
  await probe.close();
  const app=await context.newPage();
  await app.addInitScript(()=>{
   window.__cdqAnonymousProbe={authRequired:0};
   addEventListener('message',event=>{
    if(event.origin===location.origin&&event.data?.type==='CDQ_GOOGLE_AUTH_REQUIRED')window.__cdqAnonymousProbe.authRequired++;
   });
  });
  await app.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
  await app.waitForFunction(()=>window.__cdqAnonymousProbe.authRequired>0,{},{timeout:60000});
  await app.locator('#load-help').waitFor({state:'visible',timeout:10000});
  await app.locator('#google-touch-fallback').waitFor({state:'visible',timeout:10000});
  assert.equal(await app.locator('#load-title').innerText(),'Connexion à Balance CDQ');
  const release=await app.evaluate(()=>document.documentElement.dataset.cdqIphoneRelease);
  assert.equal(release,expected.release,'Browser must load the corrected release');
  console.log(JSON.stringify({engine,mode:published?'published':'checkout',scenario:'anonymous-startup-google-sign-in-visible',ok:true,connectionRevision:expected.connectionRevision}));
 }finally{await context.close();await browser.close();}
}));
