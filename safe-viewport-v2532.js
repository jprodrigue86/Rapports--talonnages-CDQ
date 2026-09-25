/* One owner for system insets. No device model guesses or saved preference writes. */
(() => {
  'use strict';
  const root = document.documentElement;
  const role = document.currentScript?.dataset.cdqViewport;
  const nativeSafe = /\bCDQSafeArea\/1\b/.test(navigator.userAgent);
  let parentSafe = false;
  try {
    parentSafe = window.parent !== window && window.parent.location.origin === location.origin &&
      window.parent.document.documentElement.dataset.cdqSafeShell === '1';
  } catch (_) {}
  const browserShell = role === 'shell' && !nativeSafe && root.hasAttribute('data-cdq-iphone-version');
  if (role === 'shell' && (nativeSafe || browserShell)) root.dataset.cdqSafeShell = '1';
  if (role === 'selector' && (nativeSafe || parentSafe)) {
    root.dataset.cdqSafeFrame = '1';
    // Legacy styles also declare these variables with !important. The verified
    // owner is the parent/native host; make that boundary explicit once.
    for (const name of ['--cdq-safe-top','--cdq-safe-bottom','--cdq-content-safe-top','--cdq-content-safe-bottom','--cdq-content-safe-left','--cdq-content-safe-right'])
      root.style.setProperty(name,'0px','important');
  }
  const style = document.createElement('style');
  style.id = 'cdq-safe-viewport-v2532';
  style.textContent = `
html[data-cdq-safe-frame="1"] {
  --cdq-safe-top:0px!important; --cdq-safe-bottom:0px!important;
  --cdq-content-safe-top:0px; --cdq-content-safe-bottom:0px;
  --cdq-content-safe-left:0px; --cdq-content-safe-right:0px;
}
html[data-cdq-safe-frame="1"] body {margin:0!important;padding-top:0!important;padding-left:0!important;padding-right:0!important;box-sizing:border-box!important}
html[data-cdq-safe-frame="1"] .container {padding-left:0!important;padding-right:0!important;box-sizing:border-box!important}
html[data-cdq-browser-safe="1"] {--interface-scale:1!important;
  --cdq-window-top:env(safe-area-inset-top,0px);--cdq-window-bottom:env(safe-area-inset-bottom,0px);
  --cdq-window-left:env(safe-area-inset-left,0px);--cdq-window-right:env(safe-area-inset-right,0px);
}
html[data-cdq-browser-safe="1"] #app {
  position:fixed!important;box-sizing:border-box!important;
  left:calc(var(--cdq-visible-left,0px) + var(--cdq-window-left))!important;
  top:calc(var(--cdq-visible-top,0px) + var(--cdq-window-top))!important;
  width:calc(var(--cdq-visible-width,100vw) - var(--cdq-window-left) - var(--cdq-window-right))!important;
  height:calc(var(--cdq-visible-height,100dvh) - var(--cdq-window-top) - var(--cdq-window-bottom))!important;
  transform:none!important;margin:0!important;
}
html[data-cdq-browser-safe="1"] #loading {
  top:var(--cdq-window-top)!important;bottom:var(--cdq-window-bottom)!important;
  left:var(--cdq-window-left)!important;right:var(--cdq-window-right)!important;
  width:auto!important;height:auto!important;min-height:0!important;
}
html[data-cdq-browser-safe="1"][data-cdq-keyboard="1"] {--cdq-window-bottom:0px}
`;
  (document.head || root).appendChild(style);
  if (!browserShell) return;
  root.dataset.cdqBrowserSafe = '1';
  let pending = false;
  function measure() {
    pending = false;
    const vv = window.visualViewport;
    // Do not turn pinch zoom into a layout/preference change.
    if (vv && Math.abs(vv.scale - 1) > 0.05) return;
    const height = vv ? vv.height : window.innerHeight;
    const values = {width:vv ? vv.width : window.innerWidth,height,
      left:vv ? vv.offsetLeft : 0,top:vv ? vv.offsetTop : 0};
    for (const [name,value] of Object.entries(values)) {
      const px = Math.max(0,Math.round(value*100)/100)+'px';
      if (root.style.getPropertyValue('--cdq-visible-'+name) !== px)
        root.style.setProperty('--cdq-visible-'+name,px);
    }
    root.dataset.cdqKeyboard = window.innerHeight-height > 150 ? '1' : '0';
  }
  function queue() {if(!pending){pending=true;requestAnimationFrame(measure);}}
  measure();
  window.addEventListener('resize',queue,{passive:true});
  window.addEventListener('pageshow',queue,{passive:true});
  window.visualViewport?.addEventListener('resize',queue,{passive:true});
  window.visualViewport?.addEventListener('scroll',queue,{passive:true});
})();
