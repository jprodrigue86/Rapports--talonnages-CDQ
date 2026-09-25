import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
const dir='balance-cdq-android/app/build/generated/cdq-web-assets/cdq-web';
const source=fs.readFileSync(dir+'/Selector.html','utf8');
const styles=[...source.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map(m=>m[0]).join('\n');
const script=id=>{const m=source.match(new RegExp('<script id="'+id+'">([\\s\\S]*?)<\\/script>'));assert(m,id);return m[1];};
const personal=script('cdqPersonalSizingV2533'),fitter=script('cdqButtonLabelFitV2534'),mobile=script('cdqMobileLayoutJs');
const quick=[
 ['quick-intermediaire','⚖','Balance intermédiaire'],
 ['quick-camion','🚛','Balance<br>à camion'],
 ['quick-precision','⚖','Balance<br>de précision'],
 ['quick-multitete','⚖','Balance<br>multi-tete']
].map(([c,i,n])=>'<button class="quick-button '+c+'"><span class="quick-icon">'+i+'</span><span class="quick-name">'+n+'</span></button>').join('');
const actions=['Hors ligne','Note','Photos','Réglages'].map((n,i)=>'<button class="cdq-top-action"><span>⚙</span><span>'+n+'</span></button>').join('');
const nav=['Accueil','Favoris','Dossier','Inventaire','Factures','Corbeille'].map(n=>'<button class="bottom-nav-item"><span>★</span><small>'+n+'</small></button>').join('');
const body='<main class="container"><div class="quick-buttons">'+quick+'</div><div id="cdqTopActionsV2204">'+actions+'</div></main><nav class="bottom-nav">'+nav+'</nav>';
const boot=`window.utilisateurCourantEmail='owner@example.invalid';window.utilisateurCourantRole='admin';`;
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html class="android"><head><meta name="viewport" content="width=device-width,initial-scale=1">'+styles+'</head><body>'+body+'<script>'+boot+'</script><script>'+fitter+'</script><script>'+personal+'</script><script>'+mobile+'</script></body></html>')});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
function inspect(){
  function pieces(el){
    const out=[],walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
    for(let node=walker.nextNode();node;node=walker.nextNode()){
      const text=node.nodeValue||'';for(const m of text.matchAll(/\S+/g)){const range=document.createRange();range.setStart(node,m.index);range.setEnd(node,m.index+m[0].length);const rects=[...range.getClientRects()].filter(r=>r.width>.1&&r.height>.1);out.push({word:m[0],rects:rects.map(r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom}))});}
    }return out;
  }
  const groups=[['.quick-name',2],['#cdqTopActionsV2204 > .cdq-top-action > span:last-child',2],['.bottom-nav-item small',1]];
  return groups.flatMap(([sel,max])=>[...document.querySelectorAll(sel)].map(el=>{const r=el.getBoundingClientRect(),words=pieces(el),tops=[];for(const w of words)for(const x of w.rects)if(!tops.some(v=>Math.abs(v-x.top)<1))tops.push(x.top);return {text:el.textContent.trim().replace(/\s+/g,' '),max,lines:tops.length,words,width:el.clientWidth,scrollWidth:el.scrollWidth,font:parseFloat(getComputedStyle(el).fontSize),overflowWrap:getComputedStyle(el).overflowWrap,wordBreak:getComputedStyle(el).wordBreak,hyphens:getComputedStyle(el).hyphens,box:{left:r.left,right:r.right}};}));
}
try{
 for(const [engine,type] of [['Chromium',chromium],['WebKit',webkit]]){
  const browser=await type.launch({headless:true});
  try{
   for(const width of [360,384,412]){
    const context=await browser.newContext({viewport:{width,height:820},userAgent:'Mozilla/5.0 (Linux; Android 16) BalanceCDQAndroid/25.34 CDQSafeArea/1'});
    const page=await context.newPage();await page.goto(url);
    for(const scenario of [
      {name:'standard',g:50,t:50,i:50,personal:false},
      {name:'max-icons',g:50,t:50,i:100,personal:false},
      {name:'max-text-icons',g:50,t:100,i:100,personal:false},
      {name:'personal-max-icons',g:50,t:71,i:100,personal:true,pt:50,pi:100},
      {name:'personal-max-both',g:50,t:71,i:100,personal:true,pt:100,pi:100}
    ]){
      await page.evaluate(s=>{
        for(const [a,v] of [['General',s.g],['Text',s.t],['Icon',s.i]])localStorage.setItem('cdqUi'+a+'ScaleV89',String(v));
        const key='cdq-personal-sizing-v1:android:owner@example.invalid';
        if(s.personal)localStorage.setItem(key,JSON.stringify({schema:1,anchor:{General:50,Text:71,Icon:100},position:{General:50,Text:s.pt,Icon:s.pi}}));else localStorage.removeItem(key);
        cdqMobileLayout.apply();
      },scenario);
      const data=await page.evaluate(inspect);
      for(const item of data){
        assert.equal(item.overflowWrap,'normal',engine+' '+width+' '+scenario.name+' '+item.text);
        assert.notEqual(item.hyphens,'auto',engine+' '+width+' '+scenario.name+' '+item.text);
        assert(item.lines<=item.max,engine+' '+width+' '+scenario.name+' '+item.text+' lines='+item.lines);
        assert(item.scrollWidth<=item.width+1.5,engine+' '+width+' '+scenario.name+' '+item.text+' overflow');
        for(const word of item.words){assert.equal(word.rects.length,1,engine+' '+width+' '+scenario.name+' split word '+word.word);const x=word.rects[0];assert(x.left>=item.box.left-1&&x.right<=item.box.right+1,engine+' '+width+' '+scenario.name+' clipped word '+word.word+' '+JSON.stringify({x,box:item.box,font:item.font,width:item.width,scrollWidth:item.scrollWidth,lines:item.lines,text:item.text}));}
        assert(item.font>=5.7,engine+' '+width+' '+scenario.name+' unreadable '+item.text+' '+item.font);
      }
      const heights=await page.locator('.quick-button').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().height));
      assert(Math.max(...heights)-Math.min(...heights)<1.5,engine+' '+width+' '+scenario.name+' quick row height mismatch');
    }
    await context.close();
   }
  }finally{await browser.close();}
 }
 console.log('PASS: complete words, <=2 lines in tiles, single-line bottom labels and adaptive fit across widths/settings.');
}finally{server.close();}
