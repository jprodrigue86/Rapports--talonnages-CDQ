'use strict';

const $ = id => document.getElementById(id);
const LS = localStorage;
const APP_VERSION = 'V16';

const status = $('status');
const topStatus = $('topStatus');
const clientId = $('clientId');
const scriptIdInput = $('scriptIdInput');
const projectSelect = $('projectSelect');
const description = $('description');
const deployment = $('deployment');
const deploymentNotice = $('deploymentNotice');
const backupList = $('backupList');
const projectMeta = $('projectMeta');
const fileTabs = $('fileTabs');
const fileEditor = $('fileEditor');
const packageEditor = $('packageEditor');
const packageResult = $('packageResult');
const diffList = $('diffList');
const confirmText = $('confirmText');
const confirmModal = $('confirmModal');
const browserWarning = $('browserWarning');
const installApp = $('installApp');
const installModal = $('installModal');
const keepConnected = $('keepConnected');
const zipStatus = $('zipStatus');
const zipStatusIcon = $('zipStatusIcon');
const zipStatusTitle = $('zipStatusTitle');
const zipStatusDetail = $('zipStatusDetail');
const zipProgressBar = $('zipProgressBar');
const quickGoogleStatus = $('quickGoogleStatus');
const quickProjectStatus = $('quickProjectStatus');
const quickZipSummary = $('quickZipSummary');
const quickResult = $('quickResult');
const quickConnect = $('quickConnect');
const quickChooseZip = $('quickChooseZip');
const quickApply = $('quickApply');
const toggleAdvanced = $('toggleAdvanced');

const S = {
  id: '',
  meta: null,
  files: [],
  draft: new Map(),
  pkg: new Map(),
  sel: '',
  install: null,
  pendingBuild: '',
  lastWrittenBuild: '',
  lastDeploymentResult: null,
};

const esc = s => String(s).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
}[c]));
const key = f => `${f.type}:${String(f.name).toLowerCase()}`;
const clone = x => JSON.parse(JSON.stringify(x || []));
const cid = () => clientId.value.trim();
const sid = () => normalizeScriptId(S.id || scriptIdInput.value || projectSelect.value);
const nlabel = () => new Date().toLocaleString('fr-CA', { hour12: false });
const AUTO_CONNECT_MS = 7 * 24 * 60 * 60 * 1000;
const AUTO_CONNECT_UNTIL_KEY = 'cdqsm_auto_connect_until';
const KEEP_CONNECTED_KEY = 'cdqsm_keep_connected';
const TOKEN_KEY = 'cdqsm_google_access_token';
const TOKEN_EXPIRES_KEY = 'cdqsm_google_access_token_expires';

function saveLiveGoogleToken() {
  if (!keepConnectionEnabled() || !CDQ.token || !CDQ.expiresAt) return;
  LS.setItem(TOKEN_KEY, CDQ.token);
  LS.setItem(TOKEN_EXPIRES_KEY, String(CDQ.expiresAt));
}

function clearSavedGoogleToken() {
  LS.removeItem(TOKEN_KEY);
  LS.removeItem(TOKEN_EXPIRES_KEY);
}

function restoreSavedGoogleToken() {
  if (!keepConnectionEnabled()) return false;
  const token = LS.getItem(TOKEN_KEY) || '';
  const expiresAt = Number(LS.getItem(TOKEN_EXPIRES_KEY) || 0);
  if (!token || !Number.isFinite(expiresAt) || expiresAt <= Date.now() + 60000) {
    clearSavedGoogleToken();
    return false;
  }
  CDQ.token = token;
  CDQ.expiresAt = expiresAt;
  return true;
}

function keepConnectionEnabled() {
  return keepConnected ? keepConnected.checked : true;
}

function rememberConnection() {
  LS.setItem(KEEP_CONNECTED_KEY, keepConnectionEnabled() ? '1' : '0');
  if (keepConnectionEnabled()) {
    LS.setItem(AUTO_CONNECT_UNTIL_KEY, String(Date.now() + AUTO_CONNECT_MS));
  } else {
    LS.removeItem(AUTO_CONNECT_UNTIL_KEY);
  }
}

function clearRememberedConnection() {
  LS.removeItem(AUTO_CONNECT_UNTIL_KEY);
}

function shouldAutoReconnect() {
  if (!keepConnectionEnabled()) return false;
  const until = Number(LS.getItem(AUTO_CONNECT_UNTIL_KEY) || 0);
  return Number.isFinite(until) && until > Date.now();
}

function detectBuildLabel(files) {
  const texts = (files || []).map(f => String(f.source || '')).join('\n');
  const matches = texts.match(/(?:20\d{2}\.\d{2}\.\d{2}(?:\.\d+)?-)?v\d+\.\d+(?:-[A-Za-z0-9._-]+)?/gi) || [];
  if (!matches.length) return '';
  return matches.sort((a,b) => b.length - a.length)[0];
}

function setQuickResult(text, kind = '') {
  if (!quickResult) return;
  quickResult.textContent = text;
  quickResult.className = `quick-result ${kind}`.trim();
}

