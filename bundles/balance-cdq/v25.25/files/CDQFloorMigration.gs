// Owner-only, resumable conversion. The original client tree is read-only.
const CDQ23_DEST_='1XWvvenKIbZxqWUAhDyVQIM0gIPzzJ1IP';
const CDQ23_JOB_='CDQ_FLOOR_MIGRATION_V2523';
const CDQ23_FOLDER_='application/vnd.google-apps.folder';
const CDQ23_SHEET_='application/vnd.google-apps.spreadsheet';
function cdq23Quote_(s){return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'");}
function cdq23List_(parent,extra,token){var o={q:"'"+parent+"' in parents and trashed=false"+(extra?' and '+extra:''),pageSize:200,orderBy:'name_natural',fields:'nextPageToken,files(id,name,mimeType,parents,modifiedTime)',supportsAllDrives:true,includeItemsFromAllDrives:true};if(token)o.pageToken=token;return Drive.Files.list(o);}
function cdq23Folder_(parent,name,create){
 var result=cdq23List_(parent,"mimeType='"+CDQ23_FOLDER_+"' and name='"+cdq23Quote_(name)+"'",'').files||[];
 if(result.length>1)throw Error('Plusieurs dossiers portent le nom « '+name+' ». Corrigez le doublon avant de reprendre.');
 if(result.length)return result[0].id;
 if(!create)throw Error('Dossier client absent de VAPP1.0 : '+name);
 return Drive.Files.create({name:name,mimeType:CDQ23_FOLDER_,parents:[parent]},null,{fields:'id',supportsAllDrives:true}).id;
}
function cdq23Reports_(parent){
 var token='',matches=[];do{var p=cdq23List_(parent,"mimeType='"+CDQ23_FOLDER_+"'",token);(p.files||[]).forEach(function(f){if(/^rapports? detalonnages?$/.test(cdq23Norm_(f.name)))matches.push(f);});token=p.nextPageToken||'';}while(token);
 if(matches.length>1)throw Error('Plusieurs dossiers de rapports d’étalonnage : choisissez un nom unique avant de reprendre.');
 return matches.length?matches[0].id:cdq23Folder_(parent,"Rapports d’étalonnages",true);
}
function cdq23ReadJob_(){var id=PropertiesService.getScriptProperties().getProperty(CDQ23_JOB_);if(!id)return null;var file=DriveApp.getFileById(id);if(file.isTrashed())throw Error('Le journal de conversion est dans la corbeille. Restaurez-le pour reprendre sans doublons.');return {file:file,state:JSON.parse(file.getBlob().getDataAsString())};}
function cdq23WriteJob_(job){job.state.updated=new Date().toISOString();job.file.setContent(JSON.stringify(job.state));}
function cdq23Summary_(s){
 if(!s)return {exists:false};var counts={converted:0,skipped:0,errors:0};s.queue.forEach(function(q){if(q.status==='done')counts.converted++;if(q.status==='skip')counts.skipped++;if(q.status==='error')counts.errors++;});var processed=counts.converted+counts.skipped+counts.errors,total=s.queue.length;
 return {exists:true,id:s.id,status:s.status,phase:s.phase,total:total,processed:processed,converted:counts.converted,skipped:counts.skipped,errors:counts.errors,remaining:total-processed,percent:s.phase==='scan'?null:total?Math.floor(processed*100/total):100,current:s.current||'',message:s.message||'',updated:s.updated,issues:s.queue.filter(function(q){return q.status==='error';}).slice(0,30).map(function(q){return {client:q.clientName,file:q.name,error:q.error};}),destinationId:CDQ23_DEST_};
}

function cdq23Index_(s){
 var f=s.folders[s.scan];if(!f){s.queue.sort(function(a,b){return a.clientName.localeCompare(b.clientName,'fr',{numeric:true})||a.clientId.localeCompare(b.clientId)||a.path.localeCompare(b.path,'fr',{numeric:true})||a.name.localeCompare(b.name,'fr',{numeric:true})||a.id.localeCompare(b.id);});s.phase='convert';s.current='Inventaire terminé';return;}
 s.current=f.clientName||'Inventaire des clients';var page=cdq23List_(f.id,"(mimeType='"+CDQ23_FOLDER_+"' or mimeType='"+CDQ23_SHEET_+"')",f.token),folderIds={},sheetIds={};s.folders.forEach(function(x){folderIds[x.id]=true;});s.queue.forEach(function(x){sheetIds[x.id]=true;});
 (page.files||[]).forEach(function(x){
  if(x.mimeType===CDQ23_FOLDER_){if(/^_CDQ/i.test(x.name)||folderIds[x.id])return;if(f.depth>=50)throw Error('Arborescence trop profonde : '+x.name);s.folders.push({id:x.id,clientId:f.clientId||x.id,clientName:f.clientName||x.name,depth:f.depth+1,path:(f.path||'')+'/'+x.name,token:''});folderIds[x.id]=true;}
  else if(f.clientId&&!sheetIds[x.id]){s.queue.push({id:x.id,name:x.name,clientId:f.clientId,clientName:f.clientName,path:f.path||'',status:'pending'});sheetIds[x.id]=true;}
 });f.token=page.nextPageToken||'';if(!f.token)s.scan++;
}
function cdq23ReadSource_(q){
 var scope=cdqDriveScopeV2521_(q.id,{},[CONFIG.MASTER_FOLDER_ID]);if(scope.meta.mimeType!==CDQ23_SHEET_||!scope.path.some(function(p){return p.id===q.clientId;}))throw Error('Le Sheet a changé de dossier client.');
 var book=SpreadsheetApp.openById(q.id),matches=[],errors=[];
 book.getSheets().forEach(function(sheet){var h=Math.min(sheet.getLastRow(),120),w=Math.min(sheet.getLastColumn(),100);if(!h||!w)return;try{var data=cdq23ParseSheet_(sheet.getRange(1,1,h,w).getDisplayValues());if(!data.skip)matches.push(data);}catch(e){errors.push(sheet.getName()+' : '+e.message);}});
 if(errors.length)throw Error(errors.join(' | '));if(matches.length>1)throw Error('Plusieurs onglets de balance de plancher : conversion manuelle requise.');
 return {data:matches[0]||{skip:true},revision:scope.meta.modifiedTime};
}
function cdq23Existing_(q,s){
 if(!q.outputId)return false;var m;try{m=Drive.Files.get(q.outputId,{fields:'id,trashed,parents,appProperties',supportsAllDrives:true});}catch(e){if(/404|not found|File not found|introuvable/i.test(String(e)))return false;throw e;}
 if(m.trashed||!(m.parents||[]).includes(q.destination)||!m.appProperties||m.appProperties.cdqSource!==q.id||m.appProperties.cdqJob!==s.id)throw Error('Le PDF réservé a été déplacé ou modifié. Vérification manuelle nécessaire.');return true;
}

// One durable journal per client; the recurring server trigger never needs the phone.
const CDQ25_ACTIVE_='CDQ_FLOOR_ACTIVE_V2525';
function cdq25Client_(id){const s=cdqDriveScopeV2521_(id,{},[CONFIG.MASTER_FOLDER_ID]);if(s.path.length!==2||s.meta.mimeType!==CDQ23_FOLDER_)throw Error('Choisissez le dossier source du client.');return {id:s.meta.id,name:s.meta.name};}
function cdq25Read_(id){const key='CDQ_FLOOR_CLIENT_V2525_'+cdqDriveIdV2521_(id),fid=PropertiesService.getScriptProperties().getProperty(key);if(!fid)return null;const file=DriveApp.getFileById(fid);if(file.isTrashed())throw Error('Restaurez le journal de conversion pour éviter les doublons.');return {file,state:JSON.parse(file.getBlob().getDataAsString())};}
function cdq25Summary_(j){return j?Object.assign(cdq23Summary_(j.state),{clientId:j.state.clientId,clientName:j.state.clientName,background:true}):{exists:false,background:true};}
function cdq25Lock_(fn){const lock=LockService.getScriptLock();if(!lock.tryLock(1500))throw Error('Un fichier est en cours de traitement. Réessayez dans quelques secondes.');try{return fn();}finally{lock.releaseLock();}}
function cdq25StopTrigger_(){ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='cdq25FloorWorker_').forEach(t=>ScriptApp.deleteTrigger(t));}
function cdq25EnsureTrigger_(){const all=ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='cdq25FloorWorker_');if(!all.length)ScriptApp.newTrigger('cdq25FloorWorker_').timeBased().everyMinutes(1).create();all.slice(1).forEach(t=>ScriptApp.deleteTrigger(t));}
function obtenirConversionPlancherCDQV2525(clientId){verifierProprietairePrincipal_();cdq25Client_(clientId);return cdq25Summary_(cdq25Read_(clientId));}
function demarrerConversionPlancherCDQV2525(clientId,retryErrors){
 const owner=verifierProprietairePrincipal_(),client=cdq25Client_(clientId);
 return cdq25Lock_(function(){
  const props=PropertiesService.getScriptProperties(),active=props.getProperty(CDQ25_ACTIVE_);
  if(active&&active!==client.id){const other=cdq25Read_(active);if(other&&other.state.status==='running')throw Error('Une conversion est déjà en cours pour '+other.state.clientName+'. Mettez-la en pause avant de changer de client.');}
  // Verify destination before scheduling anything. No matching-by-position or guessed client.
  cdq23Folder_(CDQ23_DEST_,client.name,false);
  let j=cdq25Read_(client.id);
  if(!j){
   const system=cdq23Folder_(CDQ23_DEST_,'_CDQ_System',true);
   const state={version:2,id:Utilities.getUuid(),owner:owner.email,clientId:client.id,clientName:client.name,status:'paused',phase:'scan',folders:[{id:client.id,clientId:client.id,clientName:client.name,depth:1,token:'',path:''}],scan:0,queue:[],created:new Date().toISOString()};
   const file=DriveApp.getFolderById(system).createFile('Conversion '+client.name+' V25.25.json',JSON.stringify(state),'application/json');props.setProperty('CDQ_FLOOR_CLIENT_V2525_'+client.id,file.getId());j={file,state};
  }
  if(retryErrors)j.state.queue.forEach(q=>{if(q.status==='error'){q.status='pending';delete q.error;}});
  const legacy=cdq23ReadJob_();if(legacy&&legacy.state.status==='running'){legacy.state.status='paused';legacy.state.message='Remplacée par la conversion du client sélectionné V25.25.';cdq23WriteJob_(legacy);}
  cdq25EnsureTrigger_(); // Authorization failure must never report a running job.
  props.setProperty(CDQ25_ACTIVE_,client.id);j.state.owner=owner.email;j.state.status='running';j.state.message='Conversion serveur programmée. Vous pouvez fermer CDQ.';cdq23WriteJob_(j);return cdq25Summary_(j);
 });
}
function suspendreConversionPlancherCDQV2525(clientId){verifierProprietairePrincipal_();cdq25Client_(clientId);return cdq25Lock_(()=>{const j=cdq25Read_(clientId);if(j){j.state.status='paused';j.state.message='Conversion en pause; fichiers terminés conservés.';cdq23WriteJob_(j);}if(PropertiesService.getScriptProperties().getProperty(CDQ25_ACTIVE_)===clientId)cdq25StopTrigger_();return cdq25Summary_(j);});}
function cdq25ExistingSource_(q){const list=cdq23List_(q.destination,"appProperties has { key='cdqSource' and value='"+cdq23Quote_(q.id)+"' }",'').files||[];if(list.length>1)throw Error('Plusieurs PDF proviennent déjà de ce Sheet. Vérification manuelle nécessaire.');return list[0];}
async function cdq25FloorWorker_(){
 const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;
 let j;
 try{
  const clientId=PropertiesService.getScriptProperties().getProperty(CDQ25_ACTIVE_);if(!clientId){cdq25StopTrigger_();return;}
  j=cdq25Read_(clientId);if(!j||j.state.status!=='running'){cdq25StopTrigger_();return;}
  const s=j.state,principal=String(obtenirAdministrateurPrincipal_()||'').toLowerCase(),effective=String(Session.getEffectiveUser().getEmail()||'').toLowerCase();
  if(!principal||String(s.owner).toLowerCase()!==principal||effective!==principal)throw Error('La conversion doit être lancée sous le compte du propriétaire principal.');
  const client=cdq25Client_(s.clientId);if(client.name!==s.clientName)throw Error('Le nom du client a changé. Vérifiez le dossier de destination.');
  if(s.phase==='scan'){for(let n=0;n<5&&s.phase==='scan';n++){cdq23Index_(s);cdq23WriteJob_(j);}return;}
  const q=s.queue.find(x=>x.status==='pending'||x.status==='processing');
  if(!q){s.status='completed';s.current='';s.message='Conversion terminée.';cdq23WriteJob_(j);cdq25StopTrigger_();return;}
  s.current=q.name;s.message='Traitement serveur : '+q.name;
  try{
   if(cdq23Existing_(q,s)){q.status='done';delete q.values;cdq23WriteJob_(j);return;}
   const source=cdq23ReadSource_(q);if(source.data.skip){q.status='skip';cdq23WriteJob_(j);return;}
   q.destination=cdq23Reports_(cdq23Folder_(CDQ23_DEST_,s.clientName,false));
   const previous=cdq25ExistingSource_(q);if(previous){q.status='skip';q.note='Déjà converti : '+previous.name;cdq23WriteJob_(j);return;}
   const filename=q.name.replace(/\.pdf$/i,'')+'.pdf';
   if((cdq23List_(q.destination,"name='"+cdq23Quote_(filename)+"'",'').files||[]).length)throw Error('Un PDF porte déjà ce nom. Aucun suffixe ajouté et aucun fichier remplacé.');
   q.revision=source.revision;q.warning=source.data.warnings||'';q.status='processing';
   if(!q.outputId)q.outputId=Drive.Files.generateIds({count:1,space:'drive',type:'files'}).ids[0];
   cdq23WriteJob_(j); // Reserve identity before render/upload; lost replies cannot duplicate files.
   const bytes=await cdq25FillPdf_(source.data.values);
   const latest=cdqDriveScopeV2521_(q.id,{},[CONFIG.MASTER_FOLDER_ID]);
   if(latest.meta.modifiedTime!==q.revision||latest.meta.name!==q.name||!latest.path.some(p=>p.id===s.clientId))throw Error('Le Sheet a changé pendant la conversion. Réessayez ce fichier.');
   const dest=cdqDriveScopeV2521_(q.destination,{},[CDQ23_DEST_]);if(dest.path.length!==3||dest.path[1].nom!==s.clientName||!/^rapports? detalonnages?$/.test(cdq23Norm_(dest.meta.name)))throw Error('Le chemin du dossier de destination a changé.');
   Drive.Files.create({id:q.outputId,name:filename,mimeType:'application/pdf',parents:[q.destination],appProperties:{cdqSource:q.id,cdqJob:s.id,cdqTemplate:'floor-v2519'},description:'Conversion du Sheet '+q.id+'. '+q.warning},Utilities.newBlob(Array.from(bytes,b=>b>127?b-256:b),'application/pdf',filename),{fields:'id',supportsAllDrives:true});
   q.status='done';q.finished=new Date().toISOString();delete q.values;
  }catch(e){if(/quota|too many|Service invoked|timed out/i.test(String(e)))throw e;q.status='error';q.error=String(e.message||e);}
  cdq23WriteJob_(j);
 }catch(e){if(j){j.state.status='paused';j.state.message=String(e.message||e);cdq23WriteJob_(j);}cdq25StopTrigger_();throw e;}
 finally{lock.releaseLock();}
}
// Old tabs may still call these names after deployment. They cannot restart the global scan.
function obtenirConversionPlancherCDQV2523(){verifierProprietairePrincipal_();return {exists:false,message:'Rechargez CDQ pour convertir le client ouvert.'};}
function demarrerConversionPlancherCDQV2523(){verifierProprietairePrincipal_();throw Error('Rechargez CDQ pour choisir le client source.');}
function suspendreConversionPlancherCDQV2523(){verifierProprietairePrincipal_();return {exists:false};}
function prochaineConversionPlancherCDQV2523(){verifierProprietairePrincipal_();return {progress:{status:'paused'}};}
function enregistrerConversionPlancherCDQV2523(){verifierProprietairePrincipal_();throw Error('Ancienne conversion arrêtée. Rechargez CDQ.');}
function signalerErreurConversionPlancherCDQV2523(){verifierProprietairePrincipal_();return {status:'paused'};}
