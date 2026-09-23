
(function () {
  'use strict';
  // All document entry points share the preferences shown in Settings.
  function account() {
    try { return String(localStorage.getItem('cdqDefaultGoogleAccountV2294') || '').trim().toLowerCase(); }
    catch (_) { return ''; }
  }
  function reader() {
    let value = 'ask';
    try { value = localStorage.getItem('cdqPdfReaderPreferenceV1') || 'ask'; } catch (_) {}
    return ['ask', 'cdq', 'ilovepdf', 'acrobat'].includes(value) ? value : 'ask';
  }
  function meta(id) {
    const box = document.querySelector('.file-checkbox[data-file-id="' + id + '"]');
    const row = box && box.closest('.file-row');
    if (row) return {name: row.dataset.fileName || '', type: row.dataset.fileType || '', modified: row.dataset.fileDate || ''};
    try {
      const m = typeof cdqDocumentMeta === 'function' ? cdqDocumentMeta(id) : null;
      if (m) return {name: m.nom || m.name || '', type: m.type || '', modified: m.dateModification || ''};
    } catch (_) {}
    return {};
  }
  function kind(m) {
    const type = String(m.type || '').toUpperCase();
    if (type === 'PDF' || /\.pdf$/i.test(m.name || '')) return 'pdf';
    if (type.includes('SHEET')) return 'sheet';
    if (type === 'TEXT' || type === 'TXT' || type === 'TEXT/PLAIN' || /\.txt$/i.test(m.name || '')) return 'note';
    return '';
  }
  function native() { return /BalanceCDQAndroid\/\d+(?:\.\d+)?/i.test(navigator.userAgent || ''); }
  let lastOpen = {id: '', at: 0};
  function open(id, requestedKind, readerOverride) {
    id = String(id || '');
    if (!/^[A-Za-z0-9_-]{10,200}$/.test(id)) return false;
    const m = meta(id), type = requestedKind || kind(m);
    if (!type || !native()) return false;
    // Keep an explicitly selected CDQ reader on its established internal route.
    const selectedReader=readerOverride||reader();
    if(type==='pdf'&&(selectedReader==='cdq'||selectedReader==='ask')){
      window.cdqOpenPdfV2520(id,m).catch(afficherErreur);return true;
    }
    if (lastOpen.id === id && Date.now() - lastOpen.at < 800) return true;
    lastOpen = {id: id, at: Date.now()};
    try {
      if (typeof utilisateurCourantRole !== 'undefined' && utilisateurCourantRole !== 'lecture') {
        fichierOuvertPourModification = id;
        sessionStorage.setItem('fichierEnModification', id);
        sessionStorage.setItem('ancienneDateModification', m.modified || '');
        sessionStorage.setItem('momentModification', String(Date.now()));
      }
    } catch (_) {}
    const email = account();
    const query = new URLSearchParams({
      fileId: id,
      name: String(m.name || (type === 'note' ? 'Note.txt' : 'Rapport.pdf')).slice(0, 180),
      account: email,
      accountMode: email ? 'default' : 'ask',
      reader: type === 'pdf' ? selectedReader : 'system',
      readOnly: typeof utilisateurCourantRole !== 'undefined' && utilisateurCourantRole === 'lecture' ? '1' : '0'
    });
    // No browser fallback: a failed native handoff must not open a Drive viewer.
    const a = document.createElement('a');
    a.href = 'intent://open?' + query.toString() + '#Intent;scheme=cdq' + type + ';package=ca.balancecdq.android;end';
    a.target = '_top';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  }
  const legacy = window.modifierFichier;
  window.modifierFichier = function (id) {
    if (open(id)) return true;
    return typeof legacy === 'function' ? legacy.apply(this, arguments) : false;
  };
  try { modifierFichier = window.modifierFichier; } catch (_) {}

  // Buttons and offline lists can call these functions without clicking a row.
  // Preserve their Promise contract and the explicit internal-reader route.
  ['cdqOpenPdf', 'cdqV24OpenPdf', 'cdqOuvrirPdfCommeSheetV2275', 'cdqV19OpenOfflineSheet'].forEach(function (name) {
    const previous = window[name];
    if (typeof previous !== 'function') return;
    window[name] = function (id) {
      if (open(id, name === 'cdqV19OpenOfflineSheet' ? 'sheet' : 'pdf')) return Promise.resolve(true);
      return previous.apply(this, arguments);
    };
  });

  // The old PDF pointerup interceptor is removed from the package.
  // A click opens a document; a drag/long press continues to select or swipe.
  let pointer = null, suppressUntil = 0;
  document.addEventListener('pointerdown', function (e) {
    if (!e.target.closest || !e.target.closest('.file-row')) return;
    pointer = {id: e.pointerId, x: e.clientX, y: e.clientY, at: Date.now(), moved: false};
  }, true);
  document.addEventListener('pointermove', function (e) {
    if (pointer && pointer.id === e.pointerId && (Math.abs(e.clientX-pointer.x)>16 || Math.abs(e.clientY-pointer.y)>16)) pointer.moved = true;
  }, true);
  document.addEventListener('pointerup', function (e) {
    if (!pointer || pointer.id !== e.pointerId) return;
    const longPress = Math.max(300, Number(localStorage.getItem('cdqLongPressMs')) || 1000);
    if (pointer.moved || Date.now()-pointer.at >= longPress) suppressUntil = Date.now()+700;
    pointer = null;
  }, true);
  document.addEventListener('pointercancel', function () { pointer = null; suppressUntil = Date.now()+700; }, true);
  window.addEventListener('click', function (e) {
    if (!native() || !e.target.closest) return;
    if (e.target.closest('button,a,input,select,textarea,label,.file-actions,[class*="swipe"]')) return;
    const row = e.target.closest('.file-row');
    if (!row) return;
    if (Date.now() < suppressUntil || row.classList.contains('cdq-swiped-left') || row.classList.contains('cdq-swiped-right')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    if (document.body.classList.contains('selection-active') || (typeof modeSelectionFichiers !== 'undefined' && modeSelectionFichiers)) return;
    const box = row.querySelector('.file-checkbox[data-file-id]');
    if (!box || !open(box.dataset.fileId)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);
  window.cdqDocumentOpen = {open: open, account: account, reader: reader, kind: kind};
})();
