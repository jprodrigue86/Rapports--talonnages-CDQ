'use strict';

// V43: read-only Apps Script audit + an explicitly scoped private Drive report.
// Never serialize project source, session data, OAuth identifiers or raw errors.
const CDQ_DIAGNOSTIC_V43 = {generation:0, report:null, saving:false, savePending:false};
const CDQ_DIAGNOSTIC_DRIVE_SCOPE_V43 = 'https://www.googleapis.com/auth/drive.file';
const CDQ_DIAGNOSTIC_AUTO_KEY_V43 = 'cdqsm_private_diagnostic_v43';
const CDQ_DIAGNOSTIC_NAME_V43 = 'CDQ_Diagnostic_Versions.txt';
const CDQ_DIAGNOSTIC_ROOT_V43 = 'https://jprodrigue86.github.io/Rapports--talonnages-CDQ/';
const CDQ_DIAGNOSTIC_REPO_V43 = 'https://api.github.com/repos/jprodrigue86/Rapports--talonnages-CDQ';

function diagnosticElementV43(id){return typeof document==='undefined'?null:document.getElementById(id);}
function diagnosticSetTextV43(id,text){const el=diagnosticElementV43(id);if(el)el.textContent=text;}
function diagnosticVersionLabelV43(value){
  const label=String(value||'').trim();
  return /^(?:20\d{2}\.\d{2}\.\d{2}(?:\.\d+)?-)?v\d+\.\d+(?:\.\d+)?(?:-[A-Za-z0-9._-]+)?$/i.test(label)?label:'';
}
function diagnosticReleaseVersionV43(value){return diagnosticVersionLabelV43(value)||diagnosticVersionLabelV43('V'+String(value||''));}
function diagnosticDateV43(value){const d=new Date(value||'');return Number.isFinite(d.getTime())?d.toISOString():null;}
function diagnosticIdV43(value){const s=String(value||'');return /^[A-Za-z0-9_-]{1,160}$/.test(s)?s:'';}
function diagnosticDeclaredBuildV43(source){
  // Prefer the real declaration, never the highest version mentioned in a comment.
  const names=['CDQ_BUILD','CDQ_BACKEND_BUILD','CDQ_SERVER_BUILD','CDQ_APP_BUILD','CDQ_PACKAGE_BUILD','CDQ_APP_VERSION','CDQ_SERVER_VERSION','CDQ_PWA_BUILD','APP_BUILD','BUILD_ID','BUILD_VERSION','APP_VERSION','BUILD'];
  for(const name of names){
    const re=new RegExp('^[ \\t]*(?:(?:const|let|var)\\s+)?'+name+'\\s*=\\s*["\']([^"\'\\r\\n]+)["\']','gm');
    const labels=[...String(source||'').matchAll(re)].map(m=>diagnosticVersionLabelV43(m[1])).filter(Boolean);
    if(labels.length)return new Set(labels).size===1?labels[0]:'';
  }
  return '';
}
function diagnosticMainBuildV43(files){
  const code=(files||[]).find(f=>f.type==='SERVER_JS'&&/^code$/i.test(f.name));
  const selector=(files||[]).find(f=>f.type==='HTML'&&/^(selector|selecteur)$/i.test(f.name));
  return diagnosticDeclaredBuildV43(code?.source)||diagnosticDeclaredBuildV43(selector?.source);
}
async function diagnosticHashV43(text){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
}
async function diagnosticSummarizeFilesV43(files){
  if(!Array.isArray(files)||!files.length)throw new Error('INVALID_CONTENT');
  const summary=[];const seen=new Set();
  for(const f of files){
    const id=String(f.type)+':'+String(f.name);
    if(seen.has(id)||typeof f.source!=='string')throw new Error('INVALID_CONTENT');
    seen.add(id);
    const normalized=f.source.replace(/\r\n/g,'\n');
    const name=String(f.name).slice(0,180),type=String(f.type).slice(0,30);
    summary.push({name,type,bytes:new TextEncoder().encode(normalized).length,sha256:await diagnosticHashV43(normalized)});
  }
  summary.sort((a,b)=>(a.type+':'+a.name).localeCompare(b.type+':'+b.name,'en'));
  const code=files.find(f=>f.type==='SERVER_JS'&&/^code$/i.test(f.name));
  const selector=files.find(f=>f.type==='HTML'&&/^(selector|selecteur)$/i.test(f.name));
  return {backendBuild:diagnosticDeclaredBuildV43(code?.source)||null,selectorBuild:diagnosticDeclaredBuildV43(selector?.source)||null,
    fingerprintSha256:await diagnosticHashV43(JSON.stringify(summary)),files:summary};
}
function diagnosticAutoEnabledV43(){
  try{return localStorage.getItem(CDQ_DIAGNOSTIC_AUTO_KEY_V43)!=='0';}catch(_){return false;}
}
function diagnosticHasDriveScopeV43(){return String(CDQ.grantedScopes||'').split(/\s+/).includes(CDQ_DIAGNOSTIC_DRIVE_SCOPE_V43);}
function invalidateVersionDiagnosticV43(){
  CDQ_DIAGNOSTIC_V43.generation++;
  CDQ_DIAGNOSTIC_V43.report=null;
  diagnosticSetTextV43('diagnosticStatus','Lecture en attente ou en cours…');
  diagnosticSetTextV43('diagnosticText','Aucun diagnostic actuel.');
  diagnosticSetTextV43('diagnosticRows','');
  diagnosticSetTextV43('diagnosticDriveStatus','Aucun nouveau rapport enregistré pour cette lecture.');
  for(const id of ['diagnosticSave','diagnosticCopy']){const el=diagnosticElementV43(id);if(el)el.disabled=true;}
  const link=diagnosticElementV43('diagnosticDriveLink');if(link){link.hidden=true;link.removeAttribute('href');}
}
async function diagnosticPublicJsonV43(url){
  // Public requests never carry the Google token; URLs are constructed locally.
  if(!url.startsWith(CDQ_DIAGNOSTIC_ROOT_V43)&&!url.startsWith(CDQ_DIAGNOSTIC_REPO_V43+'/'))throw new Error('UNEXPECTED_ORIGIN');
  const u=new URL(url);u.searchParams.set('cdq_diag',String(Date.now()));
  const {response,text}=await cdqFetchOnceV39(u.href,{},new Headers({'Accept':'application/json'}),12000,'des versions publiques');
  if(!response.ok||text.length>2000000)throw new Error('PUBLIC_VERSION_UNAVAILABLE');
  return JSON.parse(text);
}
function diagnosticVersionOrderV43(a,b){
  const parts=v=>(String(v).match(/v(\d+)\.(\d+)(?:\.(\d+))?/i)||String(v).match(/^(\d+)\.(\d+)(?:\.(\d+))?$/)||[]).slice(1).map(n=>Number(n||0));
  const x=parts(a),y=parts(b);for(let i=0;i<3;i++){const d=(x[i]||0)-(y[i]||0);if(d)return d;}return 0;
}
async function diagnosticPublishedVersionsV43(){
  const get=async(path,project)=>{try{return project(await diagnosticPublicJsonV43(CDQ_DIAGNOSTIC_ROOT_V43+path));}catch(_){return {status:'unavailable'};}};
  const base=await Promise.all([
    get('downloads/android-release-update.json',d=>({status:'read',version:diagnosticReleaseVersionV43(d.versionName)||null,versionCode:Number(d.versionCode)||null})),
    get('iphone/app/release.json',d=>({status:'read',version:diagnosticReleaseVersionV43(d.version)||null,androidSourceBuild:diagnosticVersionLabelV43(d.androidSourceBuild)||null})),
    get('version.json',d=>({status:'read',version:diagnosticVersionLabelV43(d.version)||null,backendReference:diagnosticVersionLabelV43(d.backend_version)||null,selectorReference:diagnosticVersionLabelV43(d.selector_version)||null})),
    get('bundles/balance-cdq/latest/manifest.json',d=>({status:'read',version:diagnosticReleaseVersionV43(d.version)||null,build:diagnosticVersionLabelV43(d.build)||null})),
    get('apps-script-manager/version.json',d=>({status:'read',version:/^V\d+$/.test(d.version)?d.version:null}))
  ]);
  const result={android:base[0],iphone:base[1],web:base[2],automaticPackage:base[3],manager:base[4],github:{status:'unavailable'},newestServerPackage:{status:'unavailable'}};
  await Promise.all([
    (async()=>{try{const d=await diagnosticPublicJsonV43(CDQ_DIAGNOSTIC_REPO_V43+'/commits/main');result.github={status:'read',commit:/^[a-f0-9]{40}$/.test(d.sha)?d.sha:null,date:diagnosticDateV43(d.commit?.committer?.date)};}catch(_){}})(),
    (async()=>{try{
      const dirs=await diagnosticPublicJsonV43(CDQ_DIAGNOSTIC_REPO_V43+'/contents/bundles/balance-cdq?ref=main');
      const versions=dirs.filter(d=>d.type==='dir'&&/^v\d+\.\d+$/.test(d.name)).map(d=>d.name).sort((a,b)=>diagnosticVersionOrderV43(b,a));
      if(!versions.length)return;
      const d=await diagnosticPublicJsonV43(CDQ_DIAGNOSTIC_ROOT_V43+'bundles/balance-cdq/'+versions[0]+'/manifest.json');
      result.newestServerPackage={status:'read',version:diagnosticReleaseVersionV43(d.version)||null,build:diagnosticVersionLabelV43(d.build)||null};
    }catch(_){}})()
  ]);
  return result;
}
function diagnosticComparisonTextV43(comparison){
  return comparison===true?'Source et déploiement identiques (empreintes vérifiées)':comparison===false?'Source différente du déploiement versionné':'Comparaison non confirmée';
}
function diagnosticRowsV43(r){
  return [
    ['Script Manager',r.managerVersion],
    ['Source serveur Google',r.source?.backendBuild||'Version non détectée'],
    ['Source interface Google',r.source?.selectorBuild||'Version non détectée'],
    ['Déploiement configuré',r.production?.versionNumber?'Apps Script v'+r.production.versionNumber:'Non confirmé'],
    ['Serveur déployé',r.production?.content?.backendBuild||'Version non détectée'],
    ['Interface déployée',r.production?.content?.selectorBuild||'Version non détectée'],
    ['Comparaison',diagnosticComparisonTextV43(r.production?.matchesSource)],
    ['Android publié',r.published?.android?.version||'Non vérifié'],
    ['iPhone publié',r.published?.iphone?.version||'Non vérifié'],
    ['Web / PC publié',r.published?.web?.version||'Non vérifié'],
    ['Package automatique',r.published?.automaticPackage?.version||'Non vérifié'],
    ['Dernier package serveur',r.published?.newestServerPackage?.version||'Non vérifié'],
    ['GitHub main',r.published?.github?.commit?.slice(0,12)||'Non vérifié'],
    ['Appareils des techniciens','Versions installées non mesurées par ce diagnostic']
  ];
}
function diagnosticReportTextV43(r){
  const lines=['CDQ — Diagnostic privé des versions','Date UTC : '+r.completedAt,'Projet : '+r.project.name,'Script ID : '+r.project.id,''];
  for(const [name,value] of diagnosticRowsV43(r))lines.push(name+' : '+value);
  lines.push('','Le déploiement est vérifié par l’API Google et son contenu versionné. Le fonctionnement réel de /exec et les appareils ne sont pas testés.',
    'Ce rapport ne donne aucun accès distant et ne contient pas le code source, les mots de passe ni les jetons de connexion.',
    'Les erreurs sont des codes de diagnostic, sans réponse brute Google.','',JSON.stringify(r,null,2));
  return lines.join('\n');
}
function diagnosticRenderV43(r){
  const rows=diagnosticElementV43('diagnosticRows');
  if(rows){rows.replaceChildren();for(const [name,value] of diagnosticRowsV43(r)){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=name;dd.textContent=value;rows.append(dt,dd);}}
  diagnosticSetTextV43('diagnosticText',diagnosticReportTextV43(r));
  diagnosticSetTextV43('diagnosticStatus',r.issues.length?'Diagnostic terminé — '+r.issues.length+' point(s) à vérifier.':'Diagnostic terminé — source et publications relevées. Les appareils restent à vérifier.');
  for(const id of ['diagnosticSave','diagnosticCopy']){const el=diagnosticElementV43(id);if(el)el.disabled=false;}
  const authorize=diagnosticElementV43('diagnosticAuthorize');if(authorize)authorize.hidden=diagnosticHasDriveScopeV43();
}
async function startVersionDiagnosticV43({id,files,deployments,deploymentsReadOk,readGeneration}){
  const generation=++CDQ_DIAGNOSTIC_V43.generation;
  const current=()=>generation===CDQ_DIAGNOSTIC_V43.generation&&S.id===id&&S.projectReadGeneration===readGeneration&&hasLiveToken();
  const r={schema:'cdq-version-diagnostic-v1',startedAt:new Date().toISOString(),completedAt:null,managerVersion:APP_VERSION,
    project:{id:diagnosticIdV43(id),name:String(S.meta?.title||'Projet Apps Script').slice(0,160)},source:null,
    production:{status:'unconfirmed',matchesSource:null},published:null,issues:[],devices:{installedVersions:'not_measured'},runtime:{execHealth:'not_tested'}};
  diagnosticSetTextV43('diagnosticStatus','Lecture du code source et du contenu du déploiement Google…');
  const published=diagnosticPublishedVersionsV43();
  try{
    r.source=await diagnosticSummarizeFilesV43(files);
    if(!current())return;
    const target=id===CDQ_PRODUCTION_SCRIPT_ID?CDQ_PRODUCTION_DEPLOYMENT_ID:deployment.value;
    const active=(deployments||[]).find(d=>d.deploymentId===target);
    if(!deploymentsReadOk)r.issues.push('DEPLOYMENTS_UNAVAILABLE');
    else if(!active||!Number.isInteger(active.deploymentConfig?.versionNumber)||active.deploymentConfig.versionNumber<1)r.issues.push('VERSIONED_DEPLOYMENT_NOT_FOUND');
    else{
      const versionNumber=active.deploymentConfig.versionNumber;
      r.production={status:'configured',deploymentId:diagnosticIdV43(target),versionNumber,updatedAt:diagnosticDateV43(active.updateTime),matchesSource:null};
      try{
        const deployed=await getProjectContent(id,cid(),versionNumber);
        if(!current())return;
        const summary=await diagnosticSummarizeFilesV43(deployed.files);
        if(!current())return;
        // Re-read the exact deployed pointer after the potentially large content read.
        const fresh=await googleFetch(scriptApiUrl('/projects/'+encodeURIComponent(id)+'/deployments/'+encodeURIComponent(target)),cid());
        if(fresh.deploymentId!==target||fresh.deploymentConfig?.versionNumber!==versionNumber){
          r.production.status='changed_during_read';r.issues.push('DEPLOYMENT_CHANGED_DURING_READ');
        }else{
          r.production.status='content_verified';r.production.content=summary;
          r.production.matchesSource=summary.fingerprintSha256===r.source.fingerprintSha256;
          if(!r.production.matchesSource)r.issues.push('SOURCE_DIFFERS_FROM_DEPLOYMENT');
        }
      }catch(_){r.production.status='content_unavailable';r.issues.push('DEPLOYED_CONTENT_UNAVAILABLE');}
    }
  }catch(_){r.issues.push('SOURCE_SUMMARY_UNAVAILABLE');}
  r.published=await published;
  if(!current())return;
  const latest=r.published.automaticPackage,newest=r.published.newestServerPackage;
  if(latest.version&&newest.version&&diagnosticVersionOrderV43(latest.version,newest.version)<0)r.issues.push('AUTOMATIC_PACKAGE_BEHIND_NEWEST_SERVER_PACKAGE');
  if(Object.values(r.published).some(x=>x.status==='unavailable'))r.issues.push('SOME_PUBLIC_VERSIONS_UNAVAILABLE');
  if(r.source?.backendBuild&&newest.build&&diagnosticVersionOrderV43(r.source.backendBuild,newest.build)<0)r.issues.push('SOURCE_BEHIND_PUBLISHED_SERVER_PACKAGE');
  r.completedAt=new Date().toISOString();CDQ_DIAGNOSTIC_V43.report=r;diagnosticRenderV43(r);
  if(!S.deployBusy&&id===CDQ_PRODUCTION_SCRIPT_ID){
    S.productionBuild=r.production.content?.backendBuild||r.production.content?.selectorBuild||'';
    S.redeploySource=r.production.matchesSource===false;
    updateQuickUi();
    if(!S.pkg.size&&!S.bundleAlreadyApplied){
      setQuickResult(diagnosticComparisonTextV43(r.production.matchesSource)+(r.production.matchesSource===null?' — aucune conclusion de retard.':''),r.production.matchesSource===true?'ok':'warn');
    }
  }
  if(id===CDQ_PRODUCTION_SCRIPT_ID&&diagnosticAutoEnabledV43())await saveVersionDiagnosticV43();
  else diagnosticSetTextV43('diagnosticDriveStatus','Rapport prêt sur cet appareil. Enregistrement automatique désactivé pour cette lecture.');
}

