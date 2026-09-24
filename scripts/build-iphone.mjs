import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {adaptIphoneRpc,IPHONE_CONNECTION_REVISION} from './iphone-rpc-compat.mjs';
const source=process.env.CDQ_ASSET_SOURCE||'balance-cdq-android/app/build/generated/cdq-web-assets/cdq-web';
const out=process.env.CDQ_IPHONE_OUTPUT||'iphone/app';
const nativeManifest=JSON.parse(fs.readFileSync(path.join(source,'asset-manifest.json'),'utf8'));
const version=nativeManifest.version;
const nativeBase='https://jprodrigue86.github.io/Rapports--talonnages-CDQ/native/v'+version+'/';
const base=process.env.CDQ_IPHONE_PUBLIC_BASE||'https://jprodrigue86.github.io/Rapports--talonnages-CDQ/iphone/app/';
const files=new Map(),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=p=>fs.readFileSync(p,'utf8');
function once(text,from,to){assert.equal(text.split(from).length,2,'Source anchor changed: '+from.slice(0,90));return text.replace(from,to);}
function removeScript(text,id){const re=new RegExp('<script id="'+id+'">[\\s\\S]*?<\\/script>');assert.match(text,re);return text.replace(re,'');}
for(const [name,meta] of Object.entries(nativeManifest.files)){
  assert(!name.includes('..')&&!path.isAbsolute(name));
  let bytes=fs.readFileSync(path.join(source,name));assert.equal(sha(bytes),meta.sha256,'Android source mismatch: '+name);
  if(meta.text)bytes=Buffer.from(bytes.toString().replaceAll(nativeBase,base));
  files.set(name,bytes);
}
const nativeSelector=files.get('Selector.html').toString();
let shell=files.get('index.html').toString(),selector=nativeSelector;
shell=once(shell,'<script src="./startup-unlock-v2529.js"></script>','<script src="./iphone-update.js"></script>\n<script src="https://accounts.google.com/gsi/client" defer></script>');
// The protocol is shared; the iPhone copy handles WebKit's exact Google relay.
// Its updater has an isolated service-worker scope; the APK updater stays disabled.
shell=once(shell,'<title>Rapports D’étalonnages</title>','<title>CDQ Étalonnage</title>\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-title" content="CDQ Étalonnage">\n<link rel="apple-touch-icon" href="./icons/icon-heavy-v3-192.png">');
selector=once(selector,'<head>','<head>\n<script src="./iphone-update.js"></script>');
selector=removeScript(selector,'cdqV2313AndroidUpdaterJs');
selector=removeScript(selector,'cdqV2503UpdateHandoffJs');
// WebKit can reject a storage transaction with null. Keep the original failure
// non-fatal and visible in the console; do not claim the offline model is cached.
selector=once(selector,"}catch(e){console.warn('Modèle intégré :',e.message||String(e));}","}catch(e){console.warn('Modèle intégré :',(e&&e.message)||String(e)||'Cache indisponible');}");
// Retain RPC progress feedback; only the legacy web update controls are disabled.
selector=once(selector,'function drawUpdate(){\n const host=', 'function drawUpdate(){\n return; // iPhone updates use the scoped worker.\n const host=');
selector=once(selector,'async function check(force=false){\n if(checking||navigator.onLine===false||!force&&Date.now()-lastCheck<60000)return;', 'async function check(force=false){\n return; // iPhone updates use the scoped worker.\n if(checking||navigator.onLine===false||!force&&Date.now()-lastCheck<60000)return;');
selector=once(selector,'<strong>Lien officiel d’installation</strong>','<strong>Application Android et application iPhone</strong>');
selector=once(selector,'<button type="button" id="cdqShareNative"',`<a class="modal-button" href="https://jprodrigue86.github.io/Rapports--talonnages-CDQ/installer.html?platform=android" target="_blank" rel="noopener">Application Android — ouvrir / copier le lien</a>\n<a class="modal-button" href="https://jprodrigue86.github.io/Rapports--talonnages-CDQ/iphone/" target="_blank" rel="noopener">Application iPhone — ouvrir / copier le lien</a>\n<button type="button" id="cdqShareNative"`);
selector=selector.replaceAll('Les écrans et les images se mettent à jour avec l’APK. Script Manager met à jour les services CDQ.','Sur iPhone, vérifiez la mise à jour ici puis relancez après avoir enregistré vos documents.');
for(const [name,html] of [['index.html',shell],['Selector.html',selector]]){
  files.set(name,Buffer.from(html.replace(/<html\b([^>]*)>/i,'<html$1 data-cdq-iphone-version="'+version+'" data-cdq-iphone-release="__RELEASE__">')));
}
files.delete('startup-unlock-v2529.js');
files.set('embedded-rpc.js',Buffer.from(adaptIphoneRpc(files.get('embedded-rpc.js').toString())));
files.set('connection-repair.html',Buffer.from(read('iphone-source/connection-repair.html')));
files.set('iphone-update.js',Buffer.from(read('iphone-source/iphone-update.js')));
files.set('manifest.webmanifest',Buffer.from(JSON.stringify({id:'./',name:'CDQ Étalonnage',short_name:'CDQ Étalonnage',description:'CDQ Étalonnage pour iPhone — application web installable',start_url:'./',scope:'./',display:'standalone',theme_color:'#000000',background_color:'#000000',icons:[192,512].map(n=>({src:'./icons/icon-heavy-v3-'+n+'.png',sizes:n+'x'+n,type:'image/png',purpose:'any'}))},null,2)+'\n'));
const release=sha(Buffer.concat([...files.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([n,b])=>Buffer.from(n+'\0'+sha(b)+'\n')).concat([Buffer.from(read('iphone-source/sw.js'))])));
for(const name of ['index.html','Selector.html'])files.set(name,Buffer.from(files.get(name).toString().replace('__RELEASE__',release)));
const hashes=Object.fromEntries([...files].map(([n,b])=>[n,sha(b)]));
const releaseInfo={platform:'iphone-pwa',version,release,connectionRevision:IPHONE_CONNECTION_REVISION,androidSourceBuild:nativeManifest.build,androidSelectorSha256:nativeManifest.files['Selector.html'].sha256,generatedFrom:'scripts/build-embedded-android-v2528.mjs',files:files.size};
files.set('release.json',Buffer.from(JSON.stringify(releaseInfo,null,2)+'\n'));
files.set('sw.js',Buffer.from(read('iphone-source/sw.js').replace('__CDQ_RELEASE_JSON__',JSON.stringify(release)).replace('__CDQ_ASSETS_JSON__',JSON.stringify(hashes))));
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
for(const [name,bytes] of files){
  const ext=path.extname(name);
  if((ext==='.js'||ext==='.html')&&!name.startsWith('vendor/')){
    const text=bytes.toString();
    if(ext==='.js')new vm.Script(text,{filename:name});
    else for(const m of text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!/type=["'](?:module|application\/json)["']/.test(m[1]))new vm.Script(m[2],{filename:name});
  }
  const dest=path.join(out,name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes);
}
console.log('iPhone PWA generated from Android '+version+': '+files.size+' static files; release '+release);
// The Android app already opens this public page: no new APK for these links.
let install=read('iphone-source/installer.html').replaceAll('__ANDROID_VERSION__',version);
install=once(install,'<a class="button iphone" href="./iphone/app/">Ouvrir l’application iPhone</a>','<a class="button iphone" href="./iphone/app/">Ouvrir l’application iPhone</a>\n<p class="small">Connexion bloquée ou application déjà installée ?</p>\n<a id="iphone-repair" class="button" href="./iphone/app/connection-repair.html">Actualiser puis ouvrir CDQ sur iPhone</a>');
fs.writeFileSync('installer.html',install);
fs.mkdirSync('iphone',{recursive:true});
let landing=install.replace('<head>','<head><base href="../"><link rel="manifest" href="./iphone/app/manifest.webmanifest"><link rel="apple-touch-icon" href="./icons/icon-heavy-v3-192.png"><meta name="apple-mobile-web-app-capable" content="yes">');
landing=landing.replace('<section class="card" id="android"','<section class="card" hidden id="android"').replace('Choisis le téléphone du technicien.<br>Un lien Android et un lien iPhone distincts.','Installation iPhone / iPad');
fs.writeFileSync('iphone/index.html',landing);
