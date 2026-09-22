import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import {fixture as baseFixture} from './helpers/phone-midpoint-fixture.mjs';
import {applyPatch} from './helpers/settings-fixture.mjs';
const read=p=>fs.readFileSync(p,'utf8');
const previous=JSON.parse(read('bundles/balance-cdq/v25.15/manifest.json'));
const update=JSON.parse(read('bundles/balance-cdq/v25.16/manifest.json'));
const legacy=process.env.CDQ_SELECTOR_SOURCE ? [...read(process.env.CDQ_SELECTOR_SOURCE).matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].filter(m=>!m[0].includes('id="cdqMobileLayoutCss"')).map(m=>m[1]).join('\n') : `
.company-wrapper{overflow:hidden!important}.company-menu{display:none;position:fixed;background:#24272b;z-index:10000;overflow:hidden;border:1px solid #555}
.company-search{width:100%;height:65px;font-size:20px}.company-list{overflow-y:auto}.company-item{min-height:62px;padding:16px 18px;font-size:23px;display:flex;align-items:center;border-bottom:1px solid #363a40}.cdq-company-name{flex:1}.cdq-company-star{background:transparent;border:0}
.client-info-bar{display:flex;flex-wrap:wrap}.client-info-name-wrap{width:100%}.client-stats{width:100%}
html:is(.android,.ios,.mobile-device) .bottom-nav{background:#020b12!important;border:1px solid #058dc7!important;box-shadow:inset 0 0 0 1px #0874a1!important}
html:is(.android,.ios,.mobile-device) body.cdq-theme-metal .file-row{background:#0b2131!important}
`;
const menu=`<div id="companyMenu" class="company-menu"><input id="companySearch" class="company-search" placeholder="Rechercher une compagnie…" oninput="renderCompanies()"><div id="companyList" class="company-list"></div></div>`;
const setup=`<script>
window.calls=[];window.favoriteCount=0;
window.companies=Array.from({length:40},(_,i)=>'Compagnie '+String(i+1).padStart(2,'0'));
window.renderCompanies=()=>{const list=document.getElementById('companyList');list.replaceChildren();const q=companySearch.value.toLowerCase();companies.filter(n=>n.toLowerCase().includes(q)).forEach(n=>{const row=document.createElement('div');row.className='company-item cdq-company-row';const name=document.createElement('span');name.className='cdq-company-name';name.textContent=n;name.onclick=()=>{calls.push(n);companyButton.textContent=n;companyMenu.style.display='none';companySearch.blur()};const star=document.createElement('button');star.type='button';star.className='cdq-company-star';star.textContent='★';star.onclick=e=>{e.stopPropagation();favoriteCount++;renderCompanies()};row.append(name,star);list.append(row)});ajusterMenuAndroid()};
window.ajusterMenuAndroid=()=>{if(companyMenu.style.display!=='block')return;const top=companyButton.getBoundingClientRect().bottom+8;companyMenu.style.top=top+'px';companyMenu.style.height=Math.max(220,Math.min(visualViewport.height*.5,visualViewport.height-top-16))+'px'};
window.toggleCompanyMenu=()=>{if(companyMenu.style.display==='block'){companyMenu.style.display='none';return}companySearch.value='';renderCompanies();companyMenu.style.display='block';ajusterMenuAndroid();setTimeout(()=>{ajusterMenuAndroid();companySearch.focus()},150)};
companyButton.onclick=toggleCompanyMenu;
document.addEventListener('click',e=>{if(!document.querySelector('.company-wrapper').contains(e.target))companyMenu.style.display='none'});
window.cdqApplyTheme=theme=>{document.body.classList.remove('light','cdq-theme-metal','cdq-theme-electric','cdq-theme-steel','cdq-theme-violet');if(theme==='light')document.body.classList.add('light');else if(theme!=='dark')document.body.classList.add('cdq-theme-'+theme);localStorage.setItem('cdqTheme',theme)};
window.utilisateurCourantEmail='alice@example.test';window.cdqApiRun=()=>{let ok=()=>{};const chain={withSuccessHandler:f=>{ok=f;return chain},withFailureHandler:()=>chain,obtenirStyleIconesCDQV2514:email=>setTimeout(()=>ok({email,style:'metal-music',revision:1}),5),enregistrerStyleIconesCDQV2514:(email,value)=>setTimeout(()=>ok({email,...value}),5)};return chain};
</script>`;
let fixture=baseFixture.replace(`<style>${read('bundles/balance-cdq/v25.12/mobile-layout.css')}</style>`,'')
 .replace(`<script>${read('bundles/balance-cdq/v25.12/mobile-layout.js')}</script>`,'')
 .replace('</head>',`<style>${legacy}</style></head>`)
 .replace('class="company-button"','id="companyButton" class="company-button"')
 .replace('<div class="quick-buttons">',menu+'</div><div class="quick-buttons">')
 .replace('↻</button></div>','↻</button>')
 .replace('<div class="client-info-name">Client démo</div>', '<span class="client-info-name-wrap"><span id="clientInfoName" class="client-info-name">(Kersia Canada) Laboratoire choisy</span><span id="clientNoteDot" class="note-presence-badge">●</span></span>')
 .replace('<div class="client-stats">','<div id="clientStats" class="client-stats">')
 .replace('</body>',setup+previous.patches.at(-1).text+'</body>');
