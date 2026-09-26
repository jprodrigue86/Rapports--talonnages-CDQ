/* V25.43 — reveal the Android interface only after its visible controls settle.
 * The biometric prompt remains immediate. The Selector receives an ARM message
 * from the native shell after access is ready, forces the existing icon theme,
 * waits for local artwork/fonts, then requires a stable visual signature before
 * telling the shell it is safe to reveal the first frame. */
(() => {
  'use strict';
  if (window.top === window) return;

  const ARM='CDQ_FIRST_FRAME_ARM_V2543';
  const READY='CDQ_FIRST_FRAME_STABLE_V2543';
  const labels=['Hors ligne','Note','Photos','Réglages'];
  let serial=0;

  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const paints=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const norm=value=>String(value||'').replace(/\s+/g,' ').trim().toLowerCase();

  function visible(el){
    if(!el)return false;
    const s=getComputedStyle(el),r=el.getBoundingClientRect();
    return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0&&r.width>4&&r.height>4;
  }

  const actionCache=new Map();
  function control(label){
    const cached=actionCache.get(label);
    if(cached?.isConnected&&visible(cached))return cached;

    const wanted=norm(label);
    let found=[...document.querySelectorAll('button,[role="button"],a')]
      .find(el=>visible(el)&&norm(el.textContent).includes(wanted))||null;

    if(!found){
      const leaf=[...document.querySelectorAll('small,span,div')]
        .find(el=>visible(el)&&norm(el.textContent)===wanted);
      if(leaf){
        found=leaf;
        for(let i=0;i<4&&found.parentElement;i++){
          const parent=found.parentElement;
          if(!visible(parent)||norm(parent.textContent)!==wanted)break;
          found=parent;
        }
      }
    }
    if(found)actionCache.set(label,found);
    return found;
  }

  function styleSignature(el){
    if(!el)return 'missing';
    const nodes=[el,...el.querySelectorAll('span,i,svg,img,use,path')].slice(0,14);
    const styles=nodes.map(node=>{
      const s=getComputedStyle(node),before=getComputedStyle(node,'::before'),after=getComputedStyle(node,'::after');
      return [
        node.tagName,String(node.className||''),node.getAttribute?.('data-icon')||'',
        node.getAttribute?.('src')||'',node.getAttribute?.('href')||'',
        s.display,s.visibility,s.opacity,s.backgroundImage,s.maskImage,s.color,
        before.content,before.backgroundImage,before.maskImage,
        after.content,after.backgroundImage,after.maskImage
      ].join('|');
    }).join('~');
    return el.innerHTML+'~~'+styles;
  }

  function snapshot(){
    const actions=labels.map(label=>control(label));
    const nav=[...document.querySelectorAll('.bottom-nav > .bottom-nav-item')].filter(visible);
    const navReady=nav.length>=5&&nav.every(button=>{
      const host=button.querySelector(':scope > span');
      if(!host)return false;
      const h=getComputedStyle(host),before=getComputedStyle(host,'::before'),after=getComputedStyle(host,'::after');
      const r=host.getBoundingClientRect(),box=r.width>8&&r.height>8&&h.display!=='none';
      const original=box&&h.visibility!=='hidden'&&Number(h.opacity||1)>0;
      const pseudo=box&&(
        (before.display!=='none'&&before.visibility!=='hidden'&&(before.backgroundImage!=='none'||before.maskImage!=='none'||(before.content&&before.content!=='none'&&before.content!=='normal'))) ||
        (after.display!=='none'&&after.visibility!=='hidden'&&(after.backgroundImage!=='none'||after.maskImage!=='none'||(after.content&&after.content!=='none'&&after.content!=='normal')))
      );
      return original||pseudo;
    });
    return {
      ready:actions.every(Boolean)&&navReady,
      signature:actions.map(styleSignature).join('##')+'@@'+nav.map(styleSignature).join('##')
    };
  }

  function preload(src){
    return Promise.race([
      new Promise(resolve=>{
        const image=new Image();
        image.onload=image.onerror=()=>resolve();
        image.src=new URL(src,location.href).href;
        if(image.complete)resolve();
      }),
      delay(350)
    ]);
  }

  async function resources(){
    const fontReady=document.fonts?.ready ? Promise.race([document.fonts.ready,delay(350)]) : Promise.resolve();
    await Promise.allSettled([
      fontReady,
      preload('./bundles/balance-cdq/v25.15/icons-transparent.webp'),
      preload('./bundles/balance-cdq/v25.14/icons-reference.png')
    ]);
  }

  async function settle(generation){
    const run=++serial;
    try{window.cdqIconThemesV2514?.synchronize?.();}catch(_){}
    await resources();
    if(run!==serial)return;
    try{window.cdqIconThemesV2514?.synchronize?.();}catch(_){}

    const started=performance.now();
    let last='',stableSince=started;
    while(run===serial && performance.now()-started<1400){
      await paints();
      const state=snapshot(),now=performance.now();
      if(state.signature!==last){last=state.signature;stableSince=now;}
      if(state.ready && now-started>=450 && now-stableSince>=220)break;
      await delay(30);
    }
    if(run!==serial)return;
    await paints();
    parent.postMessage({type:READY,generation:Number(generation)||0},location.origin);
  }

  addEventListener('message',event=>{
    if(event.source!==parent||event.origin!==location.origin)return;
    const data=event.data||{};
    if(data.type!==ARM)return;
    settle(data.generation);
  });
})();
