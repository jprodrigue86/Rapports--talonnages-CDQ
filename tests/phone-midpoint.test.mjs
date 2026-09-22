import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import {fixture} from './helpers/phone-midpoint-fixture.mjs';
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fixture)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
const results=[];
try {
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const [width,height,native] of [[320,694,true],[360,780,true],[384,832,true],[412,892,true],[820,380,true],[384,520,true],[384,832,false]]){
  await page.setViewport({width,height,isMobile:true,deviceScaleFactor:2});
  await page.setUserAgent('Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36'+(native?' BalanceCDQAndroid/25.15':''));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.evaluate(()=>{for(const n of ['General','Text','Icon'])localStorage.setItem('cdqUi'+n+'ScaleV89','50');cdqMobileLayout.apply()});
  const audit=await page.evaluate(()=>{
   const r=el=>{const b=el.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height}};
   const labels=Array.from(document.querySelectorAll('.quick-name,.cdq-top-action>span:last-child,.bottom-nav-item small,.file-name,.folder-name'));
   const clipped=[];
   for(const el of labels){
    const b=r(el),p=r(el.closest('button,.file-row,.folder-header'));
    const range=document.createRange();range.selectNodeContents(el);
    for(const rect of range.getClientRects())if(rect.width>0&&rect.height>0&&(rect.left<p.left-1||rect.right>p.right+1||rect.top<p.top-1||rect.bottom>p.bottom+1))clipped.push(el.textContent);
    if(el.scrollWidth>el.clientWidth+1)clipped.push(el.textContent+' scrollWidth');
   }
   const icon=document.getElementById('folderActionIcon');const range=document.createRange();range.selectNodeContents(icon);
   const box=r(icon.closest('button')),glyph=r(icon),text=range.getBoundingClientRect();
   if(text.height>glyph.height+4||text.bottom>box.bottom+1)clipped.push('folder plus wraps');
   return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,clipped,nav:r(document.querySelector('.bottom-nav')),first:r(document.querySelector('.app-header')),dims:cdqMobileDimensions};
  });
  assert.equal(audit.overflow,false,JSON.stringify(audit));assert.deepEqual(audit.clipped,[],JSON.stringify(audit));
  assert.ok(audit.dims.navHeight<60,'baseline footer stays compact');
  if(native)assert.ok(audit.first.top>=24&&audit.nav.height>=audit.dims.navHeight+24,'system bars have reserved space');
  if(native&&height>600)await page.screenshot({path:`/tmp/cdq-phone-home-${width}.png`});
  const measure=async(g,t,i)=>page.evaluate(([g,t,i])=>{for(const [n,v]of [['General',g],['Text',t],['Icon',i]])localStorage.setItem('cdqUi'+n+'ScaleV89',v);cdqMobileLayout.apply();return {row:document.querySelector('.file-row').getBoundingClientRect().height,font:parseFloat(getComputedStyle(document.querySelector('.file-name')).fontSize),icon:document.querySelector('.file-icon').getBoundingClientRect().height,nav:document.querySelector('.bottom-nav').getBoundingClientRect().height}},[g,t,i]);
  const compact=await measure(0,50,50),spacious=await measure(100,50,50);assert.ok(spacious.row>compact.row);assert.equal(spacious.icon,compact.icon);
  const small=await measure(50,0,0),large=await measure(50,100,100);assert.ok(large.font>small.font&&large.icon>small.icon&&large.nav>small.nav);
  await page.evaluate(()=>{const m=document.getElementById('cdqSettingsModalV2294');cdqOrganizeSettings(m);m.style.display='flex'});
  await page.click('.cdq-phone-preset');
  assert.deepEqual(await page.evaluate(()=>['General','Text','Icon'].map(n=>localStorage.getItem('cdqUi'+n+'ScaleV89'))),['50','50','50']);
  const modal=await page.evaluate(()=>{
   const close=document.getElementById('cdqSettingsCloseV2294'),m=close.closest('.modal'),r=m.getBoundingClientRect(),b=close.getBoundingClientRect(),panel=document.getElementById('cdq-settings-panel-sizes');
   const top=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);
   panel.scrollTop=panel.scrollHeight;
   return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,closeBottom:b.bottom,clickable:top===close||close.contains(top),scrollable:panel.scrollTop>0||panel.scrollHeight<=panel.clientHeight+1};
  });
  assert.ok(modal.left>=0&&modal.right<=width&&modal.top>=(native?24:0)&&modal.bottom<=height-(native?24:0),JSON.stringify(modal));
  assert.ok(modal.clickable&&modal.scrollable,'close stays above navigation; settings panel scrolls');
  await page.evaluate(()=>document.getElementById('cdq-settings-panel-sizes').scrollTop=0);
  if(native&&height>600)await page.screenshot({path:`/tmp/cdq-phone-settings-${width}.png`});
  await page.click('#cdqSettingsCloseV2294');
  assert.equal(await page.$eval('#cdqSettingsModalV2294',el=>getComputedStyle(el).display),'none');
  results.push({width,height,native,...audit,modal});console.log(`PASS phone ${width}x${height} native=${native}: labels, folder glyph, safe areas, midpoint, sliders, close and scroll`);
 }
 assert.deepEqual(errors,[],'no browser errors');
 fs.writeFileSync('/tmp/cdq-phone-results.json',JSON.stringify(results,null,2));
}finally{await browser.close();server.close()}
