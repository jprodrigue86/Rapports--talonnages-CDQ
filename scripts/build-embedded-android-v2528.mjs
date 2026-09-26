import fs from 'node:fs';
import {applyWholeWords2534} from './whole-words-v2534.mjs';
import {applyFullNames2536} from './full-names-v2536.mjs';
import {applyPersonalSizing2533} from './personal-sizing-v2533.mjs';
import {applySafeShell2532,applySafeSelector2532} from './safe-area-v2532.mjs';
import {applyHomeUnderline2531} from './home-underline-v2531.mjs';
import {applyInstantFiles2530} from './instant-files-v2530.mjs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {gunzipSync} from 'node:zlib';
const read=p=>fs.readFileSync(p,'utf8');
const base='https://jprodrigue86.github.io/Rapports--talonnages-CDQ/';
const local=base+'native/v25.47/';
const build='2026.09.26-v25.47-native-update-center';
const target='balance-cdq-android/app/build/generated/cdq-web-assets/cdq-web';
const source='balance-cdq-android/web-source/';
const files=new Map();
function copy(name){files.set(name,fs.readFileSync(name));}
function tree(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(e.name.startsWith('.'))continue;const p=dir+'/'+e.name;if(e.isDirectory())tree(p);else copy(p);}}
// Include the existing offline/template/reader dependency chains, with their licenses.
for(const p of fs.readdirSync('.'))if(p.endsWith('.mjs')||/^(?:reader|floor-reader|pdf-fill).*\.html$/.test(p))copy(p);
for(const d of ['vendor','icons','assets'])tree(d);
const pdfRuntime=JSON.parse(gunzipSync(fs.readFileSync(source+'pdf-runtime-assets.json.gz')));
for(const [name,encoded] of Object.entries(pdfRuntime.files)){
  if(!/^vendor\/pdfjs-6\.3\.289\/(?:cmaps|standard_fonts|wasm)\/[A-Za-z0-9_.-]+$/.test(name))throw Error('Invalid PDF asset path: '+name);
  const bytes=Buffer.from(encoded,'base64');
  if(files.has(name)&&!files.get(name).equals(bytes))throw Error('PDF asset version mismatch: '+name);
  files.set(name,bytes);
}
for(const p of ['firebase-config.js','google-auth-config.js','manifest.webmanifest','bundles/balance-cdq/v25.14/icons-reference.png','bundles/balance-cdq/v25.15/icons-transparent.webp','bundles/balance-cdq/v25.17/banner-original.webp'])copy(p);
function replace(source,search,replacement){
  if(source.split(search).length!==2)throw Error('Expected one source anchor: '+search.slice(0,100));
  return source.replace(search,replacement);
}
let shell=read('index.html');
shell=replace(shell,'<head>','<head>\n<script src="./startup-unlock-v2529.js"></script>\n<script src="./warm-unlock-v2540.js"></script>\n<script src="./embedded-rpc.js"></script>\n<link rel="icon" href="./icons/icon-heavy-v3-192.png">');
shell=replace(shell,"const CDQ_PWA_BUILD = '2026.09.23-v25.27-demarrage-dossiers';",`const CDQ_PWA_BUILD = '${build}';`);
shell=replace(shell,"if ('serviceWorker' in navigator) {","if (false && 'serviceWorker' in navigator) {");
// Android V25.43: do not reveal the first authenticated frame on a clock.
// The Selector explicitly reports when its icon/theme/layout controls are stable.
shell=replace(shell,'const MIN_LOADING_MS = 0;',`const MIN_LOADING_MS = 0;
let cdqFirstFrameStableV2543=!window.BalanceCDQNative;
let cdqFirstFrameStableSourceV2543=window.BalanceCDQNative?'':'non-native';
let cdqFirstFrameFallbackV2543=null;`);
shell=replace(shell,'if (selectorAwaitingAccess) {',`if (selectorAwaitingAccess) {
if(window.BalanceCDQNative){
  cdqFirstFrameStableV2543=false;
  cdqFirstFrameStableSourceV2543='';
  clearTimeout(cdqFirstFrameFallbackV2543);
}`);
shell=replace(shell,'const remaining = Math.max(0, MIN_LOADING_MS - elapsed);',`if(window.BalanceCDQNative && !cdqFirstFrameStableV2543){
  const generation=loadGeneration;
  clearTimeout(cdqFirstFrameFallbackV2543);
  cdqFirstFrameFallbackV2543=setTimeout(()=>{
    if(generation!==loadGeneration || cdqFirstFrameStableV2543)return;
    cdqFirstFrameStableV2543=true;
    cdqFirstFrameStableSourceV2543='fallback';
    masquerMurApresDelaiMinimum();
  },2500);
  return;
}
const remaining = Math.max(0, MIN_LOADING_MS - elapsed);`);
shell=replace(shell,`setTimeout(()=>{
  if(!iframeLoaded || selectorReady)return;`,`setTimeout(()=>{
  if(window.BalanceCDQNative)return;
  if(!iframeLoaded || selectorReady)return;`);
