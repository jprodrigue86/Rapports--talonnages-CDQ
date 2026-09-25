import fs from 'node:fs';
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
const local=base+'native/v25.33/';
const build='2026.09.25-v25.33-point50-personnel';
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
shell=replace(shell,'<head>','<head>\n<script src="./startup-unlock-v2529.js"></script>\n<script src="./embedded-rpc.js"></script>\n<link rel="icon" href="./icons/icon-heavy-v3-192.png">');
shell=replace(shell,"const CDQ_PWA_BUILD = '2026.09.23-v25.27-demarrage-dossiers';",`const CDQ_PWA_BUILD = '${build}';`);
shell=replace(shell,"if ('serviceWorker' in navigator) {","if (false && 'serviceWorker' in navigator) {");
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
shell=replace(shell,'window.cdqNativeBiometricResultV2507=function(requestId,success,message){',`window.cdqNativeBiometricResultV2507=function(requestId,success,message){
if(window.cdqStartupUnlockV2529?.receive(requestId,success,message))return;`);
shell=replace(shell,"if(ctx&&ctx.native){",`if(ctx&&ctx.native){
  window.cdqStartupUnlockV2529?.cancel(String(ctx.requestId||''));`);
shell=applySafeShell2532(shell);
files.set('index.html',Buffer.from(shell));
let selector=gunzipSync(fs.readFileSync(source+'Selector.html.gz')).toString('utf8');
selector=replace(selector,'<head>','<head>\n<meta charset="utf-8">\n<link rel="icon" href="./icons/icon-heavy-v3-192.png">\n<script src="./embedded-rpc.js"></script>');
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
selector=applyInstantFiles2530(selector);
selector=applyHomeUnderline2531(selector);
selector=applySafeSelector2532(selector);
selector=applyPersonalSizing2533(selector);
files.set('Selector.html',Buffer.from(selector));
files.set('safe-viewport-v2532.js',fs.readFileSync('safe-viewport-v2532.js'));
files.set('embedded-rpc.js',fs.readFileSync(source+'embedded-rpc.js'));
files.set('startup-unlock-v2529.js',fs.readFileSync(source+'startup-unlock-v2529.js'));
const mime={html:'text/html',js:'text/javascript',mjs:'text/javascript',css:'text/css',json:'application/json',webmanifest:'application/manifest+json',svg:'image/svg+xml',png:'image/png',webp:'image/webp',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',pdf:'application/pdf',wasm:'application/wasm',ttf:'font/ttf',woff:'font/woff',woff2:'font/woff2',txt:'text/plain'};
const manifest={version:'25.33',build,files:{}};
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
