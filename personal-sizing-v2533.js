/* Personal neutral point: device-local, account-scoped, explicit opt-in.
 * Legacy/account preferences stay untouched. Neither anchors nor positions
 * are sent to Google, Drive, the parent frame or another device. */
(function () {
  'use strict';
  const axes = ['General', 'Text', 'Icon'];
  const prefix = 'cdq-personal-sizing-v1:';
  const neutral = () => ({General:50, Text:50, Icon:50});
  // Global phone midpoint requested from the validated visual target:
  // Interface 50 stays unchanged, Text 50 renders like the former 71,
  // and Icons 50 render like the former 100.
  const defaultReferenceV2535 = Object.freeze({General:50, Text:71, Icon:100});
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
      return p && p.schema === 1 && validAxes(p.anchor) && validAxes(p.position) ? p : null;
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
  // Global midpoint 25.35: when no personal profile exists, 50/50/50 is
  // visually the former 50/71/100 target. Movement around 50 keeps the same
  // relative response curve, so the sliders can still shrink or enlarge it.
  function fromReference(axis, position, curve) {
    const reference = curve(defaultReferenceV2535[axis] ?? 50);
    if (position === 50) return reference;
    const middle = curve(50);
    return middle ? reference * curve(position) / middle : reference;
  }
  // Existing personal profiles keep their exact pre-25.35 rendering. New
  // profiles created on 25.35 capture the new midpoint without double scaling.
  function factor(axis, fallback, curve) {
    if (!axes.includes(axis)) return curve(fallback);
    const p = current();
    if (!p) return fromReference(axis, fallback, curve);
    if (p.midpoint2535 && validAxes(p.capturedPosition)) {
      const reference = fromReference(axis, p.capturedPosition[axis], curve);
      if (p.position[axis] === 50) return reference;
      const middle = curve(50);
      return middle ? reference * curve(p.position[axis]) / middle : reference;
    }
    const reference = curve(p.anchor[axis]);
    if (p.position[axis] === 50) return reference;
    return reference * curve(p.position[axis]) / curve(50);
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
    if (p) { const ref=p.midpoint2535&&validAxes(p.capturedPosition)?p.capturedPosition:p.anchor; status('Point 50 personnel actif sur ce téléphone seulement. Référence d’origine : ' + axes.map(axis => ref[axis]).join(' / ') + '.'); }
  }
  function activate() {
    if (!admin()) throw Error('Ouvre les réglages avec ton compte administrateur sur ce téléphone.');
    if (current()) return;
    const owner = account();
    const capturedPosition = Object.fromEntries(axes.map(axis => [axis, legacy(axis)]));
    if (!validAxes(capturedPosition)) throw Error('Les tailles actuelles sont invalides.');
    if (!window.confirm('Conserver exactement les tailles actuelles (' + axes.map(axis => capturedPosition[axis]).join(' / ') + ') et les afficher comme 50 / 50 / 50 ?\n\nCe calibrage reste uniquement sur ce téléphone et pour ton compte. Aucun autre appareil ne sera modifié.')) return;
    if (account() !== owner || !admin()) throw Error('Le compte a changé. Rouvre les réglages.');
    write({schema:1, anchor:{...defaultReferenceV2535}, capturedPosition, midpoint2535:true, position:neutral()});
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
  window.cdqPersonalSizing = Object.freeze({factor, mount, current, reset, refreshControls:updateControls});
})();
