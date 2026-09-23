import fs from 'node:fs';import crypto from 'node:crypto';import vm from 'node:vm';
const dir='bundles/balance-cdq/v25.24',read=p=>fs.readFileSync(p,'utf8'),base=JSON.parse(read('bundles/balance-cdq/v25.23/manifest.json')),build='2026.09.23-v25.24-hors-ligne-session';
const patches=['Code.gs','Selector.html'].map(file=>({file,op:'replace_build_any',from:[base.build],to:build}));
const replace=(id,search,replacement,file='Selector.html')=>patches.push({id,file,op:'replace_literal',search,replacement});
replace('offline-menu',read(dir+'/offline-previous.js'),read(dir+'/offline.js')+`
async function cdqV19RefreshOfflineClientStatus(comp){await cdqOffline24.refresh();return true;}
async function cdqV19PrepareClientOffline(comp){return cdqOffline24.open(comp);}
async function cdqV19ToggleClientOffline(){return cdqOffline24.open();}
window.cdqPreparerClientHorsLigne=cdqV19PrepareClientOffline;
window.cdqBasculerModeHorsLigne=cdqV19ToggleClientOffline;`);
replace('offline-button-stays-accessible','el.disabled=!!cdqV19OfflineToggleRunning;','el.disabled=false;');
replace('session-resume-direct','"restaurerSessionApresBiometrie"\n]);','"restaurerSessionApresBiometrie",\n  "reprendreSessionCourteCDQV2524"\n]);');
replace('session-resume', 'function verifierAccesApplication(skipFastBiometric){',read(dir+'/session.js')+'\nfunction verifierAccesApplication(skipFastBiometric){\n  if(!skipFastBiometric && cdqSession24.resume(()=>verifierAccesApplication(true)))return;');
replace('session-forget-device',"cdqJetonMemoireV41=String(jeton||'');","cdqJetonMemoireV41=String(jeton||'');\n  if(!jeton)cdqSession24.clear();");
patches.at(-1).expected=2;
replace('session-resume-rpc-denied','restaurerSessionApresBiometrie:true,','restaurerSessionApresBiometrie:true,\n    reprendreSessionCourteCDQV2524:true,','Code.gs');
replace('stable-bottom-layout','function cdqDetachBottomNavV96(){','function cdqDetachBottomNavV96(){\n  if(window.cdqMobileLayout){window.cdqMobileLayout.schedule();return;}');
replace('stable-general-refit','function cdqRefitGeneralScaleV92(){','function cdqRefitGeneralScaleV92(){\n  if(window.cdqMobileLayout){window.cdqMobileLayout.schedule();return;}');
// General photo metadata follows the client cache, including across reloads.
replace('persist-general-photo','cacheContenuCompagnies[String(compagnieSelectionnee)].photoPresente=presente;','cacheContenuCompagnies[String(compagnieSelectionnee)].photoPresente=presente;\n      sauvegarderCachePersistantClient(compagnieSelectionnee,cacheContenuCompagnies[String(compagnieSelectionnee)]);');
replace('pending-photo-preview-data','pending:true});});','pending:true,dataUrl:a.dataUrl});});');
replace('pending-photo-preview','if(p.url&&!p.pending){',`if(p.pending&&p.dataUrl){
      const view=document.createElement('button');view.type='button';view.textContent='Voir';
      view.onclick=function(){const img=document.createElement('img');img.src=p.dataUrl;img.alt='Photo en attente';img.style.cssText='display:block;max-width:100%;max-height:60vh;object-fit:contain';card.append(img);view.disabled=true;};actions.appendChild(view);
    }
    if(p.url&&!p.pending){`);
replace('interface','</body>','<style id="cdqInterfaceV2524">\n'+read(dir+'/interface.css')+'\n</style>\n<script id="cdqCompanyV2524">\n'+read(dir+'/company.js')+'\n</script>\n</body>');
const extraFiles=['CDQSessionResume.gs'].map(name=>({name,sha256:crypto.createHash('sha256').update(read(dir+'/files/'+name)).digest('hex'),url:'https://jprodrigue86.github.io/Rapports--talonnages-CDQ/'+dir+'/files/'+name}));
const bundle={schema:base.schema,projectScriptId:base.projectScriptId,version:'V25.24',build,title:'Balance CDQ V25.24 — gestion hors ligne et reprise de session',requiresBuild:[base.build],patches,extraFiles,removeFiles:[],audit:{scriptManagerRequired:'V40',androidAppRequired:'APK existante compatible; mise à jour web requise pour le démarrage hors ligne',productionVerified:false,scope:'Sélection PDF, progression, annulation, stockage durable et retrait par compagnie, repères note/photo, session mobile 30 minutes, navigation stable et chargement visible.',biometrics:'Biométrie Android avant NIP; le choix visage/empreinte appartient au système.'}};
for(const file of ['manifest.json','Balance_CDQ_V25_24.cdq'])fs.writeFileSync(dir+'/'+file,JSON.stringify(bundle,null,2)+'\n');
if(JSON.parse(read('bundles/balance-cdq/latest/manifest.json')).version===bundle.version)fs.writeFileSync('bundles/balance-cdq/latest/manifest.json',JSON.stringify(bundle,null,2)+'\n');
const cumulative={...bundle,title:'Balance CDQ V25.24 — mise à jour complète depuis V25.22',requiresBuild:base.requiresBuild,patches:[...base.patches,...patches],extraFiles:[...base.extraFiles,...extraFiles]};
fs.writeFileSync(dir+'/Balance_CDQ_V25_24_depuis_V25_22.cdq',JSON.stringify(cumulative,null,2)+'\n');
if(process.env.CDQ_V2523_SOURCE){
 const {applyPatch}=await import('../tests/helpers/settings-fixture.mjs');
 for(const file of ['Code.gs','Selector.html']){let source=read(process.env.CDQ_V2523_SOURCE+'-'+file);for(const p of patches.filter(p=>p.file===file))source=applyPatch(source,p);fs.writeFileSync(process.env.CDQ_V2523_SOURCE.replace(/v2523$/,'v2524')+'-'+file,source);if(file==='Code.gs')new vm.Script(source);else for(const match of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!match[1].includes('application/json'))new vm.Script(match[2]);}
 for(const file of ['Code.gs','Selector.html']){const previous=process.env.CDQ_V2523_SOURCE.replace(/v2523$/,'v2522')+'-'+file;if(!fs.existsSync(previous))continue;let source=read(previous);for(const p of cumulative.patches.filter(p=>p.file===file))source=applyPatch(source,p);const expected=read(process.env.CDQ_V2523_SOURCE.replace(/v2523$/,'v2524')+'-'+file);if(source!==expected)throw Error('Le paquet cumulatif diffère : '+file);}
}
console.log('Built V25.24:',patches.length,'patches and',extraFiles.length,'server files.');
