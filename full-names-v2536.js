/* V25.36 — show complete company, file and folder names.
 * Names wrap to additional lines and their own rectangles grow vertically.
 * No scale, storage, network, account, PDF, click-handler or data changes. */
(function () {
  'use strict';

  const nameSelector = [
    '.file-name',
    '.file-name-text',
    '.folder-name',
    '.folder-name-text',
    '#companyList .cdq-company-name',
    '.company-button',
    '.client-info-name'
  ].join(',');

  const textProps = {
    'white-space':'normal',
    'overflow-wrap':'anywhere',
    'word-break':'normal',
    'hyphens':'none',
    'overflow':'visible',
    'text-overflow':'clip',
    'max-height':'none',
    'height':'auto',
    '-webkit-line-clamp':'unset',
    'line-clamp':'unset'
  };

  function set(el, props) {
    if (!el) return;
    for (const [key, value] of Object.entries(props)) {
      if (el.style.getPropertyValue(key) !== value || el.style.getPropertyPriority(key) !== 'important') {
        el.style.setProperty(key, value, 'important');
      }
    }
  }

  function each(selector, props) {
    document.querySelectorAll(selector).forEach(el => set(el, props));
  }

  function fit() {
    each(nameSelector, textProps);

    each('.file-info', {
      'min-width':'0',
      'height':'auto',
      'max-height':'none',
      'overflow':'visible'
    });

    // Keep the swipe clipping on the outer row, but let its height follow
    // the complete multi-line file or folder name.
    each('.file-row,.folder-header', {
      'height':'auto',
      'max-height':'none'
    });

    each('#companyList .company-item', {
      'height':'auto',
      'max-height':'none',
      'align-items':'center'
    });

    // The selected-company button grows only when its full name needs it.
    each('.company-wrapper', {
      'height':'auto',
      'max-height':'none',
      'align-items':'stretch',
      'overflow':'visible'
    });
    each('.company-button', {
      'height':'auto',
      'max-height':'none'
    });
    each('.company-reset-button', {
      'height':'auto',
      'align-self':'stretch'
    });

    // The company information band also grows instead of replacing the end
    // of the name with an ellipsis.
    each('.client-info-name-wrap', {
      'min-width':'0',
      'height':'auto',
      'max-height':'none',
      'overflow':'visible',
      'flex':'1 1 0'
    });
    each('#clientInfoBar', {
      'height':'auto',
      'max-height':'none'
    });
  }

  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    const run = () => { queued = false; fit(); };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
    else setTimeout(run, 0);
  }

  window.cdqFitFullNamesV2536 = fit;

  function start() {
    fit();
    if (typeof MutationObserver === 'function' && document.documentElement) {
      const observer = new MutationObserver(schedule);
      observer.observe(document.documentElement, {subtree:true, childList:true, characterData:true});
    }
    document.fonts?.ready.then(schedule).catch(() => {});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