function updateQuickUi() {
  if (quickGoogleStatus) {
    const connected = hasLiveToken();
    quickGoogleStatus.textContent = connected ? 'Connecté' : 'Non connecté';
    quickGoogleStatus.className = connected ? 'ok' : '';
  }
  if (quickProjectStatus) {
    quickProjectStatus.textContent = S.meta?.title || (sid() ? 'Projet mémorisé' : 'Non lié');
    quickProjectStatus.className = S.id ? 'ok' : (sid() ? 'warn' : '');
  }
  if (quickZipSummary) {
    const pending = pendingChangeCount();
    quickZipSummary.textContent = pending
      ? `${pending} modification(s)${S.pendingBuild ? ' • ' + S.pendingBuild : ''}`
      : 'Aucun fichier';
    quickZipSummary.className = pending ? 'ok' : '';
  }
  if (quickConnect) quickConnect.hidden = hasLiveToken();
  if (quickChooseZip) quickChooseZip.disabled = !S.id;
  if (quickApply) quickApply.disabled = !(S.id && pendingChangeCount() > 0);
}

function stat(text, kind = '') {
  status.textContent = text;
  status.className = `status bottom-status ${kind}`.trim();
}

function topstat(text, kind = '') {
  topStatus.textContent = text;
  topStatus.className = `status ${kind}`.trim();
}

function badge(id, text, kind = '') {
  const el = $(id);
  el.textContent = text;
  el.className = `badge ${kind}`.trim();
}

function saveSettings() {
  LS.setItem('cdqsm_client_id', cid());
  LS.setItem('cdqsm_script_id', sid());
  LS.setItem('cdqsm_description', description.value);
  LS.setItem('cdqsm_deployment', deployment.value);
}

function bootSettings() {
  clientId.value = LS.getItem('cdqsm_client_id') || clientId.value;
  scriptIdInput.value = LS.getItem('cdqsm_script_id') || '';
  description.value = LS.getItem('cdqsm_description') || `Mise à jour CDQ - ${nlabel()}`;
  if (keepConnected) {
    keepConnected.checked = LS.getItem(KEEP_CONNECTED_KEY) !== '0';
  }
}

function backups() {
  try { return JSON.parse(LS.getItem('cdqsm_backups') || '[]'); }
  catch { return []; }
}

function saveBackup(id, content, label = 'Sauvegarde automatique') {
  const all = backups();
  all.unshift({ date: new Date().toISOString(), scriptId: id, label, content });
  LS.setItem('cdqsm_backups', JSON.stringify(all.slice(0, 12)));
  renderBackups();
}

function renderBackups() {
  const all = backups();
  backupList.innerHTML = all.length
    ? all.map((b, i) => `<div class="backup-item"><div><b>${esc(b.label)}</b><span>${esc(new Date(b.date).toLocaleString('fr-CA', { hour12: false }))} • ${esc(b.scriptId)}</span></div><button data-r="${i}">Restaurer</button></div>`).join('')
    : '<div class="empty">Aucune sauvegarde locale.</div>';
  backupList.querySelectorAll('[data-r]').forEach(btn => {
    btn.onclick = () => restoreBackup(Number(btn.dataset.r));
  });
}

async function restoreBackup(index) {
  const backup = backups()[index];
  if (!backup || !confirm('Restaurer cette sauvegarde ?')) return;
  try {
    const current = await getProjectContent(backup.scriptId, cid());
    saveBackup(backup.scriptId, current, 'Avant restauration');
    await updateProjectContent(backup.scriptId, backup.content.files, cid());
    scriptIdInput.value = backup.scriptId;
    await readProject(backup.scriptId, false);
    stat('Sauvegarde restaurée ✓', 'ok');
  } catch (e) {
    stat('Échec : ' + e.message, 'err');
  }
}

async function handleGoogleConnect() {
  try {
    topstat('Ouverture de Google…');
    await requestGoogleToken(cid(), 'manual');
    rememberConnection();
    saveLiveGoogleToken();
    badge('authBadge', 'Google : connecté', 'ok');
    updateQuickUi();
    await refreshProjectList();
  } catch (e) {
    badge('authBadge', 'Google : non connecté');
    topstat('Connexion impossible : ' + e.message, 'err');
  }
}

function handleGoogleDisconnect() {
  clearRememberedConnection();
  clearSavedGoogleToken();
  revokeGoogleToken();
  badge('authBadge', 'Google : non connecté');
  topstat('Session Google déconnectée.');
}

async function refreshProjectList() {
  try {
    topstat('Lecture des projets Apps Script…');
    const data = await listAppsScriptProjects(cid());
    const projects = data.files || [];
    projectSelect.innerHTML = '<option value="">— Choisir un projet —</option>' + projects.map(f =>
      `<option value="${esc(f.id)}">${esc(f.name || 'Sans titre')} • ${esc(new Date(f.modifiedTime).toLocaleString('fr-CA', { hour12: false }))}</option>`
    ).join('');
    const old = normalizeScriptId(LS.getItem('cdqsm_script_id') || '');
    if (projects.some(f => f.id === old)) {
      projectSelect.value = old;
    } else if (projects.length === 1) {
      projectSelect.value = projects[0].id;
      scriptIdInput.value = projects[0].id;
      LS.setItem('cdqsm_script_id', projects[0].id);
    }
    badge('authBadge', 'Google : connecté', 'ok');
    if (keepConnectionEnabled()) {
      rememberConnection();
      saveLiveGoogleToken();
    }
    topstat(`${projects.length} projet(s) trouvé(s).`, 'ok');
    updateQuickUi();

    const autoId = projectSelect.value || normalizeScriptId(LS.getItem('cdqsm_script_id') || '');
    if (autoId && S.id !== autoId) {
      try {
        await readProject(autoId, true);
        setQuickResult('Google connecté et projet lié automatiquement. Choisis maintenant ton ZIP.', 'ok');
      } catch (projectError) {
        setQuickResult('Projet trouvé, mais lecture impossible : ' + projectError.message, 'err');
      }
    }
  } catch (e) {
    topstat('Impossible de charger les projets : ' + e.message, 'err');
  }
}

