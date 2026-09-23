import fs from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
const dir='bundles/balance-cdq/v25.27',read=p=>fs.readFileSync(p,'utf8');
const base=JSON.parse(read('bundles/balance-cdq/v25.26/manifest.json'));
const build='2026.09.23-v25.27-demarrage-dossiers';
const patches=['Code.gs','Selector.html'].map(file=>({file,op:'replace_build_any',from:[base.build],to:build}));
function replace(id,search,replacement,file='Selector.html',expected=1){patches.push({id,file,op:'replace_literal',search,replacement,...(expected===1?{}:{expected})});}

// Keep exactly the same artwork; download/cache each asset independently of HTML.
patches.push({file:'Selector.html',op:'remove_style_id',id:'cdqIconThemesCssV2514'});
patches.push({id:'cached-artwork',file:'Selector.html',op:'insert_before_literal',before:'<script id="cdqIconThemesJsV2514">',text:'<style id="cdqIconThemesCssV2514">'+read(dir+'/icon-themes.css')+'</style>\n'});
// Apps Script's served HTML omits comments retained by the editable project.
// Normalize only these two archived comments, then require the complete code.
for(const [id,search] of [
  ['legacy-company-cache-comment',"// Si le cache local est déjà affiché, on ne bloque pas l'application."],
  ['legacy-company-refresh-comment','// La liste locale apparaît tout de suite, puis Drive est vérifié silencieusement.']
])patches.push({id,file:'Selector.html',op:'replace_literal_if_present',search,replacement:''});
replace('company-list',read(dir+'/clients-previous.js').trimEnd()+'\n',read(dir+'/clients.js').trimEnd()+'\n');
replace('startup-priority','  nettoyerAncienCache();\n  chargerClients();\n  cdqSetAccessState("ready");',
  '  cdqSetAccessState("ready");\n  chargerClients(false,etat.compagniesInitiales);\n  setTimeout(function(){if(cdqAccessState==="ready")nettoyerAncienCache();},3000);');
replace('folder-priority',read(dir+'/folder-load-previous.js').trimEnd()+'\n',(read(dir+'/folder-loader.js')+'\n'+read(dir+'/folder-integration.js')).trimEnd()+'\n');
replace('client-refresh-keeps-preloads',read(dir+'/client-refresh-previous.js').trimEnd()+'\n',read(dir+'/client-refresh.js').trimEnd()+'\n');
replace('mobile-renders-prepared-folder','if(sousDossier && sousDossier.charge === false && typeof window.cdqLazyOpenFolder === "function"){','if(vaOuvrir && sousDossier && typeof window.cdqLazyOpenFolder === "function"){');
replace('desktop-prepares-next-level','if(node && node.charge === false){','if(node){');
replace('lock-cancels-preload',"  cdqPostToPwa({type:'CDQ_ACCESS_STATE',state:state,authProtocol:42});", "  cdqPostToPwa({type:'CDQ_ACCESS_STATE',state:state,authProtocol:42});\n  window.dispatchEvent(new CustomEvent('cdq:access-state-v2527',{detail:state}));");
replace('prepare-next-level','    cdqRootContent=contenu||null;\n    cdqBuildFolderMaps(cdqRootContent);',
  '    cdqRootContent=contenu||null;\n    cdqBuildFolderMaps(cdqRootContent);\n    setTimeout(function(){cdqFoldersV2527.plan(cdqRootContent);},200);');
replace('retain-prepared-folders','        Object.keys(loaded).forEach(function(k){node[k]=loaded[k];});',
  '        if(cdqFindFolder(node.id)!==node||cdqAccessState!=="ready")return;\n        cdqFoldersV2527.merge(node,loaded);');
// A cached client root should not repeat Drive checks for automatic folder setup.
replace('client-cache-first','  assurerStructureClientAIOuverture_(dossierId);\n\n  const cache = CacheService.getScriptCache();','  const cache = CacheService.getScriptCache();','Code.gs');
replace('client-setup-on-miss','  const photoIndex = construireIndexPhotosCDQ_();\n  const contenu = lireDossierSurface_(DriveApp.getFolderById(dossierId), photoIndex);',
  '  assurerStructureClientAIOuverture_(dossierId);\n  const photoIndex = construireIndexPhotosCDQ_();\n  const contenu = lireDossierSurface_(DriveApp.getFolderById(dossierId), photoIndex);','Code.gs');
