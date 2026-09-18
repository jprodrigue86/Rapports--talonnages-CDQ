'use strict';

const $ = id => document.getElementById(id);
const LS = localStorage;
const APP_VERSION = 'V22';
const CDQ_PRODUCTION_SCRIPT_ID = '1udMG-jQcBAwBAwk6kSEZ660JWo5n7nVvnq24lp2T4RDV5pfXe8QDlPdf';
const CDQ_PRODUCTION_DEPLOYMENT_ID = 'AKfycbx8NuvklaL-azJBIVyCMKjPk_Hd9z62Q_2-NPl3vqw2kJRpI5wy63J8xkBN5toOFxEw';
const CDQ_PRODUCTION_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbx8NuvklaL-azJBIVyCMKjPk_Hd9z62Q_2-NPl3vqw2kJRpI5wy63J8xkBN5toOFxEw/exec';

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

function parseBuildVersion(label) {
  const s=String(label||'');
  const m=s.match(/v(\d+)\.(\d+)(?:\.(\d+))?/i);
  return m ? [Number(m[1]||0),Number(m[2]||0),Number(m[3]||0)] : [0,0,0];
}
function compareBuildLabels(a,b) {
  const av=parseBuildVersion(a),bv=parseBuildVersion(b);
  for(let i=0;i<3;i++){if(av[i]!==bv[i])return av[i]-bv[i];}
  const ad=(String(a).match(/^(20\d{2}\.\d{2}\.\d{2}(?:\.\d+)?)/)||[])[1]||'';
  const bd=(String(b).match(/^(20\d{2}\.\d{2}\.\d{2}(?:\.\d+)?)/)||[])[1]||'';
  if(ad!==bd)return ad.localeCompare(bd,undefined,{numeric:true});
  return String(a).localeCompare(String(b),undefined,{numeric:true});
}
function detectBuildLabel(files) {
  const texts=(files||[]).map(f=>String(f.source||'')).join('\n');
  const matches=texts.match(/(?:20\d{2}\.\d{2}\.\d{2}(?:\.\d+)?-)?v\d+\.\d+(?:-[A-Za-z0-9._-]+)?/gi)||[];
  if(!matches.length)return '';
  return Array.from(new Set(matches)).sort((a,b)=>compareBuildLabels(b,a))[0];
}
function isProductionProject(id=sid()) {
  return normalizeScriptId(id)===CDQ_PRODUCTION_SCRIPT_ID;
}
function productionDeployment(all=CDQ.deployments||[]) {
  return (all||[]).find(d=>String(d.deploymentId||'')===CDQ_PRODUCTION_DEPLOYMENT_ID)||null;
}
function productionDeploymentReady() {
  return !isProductionProject() || Boolean(productionDeployment());
}
function isAppsScriptOriginV21(origin){
  try{
    const u=new URL(origin);
    const h=u.hostname;
    return u.protocol==='https:' && !u.port &&
      (h==='script.google.com' || h==='script.googleusercontent.com' || h.endsWith('-script.googleusercontent.com'));
  }catch(e){return false;}
}
function knownGoodKeyV22(){return 'cdqsm_known_good_'+CDQ_PRODUCTION_SCRIPT_ID;}
function getKnownGoodV22(){return Number(LS.getItem(knownGoodKeyV22())||0)||0;}
function setKnownGoodV22(v){v=Number(v)||0;if(v>0)LS.setItem(knownGoodKeyV22(),String(v));}
function verifyProductionWebAppReadyV22(expectedBuild='',timeoutMs=30000){
  return new Promise((resolve,reject)=>{
    let finished=false,loaded=false;
    const frame=document.createElement('iframe');
    frame.title='Vérification silencieuse Balance CDQ';
    frame.tabIndex=-1;
    frame.setAttribute('aria-hidden','true');
    frame.style.cssText='position:fixed;left:-12000px;top:0;width:420px;height:800px;opacity:0;pointer-events:none;border:0';
    const cleanup=()=>{
      if(finished)return;
      finished=true;
      clearTimeout(timer);
      window.removeEventListener('message',onMessage);
      try{frame.remove();}catch(e){}
    };
    const fail=msg=>{cleanup();reject(new Error(msg));};
    const onMessage=e=>{
      const d=e.data||{};
      if(!isAppsScriptOriginV21(e.origin))return;
      if(d.type!=='CDQ_SELECTOR_READY' && d.type!=='CDQ_HEALTH_READY')return;
      const build=String(d.build||'');
      if(expectedBuild && build && compareBuildLabels(build,expectedBuild)<0){
        fail('La production répond, mais elle annonce encore '+build+' au lieu de '+expectedBuild+'.');
        return;
      }
      cleanup();
      resolve({build:build||'version non annoncée',signal:d.type,loaded});
    };
    const timer=setTimeout(()=>{
      fail('La version déployée n’a envoyé ni CDQ_HEALTH_READY ni CDQ_SELECTOR_READY dans '+Math.round(timeoutMs/1000)+' secondes.');
    },timeoutMs);
    window.addEventListener('message',onMessage);
    frame.onload=()=>{loaded=true;};
    frame.onerror=()=>fail('La page de production n’a pas pu être chargée.');
    const sep=CDQ_PRODUCTION_WEBAPP_URL.includes('?')?'&':'?';
    frame.src=CDQ_PRODUCTION_WEBAPP_URL+sep+'cdq_sm_health='+Date.now();
    document.body.appendChild(frame);
  });
}
// compatibilité
const verifyProductionWebAppReadyV21=verifyProductionWebAppReadyV22;

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
    const staged = S.pkg.size;
    quickZipSummary.textContent = staged
      ? (pending
          ? `${staged} fichier(s) • ${pending} modification(s)${S.pendingBuild ? ' • ' + S.pendingBuild : ''}`
          : `${staged} fichier(s) • code déjà présent${S.pendingBuild ? ' • ' + S.pendingBuild : ''}`)
      : 'Aucun fichier';
    quickZipSummary.className = staged ? 'ok' : '';
  }
  if (quickConnect) quickConnect.hidden = hasLiveToken();
  if (quickChooseZip) quickChooseZip.disabled = !S.id;
  if (quickApply) {
    const ready=Boolean(S.id && S.pkg.size>0 && productionDeploymentReady());
    quickApply.disabled=!ready;
    if(isProductionProject() && S.id && !productionDeploymentReady()){
      quickApply.title='Déploiement de production Balance CDQ introuvable : mise à jour bloquée.';
    }else quickApply.title='';
  }
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