shell=replace(shell,`selectorReady = false;
iframeLoaded = false;
selectorAwaitingAccess = false;
clearTimeout(accessWaitTimer);`,`selectorReady = false;
iframeLoaded = false;
selectorAwaitingAccess = false;
cdqFirstFrameStableV2543=!window.BalanceCDQNative;
cdqFirstFrameStableSourceV2543=window.BalanceCDQNative?'':'non-native';
clearTimeout(cdqFirstFrameFallbackV2543);
clearTimeout(accessWaitTimer);`);
shell=replace(shell,`if (event.source !== selectorWindow || event.origin !== selectorOrigin) return;

if(data.type==='CDQ_FILE_HANDOFF_FREEZE_V2307'){`,`if (event.source !== selectorWindow || event.origin !== selectorOrigin) return;

if(data.type==='CDQ_FIRST_FRAME_STABLE_V2543'){
  if(Number(data.generation)!==loadGeneration)return;
  cdqFirstFrameStableV2543=true;
  cdqFirstFrameStableSourceV2543='signal';
  clearTimeout(cdqFirstFrameFallbackV2543);
  masquerMurApresDelaiMinimum();
  return;
}

if(data.type==='CDQ_FILE_HANDOFF_FREEZE_V2307'){`);
shell=replace(shell,`if((data.type==='CDQ_ACCESS_STATE' && data.state==='ready') || (data.type==='CDQ_SELECTOR_READY' && data.accessState==='ready'))replyToSelector(event.source,{type:'CDQ_OFFLINE_PREPARE'});`,`if((data.type==='CDQ_ACCESS_STATE' && data.state==='ready') || (data.type==='CDQ_SELECTOR_READY' && data.accessState==='ready')){
  replyToSelector(event.source,{type:'CDQ_OFFLINE_PREPARE'});
  if(window.BalanceCDQNative)replyToSelector(event.source,{type:'CDQ_FIRST_FRAME_ARM_V2543',generation:loadGeneration});
}`);
shell=replace(shell,"function cdqFreshAppUrl(reason='boot'){","function cdqFreshAppUrl(reason='boot'){\n  return new URL('./Selector.html',location.href).href;\n}");
// Remove the former function body after replacing its opening.
shell=replace(shell,"\n  const sep=APP_URL.includes('?')?'&':'?';\n  return APP_URL+sep+'cdq_boot=1&cdq_reason='+encodeURIComponent(reason)+'&cdq_live='+encodeURIComponent(CDQ_BOOT_NONCE)+'&ts='+Date.now();\n}",'');
shell=replace(shell,"if (!event.source || !event.data || typeof event.data !== 'object') return false;","if (!event.source || !event.data || typeof event.data !== 'object') return false;\nreturn event.origin===location.origin && event.source===app.contentWindow;");
// Native Google sign-in uses its existing external authenticated return path.
shell=replace(shell,'<script src="https://accounts.google.com/gsi/client" async defer></script>','');
shell=replace(shell,"  if(cdqGoogleRenderingV42)return;","  if(window.BalanceCDQNative){\n    touchHelp.textContent='Connexion Google sécurisée. Retour automatique dans Balance CDQ.';\n    return;\n  }\n  if(cdqGoogleRenderingV42)return;");
// An APK interface cannot be updated by reloading the public website.
shell=replace(shell,"function cdqDemarrerSurveillanceMiseAJourV2254(){","function cdqDemarrerSurveillanceMiseAJourV2254(){\n  return; // Embedded interface updates are delivered by Android.\n");
shell=replace(shell,"if(cdqSelectorBuildV2254)setTimeout(function(){cdqVerifierMiseAJourLiveV2254(selectorWindow,cdqSelectorBuildV2254,true)},1200);",'// Native release checks run outside the initial interface render.');
shell=replace(shell,'    BalanceCDQNative.biometric(String(requestId||\'\'));',`    if(mode==='unlock' && window.cdqStartupUnlockV2529?.attach(email,requestId,
      (ok,message)=>window.cdqNativeBiometricResultV2507(requestId,ok,message)))return;
    BalanceCDQNative.biometric(String(requestId||''));`);
