/* V25.38 — bottom-nav icon fallback.
 * Keep original icons visible until the packaged custom icon sprite is
 * confirmed loaded. This prevents an empty bottom bar on restored/slow state. */
(() => {
  'use strict';

  const READY='cdq-icon-art-ready-v2538';
  const THEMED='cdq-icon-host-v2514';
  const sprite=new URL('./bundles/balance-cdq/v25.15/icons-transparent.webp',location.href).href;
  let loaded=false;

  const style=document.createElement('style');
  style.id='cdqIconFallbackStyleV2538';
  style.textContent=`
    .bottom-nav > .bottom-nav-item > span:not(.${THEMED}){
      visibility:visible!important;
    }
    .bottom-nav > .bottom-nav-item > span:not(.${THEMED}) *{
      visibility:visible!important;
    }
    .bottom-nav > .bottom-nav-item > .${THEMED}:not(.${READY}){
      visibility:visible!important;
    }
    .bottom-nav > .bottom-nav-item > .${THEMED}:not(.${READY}) *{
      visibility:visible!important;
    }
    .bottom-nav > .bottom-nav-item > .${THEMED}:not(.${READY})::after{
      display:none!important;
      visibility:hidden!important;
    }
  `;
  (document.head||document.documentElement).append(style);

  function sync(){
    document.querySelectorAll('.bottom-nav > .bottom-nav-item > span').forEach(host=>{
      const themed=host.classList.contains(THEMED);
      host.classList.toggle(READY,themed&&loaded);
    });
  }

  function start(){
    sync();
    const observer=new MutationObserver(records=>{
      if(records.some(r=>r.type==='childList'||r.attributeName==='class'))sync();
    });
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});

    const image=new Image();
    image.decoding='async';
    image.onload=()=>{loaded=true;sync();};
    image.onerror=()=>{loaded=false;sync();};
    image.src=sprite;
  }

  window.cdqIconFallbackV2538={
    sprite,
    ready:()=>loaded,
    sync
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
