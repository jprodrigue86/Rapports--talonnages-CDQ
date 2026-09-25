import fs from 'node:fs';
import assert from 'node:assert/strict';
import http from 'node:http';
import {chromium,webkit} from 'playwright';
const dir='balance-cdq-android/app/build/generated/cdq-web-assets/cdq-web';
const html=fs.readFileSync(dir+'/Selector.html','utf8');
const styles=[...html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map(m=>m[0]).join('\n');
const extract=id=>html.match(new RegExp('<script id="'+id+'">([\\s\\S]*?)<\\/script>'))[1];
const mobile=extract('cdqMobileLayoutJs'),personal=extract('cdqPersonalSizingV2533'),fit=extract('cdqWholeWordsV2534');
const header=html.match(/<header class="app-header[\s\S]*?<\/header>/)[0];
const quick=html.match(/<div[^>]*class="quick-buttons"[^>]*>[\s\S]*?<\/div>/)[0];
const axes=['General','Text','Icon'],names=['Accueil','Favoris','Dossier','Inventaire','Factures','Corbeille'];
const content='<main class="container">'+header+'<div class="company-wrapper"><button class="company-button">Choisir une compagnie</button><button class="company-reset-button"><svg viewBox="0 0 24 24"><path d="M20 5V11H14"/></svg></button></div>'+quick+'<div id="cdqTopActionsV2204">'+['Hors ligne','Note','Photos','Réglages'].map(n=>'<button class="cdq-top-action"><span>✧</span><span>'+n+'</span></button>').join('')+'</div><div id="filesContainer"></div></main><nav class="bottom-nav">'+names.map(n=>'<button class="bottom-nav-item"><span>★</span><small>'+n+'</small></button>').join('')+'</nav>';
const init=`window.utilisateurCourantEmail='owner@example.invalid';window.utilisateurCourantRole='admin';window.__clicks=[];window.demanderCopie=x=>__clicks.push(x);window.cdqApplyAllScalesV89=()=>cdqMobileLayout.apply();`;
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html class="android" data-cdq-safe-frame="1"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+styles+'</head><body class="cdq-theme-metal">'+content+'<script>'+init+'</script><script>'+personal+'</script><script>'+fit+'</script><script>'+mobile+'</script></body></html>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url='http://127.0.0.1:'+server.address().port;
const inspect=()=>{
 const bad=[],top=[];
 for(const el of document.querySelectorAll('.quick-name,#cdqTopActionsV2204>.cdq-top-action>span:last-child,.bottom-nav-item>small')){
  const b=el.parentElement.getBoundingClientRect();if(!b.width)continue;
  if(!el.querySelector('.cdq-word-line'))bad.push([el.textContent,'not protected']);
  for(const line of el.children){const range=document.createRange();range.selectNodeContents(line);const r=range.getBoundingClientRect(),rects=[...range.getClientRects()].filter(r=>r.width>0);
   if(rects.length>1)bad.push([line.textContent,'split']);
   if(r.left<b.left-.7||r.right>b.right+.7||r.top<b.top-.7||r.bottom>b.bottom+.7)bad.push([line.textContent,'outside tile']);
   range.detach();
  }
  if(el.classList.contains('quick-name'))top.push([...el.children].map(c=>c.textContent.trim()));
 }
 const nav=document.querySelector('.bottom-nav'),nr=nav.getBoundingClientRect();
 return {bad,top,scrollWidth:document.documentElement.scrollWidth,width:innerWidth,nav:nr.toJSON(),padding:parseFloat(getComputedStyle(document.body).paddingBottom),nodes:document.querySelectorAll('.cdq-word-line').length};
};
let count=0;
try{for(const [name,type] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await type.launch({headless:true});
 try{for(const platform of ['android','ios']){
  const ua=platform==='android'?'Mozilla/5.0 (Linux; Android 16) BalanceCDQAndroid/25.34 CDQSafeArea/1':'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1';
  const context=await browser.newContext({viewport:{width:384,height:840},userAgent:ua});await context.route('https://**/*',r=>r.abort());const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
  await page.evaluate(p=>{document.documentElement.className=p+' cdq-mobile-layout';},platform);
  for(const w of [280,320,360,384,390,412,480,768]){
   await page.setViewportSize({width:w,height:840});
   for(const [values,pos] of [[[50,50,50],null],[[50,71,100],null],[[50,71,100],[50,50,50]],[[50,71,100],[50,50,100]],[[100,100,100],null],[[100,100,100],[100,100,100]],[[0,0,0],null]]){
    const saved=await page.evaluate(({values,pos,platform})=>{
     const axes=['General','Text','Icon'];axes.forEach((a,i)=>localStorage.setItem('cdqUi'+a+'ScaleV89',values[i]));
     const key='cdq-personal-sizing-v1:'+(platform==='ios'?'iphone':'android')+':owner@example.invalid';
     if(pos)localStorage.setItem(key,JSON.stringify({schema:1,anchor:Object.fromEntries(axes.map((a,i)=>[a,values[i]])),position:Object.fromEntries(axes.map((a,i)=>[a,pos[i]]))}));else localStorage.removeItem(key);
     const before=JSON.stringify({...localStorage});cdqMobileLayout.apply();return before;
    },{values,pos,platform});
    await page.waitForTimeout(35);const a=await page.evaluate(inspect);assert.deepEqual(a.bad,[],name+' '+platform+' '+w+' '+values+' '+pos);
    assert.deepEqual(a.top,[['Balance','intermédiaire'],['Balance','à camion'],['Balance','de précision'],['Balance','multi-tete']]);
    assert(a.scrollWidth<=a.width+1,'No horizontal page overflow');assert(a.padding>=a.nav.height-.7,'Navigation space reserved');
    assert.equal(await page.evaluate(()=>JSON.stringify({...localStorage})),saved,'Reflow cannot alter saved personal/shared settings');
    await page.evaluate(()=>{for(let i=0;i<8;i++)cdqMobileLayout.apply()});const b=await page.evaluate(inspect);assert.deepEqual(b,a,'Reflow is idempotent');count++;
   }
  }
  await page.setViewportSize({width:412,height:580});await page.waitForTimeout(60);assert.deepEqual((await page.evaluate(inspect)).bad,[],'Keyboard-sized viewport');
  await page.locator('.quick-intermediaire').click();await page.locator('.quick-precision').click();assert.deepEqual(await page.evaluate(()=>__clicks),['intermediaire','precision'],'Original click actions preserved');
  // Legacy raw text node variant and a replaced icon must receive the same fit.
  await page.evaluate(()=>{const b=document.querySelector('#cdqTopActionsV2204>.cdq-top-action:last-child');b.innerHTML='<svg viewBox="0 0 24 24"><path d="M1 1H20V20H1Z"/></svg> Réglages';cdqMobileLayout.apply()});await page.waitForTimeout(60);assert.deepEqual((await page.evaluate(inspect)).bad,[]);
  assert.deepEqual(errors,[]);await context.close();
 }}finally{await browser.close();}
}}finally{server.close();}
console.log('PASS '+count+' word-safe layouts: complete phrases, extreme/personal scales, Android/iPhone, Chromium/WebKit, no clipping or preference writes; original actions preserved.');