async function readProject(id, save = true) {
  id = normalizeScriptId(id);
  if (!id) throw Error('Choisis un projet ou colle son Script ID.');
  stat('Lecture du projet…');
  const [meta, content, deps] = await Promise.all([
    getProjectMetadata(id, cid()),
    getProjectContent(id, cid()),
    listDeployments(id, cid()).catch(() => []),
  ]);
  S.id = id;
  S.meta = meta;
  S.files = clone(content.files);
  S.draft.clear();
  S.pkg.clear();
  S.sel = '';
  scriptIdInput.value = id;
  if (save) LS.setItem('cdqsm_script_id', id);
  projectMeta.innerHTML = `<b>${esc(meta.title || 'Projet Apps Script')}</b><br>Script ID : <code>${esc(id)}</code>`;
  badge('projectBadge', 'Projet : ' + (meta.title || 'chargé'), 'ok');
  renderFiles();
  renderDiff();
  renderDeployments(deps);
  updateQuickUi();
  stat(`${S.files.length} fichier(s) chargé(s).`, 'ok');
}

async function loadSelectedProject() {
  try {
    const pending = pendingChangeCount();
    if (pending > 0) {
      const ok = confirm(`Tu as ${pending} modification(s) non écrite(s). Relire le projet va les effacer. Continuer quand même ?`);
      if (!ok) {
        stat('Lecture annulée : tes modifications sont conservées.', 'warn');
        return;
      }
    }
    await readProject(projectSelect.value || scriptIdInput.value);
  } catch (e) {
    stat('Échec : ' + e.message, 'err');
  }
}

const baseFile = () => S.files.find(f => key(f) === S.sel);

function sourceOf(f) {
  const k = key(f);
  return S.draft.get(k)?.source ?? S.pkg.get(k)?.source ?? f.source ?? '';
}

function renderFiles() {
  if (!S.files.length) {
    fileTabs.innerHTML = '<span class="empty">Charge un projet pour voir ses fichiers.</span>';
    fileEditor.value = '';
    return;
  }
  const changed = new Set([...S.draft.keys(), ...S.pkg.keys()]);
  fileTabs.innerHTML = S.files.map(f =>
    `<button class="file-tab ${S.sel === key(f) ? 'active' : ''} ${changed.has(key(f)) ? 'changed' : ''}" data-k="${esc(key(f))}">${esc(displayNameForFile(f))}</button>`
  ).join('');
  fileTabs.querySelectorAll('[data-k]').forEach(btn => {
    btn.onclick = () => selectFile(btn.dataset.k);
  });
  if (!S.sel) selectFile(key(S.files[0]));
  else {
    const f = baseFile();
    if (f) fileEditor.value = sourceOf(f);
  }
}

function selectFile(k) {
  S.sel = k;
  const f = baseFile();
  fileEditor.value = f ? sourceOf(f) : '';
  renderFiles();
}

function draftCurrent() {
  const f = baseFile();
  if (!f) return;
  const k = key(f);
  const src = fileEditor.value;
  if (src === (f.source || '')) S.draft.delete(k);
  else S.draft.set(k, { name: f.name, type: f.type, source: src, displayName: displayNameForFile(f) });
  renderFiles();
  renderDiff();
}

function revertCurrentFile() {
  const f = baseFile();
  if (!f) return;
  S.draft.delete(key(f));
  S.pkg.delete(key(f));
  fileEditor.value = f.source || '';
  renderFiles();
  renderDiff();
}

function parsePackage(text) {
  const source = String(text || '').replace(/\r\n/g, '\n');
  const re = /^\s*===\s*FILE\s*:\s*(.+?)\s*===\s*$/gmi;
  const markers = [...source.matchAll(re)];
  if (!markers.length) throw Error('Aucun marqueur « === FILE: nom.ext === » trouvé.');
  return markers.map((marker, i) => {
    const spec = apiNameFromDisplayName(marker[1].trim());
    const next = i + 1 < markers.length ? markers[i + 1].index : source.length;
    const fileSource = source.slice(marker.index + marker[0].length, next).replace(/^\n/, '').replace(/\n$/, '');
    return { ...spec, displayName: marker[1].trim(), source: fileSource };
  });
}

function preparePackage() {
  try {
    if (!S.files.length) throw Error('Charge d’abord le projet.');
    const files = parsePackage(packageEditor.value);
    S.pkg.clear();
    files.forEach(entry => {
      const k = `${entry.type}:${entry.name.toLowerCase()}`;
      S.draft.delete(k);
      S.pkg.set(k, entry);
    });
    packageResult.innerHTML = `<b>${files.length} fichier(s) préparé(s)</b><br>${files.map(x => esc(x.displayName)).join(' • ')}`;
    renderFiles();
    if (S.pkg.has(S.sel)) fileEditor.value = S.pkg.get(S.sel).source;
    renderDiff();
    stat('Package préparé. Vérifie avant d’écrire.', 'ok');
  } catch (e) {
    packageResult.textContent = e.message;
    stat('Package invalide : ' + e.message, 'err');
  }
}

function importedFileSpec(fileName) {
  let name = String(fileName || '').trim();
  name = name.replace(/\.txt$/i, '');
  if (/^appsscript\.json$/i.test(name)) return { name: 'appsscript', type: 'JSON', displayName: 'appsscript.json' };
  if (/\.gs$/i.test(name)) return { name: name.replace(/\.gs$/i, ''), type: 'SERVER_JS', displayName: name };
  if (/\.html?$/i.test(name)) return { name: name.replace(/\.html?$/i, ''), type: 'HTML', displayName: name.replace(/\.htm$/i, '.html') };
  if (/\.js$/i.test(name)) return { name: name.replace(/\.js$/i, ''), type: 'SERVER_JS', displayName: name.replace(/\.js$/i, '.gs') };
  return null;
}


