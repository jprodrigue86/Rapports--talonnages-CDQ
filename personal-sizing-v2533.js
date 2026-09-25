/* Personal neutral point: device-local, account-scoped, explicit opt-in.
 * Legacy/account preferences stay untouched. Neither anchors nor positions
 * are sent to Google, Drive, the parent frame or another device. */
(function () {
  'use strict';
  const axes = ['General', 'Text', 'Icon'];
  // Reference chosen from the user's validated right-hand screenshot:
  // the previous rendering at 50 / 71 / 100 becomes the new standard 50 / 50 / 50.
  const standardAnchor = Object.freeze({General:50, Text:71, Icon:100});
  const prefix = 'cdq-personal-sizing-v1:';
  const neutral = () => ({General:50, Text:50, Icon:50});
  const validValue = n => Number.isInteger(n) && n >= 0 && n <= 100;
  const validAxes = value => value && axes.every(axis => validValue(value[axis]));
  const mobile = () => document.documentElement.matches('.android,.ios,.mobile-device') || innerWidth < 900;
  const platform = () => /BalanceCDQAndroid\//i.test(navigator.userAgent) ? 'android' : /iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'iphone' : 'mobile-web';
  function account() {
    try { return typeof utilisateurCourantEmail === 'string' ? utilisateurCourantEmail.trim().toLowerCase() : ''; }
    catch (_) { return ''; }
  }
  function admin() {
    try { return mobile() && utilisateurCourantRole === 'admin' && !!account(); }
    catch (_) { return false; }
  }
  const key = () => prefix + platform() + ':' + account();
  function current() {
    if (!mobile() || !account()) return null;
    try {
      const p = JSON.parse(localStorage.getItem(key()) || 'null');
      return p && (p.schema === 1 || p.schema === 2) && validAxes(p.anchor) && validAxes(p.position) ? p : null;
    } catch (_) { return null; }
  }
  function write(p) {
    if (!account() || !validAxes(p.anchor) || !validAxes(p.position)) throw Error('Calibrage local invalide.');
    const serialized = JSON.stringify(p);
    localStorage.setItem(key(), serialized);
    if (localStorage.getItem(key()) !== serialized) throw Error('Le téléphone ne confirme pas la sauvegarde locale.');
  }
  function legacy(axis) {
    const fn = window['cdq' + axis + 'ValueV89'];
    if (typeof fn !== 'function') throw Error('Les réglages ne sont pas encore prêts.');
    return fn();
  }
  // Apply each existing rendering curve around a visual reference.
  // With no personal calibration, the validated former 50 / 71 / 100 rendering
  // is the new standard 50 / 50 / 50. Existing schema-1 personal calibrations
  // retain their exact old rendering. New schema-2 calibrations capture the
  // current standard slider position as their local reference.
  function factor(axis, fallback, curve) {
    if (!axes.includes(axis)) return curve(fallback);
    const p = current();
    if (p && p.schema === 1) {
      const reference = curve(p.anchor[axis]);
      if (p.position[axis] === 50) return reference;
      return reference * curve(p.position[axis]) / curve(50);
    }
    const baseAnchor = p && p.schema === 2 ? p.anchor[axis] : standardAnchor[axis];
    const position = p && p.schema === 2 ? p.position[axis] : fallback;
    const standardReference = curve(standardAnchor[axis]);
    const capturedReference = standardReference * curve(baseAnchor) / curve(50);
    if (position === 50) return capturedReference;
    return capturedReference * curve(position) / curve(50);
  }
  function render() {
    if (typeof window.cdqApplyAllScalesV89 === 'function') window.cdqApplyAllScalesV89(true);
    window.cdqMobileLayout?.apply();
    updateControls();
  }
  function status(text, error) {
    const el = document.getElementById('cdqPersonalSizingStatus');
    if (el) { el.textContent = text; el.setAttribute('role', error ? 'alert' : 'status'); }
  }
  function updateControls() {
    const p = current();
    const modal = document.getElementById('cdqSettingsModalV2294');
    if (!modal) return;
    if (p) axes.forEach(axis => {
      const range = modal.querySelector('#cdq' + axis + 'ScaleRange');
      const label = modal.querySelector('#cdq' + axis + 'ScaleValue');
      if (range) range.value = String(p.position[axis]);
      if (label) label.textContent = p.position[axis] + ' / 100';
    });
    const preset = modal.querySelector('.cdq-phone-preset');
    if (preset) preset.textContent = p ? 'Mon format — 50 / 50 / 50' : 'Format téléphone — 50 / 50 / 50';
    const activate = modal.querySelector('#cdqPersonalSizingActivate');
    const remove = modal.querySelector('#cdqPersonalSizingRemove');
    if (activate) activate.hidden = !!p;
    if (remove) remove.hidden = !p;
    if (p) status('Point 50 personnel actif sur ce téléphone seulement. Référence d’origine : ' + axes.map(axis => p.anchor[axis]).join(' / ') + '.');
  }
  function activate() {
    if (!admin()) throw Error('Ouvre les réglages avec ton compte administrateur sur ce téléphone.');
    if (current()) return;
    const owner = account();
    const anchor = Object.fromEntries(axes.map(axis => [axis, legacy(axis)]));
    if (!validAxes(anchor)) throw Error('Les tailles actuelles sont invalides.');
    if (!window.confirm('Conserver exactement les tailles actuelles (' + axes.map(axis => anchor[axis]).join(' / ') + ') et les afficher comme 50 / 50 / 50 ?\n\nCe calibrage reste uniquement sur ce téléphone et pour ton compte. Aucun autre appareil ne sera modifié.')) return;
    if (account() !== owner || !admin()) throw Error('Le compte a changé. Rouvre les réglages.');
    write({schema:2, anchor, position:neutral()});
    render();
  }
  function reset() {
    const p = current();
    if (!p) return;
    write({...p, position:neutral()});
    render();
  }
  function remove() {
    const p = current();
    if (!p || !window.confirm('Retirer le point 50 personnel de ce téléphone ? Les curseurs et les tailles reprendront les réglages habituels du compte.')) return;
    localStorage.removeItem(key());
    render();
    axes.forEach(axis => {
      const value = legacy(axis), range = document.getElementById('cdq' + axis + 'ScaleRange'), label = document.getElementById('cdq' + axis + 'ScaleValue');
      if (range) range.value = String(value);
      if (label) label.textContent = value + ' / 100';
    });
    status('Calibrage retiré de ce téléphone. Les réglages partagés n’ont pas été modifiés.');
  }
  function safely(fn) { try { fn(); } catch (e) { status('Non enregistré : ' + (e.message || String(e)), true); } }
  function mount(panel) {
    if (!panel || (!admin() && !current())) return;
    if (!panel.querySelector('#cdqPersonalSizingCard')) {
      const card = document.createElement('div'); card.id = 'cdqPersonalSizingCard'; card.className = 'cdq-display-group';
      const title = document.createElement('div'); title.className = 'cdq-display-label'; title.textContent = 'Mon point 50 — ce téléphone uniquement';
      const text = document.createElement('p'); text.id = 'cdqPersonalSizingStatus'; text.setAttribute('role','status');
      text.textContent = 'Conserve les tailles que tu vois, mais place les trois curseurs à 50. Ce choix ne sera pas synchronisé avec tes autres appareils.';
      const make = (id, label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.id = id; b.textContent = label; b.style.cssText = 'width:100%;white-space:normal;padding:12px;margin-top:8px;min-height:44px'; b.onclick = () => safely(fn); return b; };
      card.append(title, text, make('cdqPersonalSizingActivate', 'Garder ces tailles comme mon 50 / 50 / 50', activate), make('cdqPersonalSizingRemove', 'Retirer mon calibrage local', remove));
      panel.insertBefore(card, panel.querySelector('.cdq-phone-preset')?.nextSibling || panel.firstChild);
    }
    updateControls();
  }
  // Capture before legacy handlers: personal edits must never enter account sync.
  function intercept(e) {
    const p = current();
    if (!p) return;
    if (e.type === 'click') {
      if (!e.target.closest?.('.cdq-phone-preset,#cdqUiScaleResetAll')) return;
      e.preventDefault(); e.stopImmediatePropagation(); safely(reset); return;
    }
    const match = String(e.target.id || '').match(/^cdq(General|Text|Icon)ScaleRange$/);
    if (!match) return;
    e.stopImmediatePropagation();
    // Keep native focus/drag/keyboard defaults; only stop legacy persistence.
    if (!['input','change','pointerup','touchend','keyup'].includes(e.type)) return;
    const axis = match[1], value = Number(e.target.value);
    if (!validValue(value) || value === p.position[axis]) return;
    safely(() => { write({...p, position:{...p.position, [axis]:value}}); render(); });
  }
  ['click','pointerdown','touchstart','input','change','pointerup','touchend','keyup'].forEach(type => window.addEventListener(type, intercept, {capture:true}));
  window.addEventListener('storage', e => { if (e.key?.startsWith(prefix)) render(); });
  window.cdqPersonalSizing = Object.freeze({factor, mount, current, reset, refreshControls:updateControls, standardAnchor});
})();