replace('batch-folder-metadata','function lireDossierSurface_(dossier, photoIndex) {',
  'function lireDossierSurface_(dossier, photoIndex) {\n  if(typeof Drive!=="undefined"){try{return cdqReadSurfaceV2527_(dossier,photoIndex);}catch(e){console.warn("Lecture groupée indisponible; lecture Drive classique.");}}','Code.gs');
replace('batch-company-metadata',"  const dossierPrincipal = DriveApp.getFolderById(CONFIG.MASTER_FOLDER_ID);\n  const dossiers = dossierPrincipal.getFolders();\n  const resultats = [];",
  '  if(typeof Drive!=="undefined"){\n    try{const fast=cdqReadCompaniesV2527_();try{cache.put(cle,JSON.stringify(fast),CONFIG.CACHE_COMPAGNIES_SECONDES);}catch(_){}return fast;}catch(e){console.warn("Liste groupée indisponible; lecture classique.");}\n  }\n  const dossierPrincipal = DriveApp.getFolderById(CONFIG.MASTER_FOLDER_ID);\n  const dossiers = dossierPrincipal.getFolders();\n  const resultats = [];','Code.gs');
replace('unlock-cached-company-list','  return { autorise:true, email:u.email, role:u.role, jetonSession:jetonSession };',
  '  return cdqStartupCachedV2527_({ autorise:true, email:u.email, role:u.role, jetonSession:jetonSession });','Code.gs',2);
// These legacy blocks contain no multiline string values. Some saved projects
// trim their blank lines; permit only spaces at line ends, never changed code.
for(const p of patches.filter(p=>['company-list','folder-priority','client-refresh-keeps-preloads'].includes(p.id))){
  if(p.search.includes('`')||/\\[ \t]*\n/.test(p.search))throw Error('Multiline value in '+p.id);
  p.ignoreLineTrailingSpaces=true;
}
const extraFiles=['CDQPerformance.gs','CDQSessionResume.gs'].map(name=>({name,sha256:crypto.createHash('sha256').update(read(dir+'/files/'+name)).digest('hex'),url:'https://jprodrigue86.github.io/Rapports--talonnages-CDQ/'+dir+'/files/'+name}));
const manifest={schema:base.schema,projectScriptId:base.projectScriptId,version:'V25.27',build,
 title:'Balance CDQ V25.27 — démarrage et dossiers plus rapides',requiresBuild:[base.build],patches,extraFiles,removeFiles:[],
 audit:{scriptManagerRequired:'V42',packageRevision:3,androidAppRequired:'APK 25.26 existante compatible; aucune nouvelle APK nécessaire',productionVerified:false,
 scope:'Images inchangées mises en cache séparément, accueil local immédiat, connexion avec liste de clients en cache, métadonnées Drive groupées et préchargement limité aux prochains sous-dossiers du client actif.',
 security:'Biométrie et validation serveur maintenues. Préchargement uniquement après déverrouillage; réponses tardives abandonnées lors du changement de compte ou de client.'}};
for(const f of ['manifest.json','manifest-r3.json','Balance_CDQ_V25_27.cdq'])fs.writeFileSync(dir+'/'+f,JSON.stringify(manifest,null,2)+'\n');
if(!process.env.CDQ_SKIP_LATEST)fs.writeFileSync('bundles/balance-cdq/latest/manifest.json',JSON.stringify(manifest,null,2)+'\n');
for(const f of extraFiles)new vm.Script(read(dir+'/files/'+f.name));
if(process.env.CDQ_V2526_SOURCE){
 const {applyPatch}=await import('../tests/helpers/settings-fixture.mjs');
 for(const file of ['Code.gs','Selector.html']){
  let source=read(process.env.CDQ_V2526_SOURCE+'-'+file);const before=Buffer.byteLength(source);
  for(const p of patches.filter(p=>p.file===file))source=applyPatch(source,p);
  fs.writeFileSync(process.env.CDQ_V2526_SOURCE.replace(/v2526$/,'v2527')+'-'+file,source);
  if(file==='Code.gs')new vm.Script(source);else for(const m of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!m[1].includes('application/json'))new vm.Script(m[2]);
  console.log(file,before,'→',Buffer.byteLength(source),'bytes');
 }
}
console.log('V25.27:',patches.length,'guarded changes; two server helpers.');