shell=replace(shell,'window.cdqNativeBiometricResultV2507=function(requestId,success,message){',`window.cdqNativeBiometricResultV2507=function(requestId,success,message,grant){
if(window.cdqStartupUnlockV2529?.receive(requestId,success,message,grant))return;
try{
  const __ctx=bioContext;
  if(__ctx&&__ctx.mode==='unlock')window.cdqWarmUnlockV2540?.observe(requestId,success,message,grant);
}catch(_){ }`);
shell=replace(shell,"if(ctx&&ctx.native){",`if(ctx&&ctx.native){
  window.cdqStartupUnlockV2529?.cancel(String(ctx.requestId||''));`);
shell=applySafeShell2532(shell);
files.set('index.html',Buffer.from(shell));
let selector=gunzipSync(fs.readFileSync(source+'Selector.html.gz')).toString('utf8');
selector=replace(selector,'<head>','<head>\n<meta charset="utf-8">\n<link rel="icon" href="./icons/icon-heavy-v3-192.png">\n<link rel="stylesheet" href="./icon-artwork-baseline-v2540.css">\n<script src="./embedded-rpc.js"></script>');
selector=replace(selector,'</body>','<script src="./first-frame-stable-v2543.js"></script>\n<script src="./client-speed-v2544.js"></script>\n</body>');
selector=selector.replaceAll('2026.09.23-v25.27-demarrage-dossiers',build);
// A prompt already running over the music wall must not wait behind a failed
// network-only resume attempt. Returning from Sheets keeps the existing page.
selector=replace(selector,'if(!skipFastBiometric && cdqSession24.resume(',
  'if(!skipFastBiometric && !window.parent.cdqStartupUnlockV2529?.activeFor(cdqObtenirJetonAppareil()) && cdqSession24.resume(');
