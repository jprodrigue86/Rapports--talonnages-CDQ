import {webkit,chromium,devices} from 'playwright';
import fs from 'node:fs';
const base='https://jprodrigue86.github.io/Rapports--talonnages-CDQ/iphone/app/';
const original=fs.readFileSync('iphone/app/embedded-rpc.js','utf8');
const variants={hidden:original,onscreen:original.replace('frame.hidden=true;',"frame.style.cssText='position:fixed;left:0;top:0;width:2px;height:2px;border:0;opacity:0.01;pointer-events:none;';"),offscreen:original.replace('frame.hidden=true;',"frame.style.cssText='position:fixed;left:-10000px;top:0;width:400px;height:300px;border:0;';"),visible:original.replace('frame.hidden=true;',"frame.style.cssText='position:fixed;left:0;top:0;width:390px;height:300px;border:0;';")};
for(const [name,source] of Object.entries(variants))if(name!=='hidden'&&source===original)throw Error('Anchor not found');
await Promise.all(Object.entries(variants).map(async([name,source])=>{
 const browser=await webkit.launch(),context=await browser.newContext({...devices['iPhone 13'],serviceWorkers:'block'});
 const page=await context.newPage();
 try{
  await context.addInitScript(()=>{
   window.__messages=[];window.__raf=false;requestAnimationFrame(()=>{window.__raf=true;});
   addEventListener('message',e=>{const d=e.data;if(d&&/^CDQ_EMBEDDED_/.test(d.type))window.__messages.push({type:d.type,id:d.id,name:d.name,ok:d.ok});});
  });
  await page.route(base+'__layout_probe__',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><script src="./__transport_probe__.js"></script><body>Anonymous read-only probe</body>'}));
  await page.route(base+'__transport_probe__.js',r=>r.fulfill({contentType:'text/javascript',body:source}));
  await page.goto(base+'__layout_probe__',{waitUntil:'domcontentloaded',timeout:45000});
  const result=await page.evaluate(()=>new Promise(resolve=>{
   const start=Date.now();let done=false;const finish=v=>{if(done)return;done=true;resolve({...v,ms:Date.now()-start});};
   google.script.run.withSuccessHandler(v=>finish({ok:true,authorized:v?.autorise===true})).withFailureHandler(()=>finish({ok:false,error:'RPC_ERROR'})).obtenirEtatAcces('','');
   setTimeout(()=>finish({ok:false,error:'NO_RESULT_35S'}),35000);
  }));
  const frames=[];
  for(const f of page.frames())frames.push(await f.evaluate(()=>({host:location.hostname,ready:document.readyState,visibility:document.visibilityState,raf:window.__raf,messages:window.__messages,google:!!window.google?.script?.run})).catch(()=>({inaccessible:true})));
  console.log('LAYOUT_RESULT '+JSON.stringify({name,result,frames}));
 }catch(e){console.log('LAYOUT_ERROR '+JSON.stringify({name,error:String(e.message).replace(/https?:\/\/\S+/g,'[url]').slice(0,220)}));process.exitCode=1;}
 finally{await context.close();await browser.close();}
}));
