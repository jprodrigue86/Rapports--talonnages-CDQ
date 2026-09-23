// Explicit, non-destructive copies. All endpoints enforce CDQ access and scope.
const CDQ_COPY_FOLDER_V2522_='application/vnd.google-apps.folder';
function cdqCopyScopeV2522_(id,cache){return cdqDriveScopeV2521_(id,cache||{},[CONFIG.MASTER_FOLDER_ID,CDQ_GENERAL_DRIVE_V2521_]);}
function cdqCopyClientV2522_(scope){return scope.root===CONFIG.MASTER_FOLDER_ID&&scope.path.length>1?scope.path[1].id:'';}
function obtenirContexteCopieCDQV2522(id){
 verifierDroit_('ecriture');const cache={},s=cdqCopyScopeV2522_(id,cache);
 if(s.path.length<2)throw Error('La racine Drive ne peut pas être copiée.');
 const parent=s.path[s.path.length-2];return {id:s.meta.id,nom:s.meta.name,parentId:parent.id,parentName:parent.nom,clientId:cdqCopyClientV2522_(s)};
}
function obtenirDossiersCopieCDQV2522(id,sourceId){
 verifierDroit_('ecriture');const cache={},source=cdqCopyScopeV2522_(sourceId,cache),dest=cdqDriveScopeV2521_(id,cache,[CONFIG.MASTER_FOLDER_ID]);
 if(dest.meta.mimeType!==CDQ_COPY_FOLDER_V2522_||dest.path.length<2)throw Error('Choisissez un dossier client.');
 if(source.meta.mimeType===CDQ_COPY_FOLDER_V2522_&&dest.path.some(x=>x.id===source.meta.id))throw Error('Un dossier ne peut pas être copié à l’intérieur de lui-même.');
 const items=[];let token='';do{const options={q:"'"+dest.meta.id+"' in parents and trashed=false and mimeType='"+CDQ_COPY_FOLDER_V2522_+"'",pageSize:1000,fields:'nextPageToken,files(id,name)',supportsAllDrives:true,includeItemsFromAllDrives:true};if(token)options.pageToken=token;const page=Drive.Files.list(options);(page.files||[]).forEach(f=>{if(f.id!==source.meta.id)items.push({id:f.id,nom:f.name})});token=page.nextPageToken||'';if(items.length>3000)throw Error('Trop de dossiers dans cette liste.');}while(token);
 return {crumbs:dest.path,items};
}
function cdqCopyQuoteV2522_(value){return String(value).replace(/\\/g,'\\\\').replace(/'/g,"\\'");}
function cdqCopyNameV2522_(meta,dest){
 const dot=meta.mimeType!==CDQ_COPY_FOLDER_V2522_?meta.name.lastIndexOf('.'):-1,base=dot>0?meta.name.slice(0,dot):meta.name,ext=dot>0?meta.name.slice(dot):'';
 for(let i=1;i<=1000;i++){const name=base+' - Copie'+(i===1?'':' '+i)+ext;
  const found=Drive.Files.list({q:"'"+dest+"' in parents and trashed=false and name='"+cdqCopyQuoteV2522_(name)+"'",pageSize:1,fields:'files(id)',supportsAllDrives:true,includeItemsFromAllDrives:true});if(!(found.files||[]).length)return name;
 }throw Error('Trop de copies portent déjà ce nom.');
}
function copierElementCDQV2522(id,destinationId,requestId){
 const user=verifierDroit_('ecriture');id=cdqDriveIdV2521_(id);destinationId=cdqDriveIdV2521_(destinationId);requestId=String(requestId||'');
 if(!/^copy-[a-zA-Z0-9-]{20,80}$/.test(requestId))throw Error('Demande de copie invalide.');
 const lock=LockService.getScriptLock();lock.waitLock(15000);
 try{
  const props=PropertiesService.getScriptProperties(),key='CDQ_COPY_V2522_'+empreinteCDQ_(String(user.email).toLowerCase()),history=JSON.parse(props.getProperty(key)||'[]');
  const old=history.find(x=>x.requestId===requestId);
  if(old){if(old.source!==id||old.destination!==destinationId)throw Error('La destination de cette demande a changé.');if(old.result)return old.result;throw Error(old.error||'Cette copie est déjà en cours. Vérifiez sa destination avant de recommencer.');}
  const cache={},source=cdqCopyScopeV2522_(id,cache),dest=cdqCopyScopeV2522_(destinationId,cache);
  if(source.path.length<2||dest.meta.mimeType!==CDQ_COPY_FOLDER_V2522_)throw Error('Source ou destination invalide.');
  const same=source.path[source.path.length-2].id===destinationId;
  if(!same&&(dest.root!==CONFIG.MASTER_FOLDER_ID||dest.path.length<2))throw Error('Choisissez le dossier actuel ou un autre dossier client.');
  if(source.meta.mimeType===CDQ_COPY_FOLDER_V2522_&&dest.path.some(x=>x.id===id))throw Error('Un dossier ne peut pas être copié à l’intérieur de lui-même.');
  // Enumerate before creating anything: no silent omissions and no recursion into
  // a newly-created copy. Bound the work before the Apps Script execution limit.
  const plan=[],seen={},deadline=Date.now()+150000;
  function scan(meta,parent,depth){
   if(Date.now()>deadline||plan.length>=200||depth>25)throw Error('Ce dossier est trop volumineux pour une copie en une fois. Copiez ses sous-dossiers séparément.');
   if(seen[meta.id])throw Error('Structure de dossier répétée.');seen[meta.id]=true;
   if(meta.mimeType==='application/vnd.google-apps.shortcut')throw Error('Le dossier contient un raccourci Drive. Copiez sa cible séparément.');
   plan.push({meta,parent});
   if(meta.mimeType!==CDQ_COPY_FOLDER_V2522_)return;
   let token='';do{const options={q:"'"+meta.id+"' in parents and trashed=false",pageSize:100,fields:'nextPageToken,files('+CDQ_DRIVE_FIELDS_V2521_+')',supportsAllDrives:true,includeItemsFromAllDrives:true};if(token)options.pageToken=token;const page=Drive.Files.list(options);(page.files||[]).forEach(f=>scan(f,meta.id,depth+1));token=page.nextPageToken||'';}while(token);
  }
  scan(source.meta,'',0);const name=cdqCopyNameV2522_(source.meta,destinationId),entry={requestId,source:id,destination:destinationId,time:Date.now()},recent=history.filter(x=>Date.now()-x.time<7*86400000).slice(-9);recent.push(entry);
  const save=()=>props.setProperty(key,JSON.stringify(recent));save();
  let top=null;const mapping={};
  try{
   for(const part of plan){
    if(Date.now()>deadline)throw Error('La copie a dépassé le délai permis. Copiez les sous-dossiers séparément.');
    // Revalidate ancestry immediately before each copy; a moved item is rejected.
    const fresh=cdqCopyScopeV2522_(part.meta.id,{});if(part.parent&&!fresh.path.some(x=>x.id===id))throw Error('Le dossier source a changé pendant la copie.');
    const body={name:part.parent?part.meta.name:name,parents:[part.parent?mapping[part.parent]:destinationId]},options={fields:'id,name,mimeType',supportsAllDrives:true};
    let created;
    if(part.meta.mimeType===CDQ_COPY_FOLDER_V2522_){body.mimeType=CDQ_COPY_FOLDER_V2522_;created=Drive.Files.create(body,null,options);}
    else{const detail=Drive.Files.get(part.meta.id,{fields:'description',supportsAllDrives:true});body.description=typeof remplacerNoteCDQ_==='function'?remplacerNoteCDQ_(detail.description||'',''):detail.description||'';created=Drive.Files.copy(body,part.meta.id,options);}
    mapping[part.meta.id]=created.id;if(!top){top=created;entry.createdId=top.id;save();}
   }
   entry.result={ok:true,id:top.id,nom:name,kind:source.meta.mimeType===CDQ_COPY_FOLDER_V2522_?'folder':'file',destinationId,clientId:cdqCopyClientV2522_(dest),copiedItems:plan.length};save();
   try{if(entry.result.clientId)invaliderCacheContenuClient_(entry.result.clientId);if(destinationId===CONFIG.MASTER_FOLDER_ID)invaliderCacheCompagnies_();}catch(_){}
   return entry.result;
  }catch(e){
   let cleanup='';if(top){try{Drive.Files.update({trashed:true},top.id,null,{supportsAllDrives:true});}catch(_){cleanup=' La copie partielle « '+name+' » est encore dans le dossier destination; vérifiez-la avant de recommencer.';}}
   entry.error='Copie interrompue : '+(e.message||String(e))+cleanup;save();throw Error(entry.error);
  }
 }finally{lock.releaseLock();}
}
