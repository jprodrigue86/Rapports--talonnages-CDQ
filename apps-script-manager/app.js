'use strict';

const $ = id => document.getElementById(id);
const LS = localStorage;
const APP_VERSION = 'V43';
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
const quickDeployProgress = $('quickDeployProgress');
const quickDeployProgressBar = $('quickDeployProgressBar');
const quickDeployProgressPercent = $('quickDeployProgressPercent');
const quickDeployProgressText = $('quickDeployProgressText');
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
  bundleUrl: '',
  bundleLabel: '',
  bundleAlreadyApplied: false,
  bundleTargetBuild: '',
  sourceBuild: '',
  productionBuild: '',
  redeploySource: false,
  deployBusy: false,
  deployProgress: 0,
  autoBundleChecked: false,
  projectReadGeneration: 0,
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
const PENDING_BUNDLE_KEY_V41 = 'cdqsm_pending_bundle_v41';

function rememberPendingBundleV41(url) {
  try { LS.setItem(PENDING_BUNDLE_KEY_V41, JSON.stringify({url:bundleUrlFromValueV24(url), savedAt:Date.now()})); } catch (_) {}
}

function pendingBundleV41() {
  try {
    const saved = JSON.parse(LS.getItem(PENDING_BUNDLE_KEY_V41) || 'null');
    if (saved && Date.now() - saved.savedAt < 7 * 24 * 60 * 60 * 1000) return bundleUrlFromValueV24(saved.url);
  } catch (_) {}
  LS.removeItem(PENDING_BUNDLE_KEY_V41);
  return '';
}

async function prepareLatestBundleV41() {
  if (S.autoBundleChecked || !isProductionProject() || S.bundleUrl || S.pkg.size || S.draft.size) return false;
  S.autoBundleChecked = true;
  const id = S.id;
  const manifest = JSON.parse(await fetchBundleTextV24(bundleUrlFromValueV24('latest')));
  if (S.id !== id || S.bundleUrl || S.pkg.size || S.draft.size) return false;
  if (normalizeScriptId(manifest.projectScriptId) !== id || !manifest.build) return false;
  if (compareBuildLabels(detectBuildLabel(S.files), manifest.build) >= 0) return false;
  rememberPendingBundleV41('latest');
  // Only prepare the published update; writing/deployment still needs the button.
  await importBundleManifestV24('latest', manifest);
  return true;
}

window.addEventListener('cdqsm:network-wait', event => {
  const d = event.detail || {};
  const message = d.phase + ' — ' + d.elapsedSeconds + ' s';
  if (S.deployBusy) {
    if (quickDeployProgressText) quickDeployProgressText.textContent = message;
  } else stat(message);
});

function saveLiveGoogleToken() {
  if (!keepConnectionEnabled() || !CDQ.token || !CDQ.expiresAt) return;
  LS.setItem(TOKEN_KEY, CDQ.token);
  LS.setItem(TOKEN_EXPIRES_KEY, String(CDQ.expiresAt));
  LS.setItem('cdqsm_google_scopes_v43', CDQ.grantedScopes || '');
}

