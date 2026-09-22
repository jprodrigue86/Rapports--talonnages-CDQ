import fs from 'node:fs';import http from 'node:http';import assert from 'node:assert/strict';import puppeteer from 'puppeteer-core';
import {fixture} from './helpers/desktop-ergonomics-fixture.mjs';
const out=process.env.CDQ_TEST_OUTPUT||'/tmp/cdq-pc2518';fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(fixture())});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});const page=await browser.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
try{
 await page.setRequestInterception(true);page.on('request',r=>{if(r.url().startsWith('http://127.0.0.1:')||r.url().startsWith('data:'))return r.continue();const path=new URL(r.url()).pathname.replace('/Rapports--talonnages-CDQ/','');if(fs.existsSync(path)&&fs.statSync(path).isFile())return r.respond({status:200,contentType:path.endsWith('.webp')?'image/webp':'text/plain',body:fs.readFileSync(path)});r.respond({status:200,body:''})});
 await page.setViewport({width:1440,height:900});await page.goto('http://127.0.0.1:'+server.address().port);await wait(400);assert.equal(await page.$('#cdqPcV16'),null);
 await page.click('#demoLogin');await page.waitForSelector('[data-view="clients"]');await page.click('[data-view="clients"]');await page.waitForSelector('[data-client="c279"]');
 if(process.env.CDQ_SELECTOR_SOURCE)assert.equal(await page.evaluate(()=>completed.includes('obtenirRapportsRecentsPC')),false,'clients ready while recent files still loading');
 assert.equal(await page.$('[data-view="models"]'),null);assert.equal(await page.$$eval('button',es=>es.some(e=>e.textContent.includes('Importer'))),false);
 await page.click('[data-client="c0"] .pc17-open-client');await page.waitForSelector('[data-file="f95"]');assert.ok(await page.$('#pc18NewReport'));assert.equal(await page.$('#pc17Multi'),null);assert.equal(await page.$('#pc17BackClients'),null);
 await page.click('[data-view="clients"]');await page.click('[data-client="c1"] b');await page.click('[data-view="reports"]');
 await page.click('#pc18NewReport');await page.click('[data-model="multitete"]');assert.equal(await page.evaluate(()=>calls.at(-1).args[0]),'multitete');
 if(process.env.CDQ_SELECTOR_SOURCE)assert.equal(await page.evaluate(()=>calls.at(-1).args[1]),'c0');
 const row='[data-file="f0"] b';let box=await page.$eval(row,e=>{const r=e.getBoundingClientRect();return{x:r.x+10,y:r.y+8}});
 await page.mouse.move(box.x,box.y);await page.mouse.down();await wait(580);assert.equal(await page.$('#pc17Multi'),null);await wait(180);assert.ok(await page.$('#pc17Multi'));await page.mouse.up();
 assert.equal(await page.$$eval('.pc17-files tr.selected',es=>es.length),1);assert.equal(await page.evaluate(()=>opened.length),0);
 await page.click('[data-file="f1"] b');assert.equal(await page.$$eval('.pc17-files tr.selected',es=>es.length),2);await page.click('[data-file="f0"] b');assert.equal(await page.$$eval('.pc17-files tr.selected',es=>es.length),1);await page.click('#pc17Multi');assert.ok(await page.$('#pc18NewReport'));
 box=await page.$eval(row,e=>{const r=e.getBoundingClientRect();return{x:r.x+10,y:r.y+8}});await page.mouse.move(box.x,box.y);await page.mouse.down();await page.mouse.move(box.x+30,box.y);await wait(750);await page.mouse.up();assert.equal(await page.$('#pc17Multi'),null,'drag cancels long press');
 await page.click('[data-file="f0"] b',{clickCount:2});assert.equal(await page.evaluate(()=>opened.at(-1)),'f0');
 await page.click('[data-file="archive"] [data-open]');await page.waitForFunction(()=>document.querySelectorAll('[data-file]').length===26);
 const callsBefore=await page.evaluate(()=>calls.filter(c=>c.name==='obtenirContenuDossierPCRapideV79').length);
 await page.click('[data-crumb="0"]');await page.waitForSelector('[data-file="archive"]');
 if(process.env.CDQ_SELECTOR_SOURCE)assert.equal(await page.evaluate(()=>calls.filter(c=>c.name==='obtenirContenuDossierPCRapideV79').length),callsBefore,'return uses warm cache');
 await page.click('#pc17RefreshFolder');await wait(120);
 if(process.env.CDQ_SELECTOR_SOURCE)assert.equal(await page.evaluate(()=>calls.filter(c=>c.name==='obtenirContenuDossierPCRapideV79').length),callsBefore+1);
 const sizes=[];
 for(const width of [1024,1440,1920]){await page.setViewport({width,height:900});await wait(80);sizes.push(await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,font:getComputedStyle(document.querySelector('[data-file="f0"] b')).fontSize,icon:getComputedStyle(document.querySelector('[data-file="f0"] .pc16-native-icon')).width,scroll:document.querySelector('.pc17-scroll').clientHeight,row:document.querySelector('[data-file="f0"]').getBoundingClientRect().height})));}
 for(const s of sizes){assert.equal(s.overflow,false);assert.equal(s.font,'24px');assert.equal(s.icon,'34px');assert.ok(s.scroll>470,JSON.stringify(s));assert.ok(s.row<85,JSON.stringify(s))}
 await page.setViewport({width:1440,height:900});await page.screenshot({path:out+'/rapports.png'});
 await page.click('[data-view="settings"]');assert.equal(await page.$('#pc17SharedSettings'),null);await page.type('#pc18GoogleEmail','pc@example.test');await page.click('#pc18SaveAccount');assert.equal(await page.evaluate(()=>cdqGoogleDefaultAccountV2294()),'pc@example.test');await page.click('#pc18ResetAccount');assert.equal(await page.evaluate(()=>cdqGoogleDefaultAccountV2294()),'');
 await page.click('[data-pc-reader="acrobat"]');assert.equal(await page.evaluate(()=>localStorage.getItem('cdqPdfReaderPreferenceV1')),'acrobat');
 await page.click('#pc18CheckUpdate');assert.ok(await page.evaluate(()=>calls.some(c=>c.name==='check-update')));
 for(const key of ['text','icons'])await page.$eval(`[data-pc-range="${key}"]`,e=>{e.value=100;e.dispatchEvent(new Event('input'))});
 await page.click('[data-view="reports"]');await page.waitForSelector('[data-file="f0"]');assert.equal(await page.$eval(row,e=>getComputedStyle(e).fontSize),'32px');assert.equal(await page.$eval('[data-file="f0"] .pc16-native-icon',e=>getComputedStyle(e).width),'44px');
 await page.click('[data-view="home"]');await page.waitForSelector('[data-file="f0"]');assert.equal(await page.$('#pc17NewReport'),null);assert.equal(await page.$eval('#pc16Main',e=>e.textContent.includes('À vérifier')),false);
 await page.click('[data-view="settings"]');for(const key of ['text','icons'])await page.$eval(`[data-pc-range="${key}"]`,e=>{e.value=50;e.dispatchEvent(new Event('input'))});await page.$eval('.pc17-scroll',e=>e.scrollTop=0);await page.screenshot({path:out+'/reglages.png'});
 assert.deepEqual(errors,[]);fs.writeFileSync(out+'/results.json',JSON.stringify({realSource:!!process.env.CDQ_SELECTOR_SOURCE,sizes,errors},null,2));console.log(JSON.stringify({ok:true,sizes,errors},null,2));
}catch(e){await page.screenshot({path:out+'/failure.png'});console.error('Browser errors:',errors);throw e}finally{await browser.close();server.close()}
