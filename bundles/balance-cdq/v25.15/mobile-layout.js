(function () {
  'use strict';
  const root = document.documentElement;
  const clamp = value => Math.max(0, Math.min(100, Number.isFinite(+value) ? +value : 50));
  const setting = name => {
    const value = localStorage.getItem('cdqUi' + name + 'ScaleV89');
    return value === null ? 50 : clamp(value);
  };
  const px = n => (Math.round(n * 10) / 10) + 'px';
  function set(el, props) {
    if (!el) return;
    Object.entries(props).forEach(([key, value]) => {
      if (el.style.getPropertyValue(key) !== value || el.style.getPropertyPriority(key) !== 'important')
        el.style.setProperty(key, value, 'important');
    });
  }
  function each(selector, props) { document.querySelectorAll(selector).forEach(el => set(el, props)); }
  function icon(selector, size) {
    each(selector, {'width': px(size), 'height': px(size), 'min-width': px(size), 'max-width': px(size),
      'min-height': px(size), 'max-height': px(size), 'font-size': px(size), 'line-height': '1', 'flex-shrink': '0'});
  }
  function apply() {
    if (!root.matches('.android,.ios,.mobile-device') && window.innerWidth > 899) return;
    root.classList.add('cdq-mobile-layout');
    root.classList.toggle('cdq-native-edge', /BalanceCDQAndroid\//i.test(navigator.userAgent));
    const g = setting('General'), t = setting('Text'), i = setting('Icon');
    // Reference photo is 709 px wide: normalize its proportions to a 384 CSS px phone.
    // All three controls meet at this reference, without rewriting saved preferences.
    const reference = Math.min(480, Math.max(280, window.innerWidth)) / 384;
    const around50 = (value, low, high) => value <= 50
      ? low + (1 - low) * value / 50 : 1 + (high - 1) * (value - 50) / 50;
    const density = around50(g, .78, 1.25), unit = reference * density;
    const textScale = around50(t, .78, 1.35), iconScale = around50(i, .65, 1.5);
    const top = 18 * unit * iconScale, bottom = 22 * unit * iconScale;
    const label = 8 * unit * textScale, text = 18.5 * unit * textScale;
    const action = 16 * unit * iconScale;
    const height = Math.max(49 * unit, bottom + label * 1.15 + 10 * unit);
    const navHeight = 'calc(' + px(height) + ' + var(--cdq-safe-bottom))';
    root.style.setProperty('--cdq-phone-reference', String(reference));
    root.style.setProperty('--cdq-nav-height', navHeight);
    Object.entries({bottom, top, quick: top, file:24 * unit * iconScale, action})
      .forEach(([name, value]) => root.style.setProperty('--cdq-icon-' + name + '-v2213', px(value)));
    each('.container', {'zoom':'1', 'width':'calc(100% - '+px(12 * reference)+')',
      'max-width':'calc(100% - '+px(12 * reference)+')', 'margin-left':px(6 * reference),
      'margin-right':px(6 * reference), 'padding-left':'0', 'padding-right':'0'});
    each('.top-bar', {'margin':'0', 'padding':'0', 'gap':'0'});
    const nav = document.querySelector('.bottom-nav');
    if (nav) {
      if (nav.parentElement !== document.body) document.body.appendChild(nav);
      const count = nav.querySelectorAll(':scope > .bottom-nav-item').length || 1;
      set(nav, {'height':navHeight, 'min-height':navHeight, 'max-height':navHeight,
        'padding':px(4 * unit)+' 2px calc('+px(4 * unit)+' + var(--cdq-safe-bottom))',
        'gap':'0', 'z-index':'1000', 'grid-template-columns':'repeat('+count+',minmax(0,1fr))',
        'grid-template-rows':'minmax(0,1fr)', 'align-items':'stretch'});
      set(document.body, {'padding-bottom':navHeight, 'padding-top':'var(--cdq-safe-top)'});
    }
    each('.bottom-nav > .bottom-nav-item', {'height':'100%', 'min-height':'0', 'max-height':'none',
      'padding':px(2 * unit)+' 0', 'gap':px(2 * unit), 'justify-content':'center',
      'min-width':'0', 'width':'100%', 'box-sizing':'border-box', 'overflow':'visible'});
    icon('.bottom-nav > .bottom-nav-item > span, .bottom-nav > .bottom-nav-item > span svg', bottom);
    each('.bottom-nav > .bottom-nav-item > span', {'display':'inline-flex','align-items':'center','justify-content':'center','white-space':'nowrap'});
    const folderIcon = document.getElementById('folderActionIcon');
    if (folderIcon && folderIcon.textContent.trim() === '📁+') {
      set(folderIcon, {'width':px(bottom * 1.5),'min-width':px(bottom * 1.5),'max-width':px(bottom * 1.5),'font-size':px(bottom * .8)});
    }
    each('.bottom-nav > .bottom-nav-item small', {'font-size':px(Math.min(label,(window.innerWidth - 24)/34)),
      'line-height':'1.15','padding':'0','margin':'0','max-width':'100%','white-space':'normal','overflow-wrap':'anywhere','text-overflow':'clip'});
    const topLabel = 8 * unit * textScale;
    const buttonHeight = Math.max(34 * unit, top + 8 * unit, topLabel * 2.25 + 6 * unit);
    each('#cdqTopActionsV2204, .quick-buttons', {'gap':px(4 * unit),'margin-top':'0','margin-bottom':'0'});
    each('.quick-buttons', {'margin-top':px(6 * unit),'margin-bottom':px(7 * unit)});
    each('#cdqTopActionsV2204', {'padding':px(5 * unit),'margin-top':'0','margin-bottom':px(6 * unit)});
    each('#cdqTopActionsV2204 > .cdq-top-action, .quick-button', {'min-height':px(buttonHeight),
      'height':'auto','display':'flex','flex-direction':'row','align-items':'center','justify-content':'center',
      'padding':px(3 * unit)+' '+px(2 * unit),'gap':px(3 * unit),'white-space':'normal'});
    icon('#cdqTopActionsV2204 > .cdq-top-action > svg, #cdqTopActionsV2204 > .cdq-top-action > span:first-child:not(:last-child), .quick-icon, .quick-icon svg', top);
    each('#cdqTopActionsV2204 > .cdq-top-action > span:last-child, .quick-name', {'font-size':px(topLabel),
      'line-height':'1.12','white-space':'normal','overflow-wrap':'normal','word-break':'normal',
      'min-width':'0','width':'auto','flex':'1 1 0','max-width':'100%','text-overflow':'clip','text-align':'center'});
    // Some native quick actions contain only a text node, not a label span.
    each('#cdqTopActionsV2204 > .cdq-top-action', {'font-size':px(7 * unit * textScale),'line-height':'1.12'});
    icon('.file-icon, .file-icon svg', 24 * unit * iconScale);
    each('#createFolderButton', {'font-size':px(top),'width':px(buttonHeight),'height':px(buttonHeight),'min-height':px(buttonHeight),'padding':'2px'});
    each('.file-name, .file-name-text, .folder-name, .folder-name-text', {'font-size':px(text),
      'font-weight':'700','line-height':'1.22','white-space':'normal','overflow-wrap':'anywhere'});
    each('.file-date', {'font-size':px(13.5 * unit * textScale),'line-height':'1.2','margin-top':px(3 * unit)});
    each('.client-info-name', {'font-size':px(15 * unit * textScale),'line-height':'1.2'});
    each('.client-stats', {'font-size':px(12 * unit * textScale),'line-height':'1.2','white-space':'normal','margin-top':px(4 * unit)});
    each('#clientInfoBar', {'padding':px(4 * unit)+' '+px(6 * unit),'margin':'0 0 '+px(5 * unit)});
    each('.file-row, .folder-header', {'min-height':px(54 * unit), 'height':'auto',
      'padding-top':px(5 * unit),'padding-bottom':px(5 * unit),'padding-left':px(10 * unit),'padding-right':px(8 * unit),'gap':px(6 * unit)});
    each('.company-wrapper', {'margin-top':px(7 * unit),'margin-bottom':'0','gap':px(4 * unit)});
    const companyHeight = Math.max(35 * unit, 17 * unit * textScale * 1.2 + 8 * unit);
    each('.company-button, .company-reset-button', {'min-height':px(companyHeight),'height':px(companyHeight),'padding-top':'0','padding-bottom':'0'});
    each('.company-button', {'font-size':px(17 * unit * textScale),'padding-left':px(12 * unit),'padding-right':px(10 * unit)});
    each('.company-reset-button', {'width':px(29 * unit),'min-width':px(29 * unit),'max-width':px(29 * unit),
      'flex':'0 0 '+px(29 * unit),'font-size':px(top),'padding-left':'0','padding-right':'0'});
    icon('.company-reset-button svg', top);
    each('.app-header', {'height':px(55 * unit),'min-height':'0','padding':'0','margin':px(9 * reference)+' 0 0'});
    each('.header-metal-banner', {'height':'100%','width':'100%','object-fit':'contain'});
    each('.cdq-swipe-overlay', {'gap':'4px','padding':'2px 6px'});
    each('.cdq-swipe-action', {'height':px(Math.min(48 * unit, Math.max(36 * unit,action + 12 * unit))),
      'min-height':px(32 * unit),'min-width':px(36 * unit),'max-width':'100%','padding':'2px 6px','border-radius':'8px',
      'font-size':px(action),'line-height':'1.15','white-space':'normal','overflow-wrap':'anywhere','flex':'0 1 auto'});
    each('.cdq-swipe-action.note,.cdq-swipe-action.photo,.cdq-swipe-action.favorite,.cdq-swipe-action.send,.cdq-swipe-action.protect',
      {'font-size':px(11.5 * unit * textScale),'min-width':px(36 * unit)});
    window.cdqMobileDimensions = {reference,density,top,bottom,label,navHeight:height,buttonHeight,text,action};
  }
  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; apply(); });
  }
  window.cdqMobileLayout = {apply, schedule};
  window.addEventListener('resize', schedule, {passive: true});
  if (window.visualViewport) window.visualViewport.addEventListener('resize', schedule, {passive: true});
  document.addEventListener('input', e => {
    if (e.target.matches('#cdqGeneralScaleRange,#cdqTextScaleRange,#cdqIconScaleRange')) schedule();
  });
  function start() {
    apply();
    installSwipeReturn();
    // Observe new/replaced icons only. Style writes cannot re-trigger this observer.
    new MutationObserver(records => {
      if (records.some(r => r.addedNodes.length || r.removedNodes.length)) schedule();
    }).observe(document.body, {subtree: true, childList: true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true});
  else start();

  // Handle a revealed bar before legacy row handlers. A gesture can start on
  // any action button; a plain tap still reaches its existing click handler.
  function installSwipeReturn() {
    let gesture = null, blockedRow = null, blockUntil = 0;
    const isOpen = row => row?.matches('.cdq-swiped-left,.cdq-swiped-right');
    document.addEventListener('pointerdown', e => {
      if (gesture && e.pointerId !== gesture.id) { gesture = null; return; }
      if (!root.classList.contains('cdq-mobile-layout') || root.classList.contains('windows')) return;
      if (e.isPrimary === false || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const row = e.target.closest('.file-row,.folder-header');
      if (!isOpen(row) || (typeof modeSelectionFichiers !== 'undefined' && modeSelectionFichiers)) return;
      blockedRow = null;
      gesture = {row, id:e.pointerId, x:e.clientX, y:e.clientY,
        side:row.classList.contains('cdq-swiped-left') ? -1 : 1};
      e.stopPropagation();
    }, true);
    document.addEventListener('pointermove', e => {
      if (!gesture || gesture.id !== e.pointerId) return;
      const dx = Math.abs(e.clientX - gesture.x), dy = Math.abs(e.clientY - gesture.y);
      if (dx > 10 && dx > dy * 1.2 && e.cancelable) e.preventDefault();
    }, {capture:true, passive:false});
    document.addEventListener('pointerup', e => {
      if (!gesture || gesture.id !== e.pointerId) return;
      const g = gesture; gesture = null;
      const dx = e.clientX - g.x, dy = e.clientY - g.y;
      const threshold = typeof obtenirSeuilGlissement === 'function' ? obtenirSeuilGlissement() : 40;
      const ratio = typeof obtenirRatioGlissement === 'function' ? obtenirRatioGlissement() : 1.2;
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      // A drag must never activate Note, Send, Delete, or the file underneath.
      blockedRow = g.row; blockUntil = Date.now() + 600;
      e.preventDefault(); e.stopPropagation();
      if (Math.abs(dx) >= threshold && Math.abs(dx) > Math.abs(dy) * ratio && Math.sign(dx) !== g.side)
        g.row.classList.remove('cdq-swiped-left', 'cdq-swiped-right');
    }, true);
    document.addEventListener('pointercancel', e => {
      if (gesture?.id === e.pointerId) gesture = null;
    }, true);
    document.addEventListener('click', e => {
      if (blockedRow?.contains(e.target) && Date.now() < blockUntil) {
        e.preventDefault(); e.stopImmediatePropagation();
      }
    }, true);
  }

  window.cdqOrganizeSettings = function (modal) {
    const container = modal.querySelector('.cdq-settings-v2294');
    const accountCard = modal.querySelector('#cdqDefaultGoogleStatusV2294').closest('section');
    const androidCard = modal.querySelector('#cdqAndroidUpdateCardV2315');
    // Build the original controls once per opening, retaining all existing handlers.
    window.ouvrirReglagesAffichage();
    const display = document.getElementById('cdqDisplayModal');
    const groups = Array.from(display.querySelectorAll('.cdq-display-options > .cdq-display-group'));
    display.style.display = 'none';
    document.getElementById('cdqInlineDisplayPanelV2204')?.classList.remove('open');
    container.replaceChildren();
    const tabs = document.createElement('div');
    tabs.className = 'cdq-settings-tabs'; tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Catégories de réglages');
    const panels = {};
    const titles = {sizes: 'Tailles', appearance: 'Apparence', files: 'Fichiers', gestures: 'Gestes', updates: 'Mises à jour', advanced: 'Avancé'};
    Object.entries(titles).forEach(([key, title]) => {
      const tab = document.createElement('button'); tab.type = 'button'; tab.textContent = title;
      tab.id = 'cdq-settings-tab-' + key; tab.setAttribute('role', 'tab'); tab.dataset.settingsTab = key;
      const panel = document.createElement('div'); panel.id = 'cdq-settings-panel-' + key;
      panel.className = 'cdq-settings-panel'; panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', tab.id);
      tab.setAttribute('aria-controls', panel.id);
      tab.onclick = () => {
        tabs.querySelectorAll('button').forEach(b => { b.setAttribute('aria-selected', String(b === tab)); b.tabIndex = b === tab ? 0 : -1; });
        Object.values(panels).forEach(p => { p.hidden = p !== panel; });
        panel.scrollTop = 0;
        if (key === 'updates') panel.querySelector('#cdqCheckUpdateButton')?.click();
      };
      tab.onkeydown = e => {
        const buttons = Array.from(tabs.children), index = buttons.indexOf(tab);
        let next = e.key === 'ArrowRight' ? (index + 1) % buttons.length : e.key === 'ArrowLeft' ? (index + buttons.length - 1) % buttons.length : e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : -1;
        if (next < 0) return; e.preventDefault(); buttons[next].click(); buttons[next].focus();
      };
      tabs.appendChild(tab); panels[key] = panel;
    });
    container.appendChild(tabs);
    Object.values(panels).forEach(p => container.appendChild(p));
    groups.forEach(group => {
      const title = group.querySelector('.cdq-display-label')?.textContent || '';
      const key = /Ajustement/.test(title) ? 'sizes' : /Thème/.test(title) ? 'appearance' : /Lecteur PDF/.test(title) ? 'files' : /Gestes/.test(title) ? 'gestures' : /Mise à jour/.test(title) ? 'updates' : 'advanced';
      panels[key].appendChild(group);
    });
    panels.files.appendChild(accountCard);
    if (androidCard) panels.updates.appendChild(androidCard);
    if (typeof window.cdqOuvrirPartageApplication === 'function') {
      const share = document.createElement('button'); share.type = 'button'; share.id = 'cdqInstallShareSettingsButton';
      share.textContent = 'Installer / partager Balance CDQ'; share.onclick = window.cdqOuvrirPartageApplication;
      panels.advanced.appendChild(share);
    }
    const preset = document.createElement('button'); preset.type = 'button'; preset.className = 'cdq-phone-preset';
    preset.textContent = 'Format téléphone — 50 / 50 / 50';
    preset.onclick = () => {
      [['General', 50], ['Text', 50], ['Icon', 50]].forEach(([name, value]) => {
        const range = modal.querySelector('#cdq' + name + 'ScaleRange');
        if (range) { range.value = value; range.dispatchEvent(new Event('input', {bubbles: true})); range.dispatchEvent(new Event('change', {bubbles: true})); }
      });
      apply();
    };
    panels.sizes.prepend(preset);
    const notes = {
      General: 'À 50, le format est adapté à la largeur du téléphone. Diminue pour compacter ou augmente pour espacer.',
      Text: 'À 50, les textes sont équilibrés. Les noms longs passent à la ligne.',
      Icon: 'À 50, les icônes et leurs boutons sont proportionnés au téléphone.'
    };
    Object.entries(notes).forEach(([name, text]) => {
      const note = modal.querySelector('#cdq' + name + 'ScaleRange')?.closest('.cdq-ui-scale-box')?.querySelector('.cdq-ui-scale-note');
      if (note) note.textContent = text;
    });
    tabs.firstChild.click();
    modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-label', 'Réglages');
    if (!modal.dataset.cdqCategoryNavigation) {
      modal.dataset.cdqCategoryNavigation = '1';
      modal.addEventListener('click', e => {
        if (e.target.closest('#cdqAdminSettingsButton,#cdqDiagnosticSettingsButton,#cdqInstallShareSettingsButton')) modal.style.display = 'none';
      }, true);
      modal.querySelector('#cdqSettingsCloseV2294').onclick = () => {
        modal.style.display = 'none'; document.getElementById('cdqTopDisplayButtonV2204')?.focus();
      };
    }
    modal.onkeydown = e => {
      if (e.key === 'Escape') modal.querySelector('#cdqSettingsCloseV2294').click();
      if (e.key !== 'Tab') return;
      const focusable = Array.from(modal.querySelectorAll('button,input,select,a[href]')).filter(el => el.tabIndex >= 0 && el.getClientRects().length && !el.disabled);
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    requestAnimationFrame(() => tabs.firstChild.focus());
  };
})();
