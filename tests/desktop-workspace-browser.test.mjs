import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import {fixture} from './helpers/desktop-workspace-fixture.mjs';
const html=fixture(),output=process.env.CDQ_TEST_OUTPUT||'/tmp/cdq-desktop';fs.mkdirSync(output,{recursive:true});
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.error(m.text())}});
 await page.setRequestInterception(true);page.on('request',r=>{const url=r.url();if(url.startsWith('http://127.0.0.1:')||url.startsWith('data:'))return r.continue();const path=new URL(url).pathname.replace('/Rapports--talonnages-CDQ/','');if(fs.existsSync(path)&&fs.statSync(path).isFile())return r.respond({status:200,contentType:path.endsWith('.webp')?'image/webp':'application/octet-stream',body:fs.readFileSync(path)});return r.respond({status:200,body:''})});
 await page.setViewport({width:1366,height:900,deviceScaleFactor:1});await page.goto('http://127.0.0.1:'+server.address().port);
 await new Promise(r=>setTimeout(r,650));assert.equal(await page.$('#cdqPcV16'),null,'Authentication gate');
 await page.screenshot({path:output+'/01-connexion.png'});await page.click('#demoLogin');await page.waitForSelector('.pc17-files tbody tr');
 await page.waitForFunction(()=>document.querySelectorAll('.pc16-kpi').length===4);
 const measurements=[];
 for(const [width,height] of [[1366,768],[1920,1080],[1024,768],[1280,720]]){
  await page.setViewport({width,height});await new Promise(r=>setTimeout(r,200));
  measurements.push(await page.evaluate(()=>{const r=document.querySelector('#cdqPcV16').getBoundingClientRect(),s=document.querySelector('.pc16-stage').getBoundingClientRect(),row=document.querySelector('.pc17-files tbody tr'),font=getComputedStyle(row.querySelector('b')).fontSize;return {w:innerWidth,h:innerHeight,x:r.x,y:r.y,rw:r.width,rh:r.height,sw:s.width,sh:s.height,font,overflow:document.documentElement.scrollWidth>innerWidth,scroll:document.querySelector('.pc17-scroll').clientHeight}}));
 }
 for(const m of measurements){assert.equal(m.x,0);assert.equal(m.y,0);assert.equal(m.rw,m.w);assert.equal(m.rh,m.h);assert.equal(m.sw,m.w);assert.equal(m.sh,m.h);assert.equal(m.overflow,false);assert.ok(parseFloat(m.font)>=14,JSON.stringify(m));assert.ok(m.scroll>180,JSON.stringify(m))}
 await page.setViewport({width:1440,height:960});await page.screenshot({path:output+'/02-accueil.png'});
 await page.click('[data-view="clients"]');await page.waitForSelector('[data-client="c279"]');
 assert.equal(await page.$$eval('[data-client]',els=>els.length),280);
 assert.equal(await page.$eval('#pc16Kpis',e=>getComputedStyle(e).display),'none');
 assert.equal(await page.$('.pc16-pager'),null);
 await page.$eval('[data-client="c279"]',e=>e.scrollIntoView({block:'end'}));
 assert.equal(await page.$eval('[data-client="c279"]',e=>e.getBoundingClientRect().bottom<=innerHeight),true);
 await page.type('#pc17ClientSearch','Anhydra',{delay:140});await page.waitForFunction(()=>document.querySelectorAll('[data-client]').length===1);
 assert.equal(await page.evaluate(()=>document.activeElement.id),'pc17ClientSearch');
 await page.$eval('#pc17ClientSearch',e=>{e.value='';e.dispatchEvent(new Event('input'))});await page.waitForFunction(()=>document.querySelectorAll('[data-client]').length===280);
 await page.$eval('.pc17-scroll',e=>e.scrollTop=0);await page.screenshot({path:output+'/03-clients.png'});
 await page.click('[data-client="c0"] .pc17-open-client');await page.waitForSelector('[data-file="f95"]');
 assert.equal(await page.$$eval('[data-file]',els=>els.length),97);
 await page.click('[data-file="f0"] b',{clickCount:2});assert.equal(await page.evaluate(()=>opened.at(-1)),'f0','Double-click file');
 await page.click('[data-file="archive"] b',{clickCount:2});await page.waitForFunction(()=>document.querySelectorAll('[data-file]').length===26);
 await page.click('[data-crumb="0"]');await page.waitForSelector('[data-file="archive"]');
 await page.click('[data-file="f0"] [data-more]');await page.waitForSelector('.pc17-menu');
 page.once('dialog',d=>d.accept('Balance renommée.pdf'));await page.click('.pc17-menu button');
 await page.waitForFunction(()=>document.querySelector('[data-file="f0"] b')?.textContent==='Balance renommée.pdf');
 assert.equal(await page.evaluate(()=>calls.filter(c=>c.name==='renommerFichier').length),1);
 await page.click('[data-file="f1"] b');await page.click('#pc17Duplicate');
 await page.waitForSelector('[data-file="copy-f1"]');assert.equal(await page.evaluate(()=>calls.filter(c=>c.name==='dupliquerFichier').length),1);
 await page.click('#pc17Multi');await page.click('[data-file="f0"] b');await page.click('[data-file="f1"] b');
 assert.equal(await page.$$eval('.pc17-files tr.selected',els=>els.length),2);await page.click('[data-file="f0"] b');assert.equal(await page.$$eval('.pc17-files tr.selected',els=>els.length),1);
 await page.click('#pc17Multi');assert.equal(await page.$$eval('.pc17-files tr.selected',els=>els.length),0);
 await page.screenshot({path:output+'/04-rapports.png'});
 await page.click('[data-view="settings"]');await page.waitForSelector('[data-icon-style="metal-music"]');
 await page.click('[data-pc-theme="violet"]');assert.equal(await page.$eval('#cdqPcV16',e=>e.dataset.theme),'violet');
 await page.click('[data-pc-theme="metal"]');await page.click('[data-icon-style="metal-music"]');
 await page.waitForFunction(()=>document.querySelector('.pc16-nav .pc17-art'));
 assert.equal(await page.$eval('.pc16-nav .pc17-art',e=>getComputedStyle(e).filter),'none');
 await page.$eval('[data-pc-range="text"]',e=>{e.value=80;e.dispatchEvent(new Event('input'))});
 await page.click('[data-view="home"]');assert.ok(await page.$eval('.pc17-table',e=>parseFloat(getComputedStyle(e).fontSize)>16));
 await page.click('[data-view="settings"]');assert.equal(await page.$eval('[data-pc-range="text"]',e=>e.value),'80');
 await page.$eval('[data-pc-range="text"]',e=>{e.value=50;e.dispatchEvent(new Event('input'))});
 await page.$eval('.pc17-scroll',e=>e.scrollTop=0);await page.screenshot({path:output+'/05-reglages.png'});
 // The actual PC wrapper must not rescale or crop the application iframe.
 const wrapper=await browser.newPage();const shell=fs.readFileSync('pc/index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
 await wrapper.setRequestInterception(true);wrapper.on('request',r=>r.respond({status:200,body:''}));await wrapper.setViewport({width:1366,height:768});await wrapper.setContent(shell);
 const host=await wrapper.$eval('#app',e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,transform:getComputedStyle(e).transform}});
 assert.deepEqual(host,{x:0,y:0,w:1366,h:768,transform:'none'});await wrapper.close();
 assert.deepEqual(errors,[]);
 const result={mode:process.env.CDQ_SELECTOR_SOURCE?'Real Selector PC integration':'Standalone desktop components',measurements,clients:280,files:97,checks:['authentication gate','native full viewport on four sizes','home-only KPIs','continuous client/file lists','search retains focus','folder breadcrumbs','double-click open','rename once and refresh','duplicate once and refresh','multiple selection','theme and icon preferences'],errors};
 fs.writeFileSync(output+'/results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}catch(error){for(const p of await browser.pages())if(p.url().startsWith('http'))await p.screenshot({path:output+'/failure.png'});throw error}finally{await browser.close();server.close()}
