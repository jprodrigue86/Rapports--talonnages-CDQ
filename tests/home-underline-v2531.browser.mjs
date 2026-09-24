import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {HOME_UNDERLINE_CSS,HOME_UNDERLINE_STYLE,applyHomeUnderline2531} from '../scripts/home-underline-v2531.mjs';
const native='balance-cdq-android/app/build/generated/cdq-web-assets/cdq-web/';
const html=fs.readFileSync(native+'Selector.html','utf8');
assert.equal(html.split(HOME_UNDERLINE_STYLE).length,2);
const original=html.replace(HOME_UNDERLINE_STYLE,'');
assert.equal(applyHomeUnderline2531(original),html);
assert.equal(applyHomeUnderline2531(html),html);
assert(!HOME_UNDERLINE_CSS.includes('icon-host'));
const styles=[...original.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m=>m[0]).join('\n');
const names=['Accueil','Favoris','Dossier','Inventaire','Factures','Corbeille'];
const kinds=['home','fav','folder','inventory','invoices','trash'];
const nav='<nav class="bottom-nav" aria-label="Navigation principale">'+names.map((name,i)=>'<button type="button" class="bottom-nav-item cdq-nav-'+kinds[i]+(i===0?' active home-nav-button':' cdq-section-open-v2206')+'"><span class="cdq-icon-host-v2514" style="--cdq-art-size:600% 100%;--cdq-art-position:'+i*20+'% 0">'+(i===0?'⌂':'★')+'</span><small>'+name+'</small></button>').join('')+'</nav>';
fs.mkdirSync('/tmp/cdq-home-test',{recursive:true});
for(const [engine,type] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch({headless:true});
 try{
  for(const platform of ['android','ios','mobile-device','windows'])for(const width of [360,390,412]){
   const page=await browser.newPage({viewport:{width,height:844}});
   await page.route('**/*',async route=>{
    try{const u=new URL(route.request().url()),prefix='/Rapports--talonnages-CDQ/native/v25.31/';
     if(u.origin==='https://jprodrigue86.github.io'&&u.pathname.startsWith(prefix)){
      const file=native+u.pathname.slice(prefix.length);if(fs.existsSync(file))return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.webp')?'image/webp':file.endsWith('.png')?'image/png':'application/octet-stream'});
     }
    }catch{}
    return route.abort();
   });
   await page.setContent('<!doctype html><html class="'+platform+(platform==='windows'?'':' cdq-mobile-layout')+'"><head><meta charset="utf-8">'+styles+'</head><body>'+nav+'</body></html>');
   // This isolated fixture does not execute the application scripts. Reproduce
   // the EXISTING cdqMobileLayoutJs nav mount before BOTH snapshots, otherwise
   // its legacy translateX(-50%) leaves Home outside the test viewport.
   if(platform!=='windows')await page.evaluate(()=>{
    const nav=document.querySelector('.bottom-nav');
    Object.entries({'position':'fixed','left':'0','right':'0','bottom':'0','width':'100%','max-width':'100%','transform':'none','zoom':'1','margin':'0','display':'grid','grid-template-columns':'repeat(6,minmax(0,1fr))'}).forEach(([k,v])=>nav.style.setProperty(k,v,'important'));
   });
   const snapshot=()=>page.evaluate(()=>[...document.querySelectorAll('.bottom-nav-item')].map(b=>{
    const props=['color','backgroundColor','backgroundImage','border','boxShadow','fontSize','width','height','padding','margin','display','visibility','filter','transform','textDecoration'];
    const pick=(el,pseudo)=>{const s=getComputedStyle(el,pseudo);return Object.fromEntries(props.concat(['content']).map(p=>[p,s[p]]));};
    const r=b.getBoundingClientRect();return {button:pick(b),icon:pick(b.firstElementChild,'::after'),line:pick(b,'::after'),rect:[r.x,r.y,r.width,r.height],label:b.textContent};
   }));
   const before=await snapshot();
   if(platform!=='windows'){assert.notEqual(before[0].line.display,'none','Regression reproduced: home line visible before patch');assert.equal(before[0].line.content,'""');}
   if(width===390&&platform==='ios')await page.screenshot({path:'/tmp/cdq-home-test/'+engine+'-before.png'});
   await page.addStyleTag({content:HOME_UNDERLINE_CSS});
   const after=await snapshot();
   if(platform!=='windows'){assert.equal(after[0].line.display,'none');assert.equal(after[0].line.content,'none');}
   else assert.deepEqual(after,before,'Desktop remains unchanged');
   assert.deepEqual(after.slice(1),before.slice(1),'Other navigation buttons must remain identical');
   for(const key of ['button','icon','rect','label'])assert.deepEqual(after[0][key],before[0][key],'Home '+key+' must not change');
   await page.evaluate(()=>{window.homeClicks=0;document.querySelector('.cdq-nav-home').onclick=()=>window.homeClicks++;});
   if(platform!=='windows'){await page.locator('.cdq-nav-home').click();assert.equal(await page.evaluate(()=>window.homeClicks),1);}
   if(width===390&&platform==='ios')await page.screenshot({path:'/tmp/cdq-home-test/'+engine+'-after.png'});
   await page.close();
  }
 }finally{await browser.close();}
}
console.log('PASS: Chromium/WebKit, Android/iPhone/mobile and unchanged desktop, three widths; Home icon, labels, dimensions, clicks and every other button preserved.');