const BACKUP_DB_NAME = 'cdqsm-backups-v1';
const BACKUP_STORE = 'backups';
const BACKUP_LIMIT = 6;

function openBackupDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB indisponible sur ce navigateur.'));
    const request = indexedDB.open(BACKUP_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BACKUP_STORE)) {
        const store = db.createObjectStore(BACKUP_STORE, { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Impossible d’ouvrir la base de sauvegarde.'));
  });
}

async function backupPut(record) {
  const db = await openBackupDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(BACKUP_STORE, 'readwrite');
      tx.objectStore(BACKUP_STORE).put(record);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Échec d’écriture de la sauvegarde.'));
      tx.onabort = () => reject(tx.error || new Error('Sauvegarde interrompue.'));
    });
  } finally {
    db.close();
  }
}

async function listBackupRecords() {
  const db = await openBackupDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(BACKUP_STORE, 'readonly');
      const req = tx.objectStore(BACKUP_STORE).getAll();
      req.onsuccess = () => resolve((req.result || []).sort((a,b) => String(b.date).localeCompare(String(a.date))));
      req.onerror = () => reject(req.error || new Error('Lecture des sauvegardes impossible.'));
    });
  } finally {
    db.close();
  }
}

async function backupGet(id) {
  const db = await openBackupDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(BACKUP_STORE, 'readonly');
      const req = tx.objectStore(BACKUP_STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error || new Error('Sauvegarde introuvable.'));
    });
  } finally {
    db.close();
  }
}

async function backupDelete(id) {
  const db = await openBackupDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(BACKUP_STORE, 'readwrite');
      tx.objectStore(BACKUP_STORE).delete(id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Suppression de sauvegarde impossible.'));
    });
  } finally {
    db.close();
  }
}

