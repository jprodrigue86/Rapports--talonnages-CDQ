import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
const sources=['balance-cdq-android/app/build/generated/cdq-web-assets/cdq-web/Selector.html','iphone/app/Selector.html'];
const output='/tmp/cdq-home2531-results';fs.mkdirSync(output,{recursive:true});
let count=0,reproduced=0;
for(const [engineName,engine] of Object.entries({chromium,webkit})){
 const browser=await engine.launch();
 try{for(const source of sources){
  const original=fs.readFileSync(source,'utf8');
  assert.equal((original.match(/id="cdqHomeNoUnderlineV2531"/g)||[]).length,1);
  const styles=[...original.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map(m=>m[0]).join('\n');
  const nav=original.match(/<nav\b[^>]*class="bottom-nav"[^>]*>[\s\S]*?<\/nav>/i)[0];
  for(const platform of ['android','ios'])for(const width of [360,390,430,768]){
   const page=await browser.newPage({viewport:{width,height:844}});
   await page.route('**/*',route=>route.abort());
   await page.setContent('<html class="'+platform+' mobile-device cdq-mobile-layout"><head>'+styles+'</head><body>'+nav+'</body></html>');
   await page.evaluate(()=>{
    document.querySelector('.home-nav-button').classList.add('cdq-nav-home');
    document.querySelector('.home-nav-button span').classList.add('cdq-icon-host-v2514');
    document.querySelector('.home-nav-button').onclick=()=>window.homeClicks=(window.homeClicks||0)+1;
   });
   const snapshot=()=>page.evaluate(()=>Array.from(document.querySelectorAll('.bottom-nav,.bottom-nav *')).map(el=>{
    const props=style=>Object.fromEntries(Array.from(style).map(k=>[k,style.getPropertyValue(k)]));
    return {tag:el.tagName,cls:el.className,rect:el.getBoundingClientRect().toJSON(),normal:props(getComputedStyle(el)),after:props(getComputedStyle(el,'::after')),before:props(getComputedStyle(el,'::before'))};
   }));
   await page.evaluate(()=>document.getElementById('cdqHomeNoUnderlineV2531').disabled=true);
   const before=await snapshot();
   const beforePseudo=await page.locator('.home-nav-button').evaluate(el=>({display:getComputedStyle(el,'::after').display,content:getComputedStyle(el,'::after').content}));
   if(beforePseudo.display!=='none'&&beforePseudo.content!=='none')reproduced++;
   await page.evaluate(()=>document.getElementById('cdqHomeNoUnderlineV2531').disabled=false);
   const after=await snapshot();
   const afterPseudo=await page.locator('.home-nav-button').evaluate(el=>({display:getComputedStyle(el,'::after').display,content:getComputedStyle(el,'::after').content}));
   assert.equal(afterPseudo.display,'none');assert.equal(afterPseudo.content,'none');
   for(let i=0;i<before.length;i++){
    if(before[i].cls.includes('home-nav-button')){delete before[i].after;delete after[i].after;}
    assert.deepEqual(after[i],before[i],engineName+' '+platform+' '+width+' '+before[i].tag+' '+before[i].cls);
   }
   await page.locator('.home-nav-button').click({force:true});
   assert.equal(await page.evaluate(()=>window.homeClicks),1,'Home interaction preserved');
   if(width===390)await page.screenshot({path:output+'/'+engineName+'-'+platform+'-'+(source.startsWith('iphone')?'iphone':'android')+'.png'});
   await page.close();count++;
  }
 }}finally{await browser.close();}
}
assert(reproduced>0,'Regression fixture must reproduce the old underline');
fs.writeFileSync(output+'/result.json',JSON.stringify({cases:count,oldUnderlineReproduced:reproduced,homeUnderlineRemoved:true,otherElementsUnchanged:true,engines:['Chromium','WebKit'],physicalDevicesTested:false},null,2));
console.log('PASS '+count+' cases: Home underline removed; artwork host, geometry, other buttons and click retained.');
