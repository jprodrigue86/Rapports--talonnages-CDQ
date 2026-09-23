// Batch metadata reads. The public entry points still enforce CDQ authorization.
function cdqListFolderMetadataV2527_(id) {
  const files=[];let token;
  do {
    const options={q:"'"+String(id).replace(/'/g,"\\'")+"' in parents and trashed = false",
      fields:'nextPageToken,files(id,name,mimeType,modifiedTime,description,starred)',pageSize:1000,
      supportsAllDrives:true,includeItemsFromAllDrives:true};
    if(token)options.pageToken=token;
    const page=Drive.Files.list(options);
    (page.files||[]).forEach(function(f){files.push(f);});
    token=page.nextPageToken;
  }while(token);
  return files;
}

function cdqFolderMetaV2527_(f, index, type) {
  return {id:f.id,nom:f.name||'',favori:!!f.starred,
    notePresente:!!extraireNoteCDQ_(f.description||''),
    photoPresente:photoPresenteDansIndexCDQ_(index,type,f.id),
    protege:String(f.description||'').indexOf(CDQ_PROTECTION_MARKER_)!==-1,
    charge:false,fichiers:[],dossiers:[]};
}

function cdqReadSurfaceV2527_(folder, index) {
  const rows=cdqListFolderMetadataV2527_(folder.getId());
  index=index||construireIndexPhotosCDQ_();
  const root=metaDossierLegere_(folder,index);root.charge=true;
  rows.forEach(function(f){
    if(f.mimeType==='application/vnd.google-apps.folder'){root.dossiers.push(cdqFolderMetaV2527_(f,index,'dossier'));return;}
    const sheet=f.mimeType===MimeType.GOOGLE_SHEETS, pdf=f.mimeType===MimeType.PDF||/\.pdf$/i.test(f.name||''), excel=/\.xlsx?$/i.test(f.name||'');
    if(!sheet&&!pdf&&!excel)return;
    root.fichiers.push({id:f.id,nom:f.name||'',type:pdf?'PDF':sheet?'GOOGLE_SHEETS':'EXCEL',
      dateModification:f.modifiedTime||'',favori:!!f.starred,notePresente:!!extraireNoteCDQ_(f.description||''),
      photoPresente:photoPresenteDansIndexCDQ_(index,'fichier',f.id)});
  });
  root.fichiers.sort(function(a,b){return new Date(b.dateModification)-new Date(a.dateModification);});
  root.dossiers.sort(function(a,b){return a.nom.localeCompare(b.nom,'fr',{sensitivity:'base'});});
  return root;
}

function cdqReadCompaniesV2527_() {
  const rows=cdqListFolderMetadataV2527_(CONFIG.MASTER_FOLDER_ID), index=construireIndexPhotosCDQ_();
  return rows.filter(function(f){return f.mimeType==='application/vnd.google-apps.folder'&&!estDossierSystemeCDQ_({getName:function(){return f.name||'';},getDescription:function(){return f.description||'';}});})
    .map(function(f){const m=cdqFolderMetaV2527_(f,index,'client');return {id:m.id,nom:m.nom,favori:m.favori,notePresente:m.notePresente,photoPresente:m.photoPresente};})
    .sort(function(a,b){return a.nom.localeCompare(b.nom,'fr',{sensitivity:'base'});});
}

function cdqStartupCachedV2527_(state) {
  // Only reuse an authorized result and an existing cache; no Drive call during unlock.
  if(!state||!state.autorise)return state;
  try{
    const raw=CacheService.getScriptCache().get('LISTE_COMPAGNIES_V8_UI');
    const companies=raw?JSON.parse(raw):null;
    if(Array.isArray(companies))state.compagniesInitiales=companies;
  }catch(_){}
  return state;
}