function clearSavedGoogleToken() {
  LS.removeItem(TOKEN_KEY);
  LS.removeItem(TOKEN_EXPIRES_KEY);
  LS.removeItem('cdqsm_google_scopes_v43');
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
  CDQ.grantedScopes = LS.getItem('cdqsm_google_scopes_v43') || '';
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
function knownGoodKeyV23(){return 'cdqsm_known_good_'+CDQ_PRODUCTION_SCRIPT_ID;}
function getKnownGoodV23(){return Number(LS.getItem(knownGoodKeyV23())||0)||0;}
function setKnownGoodV23(v){v=Number(v)||0;if(v>0)LS.setItem(knownGoodKeyV23(),String(v));}
// Compatibilité avec V22.
const knownGoodKeyV22=knownGoodKeyV23;
const getKnownGoodV22=getKnownGoodV23;
const setKnownGoodV22=setKnownGoodV23;

function verifyProductionWebAppReadyV23(expectedBuild='',timeoutMs=90000){
  return new Promise((resolve,reject)=>{
    let finished=false;
    let attempt=0;
    let lastSeen='';
    let lastSelector='';
    const frame=document.createElement('iframe');
    frame.title='Vérification serveur Balance CDQ';
    frame.tabIndex=-1;
    frame.setAttribute('aria-hidden','true');
    frame.style.cssText='position:fixed;left:-12000px;top:0;width:420px;height:220px;opacity:0;pointer-events:none;border:0';

    const cleanup=()=>{
      if(finished)return;
      finished=true;
      clearInterval(pollTimer);
      clearTimeout(timeoutTimer);
      window.removeEventListener('message',onMessage);
      try{frame.remove();}catch(e){}
    };
    const fail=msg=>{cleanup();reject(new Error(msg));};

    const onMessage=e=>{
      const d=e.data||{};
      if(!isAppsScriptOriginV21(e.origin))return;
      if(d.type!=='CDQ_HEALTH_READY')return;

      lastSeen=String(d.build||'');
      lastSelector=String(d.selectorBuild||'');
      const announced=diagnosticVersionLabelV43(lastSelector)||diagnosticVersionLabelV43(lastSeen);

      if(!d.selectorOk || Number(d.selectorBytes||0)<1000){
        // La nouvelle version peut être en cours de propagation. Continuer à sonder.
        setQuickResult('Production répond, mais Selector n’est pas encore prêt. Propagation en cours…','warn');
        return;
      }

      if(expectedBuild && (!announced || compareBuildLabels(announced,expectedBuild)<0)){
        setQuickResult('Production répond encore avec '+announced+'. Attente de '+expectedBuild+'…','warn');
        return;
      }

      cleanup();
      resolve({
        build:diagnosticVersionLabelV43(lastSeen),
        selectorBuild:diagnosticVersionLabelV43(lastSelector),
        selectorBytes:Number(d.selectorBytes||0),
        signal:d.type,
        attempts:attempt
      });
    };

    function loadHealth(){
      if(finished)return;
      attempt++;
      if(S.deployBusy){
        setQuickDeployProgress(Math.min(98,92+attempt),'Vérification production — tentative '+attempt+'…');
      }
      const sep=CDQ_PRODUCTION_WEBAPP_URL.includes('?')?'&':'?';
      const expected=encodeURIComponent(expectedBuild||'');
      frame.src=CDQ_PRODUCTION_WEBAPP_URL+sep+
        'cdq_health=1&cdq_sm_health='+Date.now()+
        '&attempt='+attempt+'&expected='+expected;
    }

    window.addEventListener('message',onMessage);
    frame.onerror=()=>{}; // une tentative réseau peut échouer pendant la propagation.
    document.body.appendChild(frame);
    loadHealth();
    const pollTimer=setInterval(loadHealth,5000);
    const timeoutTimer=setTimeout(()=>{
      const detail=(lastSelector||lastSeen)
        ? ' Dernière version observée : '+(lastSelector||lastSeen)+'.'
        : '';
      fail('Le endpoint de santé de production n’a pas confirmé '+(expectedBuild||'la nouvelle version')+
        ' dans '+Math.round(timeoutMs/1000)+' secondes.'+detail);
    },timeoutMs);
  });
}
// Compatibilité.
const verifyProductionWebAppReadyV22=verifyProductionWebAppReadyV23;
const verifyProductionWebAppReadyV21=verifyProductionWebAppReadyV23;

function setQuickResult(text, kind = '') {
  if (!quickResult) return;
  quickResult.textContent = text;
  quickResult.className = `quick-result sm-workflow-result ${kind}`.trim();
}

function stageStateV36(id,state,label){
  const row=$(id);
  if(!row)return;
  row.classList.remove('done','active','error');
  if(state)row.classList.add(state);
  const icon=row.querySelector('span');
  const statusText=row.querySelector('em');
  if(icon)icon.textContent=state==='done'?'✓':state==='active'?'●':state==='error'?'!':'○';
  if(statusText)statusText.textContent=label || (state==='done'?'Terminé':state==='active'?'En cours…':state==='error'?'Erreur':'En attente');
}

function updateWorkflowStagesV36(progress,state='working'){
  const p=Math.max(0,Math.min(100,Number(progress)||0));
  if(state==='error'){
    const active=p<16?'smStagePrepare':p<28?'smStageRead':p<60?'smStageWrite':p<92?'smStageDeploy':'smStageVerify';
    ['smStagePrepare','smStageRead','smStageWrite','smStageDeploy','smStageVerify'].forEach(id=>{
      const row=$(id); if(row&&row.classList.contains('active'))stageStateV36(id,'error','Erreur');
    });
    if($(active)&&!$(active).classList.contains('done'))stageStateV36(active,'error','Erreur');
    return;
  }
  stageStateV36('smStagePrepare',p>=16?'done':(p>0?'active':'')); 
  stageStateV36('smStageRead',p>=28?'done':(p>=16?'active':''));
  stageStateV36('smStageWrite',p>=60?'done':(p>=28?'active':''));
  stageStateV36('smStageDeploy',p>=92?'done':(p>=60?'active':''));
  stageStateV36('smStageVerify',p>=100?'done':(p>=92?'active':''));
}

function setQuickDeployProgress(value, text = '', state = 'working') {
  const n = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  S.deployProgress = Math.max(S.deployBusy ? S.deployProgress : 0, n);
  const shown = S.deployBusy ? S.deployProgress : n;

  if (quickDeployProgress) {
    quickDeployProgress.hidden = false;
    quickDeployProgress.className = `quick-deploy-progress sm-deploy-progress ${state || 'working'}`.trim();
    quickDeployProgress.setAttribute('aria-valuenow', String(shown));
  }
  if (quickDeployProgressBar) quickDeployProgressBar.style.width = shown + '%';
  if (quickDeployProgressPercent) quickDeployProgressPercent.textContent = shown + ' %';
  if (quickDeployProgressText && text) quickDeployProgressText.textContent = text;

  const railWrite=$('railWriteState'),railDeploy=$('railDeployState');
  if(railWrite){
    railWrite.textContent=shown<56?'En cours…':(shown>=100?'Terminé':'Écrit');
    railWrite.className=state==='error'?'err':(shown>=56?'ok':'warn');
  }
  if(railDeploy){
    railDeploy.textContent=shown<60?'En attente':(shown>=100?'Terminé':'En cours…');
    railDeploy.className=state==='error'?'err':(shown>=100?'ok':(shown>=60?'warn':''));
  }

  updateWorkflowStagesV36(shown,state);
}

function beginQuickDeployProgress(text = 'Préparation de la mise à jour…') {
  if (S.deployBusy) return false;
  S.deployBusy = true;
  S.deployProgress = 0;

  if (quickApply) {
    quickApply.disabled = true;
    quickApply.classList.add('busy');
    quickApply.innerHTML = '<span class="sm-lock">🔒</span><span>ÉCRITURE EN COURS…</span>';
    quickApply.setAttribute('aria-busy', 'true');
  }
  const advancedDeploy = $('deployVersion');
  if (advancedDeploy) advancedDeploy.disabled = true;

  setQuickDeployProgress(0, text, 'working');
  requestAnimationFrame(() => setQuickDeployProgress(2, 'Préparation et vérification du package…', 'working'));
  return true;
}

function endQuickDeployProgress(ok, text = '', verified = true) {
  if (ok) {
    S.deployProgress = verified ? 100 : 98;
    setQuickDeployProgress(S.deployProgress, text || 'Mise à jour terminée.', verified ? 'success' : 'warning');
  } else {
    if (!S.deployProgress) S.deployProgress = 2;
    setQuickDeployProgress(S.deployProgress, text || 'La mise à jour a échoué.', 'error');
  }

  S.deployBusy = false;
  if (quickApply) {
    quickApply.classList.remove('busy');
    quickApply.removeAttribute('aria-busy');
    quickApply.innerHTML = '<span class="sm-lock">🔒</span><span>ÉCRIRE + DÉPLOYER</span>';
  }
  const advancedDeploy = $('deployVersion');
  if (advancedDeploy) advancedDeploy.disabled = false;
  updateQuickUi();
}

async function runQuickDeployAction() {
  if (!beginQuickDeployProgress()) return;
  try {
    const result=await writePendingAndDeploy();
    LS.removeItem(PENDING_BUNDLE_KEY_V41);
    const verified=!result?.verificationPending;
    endQuickDeployProgress(true, verified
      ? '100 % — écriture, déploiement et vérification terminés.'
      : 'Déploiement Google confirmé — vérification de la production encore en attente.', verified);
  } catch (e) {
    const message = e && e.message ? e.message : String(e);
    stat('Échec : ' + message, 'err');
    endQuickDeployProgress(false, 'Arrêt à ' + S.deployProgress + ' % — ' + message);
  }
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
    if(S.redeploySource && !staged){
      quickZipSummary.textContent='Code source '+(S.sourceBuild||'actuel')+' • prêt à redéployer';
      quickZipSummary.className='warn';
    }else if(S.bundleAlreadyApplied){
      quickZipSummary.textContent='Code déjà présent • prêt à déployer'+(S.bundleTargetBuild?' • '+S.bundleTargetBuild:'');
      quickZipSummary.className='ok';
    }else{
      quickZipSummary.textContent = staged
        ? (pending
            ? `${staged} fichier(s) • ${pending} modification(s)${S.pendingBuild ? ' • ' + S.pendingBuild : ''}`
            : `${staged} fichier(s) • code déjà présent${S.pendingBuild ? ' • ' + S.pendingBuild : ''}`)
        : 'Aucun fichier';
      quickZipSummary.className = staged ? 'ok' : '';
    }
  }
  if (quickConnect) quickConnect.hidden = hasLiveToken();
  if (quickChooseZip) quickChooseZip.disabled = !S.id;
  if (quickApply) {
    const ready=Boolean(S.id && (S.pkg.size>0 || S.bundleAlreadyApplied || S.redeploySource) && productionDeploymentReady());
    quickApply.disabled=S.deployBusy || !ready;
    if(isProductionProject() && S.id && !productionDeploymentReady()){
      quickApply.title='Déploiement de production Balance CDQ introuvable : mise à jour bloquée.';
    }else quickApply.title='';
  }

  const projectState=$('smProjectState');
  const packageState=$('smPackageState');
  const packageNote=$('smPackageNote');
  if(projectState){
    projectState.textContent=S.id?'✓ Projet détecté':'● Projet en attente';
    projectState.className='sm-step-state '+(S.id?'ok':'warn');
  }
  if(packageState){
    const ready=Boolean(S.pkg.size||S.bundleAlreadyApplied||S.redeploySource);
    packageState.textContent=S.redeploySource&&!S.pkg.size?'● Source prête à déployer':ready?'✓ Package prêt':'● Aucun package chargé';
    packageState.className='sm-step-state '+(ready?'ok':'warn');
  }
  if(packageNote){
    if(S.redeploySource&&!S.pkg.size)packageNote.textContent='La source Google diffère du déploiement versionné. Aucun nouveau fichier requis pour la republier.';
    else if(S.bundleAlreadyApplied)packageNote.textContent='Le code est déjà présent dans Apps Script. Le déploiement peut être lancé.';
    else if(S.pkg.size)packageNote.textContent=(S.pendingBuild||S.bundleLabel||'Package CDQ')+' • '+pendingChangeCount()+' modification(s) préparée(s).';
    else packageNote.textContent='Le package chargé apparaîtra ici avec sa version et le nombre de modifications.';
  }
  updateIndustrialRailV34();
}