selector=selector.replaceAll('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js',local+'vendor/pdf-lib-1.17.1.min.js');
// Later display modules already call these helpers across script boundaries.
// Explicit exports keep preference restoration working in the installed page.
selector=replace(selector,'window.cdqApplyAllScalesV89=cdqApplyAllScalesV89;',`window.cdqApplyAllScalesV89=cdqApplyAllScalesV89;
Object.assign(window,{cdqGeneralValueV89,cdqTextValueV89,cdqIconValueV89,cdqGeneralZoomV89,cdqTextZoomV89,cdqIconZoomV89,cdqClampScaleV89,cdqPwaGetDisplayPrefsV2215,cdqIsMobileUiV89,cdqEnsureRuntimeStyleV89,cdqCheckUpdate,cdqCloseSwipes,cdqCollectPreferencesV72,cdqFitGeneralScaleV92,cdqForceUpdate,cdqRunSendSelection,cdqScheduleSavePreferencesV72,cdqSetEffectiveScaleV2216,cdqVersionLabelV87});`);
selector=replace(selector,'Balance CDQ / Selector se met à jour avec Script Manager. La couche Android se met à jour séparément.','Les écrans et les images se mettent à jour avec l’APK. Script Manager met à jour les services CDQ.');
selector=replace(selector,'Les mises à jour normales de Balance CDQ continuent avec Script Manager. ','Les écrans, images et outils PDF font partie de cette installation. ');
selector=replace(selector,'Ce bouton sert seulement quand la petite couche Android native doit être mise à jour.','Ce bouton vérifie les nouvelles versions de l’application Android.');
// Android V25.47: the in-app update center must read the durable APK channel,
 // never the web/Script Manager bundle channel.
selector=replace(selector,'function cdqRefreshUpdateCenterUI(){',`function cdqNativeUpdateBridgeV2547(){
  try{return window.BalanceCDQNative || (window.parent&&window.parent.BalanceCDQNative) || null;}catch(_){return window.BalanceCDQNative||null;}
}
function cdqNativeUpdateIdentityV2547(){
  const bridge=cdqNativeUpdateBridgeV2547();
  try{
    if(bridge&&typeof bridge.updateIdentity==='function'){
      const raw=JSON.parse(String(bridge.updateIdentity()||'{}'));
      const name=String(raw.versionName||'').trim().replace(/^V/i,'');
      const code=Number(raw.versionCode||0);
      if(name&&code>0)return {version:'V'+name,code};
    }
  }catch(_){}
  const m=String(navigator.userAgent||'').match(/BalanceCDQAndroid\\/(\\d+(?:\\.\\d+)?)/i);
  if(!m)return null;
  const p=m[1].split('.');
  return {version:'V'+m[1],code:(Number(p[0]||0)*100)+Number(p[1]||0)};
}
async function cdqFetchNativeUpdateManifestV2547(){
  const stamp=Date.now();
  const urls=[
    'https://jprodrigue86.github.io/Rapports--talonnages-CDQ/downloads/android-release-update.json?cdq_ts='+stamp,
    'https://raw.githubusercontent.com/jprodrigue86/Rapports--talonnages-CDQ/main/downloads/android-release-update.json?cdq_ts='+stamp
  ];
  const settled=await Promise.allSettled(urls.map(async function(url){
    const response=await fetch(url,{cache:'no-store'});
    if(!response.ok)throw Error('HTTP '+response.status);
    const json=await response.json();
    const code=Number(json&&json.versionCode||0);
    if(!code||!json.versionName||!json.apkUrl)throw Error('Manifeste Android incomplet.');
    return json;
  }));
  const values=settled.filter(function(x){return x.status==='fulfilled';}).map(function(x){return x.value;});
  if(!values.length)throw Error('Impossible de joindre le canal Android stable.');
  values.sort(function(a,b){return Number(b.versionCode||0)-Number(a.versionCode||0);});
  return values[0];
}

function cdqRefreshUpdateCenterUI(){`);

selector=replace(selector,`    const installedBuild=CDQ_BUILD;
    const remoteBuild=String(cdqUpdateInfo.latest||"");
    const newer=cdqCompareVersionV2248(remoteBuild,installedBuild)>0;
    const availableBuild=newer?remoteBuild:"";`,`    const identity=cdqNativeUpdateIdentityV2547();
    const installedBuild=identity?identity.version:String(cdqUpdateInfo.current||CDQ_BUILD);
    const remoteBuild=String(cdqUpdateInfo.latest||"");
    const updateError=String(cdqUpdateInfo.erreur||"");
    const newer=!!cdqUpdateInfo.disponible || cdqCompareVersionV2248(remoteBuild,installedBuild)>0;
    const availableBuild=newer?remoteBuild:"";`);

