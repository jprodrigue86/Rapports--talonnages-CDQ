/* V25.48 — close the template picker while creating and surface the new PDF immediately.
 * Keeps the accepted V25.46 viewer and the V25.44 integrated progress bar unchanged.
 */
(() => {
  'use strict';
  if (window.cdqCopyRefreshV2548) return;

  const esc = value => (window.CSS && typeof CSS.escape === 'function')
    ? CSS.escape(String(value))
    : String(value).replace(/["\\]/g, '\\$&');

  function findFolder(node, id) {
    if (!node) return null;
    if (String(node.id || '') === String(id || '')) return node;
    for (const child of (node.dossiers || [])) {
      const found = findFolder(child, id);
      if (found) return found;
    }
    return null;
  }

  function inferredName(result) {
    const direct = String(result?.nom || result?.name || '').trim();
    if (direct) return /\.pdf$/i.test(direct) ? direct : direct + '.pdf';
    let label = String(document.getElementById('copyTemplateName')?.textContent || '')
      .replace(/[«»"]/g, '').trim();
    if (!label) label = 'Nouveau rapport';
    return /\.pdf$/i.test(label) ? label : label + '.pdf';
  }

  function fileMeta(result, fallback = {}) {
    return {
      ...fallback,
      ...(result?.meta || result?.fichier || result || {}),
      id: String(result?.id || ''),
      nom: inferredName(result),
      type: 'PDF',
      mimeType: 'application/pdf',
      dateModification: result?.dateModification || result?.modifiedTime || new Date().toISOString(),
      favori: !!(result?.favori || result?.starred),
      notePresente: !!result?.notePresente,
      photoPresente: !!result?.photoPresente,
      _cdqConfirmedAt2530: Date.now()
    };
  }

  function visibleHost(clientId, parentId) {
    if (String(typeof compagnieSelectionnee === 'undefined' ? '' : compagnieSelectionnee) !== String(clientId)) return null;
    const rootHost = document.getElementById('filesContainer');
    if (String(parentId) === String(clientId)) return rootHost;

    const folder = document.querySelector('.folder[data-folder-id="' + esc(parentId) + '"]');
    if (!folder || !folder.classList.contains('open')) return null;
    return folder.querySelector(':scope > .folder-content');
  }

  function removeExistingVisibleRow(id) {
    for (const checkbox of document.querySelectorAll('.file-checkbox')) {
      if (String(checkbox.dataset.fileId || '') !== String(id)) continue;
      checkbox.closest('.file-row')?.remove();
    }
  }

  function paintVisible(meta, clientId, parentId) {
    const host = visibleHost(clientId, parentId);
    if (!host || typeof creerLigneFichier !== 'function') return false;
    removeExistingVisibleRow(meta.id);
    const row = creerLigneFichier(meta);
    host.prepend(row);
    try { cdqEnhanceMobileFolders?.(); } catch (_) {}
    try { appliquerFiltresFichiers?.(); } catch (_) {}
    try { mettreAJourInterface?.(); } catch (_) {}
    try { cdqSchedulePhotoPresenceRefresh?.(); } catch (_) {}
    return true;
  }

  function inject(result, clientId, parentId, fallback = {}) {
    const id = String(result?.id || '');
    clientId = String(clientId || '');
    parentId = String(parentId || clientId);
    if (!id || !clientId || typeof cacheContenuCompagnies === 'undefined') return false;

    const root = cacheContenuCompagnies[clientId];
    if (!root) return false;
    const parent = findFolder(root, parentId) || (String(root.id || '') === clientId ? root : null);
    if (!parent) return false;

    const meta = fileMeta(result, fallback);
    parent.fichiers ||= [];
    const existing = parent.fichiers.findIndex(f => String(f.id || '') === id);
    if (existing >= 0) parent.fichiers[existing] = { ...parent.fichiers[existing], ...meta };
    else parent.fichiers.unshift(meta);

    try { window.cdqInstantFiles2530?.keep?.(clientId, meta, parent.id); } catch (_) {}
    try {
      sauvegarderCachePersistantClient(
        clientId,
        root,
        (typeof cacheDerniereVerificationCompagnies !== 'undefined' && cacheDerniereVerificationCompagnies[clientId]) || Date.now()
      );
    } catch (_) {}

    return paintVisible(meta, clientId, parent.id);
  }

  // Keep the V25.30 receipt/reconciliation behavior, but avoid a full client-tree
  // redraw for the immediate confirmation. The new row is painted directly.
  if (window.cdqInstantFiles2530 && typeof window.cdqInstantFiles2530.confirm === 'function') {
    const previousConfirm = window.cdqInstantFiles2530.confirm.bind(window.cdqInstantFiles2530);
    window.cdqInstantFiles2530.confirm = function(result, clientId, parentId, fallback = {}) {
      const selected = String(typeof compagnieSelectionnee === 'undefined' ? '' : compagnieSelectionnee) === String(clientId || '');
      const savedLexical = typeof afficherContenu === 'function' ? afficherContenu : null;
      const savedWindow = window.afficherContenu;
      let confirmed = false;

      try {
        if (selected && savedLexical) {
          afficherContenu = function() {};
          window.afficherContenu = afficherContenu;
        }
        confirmed = !!previousConfirm(result, clientId, parentId, fallback);
      } finally {
        if (selected && savedLexical) {
          afficherContenu = savedLexical;
          window.afficherContenu = savedWindow || savedLexical;
        }
      }

      const painted = inject(result, clientId, parentId, fallback);
      if (selected && !painted && savedLexical && typeof cacheContenuCompagnies !== 'undefined') {
        const root = cacheContenuCompagnies[String(clientId || '')];
        if (root) savedLexical(root);
      }
      return confirmed || painted;
    };
  }

  // The existing V25.44 progress wrapper already starts the integrated bar.
  // Once the original function passes validation it sets cdqCopieEnCours=true;
  // hide only then. On validation/server failure the modal is restored.
  if (typeof confirmerCopie === 'function') {
    const previousCopy = confirmerCopie;
    confirmerCopie = async function() {
      const overlay = document.getElementById('copyModalOverlay');
      const status = document.getElementById('copyModalStatus');
      const promise = previousCopy.apply(this, arguments);

      if (typeof cdqCopieEnCours !== 'undefined' && cdqCopieEnCours && overlay) {
        overlay.style.display = 'none';
      }

      const result = await promise;
      if (overlay && status?.classList.contains('error')) {
        overlay.style.display = 'flex';
      }
      return result;
    };
    window.confirmerCopie = confirmerCopie;
  }

  window.cdqCopyRefreshV2548 = { inject, version: '25.48' };
})();
