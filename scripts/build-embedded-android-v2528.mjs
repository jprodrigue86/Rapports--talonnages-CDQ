import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {gunzipSync} from 'node:zlib';
const read=p=>fs.readFileSync(p,'utf8');
const base='https://jprodrigue86.github.io/Rapports--talonnages-CDQ/';
const local=base+'native/v25.28/';
const target='balance-cdq-android/app/build/generated/cdq-web-assets/cdq-web';
const source='balance-cdq-android/web-source/';
const files=new Map();
function copy(name){files.set(name,fs.readFileSync(name));}
function tree(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())tree(p);else copy(p);}}
// Include the existing offline/template/reader dependency chains, with their licenses.
for(const p of fs.readdirSync('.'))if(p.endsWith('.mjs')||/^(?:reader|floor-reader|pdf-fill).*\.html$/.test(p))copy(p);
for(const d of ['vendor','icons','assets'])tree(d);
for(const p of ['firebase-config.js','google-auth-config.js','manifest.webmanifest','bundles/balance-cdq/v25.14/icons-reference.png','bundles/balance-cdq/v25.15/icons-transparent.webp','bundles/balance-cdq/v25.17/banner-original.webp'])copy(p);
function replace(source,search,replacement){
  if(source.split(search).length!==2)throw Error('Expected one source anchor: '+search.slice(0,100));
  return source.replace(search,replacement);
}
let shell=read('index.html');
shell=replace(shell,"const CDQ_PWA_BUILD = '2026.09.23-v25.27-demarrage-dossiers';","const CDQ_PWA_BUILD = '2026.09.23-v25.28-apk-embarquee';");
shell=replace(shell,"if ('serviceWorker' in navigator) {","if (false && 'serviceWorker' in navigator) {");
shell=replace(shell,"function cdqFreshAppUrl(reason='boot'){","function cdqFreshAppUrl(reason='boot'){\n  return new URL('./Selector.html',location.href).href;\n}");
// Remove the former function body after replacing its opening.
shell=replace(shell,"\n  const sep=APP_URL.includes('?')?'&':'?';\n  return APP_URL+sep+'cdq_boot=1&cdq_reason='+encodeURIComponent(reason)+'&cdq_live='+encodeURIComponent(CDQ_BOOT_NONCE)+'&ts='+Date.now();\n}",'');
shell=replace(shell,"if (!event.source || !event.data || typeof event.data !== 'object') return false;","if (!event.source || !event.data || typeof event.data !== 'object') return false;\nif(event.origin===location.origin && event.source===app.contentWindow)return true;");
// Native Google sign-in uses its existing external authenticated return path.
shell=replace(shell,'<script src="https://accounts.google.com/gsi/client" async defer></script>','');
shell=replace(shell,"  if(cdqGoogleRenderingV42)return;","  if(window.BalanceCDQNative){\n    touchHelp.textContent='Connexion Google sécurisée. Retour automatique dans Balance CDQ.';\n    return;\n  }\n  if(cdqGoogleRenderingV42)return;");
// An APK interface cannot be updated by reloading the public website.
shell=replace(shell,"function cdqDemarrerSurveillanceMiseAJourV2254(){","function cdqDemarrerSurveillanceMiseAJourV2254(){\n  return; // Embedded interface updates are delivered by Android.\n");
files.set('index.html',Buffer.from(shell));
let selector=gunzipSync(fs.readFileSync(source+'Selector.html.gz')).toString('utf8');
selector=replace(selector,'<head>','<head>\n<script src="./embedded-rpc.js"></script>');
selector=selector.replaceAll('2026.09.23-v25.27-demarrage-dossiers','2026.09.23-v25.28-apk-embarquee');
selector=selector.replaceAll('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js',local+'vendor/pdf-lib-1.17.1.min.js');
files.set('Selector.html',Buffer.from(selector));
files.set('embedded-rpc.js',fs.readFileSync(source+'embedded-rpc.js'));
const mime={html:'text/html',js:'text/javascript',mjs:'text/javascript',css:'text/css',json:'application/json',webmanifest:'application/manifest+json',svg:'image/svg+xml',png:'image/png',webp:'image/webp',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',pdf:'application/pdf',wasm:'application/wasm',ttf:'font/ttf',woff:'font/woff',woff2:'font/woff2',txt:'text/plain'};
const manifest={version:'25.28',build:'2026.09.23-v25.28-apk-embarquee',files:{}};
fs.rmSync(target,{recursive:true,force:true});fs.mkdirSync(target,{recursive:true});
for(let [name,bytes] of files){
  const ext=path.extname(name).slice(1),text=['html','js','mjs','css','json','webmanifest','svg','txt'].includes(ext);
  if(text){
    let content=bytes.toString();
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