function fileBaseName(path) {
  return String(path || '').split('/').filter(Boolean).pop() || '';
}

function existingProjectFileByName(name, type) {
  const n = String(name || '').toLowerCase();
  return S.files.find(f => f.type === type && String(f.name || '').toLowerCase() === n);
}

function resolveImportedEntry(entry, counts = {}) {
  const base = fileBaseName(entry.displayName || entry.path || entry.name);
  const spec = importedFileSpec(base);
  if (!spec) return null;

  const exact = existingProjectFileByName(spec.name, spec.type);
  if (exact) {
    return { name: exact.name, type: exact.type, displayName: displayNameForFile(exact), source: entry.source };
  }

  if (spec.type === 'SERVER_JS') {
    const codeTarget = S.files.find(f => f.type === 'SERVER_JS' && /^code$/i.test(f.name));
    if (codeTarget && (/code/i.test(base) || counts.gs === 1)) {
      return { name: codeTarget.name, type: codeTarget.type, displayName: displayNameForFile(codeTarget), source: entry.source };
    }
  }

  if (spec.type === 'HTML') {
    const selectorTarget = S.files.find(f => f.type === 'HTML' && /^(selector|selecteur)$/i.test(f.name));
    if (selectorTarget && (/(selector|selecteur)/i.test(base) || counts.html === 1)) {
      return { name: selectorTarget.name, type: selectorTarget.type, displayName: displayNameForFile(selectorTarget), source: entry.source };
    }
  }

  return { ...spec, source: entry.source };
}


function setZipVisual(state, title, detail, progress = null) {
  if (!zipStatus) return;
  zipStatus.hidden = false;
  zipStatus.className = `zip-status ${state || ''}`.trim();
  zipStatusIcon.textContent =
    state === 'processing' ? '🔄' :
    state === 'success' ? '✅' :
    state === 'error' ? '⚠️' : '📦';
  zipStatusTitle.textContent = title || 'ZIP';
  zipStatusDetail.textContent = detail || '';
  if (progress !== null && zipProgressBar) zipProgressBar.style.width = `${Math.max(0, Math.min(100, progress))}%`;
  else if (zipProgressBar) zipProgressBar.style.width = '';
}

function clearZipVisual() {
  if (!zipStatus) return;
  zipStatus.hidden = true;
  zipStatus.className = 'zip-status';
  if (zipProgressBar) zipProgressBar.style.width = '';
}