async function diagnosticDriveRequestV43(url,options,token){
  // Separate from automatic OAuth renewal: a report must never cross accounts.
  const headers=new Headers(options.headers||{});headers.set('Authorization','Bearer '+token);headers.set('Accept','application/json');
  const {response,text}=await cdqFetchOnceV39(url,options,headers,25000,'du rapport privé Drive');
  if(!response.ok){const error=new Error('DRIVE_REPORT_UNAVAILABLE');error.status=response.status;throw error;}
  return text?JSON.parse(text):{};
}
async function saveVersionDiagnosticV43(){
  const r=CDQ_DIAGNOSTIC_V43.report;
  if(!r)return;
  if(CDQ_DIAGNOSTIC_V43.saving){CDQ_DIAGNOSTIC_V43.savePending=true;return;}
  if(!hasLiveToken()||!diagnosticHasDriveScopeV43()){
    diagnosticSetTextV43('diagnosticDriveStatus','Rapport prêt, mais pas encore enregistré. Touche « Autoriser le rapport Drive » une fois, puis relis le projet.');
    const button=diagnosticElementV43('diagnosticAuthorize');if(button)button.hidden=false;
    return;
  }
  const generation=CDQ_DIAGNOSTIC_V43.generation,token=CDQ.token;
  const current=()=>CDQ_DIAGNOSTIC_V43.report===r&&CDQ_DIAGNOSTIC_V43.generation===generation&&CDQ.token===token&&hasLiveToken()&&S.id===r.project.id;
  if(!current())return;
  CDQ_DIAGNOSTIC_V43.saving=true;
  const button=diagnosticElementV43('diagnosticSave');if(button)button.disabled=true;
  diagnosticSetTextV43('diagnosticDriveStatus','Enregistrement du rapport privé dans ton Drive…');
  try{
    const projectId=diagnosticIdV43(r.project.id);
    if(!projectId)throw new Error('INVALID_PROJECT');
    const q="trashed=false and 'root' in parents and 'me' in owners and mimeType='text/plain' and appProperties has { key='cdqDiagnostic' and value='versions-v43' } and appProperties has { key='cdqScriptId' and value='"+projectId+"' }";
    const url='https://www.googleapis.com/drive/v3/files?'+new URLSearchParams({q,fields:'files(id,shared,ownedByMe,mimeType,appProperties),nextPageToken',orderBy:'modifiedTime desc',pageSize:'100'});
    const listed=await diagnosticDriveRequestV43(url,{},token);
    if(!current())return;
    // Never overwrite a file only because its name happens to match.
    const existing=(listed.files||[]).find(f=>f.shared===false&&f.ownedByMe===true&&f.mimeType==='text/plain'&&f.appProperties?.cdqDiagnostic==='versions-v43'&&f.appProperties?.cdqScriptId===projectId&&diagnosticIdV43(f.id));
    let fileId=existing?.id||'';
    if(fileId){
      const check=await diagnosticDriveRequestV43('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(fileId)+'?fields=id,shared,ownedByMe,appProperties',{},token);
      if(check.shared!==false||check.ownedByMe!==true||check.appProperties?.cdqScriptId!==projectId||check.appProperties?.cdqDiagnostic!=='versions-v43')fileId='';
    }
    if(!current())return;
    const body=diagnosticReportTextV43(r);
    let saved;
    if(fileId){
      saved=await diagnosticDriveRequestV43('https://www.googleapis.com/upload/drive/v3/files/'+encodeURIComponent(fileId)+'?uploadType=media&fields=id,name,shared',
        {method:'PATCH',headers:{'Content-Type':'text/plain; charset=UTF-8'},body},token);
    }else{
      const boundary='cdqDiagnostic_'+crypto.randomUUID().replaceAll('-','');
      const metadata={name:CDQ_DIAGNOSTIC_NAME_V43,mimeType:'text/plain',parents:['root'],
        description:'Diagnostic privé des versions CDQ. Aucun code source ni jeton de connexion.',
        appProperties:{cdqDiagnostic:'versions-v43',cdqScriptId:projectId}};
      const multipart='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(metadata)+'\r\n--'+boundary+'\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n'+body+'\r\n--'+boundary+'--';
      saved=await diagnosticDriveRequestV43('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,shared',
        {method:'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body:multipart},token);
    }
    if(!current())return;
    if(!diagnosticIdV43(saved.id)||saved.shared!==false)throw new Error('PRIVATE_REPORT_NOT_CONFIRMED');
    const link=diagnosticElementV43('diagnosticDriveLink');if(link){link.href='https://drive.google.com/file/d/'+encodeURIComponent(saved.id)+'/view';link.hidden=false;}
    diagnosticSetTextV43('diagnosticDriveStatus','Rapport privé enregistré : '+CDQ_DIAGNOSTIC_NAME_V43+'. Tu peux maintenant demander à ChatGPT de lire ce diagnostic dans ton Drive.');
  }catch(error){
    if(current()){
      diagnosticSetTextV43('diagnosticDriveStatus',error.status===401||error.status===403?'Rapport non enregistré : Google demande une autorisation. Touche « Autoriser le rapport Drive », puis relis le projet.':'Enregistrement non confirmé. Le diagnostic reste visible et copiable ici. Aucun code ni déploiement n’a été modifié.');
      if(error.status===401||error.status===403){const authorize=diagnosticElementV43('diagnosticAuthorize');if(authorize)authorize.hidden=false;}
    }
  }finally{
    CDQ_DIAGNOSTIC_V43.saving=false;if(button)button.disabled=!CDQ_DIAGNOSTIC_V43.report;
    const next=CDQ_DIAGNOSTIC_V43.savePending&&CDQ_DIAGNOSTIC_V43.report&&CDQ_DIAGNOSTIC_V43.report!==r;
    CDQ_DIAGNOSTIC_V43.savePending=false;
    if(next)void saveVersionDiagnosticV43();
  }
}
function initializeVersionDiagnosticV43(){
  const checkbox=diagnosticElementV43('diagnosticAutoDrive');
  if(checkbox){checkbox.checked=diagnosticAutoEnabledV43();checkbox.addEventListener('change',()=>{try{localStorage.setItem(CDQ_DIAGNOSTIC_AUTO_KEY_V43,checkbox.checked?'1':'0');}catch(_){};diagnosticSetTextV43('diagnosticDriveStatus',checkbox.checked?'Le prochain diagnostic CDQ sera enregistré dans ton Drive privé.':'Enregistrement automatique désactivé. Les rapports déjà créés restent dans ton Drive.');});}
  diagnosticElementV43('diagnosticAuthorize')?.addEventListener('click',async()=>{
    const id=S.id||sid();
    invalidateVersionDiagnosticV43();S.projectReadGeneration++;
    try{
      await requestGoogleToken(cid(),'reuse');saveLiveGoogleToken();
      if(!diagnosticHasDriveScopeV43())throw new Error('SCOPE_NOT_GRANTED');
      // Re-read with the newly authorized account; never upload a cached other-account report.
      await readProject(id);
    }catch(_){diagnosticSetTextV43('diagnosticDriveStatus','Autorisation ou lecture non confirmée. Reconnecte le compte Google qui possède ce projet, puis touche « Lire le projet ».');}
  });
  diagnosticElementV43('diagnosticSave')?.addEventListener('click',()=>void saveVersionDiagnosticV43());
  diagnosticElementV43('diagnosticCopy')?.addEventListener('click',async()=>{
    const r=CDQ_DIAGNOSTIC_V43.report;if(!r)return;
    try{await navigator.clipboard.writeText(diagnosticReportTextV43(r));diagnosticSetTextV43('diagnosticDriveStatus','Diagnostic copié. Aucun code source ni jeton inclus.');}
    catch(_){diagnosticSetTextV43('diagnosticDriveStatus','Copie automatique indisponible. Le texte complet est dans « Voir le diagnostic complet ».');}
  });
}
if(typeof document!=='undefined')initializeVersionDiagnosticV43();
