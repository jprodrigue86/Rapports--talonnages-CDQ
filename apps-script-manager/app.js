'use strict';

const $ = id => document.getElementById(id);
const LS = localStorage;

const status = $('status');
const topStatus = $('topStatus');
const clientId = $('clientId');
const scriptIdInput = $('scriptIdInput');
const projectSelect = $('projectSelect');
const description = $('description');
const deployment = $('deployment');
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

const S = {
  id: '',
  meta: null,
  files: [],
  draft: new Map(),
  pkg: new Map(),
  sel: '',
  install: null,
};

const esc = s => String(s).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
}[c]));
const key = f => `${f.type}:${String(f.name).toLowerCase()}`;
const clone = x => JSON.parse(JSON.stringify(x || []));
const cid = () => clientId.value.trim();
const sid = () => normalizeScriptId(S.id || scriptIdInput.value || projectSelect.value);
const nlabel = () => new Date().toLocaleString('fr-CA', { hour12: false });

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
    await requestGoogleToken(cid(), true);
    badge('authBadge', 'Google : connecté', 'ok');
    await refreshProjectList();
  } catch (e) {
    badge('authBadge', 'Google : non connecté');
    topstat('Connexion impossible : ' + e.message, 'err');
  }
}

function handleGoogleDisconnect() {
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
    if (projects.some(f => f.id === old)) projectSelect.value = old;
    badge('authBadge', 'Google : connecté', 'ok');
    topstat(`${projects.length} projet(s) trouvé(s).`, 'ok');
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
  stat(`${S.files.length} fichier(s) chargé(s).`, 'ok');
}

async function loadSelectedProject() {
  try {
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

async function importPhoneFiles(fileList) {
  try {
    if (!S.files.length) throw Error('Charge d’abord le projet.');
    const selected = Array.from(fileList || []);
    if (!selected.length) return;

    const entries = [];
    const ignored = [];
    for (const file of selected) {
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
      entries.push({ ...spec, source: text.replace(/\r\n/g, '\n') });
    }

    if (!entries.length) {
      throw Error('Aucun fichier compatible trouvé. Utilise .gs, .html, appsscript.json ou un Package CDQ .txt/.cdq.');
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

    renderFiles();
    if (S.pkg.has(S.sel)) fileEditor.value = S.pkg.get(S.sel).source;
    renderDiff();
    stat(`${entries.length} fichier(s) prêt(s). Vérifie avant d’écrire.`, 'ok');
  } catch (e) {
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
  diffList.innerHTML = list.length ? list.map(x =>
    `<div class="diff-item"><div class="diff-head"><span class="diff-name">${esc(x.entry.displayName || displayNameForFile(x.entry))}</span><span class="diff-kind ${x.base ? 'changed' : 'new'}">${x.base ? 'MODIFIÉ' : 'NOUVEAU'}</span></div><div class="diff-stats">Avant : ${lines(x.base?.source)} lignes • Après : ${lines(x.entry.source)} lignes</div></div>`
  ).join('') : '<div class="empty">Aucune modification préparée.</div>';
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
  S.draft.clear();
  S.pkg.clear();
  packageEditor.value = '';
  packageResult.innerHTML = '';
  renderFiles();
  renderDiff();
  saveSettings();
  stat(`TERMINÉ ✓ ${count} fichier(s) écrit(s) et vérifié(s).`, 'ok');
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

function renderDeployments(all) {
  deployment.innerHTML = '<option value="">— Choisir un déploiement existant —</option>' + all.map(d =>
    `<option value="${esc(d.deploymentId)}">${esc(d.deploymentConfig?.description || d.deploymentId)}${d.deploymentConfig?.versionNumber ? ' • v' + d.deploymentConfig.versionNumber : ''}</option>`
  ).join('');
  const old = LS.getItem('cdqsm_deployment');
  if (all.some(d => d.deploymentId === old)) deployment.value = old;
  else if (all.length === 1) deployment.value = all[0].deploymentId;
}

async function createVersionOnly() {
  if (!S.id) throw Error('Charge d’abord un projet.');
  const v = await createProjectVersion(S.id, description.value.trim(), cid());
  stat('Version ' + v.versionNumber + ' créée.', 'ok');
  return v;
}

async function deployNewVersion() {
  if (!deployment.value) throw Error('Choisis le déploiement existant.');
  const dep = deployment.value;
  const v = await createProjectVersion(S.id, description.value.trim(), cid());
  await updateDeployment(S.id, dep, v.versionNumber, description.value.trim(), cid());
  renderDeployments(await listDeployments(S.id, cid()));
  deployment.value = dep;
  saveSettings();
  stat(`Version ${v.versionNumber} créée et déployée ✓`, 'ok');
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
$('deployVersion').addEventListener('click', () => runAction(deployNewVersion, 'Déploiement…'));
$('writeAndDeploy').addEventListener('click', () => runAction(async () => {
  await writeProjectChanges();
  await deployNewVersion();
}, 'Écriture + déploiement…'));
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

deployment.addEventListener('change', saveSettings);
description.addEventListener('change', saveSettings);
scriptIdInput.addEventListener('change', saveSettings);
clientId.addEventListener('change', saveSettings);
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
  bootSettings();
  renderBackups();
  detectEmbeddedBrowser();
  updateInstallState();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js?v=10').catch(() => {});
  try {
    await prepareGoogleClient(cid());
    $('connect').disabled = false;
    $('connect').textContent = 'Se connecter à Google';
    topstat('Application prête. Touche « Se connecter à Google ».');
  } catch (e) {
    $('connect').disabled = false;
    $('connect').textContent = 'Réessayer Google';
    topstat(e.message, 'err');
  }
})();