async function pruneBackups() {
  const all = await listBackupRecords();
  for (const old of all.slice(BACKUP_LIMIT)) {
    await backupDelete(old.id);
  }
}

async function migrateLegacyBackups() {
  const raw = LS.getItem('cdqsm_backups');
  if (!raw) return;
  try {
    const legacy = JSON.parse(raw);
    if (Array.isArray(legacy)) {
      for (const b of legacy.slice(0, BACKUP_LIMIT)) {
        if (!b?.content?.files) continue;
        const date = b.date || new Date().toISOString();
        await backupPut({
          id: `legacy-${date}-${b.scriptId || 'project'}-${Math.random().toString(36).slice(2,8)}`,
          date,
          scriptId: b.scriptId || '',
          label: b.label || 'Sauvegarde migrée',
          content: b.content
        });
      }
    }
  } catch {}
  try { LS.removeItem('cdqsm_backups'); } catch {}
  await pruneBackups();
}

async function saveBackup(id, content, label = 'Sauvegarde automatique') {
  const date = new Date().toISOString();
  const record = {
    id: `${date}-${id}-${Math.random().toString(36).slice(2,8)}`,
    date,
    scriptId: id,
    label,
    content
  };
  await backupPut(record);
  await pruneBackups();
  await renderBackups();
  return record;
}

async function renderBackups() {
  try {
    const all = await listBackupRecords();
    backupList.innerHTML = all.length
      ? all.map(b => `<div class="backup-item"><div><b>${esc(b.label)}</b><span>${esc(new Date(b.date).toLocaleString('fr-CA', { hour12: false }))} • ${esc(b.scriptId)}</span></div><button data-r="${esc(b.id)}">Restaurer</button></div>`).join('')
      : '<div class="empty">Aucune sauvegarde locale.</div>';
    backupList.querySelectorAll('[data-r]').forEach(btn => {
      btn.onclick = () => restoreBackup(btn.dataset.r);
    });
  } catch (e) {
    backupList.innerHTML = `<div class="empty">Sauvegardes indisponibles : ${esc(e.message)}</div>`;
  }
}

