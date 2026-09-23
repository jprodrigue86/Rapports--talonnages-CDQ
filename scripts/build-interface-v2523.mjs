import fs from 'node:fs';import crypto from 'node:crypto';import vm from 'node:vm';
const dir='bundles/balance-cdq/v25.23',read=p=>fs.readFileSync(p,'utf8'),base=JSON.parse(read('bundles/balance-cdq/v25.22/manifest.json')),build='2026.09.23-v25.23-lecteur-conversion';
const patches=['Code.gs','Selector.html'].map(file=>({file,op:'replace_build_any',from:[base.build],to:build}));
const replace=(id,search,replacement,file='Selector.html')=>patches.push({id,file,op:'replace_literal',search,replacement});
let desktop=read('bundles/balance-cdq/v25.22/desktop.js').replaceAll('V25.22','V25.23');
desktop=desktop.replace("{home,clients,explorer,settings}[st.view]","{home,clients,explorer,settings,driveMain:m=>window.cdqDriveMain23?.render(m)}[st.view]");
desktop=desktop.replace('window.cdqDesktopV2517={mount,render,kpis,scale};',"window.cdqDesktopV2517={mount,render,kpis,scale,showDrive(){state.view='driveMain';render(state,api)}};");
fs.writeFileSync(dir+'/desktop.js',desktop);replace('desktop',read('bundles/balance-cdq/v25.22/desktop.js'),desktop);
let drive=read('bundles/balance-cdq/v25.21/drive-browser.js');
drive=drive.replace("window.open('https://drive.google.com/file/d/'+encodeURIComponent(item.id)+'/view','_blank','noopener')","window.cdqDriveMain23.show(item).catch(afficherErreur)");
drive=drive.replace("row.append(open,star);list.append(row);","const here=button('Afficher ici',()=>window.cdqDriveMain23.show(item).catch(afficherErreur),'cdq-drive-here');row.append(open,here,star);list.append(row);");
drive=drive.replace("footer.append(more);","footer.append(button('Afficher ce dossier dans la liste principale',()=>window.cdqDriveMain23.show({id:folder,kind:'folder'}).catch(afficherErreur)),more);");
fs.writeFileSync(dir+'/drive-browser.js',drive);replace('drive-browser',read('bundles/balance-cdq/v25.21/drive-browser.js'),drive);
replace('row-load-no-global-toast',"async function cdqLoadPdfRecord(id){return window.cdqFeedbackV2522?window.cdqFeedbackV2522.during('Ouverture du PDF…',()=>cdqLoadPdfRecordImplV2522(id)):cdqLoadPdfRecordImplV2522(id);}","async function cdqLoadPdfRecord(id){return cdqLoadPdfRecordImplV2522(id);}");
replace('row-start',"const email=cdqReaderOwnerV2520();cdqReaderOpeningV2520=true;let frame=null,rec,disposed=false;","const email=cdqReaderOwnerV2520();cdqReaderOpeningV2520=true;const stopLoading=window.cdqRowLoading23?.start(id)||(()=>{});let frame=null,rec,disposed=false;");
replace('row-close',"function close(){if(disposed)return;disposed=true;window.removeEventListener('message',receive);frame?.remove();cdqReaderOpeningV2520=false;}","function close(){if(disposed)return;disposed=true;stopLoading();window.removeEventListener('message',receive);frame?.remove();cdqReaderOpeningV2520=false;}");
replace('row-opened',"if(d.type==='CDQ_READER_READY'&&!inPwa)","if(d.type==='CDQ_READER_OPENED'||d.type==='CDQ_PDF_OPENED_V2523'&&d.fileId===id)stopLoading();\n    if(d.type==='CDQ_READER_READY'&&!inPwa)");
replace('reader-version',"frame.src=CDQ_PWA_ORIGIN+'/Rapports--talonnages-CDQ/reader-v2520.html'","frame.src=CDQ_PWA_ORIGIN+'/Rapports--talonnages-CDQ/reader-v2523.html'");
replace('create-async','function cdqCreerCopiePwaHorsLigne(modeleId,destinationId,idClient,nomDestination,stableRequestId){','async function cdqCreerCopiePwaHorsLigne(modeleId,destinationId,idClient,nomDestination,stableRequestId){');
replace('create-context','const requestId=stableRequestId || "local_"+','const prefill=await window.cdqCreationV2523.context(idClient);\n  const requestId=stableRequestId || "local_"+');
replace('create-background',"open:modeleId==='plancher',","open:false,\n      prefill:prefill,");
replace('create-timeout','},12000);\n    function recevoir(e){','},65000);\n    function recevoir(e){');
replace('create-online-prefill','if(!resultat || resultat.ok !== true){','if(resultat?.ok===true&&resultat.id)await window.cdqCreationV2523.created(resultat,idClient,cdqCopieRequestId);\n    if(!resultat || resultat.ok !== true){');
replace('create-download-prefill','const blobTechnicien=await cdqPersonnaliserBlobTechnicienPdf(rec.blob);','const blobTechnicien=await window.cdqCreationV2523.fill(rec.blob,idClient);');
replace('offline-copies-access',"const b=o.querySelector('.cdq-v19-body');b.innerHTML='';o.style.display='flex';\n  const info=cdqDocumentText(b,'Préparation…');","const b=o.querySelector('.cdq-v19-body');b.innerHTML='';o.style.display='flex';\n  if(cdqPwaAvailable())cdqDocumentButton(b,'Documents en attente sur cet appareil',()=>cdqPostToPwa({type:'CDQ_OFFLINE_SHOW_LOCAL'}));\n  const info=cdqDocumentText(b,'Préparation…');");
replace('pdf-general-scope',"function obtenirPdfClientCDQ_(id) {\n  const f = DriveApp.getFileById(String(id || ''));\n  if (f.isTrashed() || f.getMimeType() !== 'application/pdf') throw new Error('PDF client introuvable.');\n  const client = obtenirClientPhotoCDQ_('fichier', f.getId());\n  return {fichier:f, client:client};\n}","function obtenirPdfClientCDQ_(id) {return obtenirPdfAutoriseCDQV2523_(id);}",'Code.gs');
// Keep all bands visible on tall phone screens; avoid a black strip from contain.
replace('wall-portrait','music-wall-android-v2521.webp','music-wall-android-v2523.webp');patches.at(-1).expected=2;
replace('drive-live-refresh',"if(cdqLiveSyncBusyV2200) return;","if(cdqLiveSyncBusyV2200 || window.cdqDriveMain23?.active()) return;");
replace('interface','</body>','<style id="cdqInterfaceV2523">\n'+read(dir+'/interface.css')+'\n</style>\n'+['row-loading','creation','drive-main','migration'].map(name=>'<script id="cdq-'+name+'-23">\n'+read(dir+'/'+name+'.js')+'\n</script>').join('\n')+'\n</body>');
const extraFiles=['CDQFloorMapping.gs','CDQFloorMigration.gs','CDQCreationContext.gs','CDQPdfReader.gs'].map(name=>({name,sha256:crypto.createHash('sha256').update(read(dir+'/files/'+name)).digest('hex'),url:'https://jprodrigue86.github.io/Rapports--talonnages-CDQ/'+dir+'/files/'+name}));
const bundle={schema:base.schema,projectScriptId:base.projectScriptId,version:'V25.23',build,title:'Balance CDQ V25.23 — lecteur fluide et transfert des Sheets',requiresBuild:[base.build],patches,extraFiles,removeFiles:[],audit:{scriptManagerRequired:'V40',androidAppRequired:'Fonctions web compatibles avec APK existante',scope:'Clavier Android, inertie PDF, apparence des champs, création préremplie sans ouverture, progression propriétaire et reprise de conversion, Drive dans la liste principale.',productionVerified:false,migration:'Conversion lancée par le propriétaire dans Réglages. Originaux conservés. Reprise à la réouverture; CDQ doit rester ouvert pour continuer.',biometrics:'La priorité entre visage et empreinte reste contrôlée par Android.'}};
for(const file of ['manifest.json','Balance_CDQ_V25_23.cdq'])fs.writeFileSync(dir+'/'+file,JSON.stringify(bundle,null,2)+'\n');
fs.writeFileSync('bundles/balance-cdq/latest/manifest.json',JSON.stringify(bundle,null,2)+'\n');
if(process.env.CDQ_V2522_SOURCE){
 const {applyPatch}=await import('../tests/helpers/settings-fixture.mjs');
 for(const file of ['Code.gs','Selector.html']){let source=read(process.env.CDQ_V2522_SOURCE+'-'+file);for(const p of patches.filter(p=>p.file===file))source=applyPatch(source,p);fs.writeFileSync(process.env.CDQ_V2522_SOURCE.replace('v2522','v2523')+'-'+file,source);if(file==='Code.gs')new vm.Script(source);else for(const match of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!match[1].includes('application/json'))new vm.Script(match[2]);}
}
console.log('Built V25.23:',patches.length,'patches and',extraFiles.length,'server files.');
