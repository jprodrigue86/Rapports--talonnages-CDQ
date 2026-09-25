import fs from 'node:fs';
import assert from 'node:assert/strict';
import http from 'node:http';
import puppeteer from 'puppeteer-core';

const runtime=fs.readFileSync('full-names-v2536.js','utf8');
const longCompany='Compagnie Industrielle Internationale de Vérification et Étalonnage du Québec Inc.';
const longFile='Rapport étalonnage balance de plancher secteur production ligne emballage numéro 14 septembre 2026.pdf';

const fixture=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box}body{margin:0;padding:8px;font:16px Arial}
.company-wrapper{display:flex;gap:4px;width:100%;overflow:hidden}.company-button{flex:1 1 0;height:36px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.company-reset-button{width:34px;height:36px}
#companyList{width:100%;overflow:hidden}.company-item{display:flex;align-items:center;height:44px;overflow:hidden;border:1px solid #999}.cdq-company-name{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cdq-company-star{width:40px;flex:0 0 40px}
.file-row,.folder-header{display:flex;gap:6px;min-height:44px;height:44px;overflow:hidden;border:1px solid #999}.file-info{flex:1;min-width:0;overflow:hidden}.file-name,.file-name-text,.folder-name,.folder-name-text{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:1;max-height:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#clientInfoBar{display:flex;gap:8px;height:34px;overflow:hidden;border:1px solid #999}.client-info-name-wrap{display:flex;flex:1;min-width:0;overflow:hidden}.client-info-name{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.client-stats{flex:0 0 72px}
</style><script>${runtime}</script></head><body>
<div class="company-wrapper"><button class="company-button">${longCompany}</button><button class="company-reset-button">↻</button></div>
<div id="companyList"><div class="company-item"><span class="cdq-company-name">${longCompany}</span><button class="cdq-company-star">★</button></div></div>
<div class="file-row"><span>▤</span><div class="file-info"><div class="file-name"><span class="file-name-text">${longFile}</span></div></div></div>
<div class="folder-header"><span>📁</span><div class="folder-name">${longCompany}</div></div>
<div id="clientInfoBar"><div class="client-info-name-wrap"><span class="client-info-name">${longCompany}</span></div><span class="client-stats">12 fichiers</span></div>
<div id="dynamic"></div>
</body></html>`;

const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fixture);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});

function inspect(){
 const rect=s=>{const e=document.querySelector(s),r=e.getBoundingClientRect(),c=getComputedStyle(e);return {height:r.height,width:r.width,whiteSpace:c.whiteSpace,overflow:c.overflow,textOverflow:c.textOverflow,maxHeight:c.maxHeight,lineClamp:c.webkitLineClamp,text:e.textContent.trim()};};
 return {
   company:rect('.company-button'),
   companyItem:rect('.company-item'),
   companyName:rect('.cdq-company-name'),
   fileRow:rect('.file-row'),
   fileName:rect('.file-name-text'),
   folder:rect('.folder-header'),
   client:rect('#clientInfoBar'),
   clientName:rect('.client-info-name'),
   pageWidth:document.documentElement.scrollWidth,
   viewport:innerWidth
 };
}

try{
 const page=await browser.newPage();
 for(const width of [280,320,384,412]){
   await page.setViewport({width,height:760,isMobile:true});
   await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'load'});
   await page.waitForFunction(()=>typeof window.cdqFitFullNamesV2536==='function');
   await page.evaluate(()=>window.cdqFitFullNamesV2536());
   const a=await page.evaluate(inspect);
   for(const key of ['company','companyItem','fileRow','folder','client']) assert.ok(a[key].height>34,key+' grows at '+width);
   for(const key of ['company','companyName','fileName','clientName']){
     assert.equal(a[key].whiteSpace,'normal',key+' wraps at '+width);
     assert.equal(a[key].textOverflow,'clip',key+' does not ellipsize at '+width);
     assert.equal(a[key].overflow,'visible',key+' is visible at '+width);
   }
   assert.equal(a.company.text,longCompany);
   assert.equal(a.companyName.text,longCompany);
   assert.equal(a.fileName.text,longFile);
   assert.equal(a.clientName.text,longCompany);
   assert.ok(a.pageWidth<=a.viewport+1,'no horizontal page overflow at '+width);
 }
 await page.evaluate(name=>{
   const host=document.getElementById('dynamic');
   host.innerHTML='<div class="file-row"><div class="file-info"><div class="file-name-text">'+name+'</div></div></div>';
 },longFile);
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('#dynamic .file-name-text')).textOverflow==='clip');
 const dynamic=await page.$eval('#dynamic .file-row',e=>({height:e.getBoundingClientRect().height,text:e.textContent.trim()}));
 assert.ok(dynamic.height>34);
 assert.equal(dynamic.text,longFile);
 console.log('PASS: complete company/file/folder names wrap and rectangles grow without ellipsis.');
}finally{await browser.close();server.close();}
