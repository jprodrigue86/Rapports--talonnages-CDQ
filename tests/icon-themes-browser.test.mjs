import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import {fixture as oldFixture} from './helpers/phone-midpoint-fixture.mjs';
const read = p => fs.readFileSync(p,'utf8');
const manifest = JSON.parse(read('bundles/balance-cdq/v25.14/manifest.json'));
const setup = `<script>
window.utilisateurCourantEmail='alice@example.test';
window.rpcCalls=[];window.rpcPending=[];window.rpcHold=false;window.rpcFailure=false;
window.rpcData={};
window.cdqApiRun=()=>{
 let success=()=>{},failure=()=>{};const chain={withSuccessHandler:f=>{success=f;return chain},withFailureHandler:f=>{failure=f;return chain},
 obtenirStyleIconesCDQV2514:user=>{const reply={email:user,style:'current',revision:0,...rpcData[user]};rpcCalls.push(['get',user]);const call=()=>rpcFailure?failure():success(reply);if(rpcHold)rpcPending.push(call);else setTimeout(call,10)},
 enregistrerStyleIconesCDQV2514:(user,value)=>{rpcCalls.push(['set',user,value]);const call=()=>{if(rpcFailure){failure();return}if(!rpcData[user]||rpcData[user].revision<value.revision)rpcData[user]=value;success({email:user,...rpcData[user]})};if(rpcHold)rpcPending.push(call);else setTimeout(call,10)}};return chain;
};
window.openSettings=()=>{const modal=document.getElementById('cdqSettingsModalV2294');cdqOrganizeSettings(modal);modal.style.display='flex'};
window.setAccount=user=>{utilisateurCourantEmail=user;window.dispatchEvent(new Event('cdq:access-ready'))};
window.navClicks=[];document.querySelectorAll('.bottom-nav button').forEach(b=>b.onclick=()=>navClicks.push(b.querySelector('small').textContent));
</script>`;
const fixture = oldFixture.replace(read('bundles/balance-cdq/v25.12/mobile-layout.css'),read('bundles/balance-cdq/v25.13/mobile-layout.css'))
  .replace(read('bundles/balance-cdq/v25.12/mobile-layout.js'),read('bundles/balance-cdq/v25.13/mobile-layout.js'))
  .replace('</body>',setup+manifest.patches.at(-1).text+'</body>');
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fixture)});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
const styles=['minimal','dark-pro','metal-music','isometric'];
const output=process.env.CDQ_TEST_OUTPUT||'/tmp/cdq-icon-themes';fs.mkdirSync(output,{recursive:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 const origin='http://127.0.0.1:'+server.address().port;
 const choose=async style=>{await page.click('[data-icon-style="'+style+'"]');await page.waitForFunction(style=>document.querySelector('[data-icon-style="'+style+'"]').getAttribute('aria-pressed')==='true',{},style)};
 for(const width of [320,384,412]){
  await page.setViewport({width,height:832,isMobile:true,hasTouch:true,deviceScaleFactor:2});
  await page.setUserAgent('Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36 BalanceCDQAndroid/25.15');
  await page.goto(origin);await page.evaluate(()=>localStorage.clear());await page.reload();
  await page.waitForFunction(()=>rpcCalls.length>0);
  const originals=await page.$$eval('.bottom-nav > button > span',els=>els.map(e=>e.innerHTML));
  await page.evaluate(()=>openSettings());await page.click('[data-settings-tab="appearance"]');
  assert.equal(await page.$eval('[data-settings-tab="appearance"]',el=>el.textContent),'Thème');
  assert.equal(await page.$$eval('.cdq-icon-choice-v2514',els=>els.length),5);
  await page.waitForFunction(()=>document.querySelector('[data-icon-style="current"]').getAttribute('aria-pressed')==='true');
  await page.evaluate(async()=>{const url=getComputedStyle(document.documentElement).getPropertyValue('--cdq-icon-art-v2514').trim().slice(5,-2);const image=new Image();image.src=url;await image.decode();if(image.width!==1536||image.height!==1024)throw Error('Reference not loaded')});
  for(const style of styles){
   await choose(style);
   assert.equal(await page.$$eval('.cdq-icon-host-v2514',els=>els.length),6);
   const sizes=await page.$$eval('.cdq-icon-host-v2514',els=>els.map(el=>{const s=getComputedStyle(el,'::after');return [parseFloat(s.width),parseFloat(s.height),s.visibility]}));
   assert.ok(sizes.every(([w,h,v])=>w===18&&h===18&&v==='visible'),JSON.stringify(sizes));
   assert.deepEqual(await page.$$eval('.bottom-nav > button > span',els=>els.map(e=>e.innerHTML)),originals);
  }
  await page.$eval('.cdq-icon-picker-v2514',el=>el.scrollIntoView({block:'start'}));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:output+'/theme-'+width+'.png'});
  await page.click('#cdqSettingsCloseV2294');
  for(const style of styles){
   await page.evaluate(()=>openSettings());await page.click('[data-settings-tab="appearance"]');await choose(style);await page.click('#cdqSettingsCloseV2294');
   if(width===384)await page.screenshot({path:output+'/home-'+style+'.png'});
  }
  // The original dynamic folder action must remain understandable and clickable.
  await page.evaluate(()=>{document.getElementById('folderActionButton').querySelector('small').textContent='Dupliquer';document.getElementById('folderActionIcon').textContent='⧉'});
  await page.waitForFunction(()=>!document.getElementById('folderActionIcon').classList.contains('cdq-icon-host-v2514'));
  await page.click('#folderActionButton');assert.equal(await page.evaluate(()=>navClicks.at(-1)),'Dupliquer');
  await page.evaluate(()=>{document.getElementById('folderActionButton').querySelector('small').textContent='Dossier';document.getElementById('folderActionIcon').textContent='📁+'});
  await page.waitForFunction(()=>document.getElementById('folderActionIcon').classList.contains('cdq-icon-host-v2514'));
  await page.evaluate(()=>{localStorage.setItem('cdqUiIconScaleV89','100');cdqMobileLayout.apply()});
  assert.equal(await page.$eval('.cdq-icon-host-v2514',el=>parseFloat(getComputedStyle(el,'::after').height)),24);
  await page.evaluate(()=>{localStorage.setItem('cdqUiIconScaleV89','50');cdqMobileLayout.apply()});
  await page.evaluate(()=>openSettings());await page.click('[data-settings-tab="appearance"]');await choose('current');
  assert.equal(await page.$$eval('.cdq-icon-host-v2514',els=>els.length),0);
  assert.deepEqual(await page.$$eval('.bottom-nav > button > span',els=>els.map(e=>e.innerHTML)),originals);
  console.log('PASS '+width+'px: exact artwork, five choices, compact size, sliders, dynamic folder action and original restoration');
 }
 // Offline choice survives reload and is isolated by signed-in user.
 await page.evaluate(()=>{rpcFailure=true});await choose('metal-music');
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('cdqIconThemeV2514:alice@example.test')).pending);
 await page.reload();await page.waitForFunction(()=>document.querySelectorAll('.cdq-icon-host-v2514').length===6);
 await page.waitForFunction(()=>rpcCalls.some(c=>c[0]==='set'&&c[1]==='alice@example.test'));
 await page.waitForFunction(()=>!JSON.parse(localStorage.getItem('cdqIconThemeV2514:alice@example.test')).pending);
 await page.evaluate(()=>setAccount('bob@example.test'));await page.waitForFunction(()=>document.querySelectorAll('.cdq-icon-host-v2514').length===0);
 await page.evaluate(()=>openSettings());await page.click('[data-settings-tab="appearance"]');await choose('dark-pro');
 await page.waitForFunction(()=>rpcData['bob@example.test']?.style==='dark-pro');
 await page.evaluate(()=>setAccount('alice@example.test'));await page.waitForFunction(()=>document.querySelector('[data-icon-style="metal-music"]').getAttribute('aria-pressed')==='true');
 // An old in-flight reply cannot repaint a different account or overwrite a newer local edit.
 await page.evaluate(()=>{rpcHold=true;cdqIconThemesV2514.synchronize()});await choose('minimal');
 await page.evaluate(()=>{rpcPending.splice(0).forEach(fn=>fn())});
 assert.equal(await page.$eval('[data-icon-style="minimal"]',el=>el.getAttribute('aria-pressed')),'true');
 await page.evaluate(()=>{setAccount('bob@example.test');rpcPending.splice(0).forEach(fn=>fn());rpcHold=false});
 assert.equal(await page.$eval('[data-icon-style="dark-pro"]',el=>el.getAttribute('aria-pressed')),'true');
 await page.evaluate(()=>setAccount(''));assert.equal(await page.$$eval('.cdq-icon-host-v2514',els=>els.length),0);
 assert.ok(await page.$$eval('.cdq-icon-choice-v2514',els=>els.every(el=>el.disabled)));
 assert.deepEqual(errors,[]);
 console.log('PASS personal/offline persistence, synchronization, account switch, stale responses and signed-out state');
}finally{await browser.close();server.close()}