function updateIndustrialRailV34(){
  const railAccount=$('railAccountStatus');
  const railProject=$('railProjectStatus');
  const railPackage=$('railPackageStatus');
  if(railAccount)railAccount.textContent=hasLiveToken()?'Connecté':'Non connecté';
  if(railProject)railProject.textContent=S.meta?.title || (sid()?'Projet mémorisé':'Aucun projet chargé');
  if(railPackage){
    if(S.bundleAlreadyApplied)railPackage.textContent='Code déjà présent • prêt à déployer';
    else if(S.pkg.size)railPackage.textContent=(S.pendingBuild||S.bundleLabel||S.pkg.size+' fichier(s)')+' • prêt';
    else railPackage.textContent='Aucun package prêt';
  }
}

function smIsMobileV35(){
  return window.matchMedia('(max-width:1100px)').matches;
}

function smSetActiveTabV34(name){
  document.querySelectorAll('.sm-tab[data-sm-tab]').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.smTab===name);
  });
}

function smCloseMobileSettingsV35(){
  document.body.classList.remove('sm-mobile-settings-open');
}

function smOpenCardV34(id,tab='settings'){
  smCloseMobileSettingsV35();
  document.body.classList.add('show-advanced');
  const card=document.getElementById(id);
  if(card)card.scrollIntoView({behavior:'smooth',block:'start'});
  smSetActiveTabV34(tab);
}

function installIndustrialUiV34(){
  document.querySelectorAll('.sm-tab[data-sm-tab]').forEach(btn=>{
    if(btn.dataset.smBound==='1')return;
    btn.dataset.smBound='1';
    btn.addEventListener('click',()=>{
      const tab=btn.dataset.smTab;
      if(tab==='deploy'){
        smCloseMobileSettingsV35();
        document.body.classList.remove('show-advanced');
        document.getElementById('quickCard')?.scrollIntoView({behavior:'smooth',block:'start'});
      }else if(tab==='projects'){
        smOpenCardV34('projectCard','projects');
      }else if(tab==='backups'){
        smOpenCardV34('backupsCard','backups');
      }else if(tab==='settings'){
        if(smIsMobileV35()){
          document.body.classList.remove('show-advanced');
          document.body.classList.add('sm-mobile-settings-open');
          window.scrollTo({top:0,behavior:'smooth'});
        }else{
          document.querySelector('.sm-settings-rail')?.scrollIntoView({behavior:'smooth',block:'start'});
        }
      }else if(tab==='about'){
        if(smIsMobileV35()){
          document.body.classList.remove('show-advanced');
          document.body.classList.add('sm-mobile-settings-open');
          window.scrollTo({top:0,behavior:'smooth'});
        }else{
          document.querySelector('.sm-settings-rail')?.scrollIntoView({behavior:'smooth',block:'start'});
        }
      }
      smSetActiveTabV34(tab);
    });
  });

  document.querySelectorAll('[data-sm-jump]').forEach(btn=>{
    if(btn.dataset.smBound==='1')return;
    btn.dataset.smBound='1';
    btn.addEventListener('click',()=>{
      const id=btn.dataset.smJump;
      if(id==='quickCard'){
        smCloseMobileSettingsV35();
        document.body.classList.remove('show-advanced');
        document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'});
        smSetActiveTabV34('deploy');
      }else{
        smOpenCardV34(id,id==='projectCard'?'projects':id==='backupsCard'?'backups':'settings');
      }
    });
  });

  const changeProject=$('smChangeProject');
  if(changeProject && changeProject.dataset.smBound!=='1'){
    changeProject.dataset.smBound='1';
    changeProject.addEventListener('click',()=>smOpenCardV34('projectCard','projects'));
  }

  const advancedRail=$('smOpenAdvancedFromRail');
  if(advancedRail && advancedRail.dataset.smBound!=='1'){
    advancedRail.dataset.smBound='1';
    advancedRail.addEventListener('click',()=>{
      smCloseMobileSettingsV35();
      document.body.classList.add('show-advanced');
      document.getElementById('deployCard')?.scrollIntoView({behavior:'smooth',block:'start'});
      smSetActiveTabV34('settings');
    });
  }

  document.querySelectorAll('.sm-settings-tab[data-sm-settings-tab]').forEach(btn=>{
    if(btn.dataset.smBound==='1')return;
    btn.dataset.smBound='1';
    btn.addEventListener('click',()=>{
      const name=btn.dataset.smSettingsTab;
      document.querySelectorAll('.sm-settings-tab').forEach(x=>x.classList.toggle('active',x===btn));
      document.querySelectorAll('.sm-settings-panel[data-sm-settings-panel]').forEach(panel=>{
        panel.classList.toggle('active',panel.dataset.smSettingsPanel===name);
      });
    });
  });

  updateIndustrialRailV34();
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',installIndustrialUiV34,{once:true});
}else installIndustrialUiV34();
window.addEventListener('load',()=>setTimeout(installIndustrialUiV34,100));

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
  invalidateVersionDiagnosticV43();
  S.projectReadGeneration++;
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
  invalidateVersionDiagnosticV43();
  S.projectReadGeneration++;
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
        if (!S.pkg.size && !S.bundleAlreadyApplied && !S.bundleUrl) setQuickResult('Google connecté et projet lié automatiquement. Choisis maintenant ton package.', 'ok');
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
  const readGeneration = ++S.projectReadGeneration;
  invalidateVersionDiagnosticV43();
  stat('Lecture du projet…');

  // V39 : charger d'abord le contenu, une seule requête critique à la fois.
  // Le projet fait maintenant plusieurs Mo; trois appels Apps Script en
  // parallèle étaient beaucoup plus fragiles sur Android/5G.
  const content = await getProjectContent(id, cid());
  if(readGeneration !== S.projectReadGeneration)return;
  if (!content || !Array.isArray(content.files) || !content.files.length) {
    throw Error('Google a répondu, mais aucun fichier Apps Script n’a été reçu.');
  }

  // The Drive list already supplies the title. Avoid another blocking request.
  const option = Array.from(projectSelect.options || []).find(o => o.value === id);
  const meta = {title: option ? String(option.textContent || '').split(' • ')[0] : 'Projet Apps Script'};

  let deps = [];
  let deploymentsReadOk = true;
  try {
    deps = await listDeployments(id, cid());
  } catch (_) {
    deploymentsReadOk = false;
  }
  if(readGeneration !== S.projectReadGeneration)return;
  CDQ.deployments = deps;

  S.id = id;
  S.meta = meta;
  S.files = clone(content.files);
  S.draft.clear();
  S.pkg.clear();
  S.bundleAlreadyApplied=false;
  S.bundleTargetBuild='';
  S.sourceBuild='';
  S.productionBuild='';
  S.redeploySource=false;
  S.sel = '';
  scriptIdInput.value = id;
  if (save) LS.setItem('cdqsm_script_id', id);
  const sourceBuild=diagnosticMainBuildV43(S.files)||'version non détectée';
  S.sourceBuild=sourceBuild;
  S.lastWrittenBuild=sourceBuild;
  projectMeta.innerHTML = `<b>${esc(meta.title || 'Projet Apps Script')}</b><br>Script ID : <code>${esc(id)}</code><br>Code source lu : <code>${esc(sourceBuild)}</code>`;
  badge('projectBadge', 'Projet : ' + (meta.title || 'chargé'), 'ok');
  renderFiles();
  renderDiff();
  renderDeployments(deps);
  updateQuickUi();
  stat(`${S.files.length} fichier(s) chargé(s) • ${sourceBuild}.`, 'ok');
  try {
    if(S.bundleUrl)await maybeImportBundleV24();
    else if(isProductionProject())await prepareLatestBundleV41();
  } catch (error) {
    setQuickResult('Lecture de la mise à jour impossible : '+error.message, 'err');
  } finally {
    if(readGeneration === S.projectReadGeneration){
      // Read-only Google audit; Drive receives only a private, sanitized report.
      // Never interpret a missing live version label as an outdated deployment.
      void startVersionDiagnosticV43({id, files:content.files, deployments:deps, deploymentsReadOk, readGeneration});
    }
  }
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

