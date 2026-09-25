/* Fit only CDQ's mobile action/navigation labels. Never change saved scales.
 * Keep complete phrases; grow the tile/reflow before allowing unreadable text.
 * No network, storage, account, PDF, or click-handler changes. */
(function () {
  'use strict';
  const labels = new Map([
    ['Balance intermédiaire', ['Balance', 'intermédiaire']],
    ['Balance à camion', ['Balance', 'à camion']],
    ['Balance de précision', ['Balance', 'de précision']],
    ['Balance multi-tête', ['Balance', 'multi-tête']],
    ['Balance multi-tete', ['Balance', 'multi-tete']],
    ['Hors ligne', ['Hors ligne']], ['Note', ['Note']],
    ['Photos', ['Photos']], ['Réglages', ['Réglages']]
  ]);
  const normalize = s => String(s || '').replace(/\s+/g, ' ').trim();
  const px = n => (Math.round(n * 100) / 100) + 'px';
  function set(el, props) {
    for (const [key, value] of Object.entries(props))
      if (el.style.getPropertyValue(key) !== value || el.style.getPropertyPriority(key) !== 'important')
        el.style.setProperty(key, value, 'important');
  }
  const number = v => parseFloat(v) || 0;
  function usable(el) {
    const s = getComputedStyle(el);
    return el.clientWidth - number(s.paddingLeft) - number(s.paddingRight);
  }
  function normalizeLabel(el, expected) {
    const raw = normalize([...el.childNodes].map(n => n.nodeName === 'BR' ? ' ' : n.textContent).join(''));
    const lines = labels.get(raw) || expected;
    if (!lines) return null;
    if (el.dataset.cdqWholeWords !== lines.join('|') || el.children.length !== lines.length || [...el.children].some(x => !x.classList.contains('cdq-word-line'))) {
      const spans = lines.map((line, i) => {
        const span = document.createElement('span'); span.className = 'cdq-word-line';
        span.textContent = line + (i < lines.length - 1 ? ' ' : ''); return span;
      });
      el.replaceChildren(...spans); el.dataset.cdqWholeWords = lines.join('|');
    }
    set(el, {'white-space':'normal', 'overflow-wrap':'normal', 'word-break':'normal', 'hyphens':'none', 'overflow':'visible', 'text-overflow':'clip'});
    for (const line of el.children) set(line, {'display':'block','width':'auto','min-width':'0','max-width':'none',
      'white-space':'nowrap','word-break':'normal','overflow-wrap':'normal','hyphens':'none','font-size':'inherit','line-height':'inherit'});
    return el;
  }
  function width(el) {
    let max = 0;
    for (const line of el.children.length ? el.children : [el]) {
      const range = document.createRange(); range.selectNodeContents(line);
      max = Math.max(max, range.getBoundingClientRect().width); range.detach();
    }
    return max;
  }
  function tilePadding(button) {
    const s = getComputedStyle(button);
    return number(s.paddingLeft) + number(s.paddingRight) + number(s.borderLeftWidth) + number(s.borderRightWidth);
  }
  function iconWidth(button, selector) {
    const el = button.querySelector(selector); return el ? el.getBoundingClientRect().width : 0;
  }
  function group(container, selector, labelSelector, iconSelector, fontSize, unit) {
    if (!container || !container.getClientRects().length || usable(container) <= 0) return;
    const entries = [...container.querySelectorAll(selector)].filter(b => getComputedStyle(b).display !== 'none').map(button => {
      let label = button.querySelector(labelSelector);
      // Some older action buttons have an icon followed by an unwrapped text node.
      if (!label) {
        const nodes = [...button.childNodes].filter(n => n.nodeType === 3 && normalize(n.textContent));
        const raw = normalize(nodes.map(n => n.textContent).join(' '));
        if (labels.has(raw)) { label = document.createElement('span'); label.textContent = raw; nodes[0].before(label); nodes.forEach(n => n.remove()); }
      }
      if (!label || !normalizeLabel(label)) return null;
      set(label, {'font-size':px(fontSize),'min-width':'0','width':'auto','max-width':'100%','flex':'1 1 0'});
      return {button,label};
    }).filter(Boolean);
    if (!entries.length) return;
    const gap = 4 * unit, available = usable(container), count = entries.length;
    const cell = n => (available - gap * (n - 1)) / n;
    let cols = Math.min(4, count), mode = 'row';
    const metrics = entries.map(({button,label}) => ({padding:tilePadding(button),icon:iconWidth(button,iconSelector),text:width(label)}));
    // A small, row-wide text adjustment avoids an unnecessary rearrangement.
    const ratio = Math.min(1,...metrics.map(m => (cell(cols)-m.padding-m.icon-3*unit-1)/Math.max(1,m.text)));
    if (ratio < .9) {
      mode = 'column';
      for (const n of [...new Set([cols,Math.min(2,count),1])]) {
        cols = n;
        if (metrics.every(m => Math.max(m.icon,m.text)+m.padding+1 <= cell(cols))) break;
      }
    }
    set(container, {'display':'grid','grid-template-columns':'repeat('+cols+',minmax(0,1fr))','grid-auto-rows':'auto','align-items':'stretch'});
    for (const {button,label} of entries) {
      set(button, {'flex-direction':mode,'height':'auto','max-height':'none','min-width':'0','width':'100%','box-sizing':'border-box','overflow':'visible'});
      set(label, {'font-size':px(fontSize*(mode==='row'?Math.max(.9,ratio):1)), 'flex':mode==='row'?'1 1 0':'0 0 auto', 'width':mode==='column'?'100%':'auto'});
    }
    container.dataset.cdqWordLayout = cols+'-'+mode;
  }
  window.cdqFitButtonWordsV2534 = function ({unit,topLabel,label}) {
    if (!document.documentElement.classList.contains('cdq-mobile-layout')) return;
    group(document.querySelector('.quick-buttons'), ':scope > .quick-button', ':scope > .quick-name', ':scope > .quick-icon', topLabel, unit);
    group(document.getElementById('cdqTopActionsV2204'), ':scope > .cdq-top-action', ':scope > span:last-child:not(:first-child)', ':scope > svg, :scope > span:first-child:not(:last-child)', topLabel, unit);
    const nav = document.querySelector('.bottom-nav');
    if (nav && usable(nav) > 0) {
      const items = [...nav.querySelectorAll(':scope > .bottom-nav-item')].filter(el => getComputedStyle(el).display !== 'none');
      const sizes = items.map(button => {
        const text = button.querySelector('small');
        if (text) {normalizeLabel(text,[normalize(text.textContent)]); set(text,{'font-size':px(label)});}
        return Math.max(text?width(text):0,iconWidth(button,':scope > span'))+tilePadding(button)+1;
      });
      let cols = items.length || 1;
      for (const n of [...new Set([cols,Math.ceil(cols/2),2,1])]) {
        cols = n;
        if (sizes.every(w => w <= usable(nav)/n)) break;
      }
      set(nav,{'grid-template-columns':'repeat('+cols+',minmax(0,1fr))'});
    }
    // The refresh icon grows with the same slider; its own tile must grow too.
    const reset = document.querySelector('.company-reset-button');
    if (reset) {
      const s = getComputedStyle(reset), icon = reset.querySelector('svg');
      const needed = (icon?icon.getBoundingClientRect().width:number(s.fontSize)) + 4*unit;
      const size = Math.max(reset.getBoundingClientRect().width,needed);
      set(reset,{'width':px(size),'min-width':px(size),'max-width':px(size),'flex':'0 0 '+px(size),
        'height':px(Math.max(reset.getBoundingClientRect().height,needed))});
    }
  };
  document.fonts?.ready.then(() => window.cdqMobileLayout?.schedule());
})();
