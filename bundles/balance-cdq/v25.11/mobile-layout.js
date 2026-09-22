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
    const g = setting('General'), t = setting('Text'), i = setting('Icon');
    const density = 0.72 + g * 0.0056;
    const top = 16 + i * 0.2, bottom = 17 + i * 0.2, label = 9 + t * 0.06;
    const text = 12 + t * 0.08;
    const height = Math.ceil(Math.max(44 * density, bottom + label * 1.15 + 8 * density, 44));
    const navHeight = 'calc(' + height + 'px + env(safe-area-inset-bottom,0px))';
    Object.entries({bottom, top, quick: top, file: 20 + i * 0.22, action: 12 + i * 0.1})
      .forEach(([name, value]) => root.style.setProperty('--cdq-icon-' + name + '-v2213', px(value)));
    const nav = document.querySelector('.bottom-nav');
    if (nav) {
      if (nav.parentElement !== document.body) document.body.appendChild(nav);
      const count = nav.querySelectorAll(':scope > .bottom-nav-item').length || 1;
      set(nav, {'height': navHeight, 'min-height': navHeight, 'max-height': navHeight,
        'padding': '2px 2px calc(2px + env(safe-area-inset-bottom,0px))', 'gap': '0',
        'grid-template-columns': 'repeat(' + count + ',minmax(0,1fr))', 'align-items': 'stretch'});
      set(document.body, {'padding-bottom': navHeight});
    }
    each('.bottom-nav > .bottom-nav-item', {'height': '100%', 'min-height': '0', 'max-height': 'none',
      'padding': px(2 * density) + ' 0', 'gap': px(2 * density), 'justify-content': 'center',
      'min-width': '0', 'width': '100%', 'box-sizing': 'border-box'});
    icon('.bottom-nav > .bottom-nav-item > span, .bottom-nav > .bottom-nav-item > span svg', bottom);
    each('.bottom-nav > .bottom-nav-item small', {'font-size': px(label), 'line-height': '1.15',
      'padding': '0', 'margin': '0', 'max-width': '100%', 'white-space': 'nowrap'});
    const buttonHeight = Math.ceil(Math.max(44, 49 * density, top + label * 1.2 + 10));
    each('#cdqTopActionsV2204 > .cdq-top-action, .quick-button', {'min-height': px(buttonHeight),
      'height': 'auto', 'padding': px(4 * density) + ' 2px', 'gap': px(3 * density)});
    icon('#cdqTopActionsV2204 > .cdq-top-action > svg, #cdqTopActionsV2204 > .cdq-top-action > span:first-child:not(:last-child), .quick-icon, .quick-icon svg', top);
    each('#cdqTopActionsV2204 > .cdq-top-action > span:last-child, .quick-name', {'font-size': px(label),
      'line-height': '1.15', 'white-space': 'nowrap', 'overflow-wrap': 'normal'});
    icon('.file-icon, .file-icon svg', 20 + i * 0.22);
    each('#createFolderButton', {'font-size': px(top), 'width': px(buttonHeight), 'height': px(buttonHeight),
      'min-height': px(buttonHeight), 'padding': '2px'});
    each('.file-name, .file-name-text, .folder-name, .folder-name-text', {'font-size': px(text), 'line-height': '1.2'});
    each('.file-date', {'font-size': px(10 + t * 0.06), 'line-height': '1.2'});
    each('.file-row, .folder-header', {'min-height': px(Math.max(44, 48 * density)), 'padding-top': px(5 * density), 'padding-bottom': px(5 * density)});
    each('.company-button, .company-reset-button', {'min-height': px(Math.max(44, 48 * density))});
    each('.company-button', {'font-size': px(text)});
    window.cdqMobileDimensions = {density, top, bottom, label, navHeight: height, buttonHeight, text};
  }
  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; apply(); });
  }
  window.cdqMobileLayout = {apply, schedule};
  window.addEventListener('resize', schedule, {passive: true});
  document.addEventListener('input', e => {
    if (e.target.matches('#cdqGeneralScaleRange,#cdqTextScaleRange,#cdqIconScaleRange')) schedule();
  });
  function start() {
    apply();
    // Observe new/replaced icons only. Style writes cannot re-trigger this observer.
    new MutationObserver(records => {
      if (records.some(r => r.addedNodes.length || r.removedNodes.length)) schedule();
    }).observe(document.body, {subtree: true, childList: true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true});
  else start();

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
    const preset = document.createElement('button'); preset.type = 'button'; preset.className = 'cdq-phone-preset';
    preset.textContent = 'Appliquer le format téléphone compact';
    preset.onclick = () => {
      [['General', 25], ['Text', 35], ['Icon', 35]].forEach(([name, value]) => {
        const range = modal.querySelector('#cdq' + name + 'ScaleRange');
        if (range) { range.value = value; range.dispatchEvent(new Event('input', {bubbles: true})); range.dispatchEvent(new Event('change', {bubbles: true})); }
      });
      apply();
    };
    panels.sizes.prepend(preset);
    tabs.firstChild.click();
    modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-label', 'Réglages');
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
