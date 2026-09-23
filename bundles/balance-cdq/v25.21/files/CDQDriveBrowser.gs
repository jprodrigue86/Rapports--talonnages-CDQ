// Additional Drive scope explicitly requested for the general folder browser.
const CDQ_GENERAL_DRIVE_V2521_='1F7rgU20Hc1PmjxQHY7ALTqkqArN6RSsf';
const CDQ_DRIVE_FIELDS_V2521_='id,name,mimeType,parents,trashed,modifiedTime,webViewLink,starred';
function cdqDriveIdV2521_(id){id=String(id||'');if(!/^[A-Za-z0-9_-]{10,200}$/.test(id))throw Error('Identifiant Drive invalide.');return id;}
function cdqDriveMetaV2521_(id,cache){id=cdqDriveIdV2521_(id);return Object.prototype.hasOwnProperty.call(cache,id)?cache[id]:(cache[id]=Drive.Files.get(id,{fields:CDQ_DRIVE_FIELDS_V2521_,supportsAllDrives:true}));}
function cdqDriveScopeV2521_(id,cache,roots){
  const target=cdqDriveMetaV2521_(id,cache),seen={},queue=[{id:target.id,path:[]}];let reads=0;
  if(target.trashed)throw Error('Élément supprimé.');
  while(queue.length&&reads++<60){
    const node=queue.shift();if(seen[node.id])continue;seen[node.id]=true;
    const meta=cdqDriveMetaV2521_(node.id,cache);if(meta.trashed)continue;
    const path=[{id:meta.id,nom:meta.name},...node.path];
    if(roots.indexOf(meta.id)!==-1)return {meta:target,root:meta.id,path};
    if(meta.mimeType==='application/vnd.google-apps.shortcut')throw Error('Ouvrez ce raccourci dans Google Drive.');
    (meta.parents||[]).forEach(parent=>queue.push({id:parent,path}));
  }
  throw Error('Cet élément ne fait pas partie des dossiers CDQ autorisés.');
}
function cdqDrivePinsKeyV2521_(email){return 'CDQ_DRIVE_FAVORITES_V2521_'+empreinteCDQ_(String(email).toLowerCase());}
function cdqDrivePinsV2521_(email){try{let a=JSON.parse(PropertiesService.getScriptProperties().getProperty(cdqDrivePinsKeyV2521_(email))||'{}');if(Array.isArray(a))a={ids:a};const clean=x=>Array.isArray(x)?x.filter(id=>/^[A-Za-z0-9_-]{10,200}$/.test(id)).slice(0,150):[];return {ids:clean(a.ids),hidden:clean(a.hidden)};}catch(e){return {ids:[],hidden:[]};}}
function cdqDriveItemV2521_(meta,pins){return {id:meta.id,nom:meta.name,kind:meta.mimeType==='application/vnd.google-apps.folder'?'folder':'file',mimeType:meta.mimeType,modifiedTime:meta.modifiedTime||'',favori:pins.hidden.indexOf(meta.id)===-1&&(pins.ids.indexOf(meta.id)!==-1||!!meta.starred)};}
function cdqDrivePageV2521_(token){token=String(token||'');if(token.length>4096||/[\x00-\x1f]/.test(token))throw Error('Page invalide.');return token;}
function obtenirDossierGeneralCDQV2521(id,pageToken){
  const user=verifierDroit_('lecture'),cache={},scope=cdqDriveScopeV2521_(id||CDQ_GENERAL_DRIVE_V2521_,cache,[CDQ_GENERAL_DRIVE_V2521_,CONFIG.MASTER_FOLDER_ID]);
  if(scope.meta.mimeType!=='application/vnd.google-apps.folder')throw Error('Choisissez un dossier.');
  const pins=cdqDrivePinsV2521_(user.email),options={q:"'"+scope.meta.id+"' in parents and trashed=false",pageSize:100,orderBy:'folder,name_natural',fields:'nextPageToken,files('+CDQ_DRIVE_FIELDS_V2521_+')',supportsAllDrives:true,includeItemsFromAllDrives:true};
  const token=cdqDrivePageV2521_(pageToken);if(token)options.pageToken=token;
  const result=Drive.Files.list(options);
  return {id:scope.meta.id,nom:scope.meta.name,root:scope.root,crumbs:scope.path,items:(result.files||[]).map(f=>cdqDriveItemV2521_(f,pins)),nextPageToken:result.nextPageToken||''};
}
function obtenirFavorisGenerauxCDQV2521(pageToken){
  const user=verifierDroit_('lecture'),pins=cdqDrivePinsV2521_(user.email),cache={},items=[],seen={},token=cdqDrivePageV2521_(pageToken);
  const roots=[CDQ_GENERAL_DRIVE_V2521_,CONFIG.MASTER_FOLDER_ID];
  function add(id){if(seen[id])return;seen[id]=true;try{const s=cdqDriveScopeV2521_(id,cache,roots),item=cdqDriveItemV2521_(s.meta,pins);item.path=s.path.map(x=>x.nom).join(' / ');item.scope=s.root;if(item.favori)items.push(item);}catch(e){}}
  if(!token)pins.ids.forEach(add);
  const options={q:'starred=true and trashed=false',pageSize:100,fields:'nextPageToken,files('+CDQ_DRIVE_FIELDS_V2521_+')',supportsAllDrives:true,includeItemsFromAllDrives:true};if(token)options.pageToken=token;
  const list=Drive.Files.list(options);(list.files||[]).forEach(f=>{cache[f.id]=f;add(f.id)});
  return {items,nextPageToken:list.nextPageToken||'',root:CDQ_GENERAL_DRIVE_V2521_};
}
function definirFavoriGeneralCDQV2521(id,active){
  const user=verifierDroit_('lecture');id=cdqDriveIdV2521_(id);
  // Personal shortcuts do not grant write access or change Drive permissions.
  const scope=cdqDriveScopeV2521_(id,{},[CDQ_GENERAL_DRIVE_V2521_,CONFIG.MASTER_FOLDER_ID]);
  const lock=LockService.getScriptLock();lock.waitLock(15000);
  try{const pins=cdqDrivePinsV2521_(user.email),next={ids:pins.ids.filter(x=>x!==id),hidden:pins.hidden.filter(x=>x!==id)};
    if(active)next.ids.push(id);else if(scope.meta.starred)next.hidden.push(id);
    const encoded=JSON.stringify(next);if(next.ids.length>150||next.hidden.length>150||encoded.length>8000)throw Error('La limite des favoris personnels est atteinte.');
    PropertiesService.getScriptProperties().setProperty(cdqDrivePinsKeyV2521_(user.email),encoded);
    return {id,favori:!!active};
  }finally{lock.releaseLock();}
}