async function readZipEntries(file) {
  if (typeof JSZip === 'undefined') throw Error('Le lecteur ZIP n’est pas chargé. Ferme puis rouvre l’application avec Internet.');
  setZipVisual('processing', `ZIP reçu : ${file.name}`, 'Décodage de l’archive… recherche du code GS et du Selector.', 10);
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const raw = [];
  const zipFiles = Object.entries(zip.files);
  setZipVisual('processing', `ZIP ouvert : ${file.name}`, `Analyse de ${zipFiles.length} élément(s)… recherche de Code.gs et Selector.html.`, 35);

  let inspected = 0;
  for (const [path, entry] of zipFiles) {
    inspected++;
    if (inspected % 4 === 0) {
      const pct = 35 + Math.round((inspected / Math.max(1, zipFiles.length)) * 45);
      setZipVisual('processing', `Décodage : ${file.name}`, `Lecture ${inspected}/${zipFiles.length} — recherche du GS et du Selector…`, pct);
      await new Promise(r => setTimeout(r, 0));
    }
    if (entry.dir) continue;
    if (/^__MACOSX\//i.test(path)) continue;
    const base = fileBaseName(path);
    if (!base || /^\./.test(base)) continue;

    const lower = base.toLowerCase();
    if (!(/\.gs$/i.test(base) || /\.html?$/i.test(base) || /^appsscript\.json$/i.test(base) || /\.(txt|cdq)$/i.test(base))) {
      continue;
    }

    const source = (await entry.async('string')).replace(/\r\n/g, '\n');

    if (/\.(txt|cdq)$/i.test(base) && /^\s*===\s*FILE\s*:/mi.test(source)) {
      raw.push(...parsePackage(source).map(x => ({ ...x, path, source: x.source })));
      continue;
    }

    raw.push({ path, displayName: base, source });
  }

  if (!raw.length) {
    setZipVisual('error', `ZIP lu : ${file.name}`, 'Aucun Code.gs, Selector.html, appsscript.json ou Package CDQ compatible trouvé.', 100);
    throw Error('Le ZIP ne contient aucun fichier .gs, .html, appsscript.json ou Package CDQ compatible.');
  }

  const counts = {
    gs: raw.filter(x => /\.gs$/i.test(fileBaseName(x.displayName || x.path))).length,
    html: raw.filter(x => /\.html?$/i.test(fileBaseName(x.displayName || x.path))).length,
  };

  const resolved = raw.map(x => {
    if (x.type && x.name) {
      const exact = existingProjectFileByName(x.name, x.type);
      if (exact) return { ...x, name: exact.name, type: exact.type, displayName: displayNameForFile(exact) };
      return x;
    }
    return resolveImportedEntry(x, counts);
  }).filter(Boolean);

  const dedup = new Map();
  for (const entry of resolved) {
    dedup.set(`${entry.type}:${String(entry.name).toLowerCase()}`, entry);
  }
  const finalEntries = Array.from(dedup.values());
  const labels = finalEntries.map(x => x.displayName || displayNameForFile(x));
  const foundGs = finalEntries.some(x => x.type === 'SERVER_JS');
  const foundHtml = finalEntries.some(x => x.type === 'HTML');
  setZipVisual(
    'success',
    `ZIP décodé ✓ : ${file.name}`,
    `${finalEntries.length} fichier(s) reconnu(s) — ${foundGs ? 'GS trouvé' : 'GS non trouvé'} • ${foundHtml ? 'Selector/HTML trouvé' : 'Selector/HTML non trouvé'}${labels.length ? ' • ' + labels.join(' • ') : ''}`,
    100
  );
  return finalEntries;
}

async function importPhoneFiles(fileList) {
  try {
    if (!S.files.length) throw Error('Charge d’abord le projet.');
    const selected = Array.from(fileList || []);
    if (!selected.length) return;

    const entries = [];
    const ignored = [];
    const hasZip = selected.some(file => /\.zip$/i.test(file.name) || /zip/i.test(file.type || ''));
    if (!hasZip) clearZipVisual();
    for (const file of selected) {
      if (/\.zip$/i.test(file.name) || /zip/i.test(file.type || '')) {
        const zipEntries = await readZipEntries(file);
        entries.push(...zipEntries);
        continue;
      }

      const text = await file.text();
      if (/\.(txt|cdq)$/i.test(file.name) && /^\s*===\s*FILE\s*:/mi.test(text)) {
        entries.push(...parsePackage(text));
        continue;
      }

      const spec = importedFileSpec(file.name);
      if (!spec) {
        ignored.push(file.name);
        continue;
      }

      const resolved = resolveImportedEntry({ ...spec, displayName: file.name, source: text.replace(/\r\n/g, '\n') }, {
        gs: /\.gs$/i.test(file.name) ? 1 : 0,
        html: /\.html?$/i.test(file.name) ? 1 : 0,
      });
      entries.push(resolved || { ...spec, source: text.replace(/\r\n/g, '\n') });
    }

    if (!entries.length) {
      throw Error('Aucun fichier compatible trouvé. Utilise .zip, .gs, .html, appsscript.json ou un Package CDQ .txt/.cdq.');
    }

    S.pkg.clear();
    entries.forEach(entry => {
      const k = `${entry.type}:${entry.name.toLowerCase()}`;
      S.draft.delete(k);
      S.pkg.set(k, entry);
    });

    packageResult.innerHTML =
      `<b>${entries.length} fichier(s) importé(s) du téléphone</b><br>${entries.map(x => esc(x.displayName || displayNameForFile(x))).join(' • ')}` +
      (ignored.length ? `<br><span>Ignoré(s) : ${ignored.map(esc).join(' • ')}</span>` : '');

    S.pendingBuild = detectBuildLabel(entries);
    renderFiles();
    if (S.pkg.has(S.sel)) fileEditor.value = S.pkg.get(S.sel).source;
    renderDiff();
    updateQuickUi();
    setQuickResult(
      `ZIP prêt : ${entries.length} fichier(s) reconnu(s)${S.pendingBuild ? ' • version détectée ' + S.pendingBuild : ''}. Appuie sur « ÉCRIRE + DÉPLOYER ».`,
      'ok'
    );
    stat(`${entries.length} fichier(s) prêt(s). Vérifie avant d’écrire.`, 'ok');
  } catch (e) {
    if (zipStatus && !zipStatus.hidden && !zipStatus.classList.contains('error')) {
      setZipVisual('error', 'Décodage ZIP interrompu', e.message, 100);
    }
    packageResult.textContent = e.message;
    stat('Import impossible : ' + e.message, 'err');
  } finally {
    const input = $('localFiles');
    if (input) input.value = '';
  }
}

function changes() {
  const merged = new Map(S.draft);
  for (const [k, v] of S.pkg) merged.set(k, v);
  return merged;
}

const lines = s => String(s || '').split('\n').length;

function renderDiff() {
  const list = [];
  for (const [k, entry] of changes()) {
    const base = S.files.find(f => key(f) === k);
    if (!base || (base.source || '') !== entry.source) list.push({ entry, base });
  }
  badge('changeBadge', 'Modifications : ' + list.length, list.length ? 'warn' : '');
  if (quickZipSummary) {
    quickZipSummary.textContent = list.length ? `${list.length} modification(s)${S.pendingBuild ? ' • ' + S.pendingBuild : ''}` : 'Aucun fichier';
    quickZipSummary.className = list.length ? 'ok' : '';
  }
  if (quickApply) quickApply.disabled = !(S.id && list.length > 0);
  diffList.innerHTML = list.length ? list.map(x =>
    `<div class="diff-item"><div class="diff-head"><span class="diff-name">${esc(x.entry.displayName || displayNameForFile(x.entry))}</span><span class="diff-kind ${x.base ? 'changed' : 'new'}">${x.base ? 'MODIFIÉ' : 'NOUVEAU'}</span></div><div class="diff-stats">Avant : ${lines(x.base?.source)} lignes • Après : ${lines(x.entry.source)} lignes</div></div>`
  ).join('') : '<div class="empty">Aucune modification préparée.</div>';
}

function pendingChangeCount() {
  let count = 0;
  for (const [k, entry] of changes()) {
    const base = S.files.find(f => key(f) === k);
    if (!base || (base.source || '') !== entry.source) count++;
  }
  return count;
}

function validateChanges() {
  if (!S.id) throw Error('Aucun projet chargé.');
  let count = 0;
  for (const [k, entry] of changes()) {
    const base = S.files.find(f => key(f) === k);
    if (!base || (base.source || '') !== entry.source) count++;
    if (entry.type === 'JSON') JSON.parse(entry.source);
  }
  if (!count) throw Error('Aucune modification à écrire.');
  if (!S.files.some(f => f.type === 'JSON' && f.name === 'appsscript')) {
    throw Error('appsscript.json absent. Écriture bloquée.');
  }
  return count;
}

function buildUpdatedFileSet(freshFiles) {
  const out = clone(freshFiles);
  for (const [, entry] of changes()) {
    const found = out.find(x => x.type === entry.type && String(x.name).toLowerCase() === String(entry.name).toLowerCase());
    if (found) found.source = entry.source;
    else out.push({ name: entry.name, type: entry.type, source: entry.source });
  }
  if (!out.some(f => f.type === 'JSON' && f.name === 'appsscript')) {
    throw Error('appsscript.json absent après modification.');
  }
  return out;
}

async function writeProjectChanges() {
  const count = validateChanges();
  stat('1/4 Relecture depuis Google…');
  const fresh = await getProjectContent(S.id, cid());
  stat('2/4 Sauvegarde complète…');
  saveBackup(S.id, fresh, `Avant écriture (${count} fichier${count > 1 ? 's' : ''})`);
  stat('3/4 Écriture…');
  await updateProjectContent(S.id, buildUpdatedFileSet(fresh.files), cid());
  stat('4/4 Vérification…');
  const checked = await getProjectContent(S.id, cid());
  for (const [k, entry] of changes()) {
    const f = (checked.files || []).find(x => key(x) === k);
    if (!f || f.source !== entry.source) {
      throw Error('Vérification Google échouée pour ' + (entry.displayName || entry.name));
    }
  }
  S.files = clone(checked.files);
  S.lastWrittenBuild = detectBuildLabel(checked.files) || S.pendingBuild || '';
  S.draft.clear();
  S.pkg.clear();
  packageEditor.value = '';
  packageResult.innerHTML = '';
  renderFiles();
  renderDiff();
  saveSettings();
  updateQuickUi();
  stat(`TERMINÉ ✓ ${count} fichier(s) écrit(s) et vérifié(s)${S.lastWrittenBuild ? ' • ' + S.lastWrittenBuild : ''}.`, 'ok');
  return count;
}

function openWriteConfirmation() {
  try {
    const count = validateChanges();
    confirmText.textContent = `Tu vas modifier ${count} fichier(s) dans « ${S.meta?.title || 'ce projet'} ». Une sauvegarde complète sera créée avant. Continuer ?`;
    confirmModal.hidden = false;
  } catch (e) {
    stat(e.message, 'err');
  }
}

function updateDeploymentUi() {
  const target = deployment.value;
  const selected = (CDQ.deployments || []).find(d => d.deploymentId === target);
  const isNew = target === '__new__';

  if (isNew) {
    $('deployVersion').textContent = 'CRÉER UN NOUVEAU DÉPLOIEMENT';
    deploymentNotice.className = 'deployment-notice warn';
    deploymentNotice.innerHTML = '<strong>⚠ Nouvelle URL</strong><span>Ce choix crée un autre déploiement. Les techniciens qui utilisent l’ancienne URL ne basculeront pas automatiquement vers cette nouvelle URL.</span>';
    return;
  }

  if (selected && Number.isInteger(selected.deploymentConfig?.versionNumber)) {
    const v = selected.deploymentConfig.versionNumber;
    $('deployVersion').textContent = 'ÉCRIRE + DÉPLOYER LA MISE À JOUR';
    deploymentNotice.className = 'deployment-notice good';
    deploymentNotice.innerHTML = `<strong>✓ Recommandé — mise à jour du déploiement actuel (v${v})</strong><span>Le Script Manager écrira d’abord le ZIP s’il y a des modifications, créera une nouvelle version, puis mettra ce même déploiement à jour. L’ID et l’URL restent les mêmes pour les techniciens.</span>`;
    return;
  }

  $('deployVersion').textContent = 'ÉCRIRE + DÉPLOYER LA MISE À JOUR';
  deploymentNotice.className = 'deployment-notice';
  deploymentNotice.innerHTML = '<strong>Aucun déploiement versionné sélectionné</strong><span>Choisis un déploiement existant ou crée un nouveau déploiement.</span>';
}

function renderDeployments(all) {
  const versioned = (all || [])
    .filter(d => Number.isInteger(d.deploymentConfig?.versionNumber) && d.deploymentConfig.versionNumber > 0)
    .sort((a,b) => (b.deploymentConfig.versionNumber || 0) - (a.deploymentConfig.versionNumber || 0));
  const readOnly = (all || []).filter(d => !Number.isInteger(d.deploymentConfig?.versionNumber));

  deployment.innerHTML =
    versioned.map((d, i) =>
      `<option value="${esc(d.deploymentId)}">${i === 0 ? '✅ ' : ''}${esc(d.deploymentConfig?.description || 'Déploiement actuel')} • v${d.deploymentConfig.versionNumber}</option>`
    ).join('') +
    '<option value="__new__">⚠ Créer un NOUVEAU déploiement — nouvelle URL</option>' +
    (readOnly.length ? `<option value="" disabled>— ${readOnly.length} HEAD/test ignoré(s) —</option>` : '');

  const old = LS.getItem('cdqsm_deployment');
  if (versioned.some(d => d.deploymentId === old)) {
    deployment.value = old;
  } else if (versioned.length) {
    deployment.value = versioned[0].deploymentId;
  } else {
    deployment.value = '__new__';
  }

  updateDeploymentUi();
}

async function createVersionOnly() {
  if (!S.id) throw Error('Charge d’abord un projet.');
  const pending = pendingChangeCount();
  if (pending > 0) {
    throw Error(`Il reste ${pending} modification(s) non écrite(s). Utilise « ÉCRIRE + DÉPLOYER LA MISE À JOUR » pour ne pas créer une version de l’ancien code.`);
  }
  const v = await createProjectVersion(S.id, description.value.trim(), cid());
  stat('Version ' + v.versionNumber + ' créée à partir du code déjà écrit.', 'ok');
  return v;
}

async function deployNewVersion(targetOverride = null) {
  if (!S.id) throw Error('Charge d’abord un projet.');

  const desc = description.value.trim() || `Mise à jour CDQ - ${nlabel()}`;
  const target = targetOverride || deployment.value || '__new__';
  const v = await createProjectVersion(S.id, desc, cid());

  if (target === '__new__') {
    const created = await createDeployment(S.id, v.versionNumber, desc, cid());
    const all = await listDeployments(S.id, cid());
    renderDeployments(all);
    if (created?.deploymentId && all.some(d => d.deploymentId === created.deploymentId)) deployment.value = created.deploymentId;
    updateDeploymentUi();
    saveSettings();
    stat(`Version ${v.versionNumber} créée + NOUVEAU déploiement créé. Attention : nouvelle URL.`, 'warn');
    return { version: v.versionNumber, deploymentId: created?.deploymentId, createdNew: true };
  }

  const targetDeployment = (CDQ.deployments || []).find(d => d.deploymentId === target);
  if (!Number.isInteger(targetDeployment?.deploymentConfig?.versionNumber)) {
    throw Error('Ce déploiement est en lecture seule. Choisis un déploiement versionné.');
  }

  await updateDeployment(S.id, target, v.versionNumber, desc, cid());
  const all = await listDeployments(S.id, cid());
  const verifiedDeployment = all.find(d => d.deploymentId === target);
  if (!verifiedDeployment || verifiedDeployment.deploymentConfig?.versionNumber !== v.versionNumber) {
    throw Error('Le déploiement n’a pas été confirmé sur la nouvelle version. Aucune réussite n’est affichée.');
  }
  renderDeployments(all);
  if (all.some(d => d.deploymentId === target)) deployment.value = target;
  updateDeploymentUi();
  saveSettings();
  S.lastDeploymentResult = { version: v.versionNumber, deploymentId: target, createdNew: false };
  const sourceBuild = S.lastWrittenBuild || S.pendingBuild || '';
  setQuickResult(
    `MISE À JOUR CONFIRMÉE ✓${sourceBuild ? ' ' + sourceBuild + ' •' : ''} Apps Script version ${v.versionNumber} • déploiement existant confirmé • même URL pour les techniciens.`,
    'ok'
  );
  stat(`MISE À JOUR TERMINÉE ✓ Déploiement actuel conservé • nouvelle version Apps Script v${v.versionNumber} • même ID/URL pour les techniciens.`, 'ok');
  return S.lastDeploymentResult;
}

async function writePendingAndDeploy() {
  if (!S.id) throw Error('Charge d’abord le projet.');
  const target = deployment.value || '__new__';
  const pending = pendingChangeCount();

  if (pending > 0) {
    stat(`Étape 1/2 — écriture de ${pending} modification(s) dans Apps Script…`);
    await writeProjectChanges();
  } else {
    stat('Étape 1/2 — aucune modification en attente. Le code Google est déjà écrit.');
  }

  stat('Étape 2/2 — création de la nouvelle version et mise à jour du déploiement…');
  return deployNewVersion(target);
}

async function runAction(fn, start = '') {
  try {
    if (start) stat(start);
    await fn();
  } catch (e) {
    stat('Échec : ' + e.message, 'err');
  }
}

function detectEmbeddedBrowser() {
  const ua = navigator.userAgent || '';
  const ref = document.referrer || '';
  browserWarning.hidden = !(/Android/i.test(ua) && (/; wv\)|FBAN|FBAV|Instagram/i.test(ua) || /chatgpt|openai/i.test(ref)));
}