async function preparePackage() {
  try {
    if (!S.files.length) throw Error('Charge d’abord le projet.');
    if (/^\s*\{/.test(packageEditor.value)) {
      await importLocalBundleV40(packageEditor.value);
      return;
    }
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



const CDQ_BUNDLE_BASE_PATH='/Rapports--talonnages-CDQ/bundles/balance-cdq/';

function bundleUrlFromValueV24(raw){
  raw=String(raw||'').trim();
  if(!raw)return '';
  if(/^v\d+\.\d+$/i.test(raw)){
    raw=CDQ_BUNDLE_BASE_PATH+raw.toLowerCase()+'/manifest.json';
  }else if(/^latest$/i.test(raw)){
    raw=CDQ_BUNDLE_BASE_PATH+'latest/manifest.json';
  }
  const u=new URL(raw,location.origin);
  if(u.origin!==location.origin || !u.pathname.startsWith(CDQ_BUNDLE_BASE_PATH)){
    throw new Error('Lien package refusé : seules les versions Balance CDQ publiées par CDQ sont acceptées.');
  }
  return u.href;
}

function bundleUrlFromLocationV24(){
  try{
    const raw=new URL(location.href).searchParams.get('bundle')||'';
    return bundleUrlFromValueV24(raw);
  }catch(e){
    setQuickResult(e.message,'err');
    return '';
  }
}

async function sha256HexV24(text){
  const bytes=new TextEncoder().encode(String(text||''));
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

async function fetchBundleTextV24(url,expectedSha=''){
  const u=bundleUrlFromValueV24(url);

  function rawFallbackUrlV32(pageUrl){
    const x=new URL(pageUrl);
    const prefix='/Rapports--talonnages-CDQ/';
    if(!x.pathname.startsWith(prefix))return '';
    const relative=x.pathname.slice(prefix.length);
    return 'https://raw.githubusercontent.com/jprodrigue86/Rapports--talonnages-CDQ/main/'+relative;
  }

  async function tryFetchV32(target){
    const bust=new URL(target);
    bust.searchParams.set('cdq_retry',Date.now());
    const {response,text}=await cdqFetchOnceV39(bust.href,{},new Headers(),20000,'du package');
    return {ok:response.ok,status:response.status,text:async()=>text};
  }

  let r=null;
  let source=u;

  // 1) GitHub Pages en premier.
  try{
    r=await tryFetchV32(u);
  }catch(_){
    r=null;
  }

  // 2) Si Pages n'a pas encore publié le nouveau fichier (404/5xx),
  // aller immédiatement au fichier brut du dépôt au lieu de boucler.
  if(!r || !r.ok){
    const raw=rawFallbackUrlV32(u);
    if(raw){
      setQuickResult('Package en cours de publication sur Pages. Chargement direct depuis GitHub…','warn');
      try{
        const rr=await tryFetchV32(raw);
        if(rr.ok){
          r=rr;
          source=raw;
        }
      }catch(_){}
    }
  }

  // 3) Une seule courte relance Pages si le dépôt brut n'est pas encore prêt.
  if(!r || !r.ok){
    await new Promise(resolve=>setTimeout(resolve,1500));
    try{
      r=await tryFetchV32(u);
      source=u;
    }catch(_){
      r=null;
    }
  }

  if(!r || !r.ok){
    throw new Error('Package indisponible pour le moment'+(r?' (HTTP '+r.status+')':'')+'. Fermez puis rouvrez le lien de mise à jour.');
  }

  const text=await r.text();
  if(text.length>3_000_000)throw new Error('Fichier package trop volumineux.');

  if(expectedSha){
    const got=await sha256HexV24(text);
    if(got.toLowerCase()!==String(expectedSha).toLowerCase()){
      throw new Error('Vérification SHA-256 échouée pour '+source.split('/').pop()+'.');
    }
  }

  return text;
}


function findProjectFileForBundleV25(displayName){
  const spec=importedFileSpec(displayName);
  if(!spec)return null;
  return existingProjectFileByName(spec.name,spec.type) ||
    (spec.type==='SERVER_JS' ? S.files.find(f=>f.type==='SERVER_JS'&&/^code$/i.test(f.name)) : null) ||
    (spec.type==='HTML' ? S.files.find(f=>f.type==='HTML'&&/^(selector|selecteur)$/i.test(f.name)) : null);
}

function countLiteralV25(source,needle){
  if(!needle)return 0;
  return String(source).split(String(needle)).length-1;
}

function removeTaggedBlockV25(source,tag,id){
  const escId=String(id).replace(/[.*+?^$()|[\]\\{}]/g,'\\$&');
  const re=new RegExp('\\s*<'+tag+'([^>]*)id=["\\\']'+escId+'["\\\']([^>]*)>[\\s\\S]*?<\\/'+tag+'>\\s*','i');
  if(!re.test(source))throw new Error(tag+' #'+id+' introuvable.');
  return source.replace(re,'\n');
}

function applyPatchV25(source,patch,fileLabel){
  const op=String(patch.op||'');
  // API project reads can mix Windows CRLF with patches previously inserted as LF.
  // Match the normalization already used by ZIP imports and source fingerprints.
  source=String(source).replace(/\r\n/g,'\n');
  fileLabel=String(fileLabel||patch.file||'Fichier')+' ['+String(patch.id||op)+']';
  if(op==='replace_literal'){
    const search=String(patch.search||'').replace(/\r\n/g,'\n');
    const replacement=String(patch.replacement||'');
    const found=countLiteralV25(source,search);
    const expected=patch.expected==null?1:Number(patch.expected);
    if(patch.ignoreLineTrailingSpaces===true){
      // Opt-in only for audited function blocks without multiline string values.
      // Keep every code character, indentation, line break and occurrence guard.
      if(!search||search.includes('`')||/\\[ \t]*\n/.test(search))throw new Error(fileLabel+' : bloc incompatible avec la comparaison des espaces.');
      const lines=search.split('\n');
      const pattern=lines.map((line,index)=>line===''&&index===lines.length-1?'':line.replace(/[ \t]+$/,'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'[ \\t]*').join('\n');
      const matches=Array.from(source.matchAll(new RegExp(pattern,'g')));
      if(matches.length!==expected)throw new Error(fileLabel+' : replace_literal attendu '+expected+', trouvé '+matches.length+'.');
      return source.replace(new RegExp(pattern,'g'),()=>replacement);
    }
    if(found!==expected)throw new Error(fileLabel+' : replace_literal attendu '+expected+', trouvé '+found+'.');
    return source.split(search).join(replacement);
  }
  if(op==='replace_literal_if_present'){
    const search=String(patch.search||'').replace(/\r\n/g,'\n');
    const replacement=String(patch.replacement||'');
    const found=countLiteralV25(source,search);
    if(found===0)return source;
    const expected=patch.expected==null?1:Number(patch.expected);
    if(found!==expected)throw new Error(fileLabel+' : replace_literal_if_present attendu '+expected+', trouvé '+found+'.');
    return source.split(search).join(replacement);
  }
  if(op==='replace_build'){
    const from=String(patch.from||'');
    const to=String(patch.to||'');
    const found=countLiteralV25(source,from);
    if(found<1)throw new Error(fileLabel+' : ancien build introuvable.');
    return source.split(from).join(to);
  }
  if(op==='replace_build_any'){
    const fromList=(Array.isArray(patch.from)?patch.from:[patch.from])
      .map(x=>String(x||'')).filter(Boolean);
    const to=String(patch.to||'');
    if(!fromList.length||!to)throw new Error(fileLabel+' : replace_build_any invalide.');
    if(countLiteralV25(source,to)>0)return source;
    let found=0;
    for(const from of fromList)found+=countLiteralV25(source,from);
    if(found<1)throw new Error(fileLabel+' : aucune version source compatible trouvée.');
    for(const from of fromList)source=source.split(from).join(to);
    return source;
  }
  if(op==='remove_script_id')return removeTaggedBlockV25(source,'script',patch.id);
  if(op==='remove_style_id')return removeTaggedBlockV25(source,'style',patch.id);
  if(op==='remove_script_id_if_present'){
    try{return removeTaggedBlockV25(source,'script',patch.id);}catch(e){return source;}
  }
  if(op==='remove_style_id_if_present'){
    try{return removeTaggedBlockV25(source,'style',patch.id);}catch(e){return source;}
  }
  if(op==='insert_before_literal'){
    const needle=String(patch.before||'');
    const text=String(patch.text||'');
    const found=countLiteralV25(source,needle);
    if(found!==1)throw new Error(fileLabel+' : point insertion attendu 1 fois, trouvé '+found+'.');
    return source.replace(needle,text+needle);
  }
  throw new Error('Opération patch non supportée : '+op);
}

function buildEntriesFromPatchesV25(manifest){
  if(!Array.isArray(manifest.patches)||!manifest.patches.length||manifest.patches.length>80){
    throw new Error('Liste de correctifs invalide.');
  }
  const currentBuild=detectBuildLabel(S.files)||'';
  if(manifest.requiresBuild){
    const allowed=Array.isArray(manifest.requiresBuild)?manifest.requiresBuild:[manifest.requiresBuild];
    const ok=allowed.some(x=>compareBuildLabels(currentBuild,String(x))===0);
    if(!ok){
      throw new Error('Ce correctif exige '+allowed.join(' ou ')+', mais le projet chargé annonce '+(currentBuild||'aucune version')+'.');
    }
  }

  const byFile=new Map();
  for(const p of manifest.patches){
    const file=String(p.file||'').trim();
    if(!/^(Code\.gs|Selector\.html|appsscript\.json)$/i.test(file)){
      throw new Error('Fichier patch non autorisé : '+file);
    }
    if(!byFile.has(file))byFile.set(file,[]);
    byFile.get(file).push(p);
  }

  const entries=[];
  for(const [displayName,patches] of byFile){
    const base=findProjectFileForBundleV25(displayName);
    if(!base)throw new Error('Fichier projet introuvable : '+displayName);
    let source=String(base.source||'');
    for(const patch of patches)source=applyPatchV25(source,patch,displayName);
    entries.push({
      name:base.name,
      type:base.type,
      displayName:displayNameForFile(base),
      source
    });
  }
  return entries;
}

async function importLocalBundleV40(text){
  if(!S.files.length)throw new Error('Charge d’abord le projet.');
  if(String(text).length>3_000_000)throw new Error('Fichier package trop volumineux.');
  let manifest;
  try{manifest=JSON.parse(text);}catch(_){throw new Error('Package CDQ invalide.');}
  if(!manifest || !['cdq-script-bundle-v2','cdq-script-bundle-v3'].includes(manifest.schema)){
    throw new Error('Format du correctif CDQ non reconnu.');
  }
  if((manifest.extraFiles||[]).length || (manifest.files||[]).length){
    throw new Error('Ce correctif contient des fichiers distants : utilise son lien de mise à jour.');
  }
  // Use exactly the same project, version, fingerprint and write guards as a direct link.
  return importBundleManifestV24('latest',manifest);
}

async function importBundleManifestV24(url,suppliedManifest=null){
  url=bundleUrlFromValueV24(url);
  S.bundleUrl=url;
  if (!suppliedManifest) rememberPendingBundleV41(url);

  if(!S.files.length){
    S.bundleLabel=url.split('/').slice(-2,-1)[0]||'package direct';
    if(quickZipSummary){
      quickZipSummary.textContent='Package direct en attente • '+S.bundleLabel;
      quickZipSummary.className='warn';
    }
    setQuickResult('Package direct reçu. Connexion/projet en cours; il sera préparé automatiquement.','warn');
    return false;
  }

  setQuickResult('Chargement du package direct…','warn');
  setZipVisual('processing','Package direct','Lecture du manifeste sécurisé…',15);

  let manifest=suppliedManifest;
  if(!manifest){
    const manifestText=await fetchBundleTextV24(url);
    try{manifest=JSON.parse(manifestText);}catch(e){throw new Error('Manifeste package invalide.');}
  }

  if(!['cdq-script-bundle-v1','cdq-script-bundle-v2','cdq-script-bundle-v3'].includes(manifest.schema)){
    throw new Error('Format package non reconnu.');
  }
  if(manifest.projectScriptId && normalizeScriptId(manifest.projectScriptId)!==normalizeScriptId(S.id)){
    throw new Error('Ce package vise un autre projet Apps Script.');
  }

  let resolved=[];
  const currentBuild=detectBuildLabel(S.files)||'';
  const targetBuild=String(manifest.build||'');
  const alreadyAtTarget=Boolean(targetBuild && compareBuildLabels(currentBuild,targetBuild)===0);

  if(alreadyAtTarget){
    S.pkg.clear();
    S.pendingBuild=targetBuild;
    S.bundleTargetBuild=targetBuild;
    S.bundleAlreadyApplied=true;
    S.bundleLabel=String(manifest.version||targetBuild||'package direct');

    packageResult.innerHTML=
      '<b>Code déjà présent dans Apps Script ✓</b><br>'+
      '<span>'+esc(targetBuild)+'</span><br>'+
      '<span>Aucun correctif à réappliquer. Tu peux déployer directement cette version.</span>';

    renderDiff();
    updateQuickUi();
    setZipVisual('success','Version déjà écrite ✓','Le projet contient déjà '+targetBuild+' • prêt à déployer',100);
    setQuickResult('Le code '+targetBuild+' est déjà écrit. Appuie simplement sur « ÉCRIRE + DÉPLOYER ».','ok');
    stat('Package direct : version déjà présente • déploiement prêt.','ok');

    try{
      const clean=new URL(location.href);
      clean.searchParams.delete('bundle');
      history.replaceState({},'',clean.pathname+clean.search+clean.hash);
    }catch(e){}
    S.bundleUrl='';
    return true;
  }

  if(targetBuild && currentBuild && compareBuildLabels(currentBuild,targetBuild)>0){
    throw new Error('Le projet chargé est déjà plus récent ('+currentBuild+') que ce package ('+targetBuild+').');
  }

  if(manifest.schema==='cdq-script-bundle-v2'||manifest.schema==='cdq-script-bundle-v3'){
    setZipVisual('processing','Package direct '+String(manifest.version||manifest.build||''),'Application des correctifs audités…',45);
    resolved=buildEntriesFromPatchesV25(manifest);

    if(Array.isArray(manifest.extraFiles)&&manifest.extraFiles.length){
      if(manifest.extraFiles.length>24)throw new Error('Trop de fichiers complémentaires dans le package.');
      const base=new URL(url);
      let extraIndex=0;
      for(const f of manifest.extraFiles){
        extraIndex++;
        const name=String(f.name||'').trim();
        if(!(/^[A-Za-z0-9_ -]+\.gs$/i.test(name)||/^[A-Za-z0-9_ -]+\.html?$/i.test(name)||/^appsscript\.json$/i.test(name))){
          throw new Error('Fichier complémentaire non autorisé : '+name);
        }
        const fileUrl=new URL(String(f.url||('files/'+name)),base).href;
        const source=(await fetchBundleTextV24(fileUrl,String(f.sha256||''))).replace(/\r\n/g,'\n');
        const spec=importedFileSpec(name);
        if(!spec)throw new Error('Fichier complémentaire non reconnu : '+name);
        const exact=existingProjectFileByName(spec.name,spec.type);
        resolved.push(exact
          ? {name:exact.name,type:exact.type,displayName:displayNameForFile(exact),source}
          : {name:spec.name,type:spec.type,displayName:name,source});
        setZipVisual(
          'processing',
          'Package direct '+String(manifest.version||manifest.build||''),
          'Chargement fichier intégré '+extraIndex+'/'+manifest.extraFiles.length+' : '+name,
          45+Math.round(extraIndex/manifest.extraFiles.length*38)
        );
      }
    }
  }else{
    if(!Array.isArray(manifest.files)||!manifest.files.length||manifest.files.length>10){
      throw new Error('Liste de fichiers package invalide.');
    }

    const base=new URL(url);
    const raw=[];
    let index=0;
    for(const f of manifest.files){
      index++;
      const name=String(f.name||'').trim();
      if(!/^(Code\.gs|Selector\.html|appsscript\.json)$/i.test(name)){
        throw new Error('Fichier non autorisé dans le package : '+name);
      }
      const fileUrl=new URL(String(f.url||name),base).href;
      const source=(await fetchBundleTextV24(fileUrl,String(f.sha256||''))).replace(/\r\n/g,'\n');
      raw.push({displayName:name,path:name,source});
      setZipVisual('processing','Package direct '+String(manifest.version||manifest.build||''),'Chargement '+index+'/'+manifest.files.length+' : '+name,15+Math.round(index/manifest.files.length*65));
    }

    const counts={
      gs:raw.filter(x=>/\.gs$/i.test(x.displayName)).length,
      html:raw.filter(x=>/\.html?$/i.test(x.displayName)).length
    };
    resolved=raw.map(x=>resolveImportedEntry(x,counts)).filter(Boolean);
  }
  if(manifest.schema==='cdq-script-bundle-v3'){
    const removals=await prepareEmbeddedModelRemovals(manifest.removeFiles||[],resolved,S.files);
    resolved.push(...removals);
  }
  if(!resolved.length)throw new Error('Aucun fichier du package ne correspond au projet.');

  S.pkg.clear();
  S.bundleAlreadyApplied=false;
  S.bundleTargetBuild='';
  resolved.forEach(entry=>{
    const k=entry.type+':'+String(entry.name).toLowerCase();
    S.draft.delete(k);
    S.pkg.set(k,entry);
  });

  S.pendingBuild=String(manifest.build||detectBuildLabel(resolved)||'');
  S.bundleLabel=String(manifest.version||manifest.build||'package direct');

  packageResult.innerHTML=
    '<b>Package direct chargé ✓</b><br>'+resolved.map(x=>esc(x.displayName||displayNameForFile(x))).join(' • ')+
    (S.pendingBuild?'<br><span>Version : '+esc(S.pendingBuild)+'</span>':'');

  renderFiles();
  if(S.pkg.has(S.sel))fileEditor.value=S.pkg.get(S.sel).source;
  renderDiff();
  updateQuickUi();

  const pendingNow=pendingChangeCount();
  setZipVisual('success','Package direct prêt ✓',resolved.length+' fichier(s) vérifié(s) • '+(S.pendingBuild||S.bundleLabel),100);
  setQuickResult(
    pendingNow>0
      ? 'Package direct prêt • '+pendingNow+' modification(s). Appuie sur « ÉCRIRE + DÉPLOYER ».'
      : 'Package direct prêt • code déjà présent. Appuie sur « ÉCRIRE + DÉPLOYER » pour publier la version.',
    'ok'
  );
  stat('Package direct prêt : '+resolved.length+' fichier(s) • '+(S.pendingBuild||S.bundleLabel)+'.','ok');

  // Le package est maintenant en mémoire : retirer le paramètre pour éviter
  // un nouvel import automatique après un futur redémarrage involontaire.
  try{
    const clean=new URL(location.href);
    clean.searchParams.delete('bundle');
    history.replaceState({},'',clean.pathname+clean.search+clean.hash);
  }catch(e){}
  S.bundleUrl='';
  return true;
}

async function maybeImportBundleV24(){
  if(!S.bundleUrl)return false;
  try{return await importBundleManifestV24(S.bundleUrl);}
  catch(e){
    setZipVisual('error','Package direct refusé',e.message,100);
    setQuickResult('Package direct : '+e.message,'err');
    stat('Package direct : '+e.message,'err');
    return false;
  }
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
  LS.removeItem(PENDING_BUNDLE_KEY_V41);
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
      if (/\.(cdq|json|txt)$/i.test(file.name) && /^\s*\{/.test(text)) {
        if(selected.length!==1)throw new Error('Importe le correctif CDQ seul pour vérifier sa version et ses fichiers.');
        await importLocalBundleV40(text);
        return;
      }
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
    const ready=Boolean(S.id&&(S.pkg.size>0||S.bundleAlreadyApplied)&&productionDeploymentReady());
    quickApply.disabled=!ready;
  }
  diffList.innerHTML = list.length ? list.map(x =>
    `<div class="diff-item"><div class="diff-head"><span class="diff-name">${esc(x.entry.displayName || displayNameForFile(x.entry))}</span><span class="diff-kind ${x.base ? 'changed' : 'new'}">${x.entry.remove ? 'RETIRÉ (SAUVEGARDÉ)' : x.base ? 'MODIFIÉ' : 'NOUVEAU'}</span></div><div class="diff-stats">Avant : ${lines(x.base?.source)} lignes • Après : ${lines(x.entry.source)} lignes</div></div>`
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

async function prepareEmbeddedModelRemovals(specs,staged,files){
  if(!Array.isArray(specs)||specs.length>32)throw Error('Nettoyage de modèles invalide.');
  const removals=[];
  const seen=new Set();
  for(const spec of specs){
    const name=String(spec.name||'');
    if(!/^(CDQTemplates\.gs|CDQ_Model_plancher(?:_v2291)?_\d+\.html)$/.test(name)){
      throw Error('Suppression de fichier non autorisée : '+name);
    }
    const parsed=importedFileSpec(name);
    const k=key(parsed);
    if(seen.has(k))throw Error('Suppression répétée : '+name);
    seen.add(k);
    const file=files.find(f=>key(f)===k);
    if(!file)continue;
    const accepted=Array.isArray(spec.sha256)?spec.sha256:[];
    const actual=await sha256HexV24(String(file.source||'').replace(/\r\n/g,'\n'));
    if(!accepted.includes(actual))throw Error(name+' a été modifié : nettoyage bloqué pour préserver son contenu.');
    removals.push({...file,displayName:name,source:'',remove:true});
  }
  const deleted=new Set(removals.map(key));
  const replacement=new Map(staged.map(f=>[key(f),f]));
  for(const f of files){
    if(deleted.has(key(f)))continue;
    const source=String((replacement.get(key(f))||f).source||'');
    for(const removed of removals){
      if(source.includes(removed.name))throw Error('Le modèle '+removed.name+' est encore référencé par '+f.name+'.');
    }
    if(removals.some(f=>f.name==='CDQTemplates')&&/\b(cdqTemplateEmbarque_|cdqMetaEmbarquee_|cdqChunkEmbarque_|cdqBlobEmbarque_)\b/.test(source)){
      throw Error('Le chargeur de modèles intégrés est encore utilisé par '+f.name+'.');
    }
  }
  return removals;
}

function buildUpdatedFileSet(freshFiles) {
  const out = clone(freshFiles);
  for (const [, entry] of changes()) {
    const base=S.files.find(x=>key(x)===key(entry));
    const found = out.find(x => x.type === entry.type && String(x.name).toLowerCase() === String(entry.name).toLowerCase());
    if((base && (!found || found.source!==base.source)) || (!base && found)){
      throw Error('Le fichier '+entry.name+' a changé depuis sa lecture. Recharge le projet et le package avant d’écrire.');
    }
    if(entry.remove){
      if(found)out.splice(out.indexOf(found),1);
      continue;
    }
    if (found) found.source = entry.source;
    else out.push({ name: entry.name, type: entry.type, source: entry.source });
  }
  if (!out.some(f => f.type === 'JSON' && f.name === 'appsscript')) {
    throw Error('appsscript.json absent après modification.');
  }
  // Recheck the freshly read project: another editor may have added a caller
  // in an unrelated file after the package was prepared.
  const removals=Array.from(changes().values()).filter(f=>f.remove);
  for(const f of out){
    const source=String(f.source||'');
    for(const removed of removals){
      if(source.includes(removed.name))throw Error('Le modèle '+removed.name+' est encore référencé par '+f.name+'.');
    }
    if(removals.some(f=>f.name==='CDQTemplates')&&/\b(cdqTemplateEmbarque_|cdqMetaEmbarquee_|cdqChunkEmbarque_|cdqBlobEmbarque_)\b/.test(source)){
      throw Error('Le chargeur de modèles intégrés est encore utilisé par '+f.name+'.');
    }
  }
  return out;
}

async function writeProjectChanges() {
  invalidateVersionDiagnosticV43();
  S.projectReadGeneration++;
  const count = validateChanges();
  setQuickDeployProgress(8, 'Lecture de la version actuelle depuis Google…');
  stat('1/4 Relecture depuis Google…');
  const fresh = await getProjectContent(S.id, cid());
  const updatedFiles=buildUpdatedFileSet(fresh.files);
  setQuickDeployProgress(16, 'Création de la sauvegarde complète…');
  stat('2/4 Sauvegarde complète…');
  await saveBackup(S.id, fresh, `Avant écriture (${count} fichier${count > 1 ? 's' : ''})`);
  setQuickDeployProgress(28, 'Écriture du nouveau code dans Apps Script…');
  stat('3/4 Écriture…');
  await updateProjectContent(S.id, updatedFiles, cid());
  setQuickDeployProgress(46, 'Code écrit — relecture et vérification Google…');
  stat('4/4 Vérification…');
  const checked = await getProjectContent(S.id, cid());
  for (const [k, entry] of changes()) {
    const f = (checked.files || []).find(x => key(x) === k);
    if(entry.remove){
      if(f)throw Error('Le fichier retiré est encore présent : '+entry.name);
      continue;
    }
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
  setQuickDeployProgress(55, 'Code écrit et vérifié dans Apps Script.');
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

async function waitForDeploymentVersionV26(target,versionNumber,timeoutMs=60000){
  const started=Date.now();
  let lastAll=[];
  let lastVersion=0;
  let lastError=null;

  while(Date.now()-started<timeoutMs){
    try{
      const all=await listDeployments(S.id,cid());
      lastAll=all||[];
      const d=lastAll.find(x=>String(x.deploymentId||'')===String(target));
      lastVersion=Number(d?.deploymentConfig?.versionNumber||0);

      if(d && lastVersion===Number(versionNumber)){
        return {all:lastAll,deployment:d,confirmed:true};
      }

      const elapsed=Math.round((Date.now()-started)/1000);
      if(S.deployBusy){
        const fraction=Math.min(1,(Date.now()-started)/Math.max(1,timeoutMs));
        setQuickDeployProgress(80+Math.round(fraction*10),'Propagation Google du déploiement… '+elapsed+' s');
      }
      setQuickResult(
        'Déploiement envoyé. Google annonce encore '+(lastVersion?('Apps Script v'+lastVersion):'une ancienne version')+
        ' — propagation '+elapsed+' s / '+Math.round(timeoutMs/1000)+' s…',
        'warn'
      );
    }catch(e){
      lastError=e;
    }
    await new Promise(r=>setTimeout(r,2500));
  }

  const suffix=lastError?(' Dernière erreur : '+lastError.message):'';
  throw new Error(
    'Google n’a pas encore confirmé Apps Script v'+versionNumber+
    ' sur le déploiement après '+Math.round(timeoutMs/1000)+' secondes.'+
    (lastVersion?(' Dernière version annoncée : v'+lastVersion+'.'):'')+suffix
  );
}

async function deployNewVersion(targetOverride = null) {
  invalidateVersionDiagnosticV43();
  S.projectReadGeneration++;
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
  const sourceBuild = S.lastWrittenBuild || S.sourceBuild || S.pendingBuild || '';

  setQuickDeployProgress(60, 'Création de la nouvelle version Apps Script…');
  const v = await createProjectVersion(S.id, desc, cid());
  setQuickDeployProgress(68, 'Version Apps Script créée : v'+v.versionNumber+'.');

  if (target === '__new__') {
    setQuickDeployProgress(74, 'Création du nouveau déploiement…');
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
    setQuickDeployProgress(98, 'Nouveau déploiement créé et relu.');
    stat(`Version ${v.versionNumber} créée + NOUVEAU déploiement créé. Attention : nouvelle URL.`, 'warn');
    return { version: v.versionNumber, deploymentId: created?.deploymentId, createdNew: true };
  }

  if (!Number.isInteger(targetDeployment?.deploymentConfig?.versionNumber)) {
    throw Error('Ce déploiement est en lecture seule. Choisis un déploiement versionné.');
  }

  setQuickDeployProgress(72, 'Mise à jour du déploiement existant…');
  const updatedDeployment=await updateDeployment(S.id, target, v.versionNumber, desc, cid());
  setQuickDeployProgress(78, 'Déploiement envoyé à Google — attente de propagation…');
  const updatedVersion=Number(updatedDeployment?.deploymentConfig?.versionNumber||0);
  if(updatedVersion!==Number(v.versionNumber)){
    throw new Error('Google a accepté la requête, mais le déploiement ne pointe pas vers Apps Script v'+v.versionNumber+'. Version retournée : v'+(updatedVersion||0)+'.');
  }

  let all=[];
  let verifiedDeployment=null;
  let productionHealth=null;
  let apiConfirmed=false;

  try{
    const confirmation=await waitForDeploymentVersionV26(
      target,
      v.versionNumber,
      isProductionProject()?45000:60000
    );
    all=confirmation.all;
    verifiedDeployment=confirmation.deployment;
    apiConfirmed=true;
  }catch(deploymentConfirmError){
    if(!isProductionProject())throw deploymentConfirmError;

    // Apps Script deployment listings can be eventually consistent.
    // For production, the live web-app build is the strongest evidence of
    // what technicians actually receive.
    setQuickDeployProgress(91, 'API Google encore en propagation — vérification directe de Balance CDQ…');
    stat('Étape 3/3 — API Google encore en propagation, vérification directe de Balance CDQ…','warn');
    setQuickResult(
      'La liste des déploiements Google est encore en retard. Vérification directe de l’URL de production…',
      'warn'
    );

    try{
      productionHealth=await verifyProductionWebAppReadyV23(sourceBuild,90000);
      try{all=await listDeployments(S.id,cid());}catch(_){all=[];}
      verifiedDeployment=all.find(d=>String(d.deploymentId||'')===String(target))||targetDeployment||null;
    }catch(healthError){
      throw new Error(
        'Le déploiement n’a été confirmé ni par la liste Google ni par l’URL de production. '+
        deploymentConfirmError.message+' • '+healthError.message
      );
    }
  }

  if(isProductionProject()&&String(target)!==CDQ_PRODUCTION_DEPLOYMENT_ID){
    throw Error('Vérification de sécurité échouée : la cible n’est pas le déploiement de production Balance CDQ.');
  }

  if(isProductionProject()){
    setQuickDeployProgress(92, 'Vérification de Balance CDQ réellement servie en production…');
    stat('Étape 3/3 — vérification serveur de Balance CDQ en production…');
    setQuickResult(
      apiConfirmed
        ? 'Déploiement confirmé. Vérification du Selector réellement servi en production…'
        : 'Déploiement API encore en propagation, mais production joignable. Validation du nouveau build…',
      'warn'
    );

    try{
      const health=productionHealth || await verifyProductionWebAppReadyV23(sourceBuild,90000);
      productionHealth=health;
      setKnownGoodV23(v.versionNumber);
      setQuickDeployProgress(98, 'Production confirmée — finalisation…');
      setQuickResult(
        `PRODUCTION TESTÉE ✓ ${sourceBuild||health.selectorBuild||health.build} • Apps Script v${v.versionNumber} • ${apiConfirmed?'déploiement + ':''}endpoint serveur confirmé.`,
        'ok'
      );
    }catch(healthError){
      // V30 : ne jamais annuler automatiquement un déploiement Google confirmé.
      // Une propagation/cache de l'URL /exec peut être plus lente que l'API de déploiement.
      // On garde donc la nouvelle version et on affiche un avertissement vérifiable.
      setQuickResult(
        `DÉPLOIEMENT GOOGLE CONFIRMÉ ✓ Apps Script v${v.versionNumber}. L’URL de production n’a pas encore confirmé ${sourceBuild||'le nouveau build'} : ${healthError.message}`,
        'warn'
      );
      stat(
        `DÉPLOIEMENT CONSERVÉ ✓ Apps Script v${v.versionNumber}. Vérification web encore en propagation — aucun rollback automatique.`,
        'warn'
      );
      try{all=await listDeployments(S.id,cid());}catch(_){all=[];}
      verifiedDeployment=all.find(d=>String(d.deploymentId||'')===String(target))||updatedDeployment||targetDeployment||null;
    }
  }

  renderDeployments(all);
  if (all.some(d => d.deploymentId === target)) deployment.value = target;
  updateDeploymentUi();
  saveSettings();
  const verificationPending=isProductionProject()&&!productionHealth;
  S.lastDeploymentResult = { version: v.versionNumber, deploymentId: target, createdNew: false, healthChecked:Boolean(productionHealth), verificationPending };

  S.pkg.clear();
  S.pendingBuild = '';
  S.bundleAlreadyApplied=false;
  S.bundleTargetBuild='';
  S.redeploySource=false;
  if(productionHealth)S.productionBuild=sourceBuild||S.productionBuild;
  renderDiff();
  updateQuickUi();

  if(verificationPending){
    setQuickDeployProgress(98, 'Déploiement conservé — production encore à vérifier.', 'warning');
    stat(`DÉPLOIEMENT GOOGLE CONFIRMÉ ✓ Apps Script v${v.versionNumber} • production encore à vérifier.`,'warn');
  }else if(isProductionProject()){
    setQuickDeployProgress(99, 'Production vérifiée — finalisation…');
    stat(`MISE À JOUR TERMINÉE ✓ Apps Script v${v.versionNumber} • production vérifiée côté serveur • même URL.`,'ok');
  }else{
    setQuickDeployProgress(99, 'Déploiement vérifié — finalisation…');
    setQuickResult(`MISE À JOUR CONFIRMÉE ✓ Apps Script v${v.versionNumber} • déploiement existant relu.`,'ok');
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

  if(pending===0 && !S.pkg.size && !S.bundleAlreadyApplied && !S.redeploySource){
    throw Error('Aucun package ni code source à déployer.');
  }

  if (pending > 0) {
    setQuickDeployProgress(5, 'Préparation de l’écriture de '+pending+' modification(s)…');
    stat(`Étape 1/${isProductionProject()?'3':'2'} — écriture de ${pending} modification(s) dans Apps Script…`);
    await writeProjectChanges();
  } else {
    const label=S.redeploySource
      ? 'Code source '+(S.sourceBuild||'actuel')+' déjà écrit — republication en production…'
      : 'Code déjà présent dans Apps Script — préparation du déploiement…';
    setQuickDeployProgress(55, label);
    stat(`Étape 1/${isProductionProject()?'3':'2'} — aucune modification en attente. Le code Google est déjà écrit; déploiement de la source actuelle.`);
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
if (quickApply) quickApply.addEventListener('click', runQuickDeployAction);
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
  LS.removeItem(PENDING_BUNDLE_KEY_V41);
  S.bundleUrl='';
  packageEditor.value = '';
  packageResult.innerHTML = '';
  clearZipVisual();
  S.pendingBuild = '';
  S.bundleAlreadyApplied=false;
  S.bundleTargetBuild='';
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
$('deployVersion').addEventListener('click', runQuickDeployAction);
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

  // V24 : un lien ChatGPT/CDQ peut préparer directement Code.gs + Selector.html
  // sans téléchargement ZIP sur le téléphone.
  try{
    const directBundle=bundleUrlFromLocationV24() || pendingBundleV41();
    if(directBundle){
      rememberPendingBundleV41(directBundle);
      S.bundleUrl=directBundle;
      S.bundleLabel=directBundle.split('/').slice(-2,-1)[0]||'package direct';
      if(quickZipSummary){
        quickZipSummary.textContent='Package direct • '+S.bundleLabel;
        quickZipSummary.className='warn';
      }
      setQuickResult('Package direct détecté. Connexion et projet en cours…','warn');
    }
  }catch(e){setQuickResult(e.message,'err');}

  try {
    await migrateLegacyBackups();
  } catch (migrationError) {
    try { LS.removeItem('cdqsm_backups'); } catch {}
  }
  await renderBackups();
  detectEmbeddedBrowser();
  updateInstallState();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js?v=43').catch(() => {});
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
