import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import {fixture as baseFixture} from './helpers/phone-midpoint-fixture.mjs';
const read=p=>fs.readFileSync(p,'utf8');
const manifest=JSON.parse(read('bundles/balance-cdq/v25.15/manifest.json'));
const setup=`<script>
window.utilisateurCourantEmail='alice@example.test';
window.rpcData={};window.calls=[];
window.cdqApiRun=()=>{let ok=()=>{};const chain={withSuccessHandler:f=>{ok=f;return chain},withFailureHandler:()=>chain,
obtenirStyleIconesCDQV2514:email=>setTimeout(()=>ok({email,style:'current',revision:0,...rpcData[email]}),5),
enregistrerStyleIconesCDQV2514:(email,value)=>{rpcData[email]=value;setTimeout(()=>ok({email,...value}),5)}};return chain};
window.openSettings=()=>{const modal=document.getElementById('cdqSettingsModalV2294');cdqOrganizeSettings(modal);modal.style.display='flex'};
window.legacyGlow=()=>document.querySelectorAll('.bottom-nav-item').forEach(button=>{button.style.setProperty('filter','brightness(1.2) saturate(1.15)','important');button.querySelector('span').style.setProperty('filter','drop-shadow(0 0 5px '+getComputedStyle(button).color+')','important')});
document.querySelectorAll('.bottom-nav-item').forEach(button=>button.onclick=()=>calls.push(button.querySelector('small').textContent));
legacyGlow();
</script>`;
let fixture=baseFixture.replace(`<style>${read('bundles/balance-cdq/v25.12/mobile-layout.css')}</style>`,'')
 .replace(`<script>${read('bundles/balance-cdq/v25.12/mobile-layout.js')}</script>`,'')
 .replace('</body>',setup+manifest.patches.at(-1).text+'</body>');
