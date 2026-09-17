import puppeteer from 'puppeteer-core';
import {spawn} from 'node:child_process';

const chrome=process.env.CHROME_PATH||'/usr/bin/google-chrome';
const server=spawn('python3',['-m','http.server','8081','--bind','127.0.0.1'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let browser;
try{
  await sleep(700);
  browser=await puppeteer.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request',r=>r.url().startsWith('https://accounts.google.com/')?r.abort():r.continue());
  await page.goto('http://127.0.0.1:8081/apps-script-manager/',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#connect');
  await page.evaluate(()=>{
    window.__testClicks=0;
    window.google={accounts:{oauth2:{initTokenClient(opts){const tc={callback:opts.callback,error_callback:opts.error_callback,requestAccessToken(){window.__tokenRequested=(window.__tokenRequested||0)+1;setTimeout(()=>tc.callback({access_token:'T',expires_in:3600}),10)}};return tc},revoke(){}}}};
    document.querySelector('#connect').addEventListener('click',()=>window.__testClicks++);
  });
  await page.waitForFunction(()=>document.querySelector('#connect') && !document.querySelector('#connect').disabled,{timeout:8000});
  const before=await page.evaluate(()=>{
    const e=document.querySelector('#connect'),r=e.getBoundingClientRect(),p=getComputedStyle(e),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
    return {outer:e.outerHTML,rect:{x:r.x,y:r.y,w:r.width,h:r.height},display:p.display,visibility:p.visibility,pointerEvents:p.pointerEvents,hitId:hit?.id,hitTag:hit?.tagName,testClicks:window.__testClicks,tokenRequested:window.__tokenRequested||0,top:document.querySelector('#topStatus')?.textContent};
  });
  console.log('DEBUG_BEFORE',JSON.stringify(before));
  await page.click('#connect');
  await sleep(500);
  const afterPhysical=await page.evaluate(()=>({testClicks:window.__testClicks,tokenRequested:window.__tokenRequested||0,top:document.querySelector('#topStatus')?.textContent,auth:document.querySelector('#authBadge')?.textContent}));
  console.log('DEBUG_AFTER_PHYSICAL',JSON.stringify(afterPhysical));
  await page.$eval('#connect',e=>e.click());
  await sleep(500);
  const afterDom=await page.evaluate(()=>({testClicks:window.__testClicks,tokenRequested:window.__tokenRequested||0,top:document.querySelector('#topStatus')?.textContent,auth:document.querySelector('#authBadge')?.textContent}));
  console.log('DEBUG_AFTER_DOM',JSON.stringify(afterDom));
}finally{
  if(browser)await browser.close();
  server.kill('SIGTERM');
}
