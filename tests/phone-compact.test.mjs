import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import {fixture as previousFixture} from './helpers/phone-midpoint-fixture.mjs';
const read=p=>fs.readFileSync(p,'utf8');
const legacy=read('tests/fixtures/legacy-phone-swipes.js');
const oldJs=read('bundles/balance-cdq/v25.12/mobile-layout.js');
const oldCss=read('bundles/balance-cdq/v25.12/mobile-layout.css');
const newJs=read('bundles/balance-cdq/v25.13/mobile-layout.js');
const newCss=read('bundles/balance-cdq/v25.13/mobile-layout.css');
const setup=`<style>
.file-row,.folder-header{position:relative!important;overflow:hidden!important}
.cdq-swipe-overlay{position:absolute;inset:0;z-index:20;display:none;align-items:center;background:#0b2335;gap:10px!important;padding:8px 12px!important}
.cdq-swiped-left .cdq-swipe-overlay.left{display:flex!important;justify-content:flex-end!important}
.cdq-swiped-right .cdq-swipe-overlay.right{display:flex!important;justify-content:flex-start!important}
.cdq-swipe-action{min-width:72px!important;height:62px!important;padding:0 14px!important;border:1px solid #41617a;border-radius:14px!important;background:#10283d;color:#fff;font-size:22px!important;font-weight:900!important}
.cdq-swipe-action.note,.cdq-swipe-action.photo{min-width:104px!important;font-size:19px!important}
.cdq-swipe-action.rename,.cdq-swipe-action.delete{min-width:68px!important;font-size:29px!important}
.cdq-swipe-action.favorite,.cdq-swipe-action.send{min-width:112px!important;height:64px!important;font-size:20px!important}
.cdq-swipe-action.favorite{color:#ffd23f}.cdq-swipe-action.send{background:#0a6ed1}.cdq-swipe-action.delete{background:#762c35}
</style><script>
let modeSelectionFichiers=false;const dossiersSelectionnes=new Set();
function obtenirSeuilGlissement(){return 40}function obtenirRatioGlissement(){return 1.2}
function obtenirDureeAppuiLongSelection(){return 1000}function mettreAJourInterface(){}
${legacy}
window.actions=[];window.fileOpens=0;
document.querySelectorAll('.file-row,.folder-header').forEach((row,index)=>{
 const folder=row.matches('.folder-header');row.id='test-row-'+index;
 const left=document.createElement('div');left.className='cdq-swipe-overlay left';
 const right=document.createElement('div');right.className='cdq-swipe-overlay right';
 for(const [cls,title] of [['note','🗒 Note'],['photo','📷 Photo'],['rename','✏️'],['delete','🗑']])left.append(cdqSwipeButton(title,cls,()=>actions.push(cls)));
 for(const [cls,title] of [['favorite','★ Favori'],[folder?'protect':'send',folder?'🔒 Déprotéger':'Envoyer']])right.append(cdqSwipeButton(title,cls,()=>actions.push(cls)));
 row.append(left,right);
 if(folder)cdqInstallFolderInteractions(row,{id:'folder-'+index});else cdqInstallSwipeGesture(row);
 row.addEventListener('click',e=>{if(!e.target.closest('button'))fileOpens++});
});
</script>`;
const base=previousFixture.replace(`<script>${oldJs}</script>`,setup+`<script>${oldJs}</script>`);
const fixture=base.replace(oldJs,newJs).replace(oldCss,newCss);
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/before'?base:fixture)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
const results=[];
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const measure=()=>page.evaluate(()=>{
  const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}};
  return {header:box('.app-header'),first:box('.file-row'),nav:box('.bottom-nav'),font:parseFloat(getComputedStyle(document.querySelector('.file-name')).fontSize),icon:box('.bottom-nav-item>span').height,overflow:document.documentElement.scrollWidth>innerWidth};
 });
 for(const width of [320,384,412]){
  await page.setViewport({width,height:832,isMobile:true,hasTouch:true,deviceScaleFactor:2});
  await page.setUserAgent('Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36 BalanceCDQAndroid/25.15');
  await page.goto(origin+'/before');
  await page.evaluate(()=>{for(const n of ['General','Text','Icon'])localStorage.setItem('cdqUi'+n+'ScaleV89','50');cdqMobileLayout.apply()});
  const before=await measure();
  await page.goto(origin);const after=await measure();
  assert.ok(after.first.y<before.first.y-30,JSON.stringify({before,after}));
  assert.ok(after.icon<=before.icon*.8&&after.nav.height<before.nav.height);
  assert.ok(after.font>before.font&&after.font<before.font*1.15);assert.equal(after.overflow,false);
  const clipped=await page.evaluate(()=>{
   const bad=[];
   for(const el of document.querySelectorAll('.quick-name,.cdq-top-action>span:last-child,.bottom-nav-item small,.file-name')){
    const p=el.closest('button,.file-row').getBoundingClientRect(),r=document.createRange();r.selectNodeContents(el);
    for(const b of r.getClientRects())if(b.left<p.left-1||b.right>p.right+1||b.top<p.top-1||b.bottom>p.bottom+1)bad.push({text:el.textContent,rect:b.toJSON(),parent:p.toJSON()});
   }return bad;
  });assert.deepEqual(clipped,[]);
  await page.screenshot({path:`/tmp/cdq-compact-home-${width}.png`});
  // Real touch events exercise browser pan-y handling, not only synthetic handlers.
  const cdp=await page.createCDPSession();
  async function drag(selector,dx,dy=0){
   await page.$eval(selector,el=>el.scrollIntoView({block:'center'}));
   const b=await page.$eval(selector,el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}});
   const x=dx>0?b.x+Math.min(b.w*.3,25):b.x+b.w-Math.min(b.w*.3,25),y=b.y+b.h/2;
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
   for(let n=1;n<=6;n++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*n/6,y:y+dy*n/6}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }
  const state=selector=>page.$eval(selector,e=>({left:e.classList.contains('cdq-swiped-left'),right:e.classList.contains('cdq-swiped-right')}));
  for(const row of ['#test-row-0','#test-row-7']){
   await drag(row,-85);assert.deepEqual(await state(row),{left:true,right:false});
   const sizes=await page.$$eval(row+' .left button',els=>els.map(e=>{const r=e.getBoundingClientRect(),p=e.parentElement.getBoundingClientRect();return {w:r.width,h:r.height,font:parseFloat(getComputedStyle(e).fontSize),fits:r.left>=p.left&&r.right<=p.right&&r.top>=p.top&&r.bottom<=p.bottom}}));
   assert.ok(sizes.every(s=>s.h>=44&&s.h<=46&&s.font<=16&&s.fits),JSON.stringify(sizes));
   if(row==='#test-row-0')await page.screenshot({path:`/tmp/cdq-compact-actions-${width}.png`});
   await drag(row+' .photo',85);assert.deepEqual(await state(row),{left:false,right:false});
   await drag(row,85);assert.deepEqual(await state(row),{left:false,right:true});
   await drag(row+' .right button:last-child',-85);assert.deepEqual(await state(row),{left:false,right:false});
   await drag(row,-85);await drag(row+' .delete',-55);assert.deepEqual(await state(row),{left:true,right:false});
   // Let the legacy opening suppression expire before a deliberate action click.
   await new Promise(r=>setTimeout(r,650));
   assert.deepEqual(await page.evaluate(()=>actions),[],'swipes must never run actions');
   await page.click(row+' .photo');
   assert.deepEqual(await page.evaluate(()=>actions),['photo']);
   await page.evaluate(()=>actions.length=0);
   await drag(row+' .note',85);
  }
  assert.equal(await page.evaluate(()=>fileOpens),0,'swipes do not open documents');
  // Cancelled vertical gestures retain the bar, then an inverse drag still works.
  await drag('#test-row-0',-85);
  await page.evaluate(()=>{
   const b=document.querySelector('#test-row-0 .photo');
   b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:88,pointerType:'touch',clientX:100,clientY:100}));
   b.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:88}));
  });
  assert.deepEqual(await state('#test-row-0'),{left:true,right:false});
  await drag('#test-row-0 .note',85);assert.deepEqual(await state('#test-row-0'),{left:false,right:false});
  await page.evaluate(()=>{modeSelectionFichiers=true});await drag('#test-row-0',85);
  assert.deepEqual(await state('#test-row-0'),{left:false,right:false});
  await page.evaluate(()=>{modeSelectionFichiers=false});
  // The icon/text controls continue changing dimensions independently.
  const scales=await page.evaluate(()=>{
   const values=[];for(const value of [0,100]){
    for(const n of ['Icon','Text'])localStorage.setItem('cdqUi'+n+'ScaleV89',value);
    cdqMobileLayout.apply();values.push({font:parseFloat(getComputedStyle(document.querySelector('.file-name')).fontSize),icon:document.querySelector('.bottom-nav-item>span').getBoundingClientRect().height,action:parseFloat(getComputedStyle(document.querySelector('.cdq-swipe-action')).fontSize)});
   }for(const n of ['Icon','Text'])localStorage.setItem('cdqUi'+n+'ScaleV89','50');cdqMobileLayout.apply();return values;
  });assert.ok(scales[1].font>scales[0].font&&scales[1].icon>scales[0].icon&&scales[1].action>scales[0].action);
  await page.evaluate(()=>{const m=document.getElementById('cdqSettingsModalV2294');cdqOrganizeSettings(m);m.style.display='flex'});
  await page.click('.cdq-phone-preset');await page.click('#cdqSettingsCloseV2294');
  assert.equal(await page.$eval('#cdqSettingsModalV2294',e=>getComputedStyle(e).display),'none');
  results.push({width,before,after,scales});console.log(`PASS ${width}px: compact header/footer, larger names, touch swipes on files/folders, button clicks, cancel, selection, sliders, settings`);
  await cdp.detach();
 }
 assert.deepEqual(errors,[]);
 fs.writeFileSync('/tmp/cdq-compact-results.json',JSON.stringify(results,null,2));
}finally{await browser.close();server.close()}
