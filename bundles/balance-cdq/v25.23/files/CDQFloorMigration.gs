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
function cdq23WithJob_(fn){verifierProprietairePrincipal_();var lock=LockService.getScriptLock();lock.waitLock(20000);try{return fn(cdq23ReadJob_());}finally{lock.releaseLock();}}
function obtenirConversionPlancherCDQV2523(){return cdq23WithJob_(function(j){return cdq23Summary_(j&&j.state);});}
function demarrerConversionPlancherCDQV2523(retryErrors){return cdq23WithJob_(function(j){
 if(!j){
  cdqDriveScopeV2521_(CDQ23_DEST_,{},[CDQ23_DEST_]);
  var system=cdq23Folder_(CDQ23_DEST_,'_CDQ_System',true),id=Utilities.getUuid();
  var state={version:1,id:id,status:'running',phase:'scan',folders:[{id:CONFIG.MASTER_FOLDER_ID,clientId:'',clientName:'',depth:0,token:''}],scan:0,queue:[],current:'Inventaire des dossiers clients',created:new Date().toISOString()};
  var file=DriveApp.getFolderById(system).createFile('Conversion balances de plancher V25.23.json',JSON.stringify(state),'application/json');PropertiesService.getScriptProperties().setProperty(CDQ23_JOB_,file.getId());j={file:file,state:state};
 }
 if(retryErrors)j.state.queue.forEach(function(q){if(q.status==='error'){q.status='pending';delete q.error;delete q.values;}});
 j.state.status='running';j.state.message='';cdq23WriteJob_(j);return cdq23Summary_(j.state);
});}
function suspendreConversionPlancherCDQV2523(){return cdq23WithJob_(function(j){if(!j)return {exists:false};j.state.status='paused';j.state.message='Pause après le fichier en cours.';cdq23WriteJob_(j);return cdq23Summary_(j.state);});}
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
function prochaineConversionPlancherCDQV2523(session){
 session=String(session||'');if(!/^[a-zA-Z0-9-]{20,80}$/.test(session))throw Error('Session invalide.');
 return cdq23WithJob_(function(j){
  if(!j)throw Error('Démarrez la conversion.');var s=j.state;if(s.status!=='running')return {progress:cdq23Summary_(s)};
  try{
   if(s.phase==='scan'){cdq23Index_(s);cdq23WriteJob_(j);return {progress:cdq23Summary_(s)};}
   var q=s.queue.find(function(x){return x.status==='pending'||x.status==='processing';});
   if(!q){s.status='completed';s.current='';s.message='Parcours terminé.';cdq23WriteJob_(j);return {progress:cdq23Summary_(s)};}
   s.current=q.clientName+' — '+q.name;
   if(q.status==='processing'&&q.leaseUntil>Date.now()&&q.session!==session)return {wait:true,progress:cdq23Summary_(s)};
   if(cdq23Existing_(q,s)){q.status='done';delete q.values;cdq23WriteJob_(j);return {progress:cdq23Summary_(s)};}
   try{
    var source=cdq23ReadSource_(q);if(source.data.skip){q.status='skip';cdq23WriteJob_(j);return {progress:cdq23Summary_(s)};}
    var dest=cdq23Folder_(CDQ23_DEST_,q.clientName,false);
    q.destination=cdq23Reports_(dest);q.revision=source.revision;q.values=source.data.values;q.warning=source.data.warnings||'';
    if(!q.outputId)q.outputId=Drive.Files.generateIds({count:1,space:'drive',type:'files'}).ids[0];
    q.status='processing';q.session=session;q.token=Utilities.getUuid();q.leaseUntil=Date.now()+120000;
    // Save the reserved ID before any PDF upload, including retries after a crash.
    cdq23WriteJob_(j);return {progress:cdq23Summary_(s),work:{id:q.id,token:q.token,values:q.values,name:q.name,warning:q.warning}};
   }catch(e){if(/quota|too many|Service invoked|timed out|délai/i.test(String(e)))throw e;q.status='error';q.error=String(e.message||e);delete q.values;cdq23WriteJob_(j);return {progress:cdq23Summary_(s)};}
  }catch(e){s.status='paused';s.message=String(e.message||e);cdq23WriteJob_(j);return {progress:cdq23Summary_(s)};}
 });
}
function enregistrerConversionPlancherCDQV2523(id,token,base64){return cdq23WithJob_(function(j){
 if(!j)throw Error('Journal introuvable.');var s=j.state,q=s.queue.find(function(x){return x.id===id;});if(!q||q.token!==token)throw Error('Cette étape a été reprise dans une autre session.');
 if(cdq23Existing_(q,s)){q.status='done';delete q.values;cdq23WriteJob_(j);return cdq23Summary_(s);}
 if(q.status!=='processing')throw Error('Fichier non réservé.');
 var source=cdqDriveScopeV2521_(q.id,{},[CONFIG.MASTER_FOLDER_ID]);if(source.meta.modifiedTime!==q.revision||!source.path.some(function(p){return p.id===q.clientId;}))throw Error('Le Sheet a changé pendant le transfert. Réessayez ce fichier.');
 var dest=cdqDriveScopeV2521_(q.destination,{},[CDQ23_DEST_]);if(dest.meta.mimeType!==CDQ23_FOLDER_||dest.path.length!==3||dest.path[1].nom!==q.clientName)throw Error('Le dossier de destination a changé.');
 if(typeof base64!=='string'||base64.length>12*1024*1024||!/^JVBERi0/.test(base64))throw Error('PDF transféré invalide.');var bytes=Utilities.base64Decode(base64);if(bytes.length<10000)throw Error('PDF incomplet.');
 var filename=q.name.replace(/\.pdf$/i,'')+'.pdf';
 var same=cdq23List_(q.destination,"name='"+cdq23Quote_(filename)+"'",'').files||[];if(same.length)filename=q.name+' — '+q.id.slice(-8)+'.pdf';
 Drive.Files.create({id:q.outputId,name:filename,mimeType:'application/pdf',parents:[q.destination],appProperties:{cdqSource:q.id,cdqJob:s.id,cdqTemplate:'floor-v2519'},description:'Transfert CDQ depuis le Sheet '+q.id+'. '+(q.warning||'')},Utilities.newBlob(bytes,'application/pdf',filename),{fields:'id',supportsAllDrives:true});
 q.status='done';delete q.values;q.finished=new Date().toISOString();cdq23WriteJob_(j);return cdq23Summary_(s);
});}
function signalerErreurConversionPlancherCDQV2523(id,token,message){return cdq23WithJob_(function(j){if(!j)throw Error('Journal introuvable.');var q=j.state.queue.find(function(x){return x.id===id;});if(!q||q.token!==token)throw Error('Étape expirée.');if(cdq23Existing_(q,j.state))q.status='done';else{q.status='error';q.error=String(message||'Préparation du PDF impossible.').slice(0,1000);}delete q.values;cdq23WriteJob_(j);return cdq23Summary_(j.state);});}