selector=replace(selector,`    if(latest){
      latest.textContent=newer?cdqVersionLabelV87(availableBuild):"—";
      latest.title=newer?cdqVersionDetailV87(availableBuild):"Aucune version plus récente.";
    }`,`    if(latest){
      latest.textContent=newer?cdqVersionLabelV87(availableBuild):"—";
      latest.title=updateError?updateError:(newer?cdqVersionDetailV87(availableBuild):"Aucune version plus récente.");
    }`);

selector=replace(selector,`      }else if(newer){
        status.textContent="Mise à jour disponible";
        status.className="cdq-update-state available";
      }else{
        status.textContent="À jour";
        status.className="cdq-update-state current";
      }`,`      }else if(updateError){
        status.textContent="Vérification impossible";
        status.className="cdq-update-state checking";
      }else if(newer){
        status.textContent="Mise à jour disponible";
        status.className="cdq-update-state available";
      }else{
        status.textContent="À jour";
        status.className="cdq-update-state current";
      }`);

selector=replace(selector,`    if(install){
      install.disabled=!newer;
      install.textContent=newer
        ? ("Installer "+cdqVersionLabelV87(availableBuild))
        : "Déjà à jour";
      install.title=newer
        ? ("Installer la dernière version publiée : "+availableBuild)
        : "Aucune mise à jour plus récente n’est disponible.";
    }`,`    if(install){
      install.disabled=!newer&&!updateError;
      install.textContent=updateError
        ? "Vérifier avec Android"
        : (newer ? ("Installer "+cdqVersionLabelV87(availableBuild)) : "Déjà à jour");
      install.title=updateError
        ? "Ouvrir le vérificateur Android natif."
        : (newer ? ("Installer la dernière version publiée : "+availableBuild) : "Aucune mise à jour plus récente n’est disponible.");
    }`);

selector=replace(selector,`function cdqCheckUpdate(){
    if(!cdqPwaAvailable()){
      cdqUpdateInfo={disponible:false,latest:"",current:CDQ_BUILD,verifie:true};
      cdqRefreshUpdateCenterUI();
      return;
    }
    try{cdqPostToPwa({type:"CDQ_CHECK_UPDATE",authProtocol:42,accessState:cdqAccessState,build:CDQ_BUILD});}catch(e){}
  }`,`function cdqCheckUpdate(){
    const identity=cdqNativeUpdateIdentityV2547();
    if(identity){
      cdqUpdateInfo={disponible:false,latest:"",current:identity.version,verifie:false,erreur:""};
      cdqRefreshUpdateCenterUI();
      cdqFetchNativeUpdateManifestV2547().then(function(manifest){
        const latest='V'+String(manifest.versionName||'').replace(/^V/i,'');
        cdqUpdateInfo={
          disponible:Number(manifest.versionCode||0)>Number(identity.code||0),
          latest:latest,current:identity.version,verifie:true,erreur:""
        };
        cdqRefreshUpdateCenterUI();
      }).catch(function(error){
        cdqUpdateInfo={
          disponible:false,latest:"",current:identity.version,verifie:true,
          erreur:error&&error.message?error.message:String(error||"Vérification Android impossible.")
        };
        cdqRefreshUpdateCenterUI();
      });
      return;
    }
    if(!cdqPwaAvailable()){
      cdqUpdateInfo={disponible:false,latest:"",current:CDQ_BUILD,verifie:true,erreur:""};
      cdqRefreshUpdateCenterUI();
      return;
    }
    try{cdqPostToPwa({type:"CDQ_CHECK_UPDATE",authProtocol:42,accessState:cdqAccessState,build:CDQ_BUILD});}catch(e){}
  }`);