for(const patch of update.patches.filter(p=>p.file==='Selector.html'&&p.op!=='replace_build_any'))fixture=applyPatch(fixture,patch);
const output=process.env.CDQ_TEST_OUTPUT||'/tmp/cdq-mobile-fit';fs.mkdirSync(output,{recursive:true});
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(fixture)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage(), errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.evaluateOnNewDocument(()=>{const viewport=new EventTarget();Object.defineProperties(viewport,{height:{get:()=>window.keyboardHeight??innerHeight},width:{get:()=>innerWidth},offsetTop:{get:()=>window.viewportOffset||0},offsetLeft:{get:()=>0}});Object.defineProperty(window,'visualViewport',{value:viewport});});
 await page.setUserAgent('Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36 BalanceCDQAndroid/25.15');
 for(const width of [320,384,412]){
  await page.setViewport({width,height:Math.round(width*1536/709),isMobile:true,hasTouch:true,deviceScaleFactor:2});
  await page.goto('http://127.0.0.1:'+server.address().port);await page.evaluate(()=>localStorage.clear());await page.reload();
  await page.waitForFunction(()=>window.cdqMobileDimensions&&document.querySelector('.cdq-company-close'));
  for(const theme of ['dark','metal','light','electric','steel','violet']){
   await page.evaluate(t=>cdqApplyTheme(t),theme);await page.waitForFunction(t=>document.documentElement.dataset.cdqPalette===t,{},theme);
   const colors=await page.evaluate(()=>{const css=s=>getComputedStyle(document.querySelector(s));return {body:css('body').backgroundColor,row:css('.file-row').backgroundColor,company:css('.company-button').backgroundColor,text:css('.file-name').color}});
   const palettes={dark:['rgb(5, 11, 16)','rgb(12, 29, 42)'],metal:['rgb(0, 0, 0)','rgb(16, 16, 16)'],light:['rgb(245, 247, 249)','rgb(255, 255, 255)'],electric:['rgb(5, 20, 42)','rgb(11, 36, 69)'],steel:['rgb(37, 42, 47)','rgb(52, 59, 66)'],violet:['rgb(16, 7, 29)','rgb(33, 18, 56)']};
   assert.deepEqual([colors.body,colors.row],palettes[theme],theme+JSON.stringify(colors));
  }
  await page.evaluate(()=>cdqApplyTheme('metal'));
  // Both controls together, including the larger general-density setting.
  for(const scale of [0,50,100]){
   await page.evaluate(v=>{for(const n of ['General','Text','Icon'])localStorage.setItem('cdqUi'+n+'ScaleV89',v);cdqMobileLayout.apply()},scale);
   const result=await page.evaluate(()=>{const nav=document.querySelector('.bottom-nav'),rect=nav.getBoundingClientRect(),css=getComputedStyle(nav);return {width:innerWidth,doc:document.documentElement.scrollWidth,height:innerHeight,nav:{x:rect.x,y:rect.y,w:rect.width,h:rect.height,b:rect.bottom},border:css.borderWidth,shadow:css.boxShadow,safe:parseFloat(css.paddingBottom),body:parseFloat(getComputedStyle(document.body).paddingBottom),labels:[...nav.querySelectorAll('small')].map(el=>{const r=el.getBoundingClientRect(),icon=el.previousElementSibling.getBoundingClientRect();return {b:r.bottom,t:r.top,l:r.left,r:r.right,h:r.height,iconBottom:icon.bottom,scroll:el.scrollHeight,client:el.clientHeight}})}});
   assert.equal(result.doc,width,JSON.stringify(result));assert.equal(result.border,'0px');assert.equal(result.shadow,'none');
   assert.ok(Math.abs(result.body-result.nav.h)<1);
   assert.ok(result.labels.every(b=>b.t>=result.nav.y&&b.b<=result.height-result.safe&&b.l>=0&&b.r<=width&&b.t>=b.iconBottom&&b.scroll<=b.client+1),JSON.stringify({width,scale,result}));
   await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));
   const last=await page.$eval('.folder-header:last-child',el=>el.getBoundingClientRect().bottom);
   assert.ok(last<=result.nav.y+1,`Last file obscured: ${last} > ${result.nav.y}`);
   await page.evaluate(()=>scrollTo(0,0));
   if(width===384)await page.screenshot({path:output+'/phone-'+scale+'.png'});
  }
  await page.evaluate(()=>{for(const n of ['General','Text','Icon'])localStorage.setItem('cdqUi'+n+'ScaleV89','50');cdqMobileLayout.apply()});
  const compact=await page.evaluate(()=>{const bar=clientInfoBar.getBoundingClientRect(),name=clientInfoName.getBoundingClientRect(),stats=clientStats.getBoundingClientRect(),container=document.querySelector('.container').getBoundingClientRect();return {h:bar.height,nameY:name.y,statsY:stats.y,text:clientStats.textContent,container:{x:container.x,w:container.width}}});
  assert.ok(compact.h<30,JSON.stringify(compact));assert.equal(compact.text,'2 dossiers');assert.equal(compact.container.x,0);assert.equal(compact.container.w,width);
  assert.ok(await page.$eval('#clientInfoName',el=>el.getBoundingClientRect().width>50));
  await page.evaluate(()=>{const modal=document.getElementById('cdqSettingsModalV2294');cdqOrganizeSettings(modal);modal.style.display='flex'});
  await page.click('[data-settings-tab=appearance]');
  assert.equal(await page.$$eval('[data-icon-style]',els=>els.length),5,'Icon preferences must survive the module update');
  await page.click('#cdqSettingsCloseV2294');
  await page.click('#companyButton');await page.waitForFunction(()=>document.activeElement===companySearch);
  await page.evaluate(()=>{keyboardHeight=innerHeight*.53;visualViewport.dispatchEvent(new Event('resize'))});
  await page.waitForFunction(()=>companyMenu.getBoundingClientRect().bottom<=visualViewport.height);
  const keyboard=await page.evaluate(()=>{const list=companyList.getBoundingClientRect(),rows=[...companyList.children].filter(e=>{const r=e.getBoundingClientRect();return r.top>=list.top&&r.bottom<=list.bottom});return {shown:rows.length,h:list.height,top:companyMenu.getBoundingClientRect().top,viewport:visualViewport.height}});
  assert.ok(keyboard.shown>=5,JSON.stringify({width,keyboard}));
  await page.click('#companySearch');await page.type('#companySearch','Compagnie 2');
  assert.equal(await page.$eval('#companyMenu',el=>el.style.display),'block');
  assert.equal(await page.$$eval('#companyList .company-item',els=>els.length),10);
  await page.click('.cdq-company-star');assert.equal(await page.evaluate(()=>favoriteCount),1);assert.equal(await page.$eval('#companyMenu',el=>el.style.display),'block');
  await page.$eval('#companyList',el=>el.scrollTop=el.scrollHeight);
  assert.ok(await page.$eval('#companyList',el=>el.scrollTop>0));
  if(width===384)await page.screenshot({path:output+'/keyboard.png'});
  await page.click('#companyList .cdq-company-row:last-child .cdq-company-name');
  assert.equal(await page.evaluate(()=>calls.at(-1)),'Compagnie 29');
  await page.waitForFunction(()=>cdqCompanyBackdrop.hidden);
  await page.click('#companyButton');await page.waitForFunction(()=>document.activeElement===companySearch);
  assert.equal(await page.$eval('#companySearch',el=>el.value),'');
  assert.equal(await page.$eval('#companyMenu',el=>el.style.display),'block');
  await page.click('.cdq-company-close');await page.waitForFunction(()=>cdqCompanyBackdrop.hidden);
  await page.evaluate(()=>{keyboardHeight=undefined;visualViewport.dispatchEvent(new Event('resize'))});
  assert.equal(await page.$eval('#companyMenu',el=>el.style.display),'none');
  console.log(`PASS ${width}px: six palettes; full width; compact summary; nav sliders 0/50/100; keyboard ${keyboard.shown} rows, typing, favorites, selection, reopening`);
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();server.close()}