async function restoreBackup(backupId) {
  const backup = await backupGet(backupId);
  if (!backup || !confirm('Restaurer cette sauvegarde ?')) return;
  try {
    const current = await getProjectContent(backup.scriptId, cid());
    await saveBackup(backup.scriptId, current, 'Avant restauration');
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
    const pendingNow = pendingChangeCount();
    setQuickResult(
      pendingNow > 0
        ? `ZIP prêt : ${entries.length} fichier(s) reconnu(s) • ${pendingNow} modification(s)${S.pendingBuild ? ' • version détectée ' + S.pendingBuild : ''}. Appuie sur « ÉCRIRE + DÉPLOYER ».`
        : `ZIP prêt : ${entries.length} fichier(s) reconnu(s)${S.pendingBuild ? ' • version détectée ' + S.pendingBuild : ''}. Le code est déjà présent dans Apps Script : tu peux quand même appuyer sur « ÉCRIRE + DÉPLOYER » pour créer et publier la nouvelle version.`,
      'ok'
    );
    stat(
      pendingNow > 0
        ? `${entries.length} fichier(s) prêt(s) • ${pendingNow} modification(s) à écrire.`
        : `${entries.length} fichier(s) prêt(s) • code déjà écrit • déploiement disponible.`,
      'ok'
    );
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
    const staged = S.pkg.size;
    quickZipSummary.textContent = staged
      ? (list.length
          ? `${staged} fichier(s) • ${list.length} modification(s)${S.pendingBuild ? ' • ' + S.pendingBuild : ''}`
          : `${staged} fichier(s) • code déjà présent${S.pendingBuild ? ' • ' + S.pendingBuild : ''}`)
      : 'Aucun fichier';
    quickZipSummary.className = staged ? 'ok' : '';
  }
  if(quickApply){
    const ready=Boolean(S.id&&S.pkg.size>0&&productionDeploymentReady());
    quickApply.disabled=!ready;
  }
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
  await saveBackup(S.id, fresh, `Avant écriture (${count} fichier${count > 1 ? 's' : ''})`);
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
  S.lastWrittenBuild=detectBuildLabel(checked.files)||S.pendingBuild||'';
  if(S.pendingBuild && compareBuildLabels(S.lastWrittenBuild,S.pendingBuild)<0){
    throw Error(`Vérification de version échouée : ZIP ${S.pendingBuild}, mais le projet relu annonce ${S.lastWrittenBuild||'aucune version'}.`);
  }
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
  if(isProductionProject()){
    const prod=productionDeployment();
    if(prod){
      deployment.value=CDQ_PRODUCTION_DEPLOYMENT_ID;
      deployment.disabled=true;
      $('deployVersion').textContent='ÉCRIRE + DÉPLOYER EN PRODUCTION';
      deploymentNotice.className='deployment-notice good';
      deploymentNotice.innerHTML=`<strong>🔒 Production Balance CDQ • Apps Script v${prod.deploymentConfig.versionNumber}</strong><span>Le même déploiement et la même URL seront conservés. Aucun nouveau déploiement ne peut être créé depuis la mise à jour rapide.</span>`;
    }else{
      $('deployVersion').textContent='PRODUCTION INTROUVABLE';
      deploymentNotice.className='deployment-notice warn';
      deploymentNotice.innerHTML='<strong>⛔ Mise à jour bloquée</strong><span>Recharge les déploiements. Script Manager ne choisira pas un autre déploiement à la place.</span>';
    }
    updateQuickUi();
    return;
  }

  const target=deployment.value;
  const selected=(CDQ.deployments||[]).find(d=>d.deploymentId===target);
  const isNew=target==='__new__';

  if(isNew){
    $('deployVersion').textContent='CRÉER UN NOUVEAU DÉPLOIEMENT';
    deploymentNotice.className='deployment-notice warn';
    deploymentNotice.innerHTML='<strong>⚠ Nouvelle URL</strong><span>Ce choix crée un autre déploiement.</span>';
    return;
  }
  if(selected&&Number.isInteger(selected.deploymentConfig?.versionNumber)){
    const v=selected.deploymentConfig.versionNumber;
    $('deployVersion').textContent='ÉCRIRE + DÉPLOYER LA MISE À JOUR';
    deploymentNotice.className='deployment-notice good';
    deploymentNotice.innerHTML=`<strong>✓ Déploiement sélectionné (v${v})</strong><span>L’ID et l’URL restent identiques.</span>`;
    return;
  }
  $('deployVersion').textContent='ÉCRIRE + DÉPLOYER LA MISE À JOUR';
  deploymentNotice.className='deployment-notice';
  deploymentNotice.innerHTML='<strong>Aucun déploiement versionné sélectionné</strong>';
}
function renderDeployments(all) {
  const versioned=(all||[])
    .filter(d=>Number.isInteger(d.deploymentConfig?.versionNumber)&&d.deploymentConfig.versionNumber>0)
    .sort((a,b)=>(b.deploymentConfig.versionNumber||0)-(a.deploymentConfig.versionNumber||0));
  const readOnly=(all||[]).filter(d=>!Number.isInteger(d.deploymentConfig?.versionNumber));

  if(isProductionProject()){
    const prod=versioned.find(d=>String(d.deploymentId||'')===CDQ_PRODUCTION_DEPLOYMENT_ID);
    deployment.disabled=true;
    if(prod){
      deployment.innerHTML=`<option value="${esc(prod.deploymentId)}">🔒 PRODUCTION Balance CDQ • Apps Script v${prod.deploymentConfig.versionNumber}</option>`;
      deployment.value=prod.deploymentId;
      LS.setItem('cdqsm_deployment',prod.deploymentId);
      deploymentNotice.className='deployment-notice good';
      deploymentNotice.innerHTML=`<strong>🔒 Déploiement de production verrouillé</strong><span>Script Manager modifiera uniquement l’ID <code>${esc(CDQ_PRODUCTION_DEPLOYMENT_ID)}</code>. URL techniciens conservée : <code>${esc(CDQ_PRODUCTION_WEBAPP_URL)}</code>.</span>`;
    }else{
      deployment.innerHTML='<option value="">❌ Déploiement de production introuvable</option>';
      deployment.value='';
      deploymentNotice.className='deployment-notice warn';
      deploymentNotice.innerHTML=`<strong>⛔ Mise à jour bloquée</strong><span>Le déploiement utilisé par Balance CDQ n’a pas été trouvé. Aucun autre déploiement ne sera choisi automatiquement.</span>`;
    }
    updateQuickUi();
    return;
  }

  deployment.disabled=false;
  deployment.innerHTML =
    versioned.map((d,i)=>`<option value="${esc(d.deploymentId)}">${i===0?'✅ ':''}${esc(d.deploymentConfig?.description||'Déploiement actuel')} • v${d.deploymentConfig.versionNumber}</option>`).join('')+
    '<option value="__new__">⚠ Créer un NOUVEAU déploiement — nouvelle URL</option>'+
    (readOnly.length?`<option value="" disabled>— ${readOnly.length} HEAD/test ignoré(s) —</option>`:'');

  const old=LS.getItem('cdqsm_deployment');
  if(versioned.some(d=>d.deploymentId===old))deployment.value=old;
  else if(versioned.length)deployment.value=versioned[0].deploymentId;
  else deployment.value='__new__';

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
  const target = isProductionProject()
    ? CDQ_PRODUCTION_DEPLOYMENT_ID
    : (targetOverride || deployment.value || '__new__');

  if(isProductionProject() && !productionDeployment()){
    throw Error('Déploiement de production Balance CDQ introuvable. Écriture/déploiement bloqués pour éviter de publier sur la mauvaise URL.');
  }

  const targetDeployment = (CDQ.deployments || []).find(d => d.deploymentId === target);
  const previousVersion = Number(targetDeployment?.deploymentConfig?.versionNumber || 0);
  const sourceBuild = S.lastWrittenBuild || S.pendingBuild || '';

  const v = await createProjectVersion(S.id, desc, cid());

  if (target === '__new__') {
    const created = await createDeployment(S.id, v.versionNumber, desc, cid());
    const all = await listDeployments(S.id, cid());
    renderDeployments(all);
    if (created?.deploymentId && all.some(d => d.deploymentId === created.deploymentId)) deployment.value = created.deploymentId;
    updateDeploymentUi();
    saveSettings();
    S.pkg.clear();
    S.pendingBuild = '';
    renderDiff();
    updateQuickUi();
    stat(`Version ${v.versionNumber} créée + NOUVEAU déploiement créé. Attention : nouvelle URL.`, 'warn');
    return { version: v.versionNumber, deploymentId: created?.deploymentId, createdNew: true };
  }

  if (!Number.isInteger(targetDeployment?.deploymentConfig?.versionNumber)) {
    throw Error('Ce déploiement est en lecture seule. Choisis un déploiement versionné.');
  }

  await updateDeployment(S.id, target, v.versionNumber, desc, cid());
  let all = await listDeployments(S.id, cid());
  let verifiedDeployment=all.find(d=>d.deploymentId===target);
  if(!verifiedDeployment||verifiedDeployment.deploymentConfig?.versionNumber!==v.versionNumber){
    throw Error('Le déploiement n’a pas été confirmé sur la nouvelle version. Aucune réussite n’est affichée.');
  }
  if(isProductionProject()&&String(verifiedDeployment.deploymentId)!==CDQ_PRODUCTION_DEPLOYMENT_ID){
    throw Error('Vérification de sécurité échouée : le déploiement confirmé n’est pas le déploiement de production Balance CDQ.');
  }

  if(isProductionProject()){
    stat('Étape 3/3 — ouverture réelle de Balance CDQ en production…');
    setQuickResult('Déploiement écrit. Vérification de la vraie application de production en cours…','warn');
    try{
      const health=await verifyProductionWebAppReadyV22(sourceBuild,30000);
      setKnownGoodV22(v.versionNumber);
      setQuickResult(
        `PRODUCTION TESTÉE ✓ ${sourceBuild||health.build} • Apps Script v${v.versionNumber} • CDQ_SELECTOR_READY reçu.`,
        'ok'
      );
    }catch(healthError){
      const knownGood=getKnownGoodV22();
      const rollbackVersion=knownGood>0?knownGood:previousVersion;
      if(rollbackVersion>0){
        stat(`Échec du démarrage — retour automatique à Apps Script v${rollbackVersion}…`,'warn');
        try{
          await updateDeployment(S.id,target,rollbackVersion,`ROLLBACK automatique — échec santé v${v.versionNumber}`,cid());
          all=await listDeployments(S.id,cid());
          const rolled=all.find(d=>d.deploymentId===target);
          renderDeployments(all);
          if(!rolled || rolled.deploymentConfig?.versionNumber!==rollbackVersion){
            throw new Error('Le retour automatique n’a pas pu être confirmé.');
          }
          setQuickResult(
            `MISE À JOUR REFUSÉE — Balance CDQ n’a pas démarré. Production restaurée automatiquement à Apps Script v${rollbackVersion}.`,
            'err'
          );
          throw new Error(`La nouvelle version n’a pas démarré. Retour automatique réussi vers Apps Script v${rollbackVersion}. Détail : ${healthError.message}`);
        }catch(rollbackError){
          if(/Retour automatique réussi/.test(rollbackError.message))throw rollbackError;
          throw new Error(`La nouvelle version n’a pas démarré ET le rollback doit être vérifié manuellement. ${healthError.message} • ${rollbackError.message}`);
        }
      }
      throw healthError;
    }
  }

  renderDeployments(all);
  if (all.some(d => d.deploymentId === target)) deployment.value = target;
  updateDeploymentUi();
  saveSettings();
  S.lastDeploymentResult = { version: v.versionNumber, deploymentId: target, createdNew: false, healthChecked:isProductionProject() };

  S.pkg.clear();
  S.pendingBuild = '';
  renderDiff();
  updateQuickUi();

  if(isProductionProject()){
    stat(`MISE À JOUR TERMINÉE ✓ Apps Script v${v.versionNumber} • production ouverte et testée • même URL.`,'ok');
  }else{
    stat(`MISE À JOUR TERMINÉE ✓ Déploiement actuel conservé • nouvelle version Apps Script v${v.versionNumber}.`,'ok');
  }
  return S.lastDeploymentResult;
}