function isStandalone() {
  return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

function updateInstallState() {
  installApp.textContent = isStandalone() ? 'Installée' : 'Installer';
  installApp.disabled = isStandalone();
}

async function handleInstallPwa() {
  if (isStandalone()) return;
  if (S.install) {
    S.install.prompt();
    await S.install.userChoice;
    S.install = null;
    updateInstallState();
  } else {
    installModal.hidden = false;
  }
}

if (quickConnect) quickConnect.addEventListener('click', handleGoogleConnect);
if (quickChooseZip) quickChooseZip.addEventListener('click', () => $('localFiles').click());
if (quickApply) quickApply.addEventListener('click', () => runAction(writePendingAndDeploy, 'Mise à jour rapide…'));
if (toggleAdvanced) toggleAdvanced.addEventListener('click', () => {
  document.body.classList.toggle('show-advanced');
  toggleAdvanced.textContent = document.body.classList.contains('show-advanced') ? 'Masquer les options avancées' : 'Options avancées';
});
$('connect').addEventListener('click', handleGoogleConnect);
$('disconnect').addEventListener('click', handleGoogleDisconnect);
$('refreshProjects').addEventListener('click', refreshProjectList);
$('projectSelect').addEventListener('change', () => {
  if (projectSelect.value) scriptIdInput.value = projectSelect.value;
});
$('loadProject').addEventListener('click', loadSelectedProject);
$('openScript').addEventListener('click', () => {
  window.open(sid() ? `https://script.google.com/home/projects/${encodeURIComponent(sid())}/edit` : 'https://script.google.com/home', '_blank');
});

fileEditor.addEventListener('input', draftCurrent);
$('saveDraft').addEventListener('click', () => {
  draftCurrent();
  stat('Brouillon gardé.', 'ok');
});
$('revertFile').addEventListener('click', revertCurrentFile);
$('copyFile').addEventListener('click', () => {
  navigator.clipboard.writeText(fileEditor.value)
    .then(() => stat('Code copié.', 'ok'))
    .catch(() => stat('Copie automatique impossible.', 'warn'));
});

$('browseFiles').addEventListener('click', () => $('localFiles').click());
$('localFiles').addEventListener('change', e => importPhoneFiles(e.target.files));
$('pastePackage').addEventListener('click', () => {
  navigator.clipboard.readText()
    .then(text => {
      packageEditor.value = text;
      stat('Package collé.', 'ok');
    })
    .catch(() => {
      packageEditor.focus();
      stat('Appuie longuement puis colle.', 'warn');
    });
});
$('parsePackage').addEventListener('click', preparePackage);
$('clearPackage').addEventListener('click', () => {
  packageEditor.value = '';
  packageResult.innerHTML = '';
  clearZipVisual();
  S.pendingBuild = '';
  S.pkg.clear();
  renderFiles();
  renderDiff();
});
$('validateChanges').addEventListener('click', () => {
  try {
    stat(`Vérification réussie ✓ ${validateChanges()} fichier(s) prêt(s).`, 'ok');
  } catch (e) {
    stat('Vérification : ' + e.message, 'err');
  }
});
$('writeChanges').addEventListener('click', openWriteConfirmation);
$('cancelWrite').addEventListener('click', () => { confirmModal.hidden = true; });
$('confirmWrite').addEventListener('click', () => {
  confirmModal.hidden = true;
  runAction(writeProjectChanges, 'Écriture…');
});

$('createVersion').addEventListener('click', () => runAction(createVersionOnly, 'Création de version…'));
$('deployVersion').addEventListener('click', () => runAction(writePendingAndDeploy, 'Préparation de la mise à jour…'));
$('backupNow').addEventListener('click', () => runAction(async () => {
  const id = sid();
  if (!id) throw Error('Aucun projet.');
  saveBackup(id, await getProjectContent(id, cid()), 'Sauvegarde manuelle');
  stat('Sauvegarde créée.', 'ok');
}, 'Sauvegarde…'));
$('downloadBackup').addEventListener('click', () => {
  const backup = backups()[0];
  if (!backup) return stat('Aucune sauvegarde.', 'warn');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
  a.download = 'CDQ_AppsScript_Backup.json';
  a.click();
});

deployment.addEventListener('change', () => {
  updateDeploymentUi();
  saveSettings();
});
description.addEventListener('change', saveSettings);
scriptIdInput.addEventListener('change', saveSettings);
clientId.addEventListener('change', saveSettings);
if (keepConnected) {
  keepConnected.addEventListener('change', () => {
    LS.setItem(KEEP_CONNECTED_KEY, keepConnected.checked ? '1' : '0');
    if (keepConnected.checked && hasLiveToken()) rememberConnection();
    if (!keepConnected.checked) {
      clearRememberedConnection();
      clearSavedGoogleToken();
    }
  });
}
installApp.addEventListener('click', handleInstallPwa);
$('closeInstall').addEventListener('click', () => { installModal.hidden = true; });
$('copyUrl').addEventListener('click', () => {
  navigator.clipboard.writeText(location.href)
    .then(() => topstat('Adresse copiée. Ouvre Chrome et colle-la.', 'ok'))
    .catch(() => topstat(location.href, 'warn'));
});

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  S.install = e;
  updateInstallState();
});
window.addEventListener('appinstalled', updateInstallState);