selector=replace(selector,`  function cdqForceUpdate(){
    if(cdqCompareVersionV2248(cdqUpdateInfo.latest,CDQ_BUILD)<=0)return;`,`  function cdqForceUpdate(){
    const identity=cdqNativeUpdateIdentityV2547();
    if(identity){
      const bridge=cdqNativeUpdateBridgeV2547();
      try{
        if(bridge&&typeof bridge.openUpdater==='function'){bridge.openUpdater();return;}
      }catch(_){}
      try{window.top.location.href='cdqupdate://check';}catch(_){location.href='cdqupdate://check';}
      return;
    }
    if(cdqCompareVersionV2248(cdqUpdateInfo.latest,CDQ_BUILD)<=0)return;`);

selector=applyInstantFiles2530(selector);
selector=applyHomeUnderline2531(selector);
selector=applySafeSelector2532(selector);
selector=applyPersonalSizing2533(selector);
selector=applyWholeWords2534(selector);
selector=applyFullNames2536(selector);
selector=replace(selector,
  '      item.textContent =\n        compagnie.nom;\n\n\n      item.onclick =',
  '      item.textContent =\n        compagnie.nom;\n      item.dataset.companyId=String(compagnie.id||"");\n\n\n      item.onclick ='
);
selector=replace(selector,
  '      const row=document.createElement("div"); row.className="company-item cdq-company-row";',
  '      const row=document.createElement("div"); row.className="company-item cdq-company-row"; row.dataset.companyId=String(comp.id||"");'
);
selector=replace(selector,
  '      afficherDossierRecursif(sousDossier, contenu);',
  '      if(!document.documentElement.classList.contains("mobile-device"))afficherDossierRecursif(sousDossier, contenu);'
);
files.set('Selector.html',Buffer.from(selector));
files.set('safe-viewport-v2532.js',fs.readFileSync('safe-viewport-v2532.js'));
files.set('embedded-rpc.js',fs.readFileSync(source+'embedded-rpc.js'));
files.set('startup-unlock-v2529.js',fs.readFileSync(source+'startup-unlock-v2529.js'));
files.set('warm-unlock-v2540.js',fs.readFileSync(source+'warm-unlock-v2540.js'));
files.set('first-frame-stable-v2543.js',fs.readFileSync(source+'first-frame-stable-v2543.js'));
files.set('client-speed-v2544.js',fs.readFileSync(source+'client-speed-v2544.js'));
files.set('icon-artwork-baseline-v2540.css',fs.readFileSync('icon-artwork-baseline-v2540.css'));
const mime={html:'text/html',js:'text/javascript',mjs:'text/javascript',css:'text/css',json:'application/json',webmanifest:'application/manifest+json',svg:'image/svg+xml',png:'image/png',webp:'image/webp',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',pdf:'application/pdf',wasm:'application/wasm',ttf:'font/ttf',woff:'font/woff',woff2:'font/woff2',txt:'text/plain'};
const manifest={version:'25.47',build,files:{}};
fs.rmSync(target,{recursive:true,force:true});fs.mkdirSync(target,{recursive:true});
for(let [name,bytes] of files){
  const ext=path.extname(name).slice(1),text=['html','js','mjs','css','json','webmanifest','svg','txt'].includes(ext);
  if(text){
    let content=bytes.toString();
    content=content.replaceAll('https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/',local+'vendor/pdfjs-6.3.289/');
    // Never rewrite mutable release manifests, Script Manager or client document URLs.
    for(const asset of files.keys())content=content.replaceAll(base+asset,local+asset);
    bytes=Buffer.from(content);
    if(ext==='js'&&!name.startsWith('vendor/'))new vm.Script(content,{filename:name});
    if(ext==='html')for(const m of content.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!m[1].includes('application/json')&&!m[1].includes('type="module"'))new vm.Script(m[2],{filename:name});
  }
  const dest=target+'/'+name;fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes);
  manifest.files[name]={bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),mime:mime[ext]||'application/octet-stream',text};
}
fs.writeFileSync(target+'/asset-manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log('Embedded Android:',Object.keys(manifest.files).length,'files,',Object.values(manifest.files).reduce((n,f)=>n+f.bytes,0),'bytes before APK compression.');