async function writePendingAndDeploy() {
  if(!S.id)throw Error('Charge d’abord le projet.');
  if(isProductionProject()&&!productionDeployment()){
    throw Error('Déploiement de production Balance CDQ introuvable. Mise à jour annulée avant toute écriture.');
  }
  const target=isProductionProject()?CDQ_PRODUCTION_DEPLOYMENT_ID:(deployment.value||'__new__');
  const pending=pendingChangeCount();

  if (pending > 0) {
    stat(`Étape 1/${isProductionProject()?'3':'2'} — écriture de ${pending} modification(s) dans Apps Script…`);
    await writeProjectChanges();
  } else {
    stat(`Étape 1/${isProductionProject()?'3':'2'} — aucune modification en attente. Le code Google est déjà écrit.`);
  }

  stat(isProductionProject()
    ? 'Étape 2/3 — création de la version et mise à jour du déploiement de production…'
    : 'Étape 2/2 — création de la nouvelle version et mise à jour du déploiement…');
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
  await saveBackup(id, await getProjectContent(id, cid()), 'Sauvegarde manuelle');
  stat('Sauvegarde créée.', 'ok');
}, 'Sauvegarde…'));
$('downloadBackup').addEventListener('click', () => runAction(async () => {
  const all = await listBackupRecords();
  const backup = all[0];
  if (!backup) return stat('Aucune sauvegarde.', 'warn');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
  a.download = 'CDQ_AppsScript_Backup.json';
  a.click();
  stat('Dernière sauvegarde téléchargée.', 'ok');
}));

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
  try {
    await migrateLegacyBackups();
  } catch (migrationError) {
    try { LS.removeItem('cdqsm_backups'); } catch {}
  }
  await renderBackups();
  detectEmbeddedBrowser();
  updateInstallState();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js?v=20').catch(() => {});
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