(async () => {
  if ($('versionChip')) $('versionChip').textContent = APP_VERSION;
  if ($('versionBadge')) $('versionBadge').textContent = 'Version : ' + APP_VERSION;
  bootSettings();
  renderBackups();
  detectEmbeddedBrowser();
  updateInstallState();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js?v=16').catch(() => {});
  try {
    await prepareGoogleClient(cid());
    $('connect').disabled = false;
    $('connect').textContent = 'Se connecter à Google';

    if (restoreSavedGoogleToken()) {
      badge('authBadge', 'Google : connecté', 'ok');
      topstat('Session Google restaurée automatiquement.', 'ok');
      updateQuickUi();
      await refreshProjectList();
    } else if (shouldAutoReconnect()) {
      badge('authBadge', 'Google : reconnexion…', 'warn');
      topstat('Reconnexion automatique à Google…');
      try {
        await requestGoogleToken(cid(), 'reuse');
        saveLiveGoogleToken();
        badge('authBadge', 'Google : connecté', 'ok');
        rememberConnection();
        updateQuickUi();
        await refreshProjectList();
      } catch (autoError) {
        badge('authBadge', 'Google : session à renouveler', 'warn');
        updateQuickUi();
        topstat('Google exige une nouvelle autorisation. Touche « Se connecter à Google » une fois.', 'warn');
      }
    } else {
      updateQuickUi();
      topstat('Application prête. Touche « Se connecter à Google ».');
    }
  } catch (e) {
    $('connect').disabled = false;
    $('connect').textContent = 'Réessayer Google';
    topstat(e.message, 'err');
  }
})();
