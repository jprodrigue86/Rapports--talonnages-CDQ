function obtenirContexteCreationCDQV2523(clientId){
 var user=verifierDroit_('ecriture'),scope=cdqDriveScopeV2521_(clientId,{},[CONFIG.MASTER_FOLDER_ID]);if(scope.path.length!==2||scope.meta.mimeType!=='application/vnd.google-apps.folder')throw Error('Choisissez un client.');
 var values={client_nom:scope.meta.name},profile=cdqObtenirProfilTechnicien_(user.email);if(profile.actifRapports!==false&&profile.nomRapport)values.client_technicien=profile.nomRapport;
 var cache=CacheService.getScriptCache(),key='CDQ23_LOCATION_'+clientId,cached=cache.get(key);if(cached)return Object.assign(values,JSON.parse(cached));
 // Only explicit city/address fields from recent reports are used, never guesses.
 var rows=Drive.Files.list({q:"'"+cdq23Quote_(clientId)+"' in parents and trashed=false and mimeType='application/vnd.google-apps.spreadsheet'",pageSize:5,orderBy:'modifiedTime desc',fields:'files(id)',supportsAllDrives:true,includeItemsFromAllDrives:true}).files||[],cities={},addresses={};
 rows.forEach(function(f){var sheet=SpreadsheetApp.openById(f.id).getSheets()[0],h=Math.min(35,sheet.getLastRow()),w=Math.min(100,sheet.getLastColumn());if(!h||!w)return;sheet.getRange(1,1,h,w).getDisplayValues().forEach(function(row){row.forEach(function(v,c){var n=cdq23Norm_(v),store=/^ville\s*:$/.test(n)?cities:/^adresse\s*:$/.test(n)?addresses:null;if(!store)return;for(var i=c+1;i<Math.min(row.length,c+15);i++){var text=cdq23Text_(row[i]);if(text){store[cdq23Norm_(text)]=text;break;}}});});});
 var location={};if(Object.keys(cities).length===1)location.client_ville=Object.values(cities)[0];if(Object.keys(addresses).length===1)location.client_adresse=Object.values(addresses)[0];cache.put(key,JSON.stringify(location),300);return Object.assign(values,location);
}
function obtenirEmplacementGeneralCDQV2523(id){verifierDroit_('lecture');var s=cdqDriveScopeV2521_(id,{},[CDQ_GENERAL_DRIVE_V2521_,CONFIG.MASTER_FOLDER_ID]);return {id:s.meta.id,parentId:s.path.length>1?s.path[s.path.length-2].id:s.root,kind:s.meta.mimeType==='application/vnd.google-apps.folder'?'folder':'file'};}
function obtenirPdfAutoriseCDQV2523_(id){
 var scope=cdqDriveScopeV2521_(id,{},[CONFIG.MASTER_FOLDER_ID,CDQ_GENERAL_DRIVE_V2521_]);if(scope.meta.mimeType!=='application/pdf')throw Error('PDF introuvable.');
 var f=DriveApp.getFileById(scope.meta.id),client=scope.root===CONFIG.MASTER_FOLDER_ID&&scope.path.length>2?scope.path[1].id:scope.path[scope.path.length-2].id;
 return {fichier:f,client:DriveApp.getFolderById(client)};
}

function verifierCreationPreRemplieCDQV2523(id,uploadId){verifierDroit_('ecriture');obtenirPdfAutoriseCDQV2523_(id);var m=Drive.Files.get(id,{fields:'appProperties',supportsAllDrives:true});return !!(m.appProperties&&m.appProperties.cdqCreationPrefill===String(uploadId));}