fixture=fixture.replace('>Bal 7<','>Balance de plancher.pdf<');
if(process.env.CDQ_PREVIEW_BANNER){
 const src='data:image/webp;base64,'+fs.readFileSync(process.env.CDQ_PREVIEW_BANNER).toString('base64');
 fixture=fixture.replace('>BALANCE CDQ</header>',`><img class="header-metal-banner" src="${src}" alt="Balance CDQ"></header>`);
}
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(fixture)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
const output=process.env.CDQ_TEST_OUTPUT||'/tmp/cdq-photo-baseline';fs.mkdirSync(output,{recursive:true});
const results=[];
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const styles=['minimal','dark-pro','metal-music','isometric'];
 const choose=async style=>{
  await page.evaluate(()=>openSettings());await page.click('[data-settings-tab="appearance"]');await page.click('[data-icon-style="'+style+'"]');
  await page.waitForFunction(style=>document.querySelector('[data-icon-style="'+style+'"]').getAttribute('aria-pressed')==='true',{},style);
  await page.click('#cdqSettingsCloseV2294');
 };
 for(const width of [320,384,412]){
  await page.setViewport({width,height:width*1536/709|0,isMobile:true,hasTouch:true,deviceScaleFactor:2});
  await page.setUserAgent('Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36 BalanceCDQAndroid/25.15');
  await page.goto('http://127.0.0.1:'+server.address().port);await page.evaluate(()=>localStorage.clear());await page.reload();
  await page.waitForFunction(()=>window.cdqMobileDimensions);
  const measures=await page.evaluate(()=>{
   const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}};
   return {width:innerWidth,header:box('.app-header'),company:box('.company-button'),quick:box('.quick-button'),actions:box('#cdqTopActionsV2204'),client:box('#clientInfoBar'),row:box('.file-row'),nav:box('.bottom-nav'),font:parseFloat(getComputedStyle(document.querySelector('.file-name')).fontSize),icon:box('.bottom-nav-item>span').h};
  });
  const u=width/384;
  assert.ok(Math.abs(measures.header.h/u-55)<.2);
  assert.ok(Math.abs(measures.company.h/u-35)<.2);
  assert.ok(Math.abs(measures.font/u-18.5)<.2);
  assert.ok(Math.abs(measures.icon/u-22)<.2);
  assert.ok(Math.abs(measures.row.h/u-54)<1);
  assert.ok(Math.abs(measures.row.y/u-291)<3,JSON.stringify(measures));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  for(const style of styles){
   await choose(style);await page.evaluate(()=>legacyGlow());
   await page.waitForFunction(()=>[...document.querySelectorAll('.cdq-icon-host-v2514')].every(el=>getComputedStyle(el).filter==='none'&&getComputedStyle(el.parentElement).filter==='none'));
   assert.equal(await page.$$eval('.cdq-icon-host-v2514',els=>els.length),6);
   // The real asset must expose alpha at every crop corner, including on a light theme.
   const alpha=await page.$$eval('.cdq-icon-host-v2514',async els=>Promise.all(els.map(async el=>{
    const style=getComputedStyle(el,'::after'),url=style.backgroundImage.slice(5,-2),img=new Image();img.src=url;try{await img.decode()}catch(e){throw Error('Artwork decode: '+JSON.stringify({background:style.backgroundImage.slice(0,100),length:style.backgroundImage.length,root:getComputedStyle(document.documentElement).getPropertyValue('--cdq-icon-transparent-v2515').length,host:el.style.getPropertyValue('--cdq-icon-art-v2514')}))};
    const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);
    const size=el.style.getPropertyValue('--cdq-art-size').split(' ').map(parseFloat),pos=el.style.getPropertyValue('--cdq-art-position').split(' ').map(parseFloat);
    const crop=img.width/(size[0]/100),x=(img.width-crop)*pos[0]/100,y=(img.height-crop)*pos[1]/100;
    return [[x,y],[x+crop-1,y],[x,y+crop-1],[x+crop-1,y+crop-1]].map(([a,b])=>ctx.getImageData(Math.round(a),Math.round(b),1,1).data[3]);
   })));
   assert.ok(alpha.flat().every(a=>a<=6),JSON.stringify({style,alpha}));
   if(width===384){
    await page.screenshot({path:output+'/phone-'+style+'.png'});
    await page.$eval('.bottom-nav',el=>el.style.setProperty('background','#66717c','important'));
    await page.screenshot({path:output+'/light-background-'+style+'.png'});
    await page.$eval('.bottom-nav',el=>el.style.removeProperty('background'));
   }
  }
  await page.evaluate(()=>{document.querySelector('#folderActionButton small').textContent='Dupliquer';document.getElementById('folderActionIcon').textContent='⧉'});
  await page.waitForFunction(()=>!document.getElementById('folderActionIcon').classList.contains('cdq-icon-host-v2514'));
  await page.click('#folderActionButton');assert.equal(await page.evaluate(()=>calls.at(-1)),'Dupliquer');
  // Independent controls grow from the reference and saved values are not reset.
  const scales=await page.evaluate(()=>{
   const result=[];
   for(const n of ['General','Text','Icon']){
    const values=[];for(const v of [0,50,100]){localStorage.setItem('cdqUi'+n+'ScaleV89',v);cdqMobileLayout.apply();values.push({...cdqMobileDimensions});}
    result.push({n,values});localStorage.setItem('cdqUi'+n+'ScaleV89','50');cdqMobileLayout.apply();
   }return result;
  });
  for(const {n,values} of scales){const key=n==='Icon'?'bottom':'text';assert.ok(values[0][key]<values[1][key]&&values[1][key]<values[2][key]);}
  await choose('current');assert.equal(await page.$$eval('.cdq-icon-host-v2514',els=>els.length),0);
  const legacy=await page.$eval('.bottom-nav-item>span',el=>getComputedStyle(el).filter);assert.match(legacy,/drop-shadow/);
  // A full reset is a user action only and still closes the settings correctly.
  await page.evaluate(()=>openSettings());await page.click('.cdq-phone-preset');
  const saved=await page.evaluate(()=>['General','Text','Icon'].map(n=>localStorage.getItem('cdqUi'+n+'ScaleV89')));assert.deepEqual(saved,['50','50','50']);
  await page.click('#cdqSettingsCloseV2294');
  results.push(measures);console.log('PASS '+width+'px: photo proportions, alpha artwork, inherited glow, dynamic action, sliders and reset');
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(output+'/measurements.json',JSON.stringify(results,null,2));
}finally{await browser.close();server.close();}
