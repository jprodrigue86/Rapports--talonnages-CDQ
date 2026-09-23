import fs from 'node:fs';import http from 'node:http';import assert from 'node:assert/strict';import puppeteer from 'puppeteer-core';
import {fixture} from './helpers/desktop-ergonomics-fixture.mjs';
const read=p=>fs.readFileSync(p,'utf8');
// Exercise the actual unchanged confirmation/RPC body captured from the V25.19 core.
const deleteFile=read('tests/fixtures/v25.19-delete-file.js');
const html=fixture().replace(read('bundles/balance-cdq/v25.18/desktop.js'),()=>read('bundles/balance-cdq/v25.20/desktop.js')).replace('fileMenu:()=>{},','fileMenu:()=>calls.push({name:"deep-menu"}),deleteFile,')
 .replace('window.startDemo=()=>{',()=>deleteFile+'\nconst st=demoState,reportClientId=f=>f.clientId,toast=()=>{},refreshReportListPC=async()=>{},loadClients=async()=>{},gs=async(name,args)=>calls.push({name,args});\nwindow.startDemo=()=>{');
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(html)});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});await page.setViewport({width:1440,height:900});await page.setRequestInterception(true);page.on('request',r=>r.url().startsWith('http://127.0.0.1:')?r.continue():r.respond({status:200,body:''}));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.click('#demoLogin');await page.click('[data-view="clients"]');await page.waitForSelector('[data-client="c0"] .pc17-open-client');await page.click('[data-client="c0"] .pc17-open-client');await page.waitForSelector('[data-file="f0"]');
 await page.click('[data-file="f0"] [data-more]');assert.match(await page.$eval('.pc17-menu button',e=>e.textContent),/Supprimer/);
 let confirmation='';page.once('dialog',async d=>{confirmation=d.message();await d.dismiss()});await page.click('.pc17-danger');assert.match(confirmation,/Balance de plancher/);assert.equal(await page.evaluate(()=>calls.filter(c=>c.name==='supprimerFichiers').length),0);assert.equal(await page.evaluate(()=>calls.filter(c=>c.name==='deep-menu').length),0);
 await page.click('[data-file="f0"] b');await page.waitForSelector('#pc20Delete');await page.screenshot({path:'/tmp/cdq-delete-v2520.png'});
 page.once('dialog',async d=>d.accept());await page.click('#pc20Delete');await page.waitForFunction(()=>calls.some(c=>c.name==='supprimerFichiers'));assert.deepEqual(await page.evaluate(()=>calls.find(c=>c.name==='supprimerFichiers').args),[['f0'],'c0']);
 await page.evaluate(()=>utilisateurCourantRole='lecture');await page.click('[data-file="f1"] b');assert.equal(await page.$('#pc20Delete'),null);await page.click('[data-file="f1"] [data-more]');assert.equal(await page.$('.pc17-danger'),null);
 assert.deepEqual(errors,[]);console.log('PASS PC delete: first-level menu, contextual button, cancellation, same existing RPC and read-only roles.');
}finally{await browser.close();await new Promise(r=>server.close(r))}
