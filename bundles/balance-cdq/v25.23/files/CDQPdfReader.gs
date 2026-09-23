// Lecteur CDQ : même document client, validation de révision et réessai idempotent.
function obtenirPdfLecteurCDQV2520(id, revision) {
  verifierDroit_('lecture');
  cdqDriveScopeV2521_(id,{},[CONFIG.MASTER_FOLDER_ID,CDQ_GENERAL_DRIVE_V2521_]);
  const cible = obtenirPdfClientCDQ_(id), f = cible.fichier;
  const size = Number(f.getSize()), current = f.getLastUpdated().toISOString();
  if (!size || size > CDQ_DOCUMENT_MAX_BYTES_) throw new Error('PDF trop volumineux (32 Mo maximum).');
  const result = {id:f.getId(),nom:f.getName(),clientId:cible.client.getId(),type:'PDF',taille:size,
    revision:current,chunkSize:CDQ_DOCUMENT_CHUNK_BYTES_,chunks:Math.ceil(size/CDQ_DOCUMENT_CHUNK_BYTES_)};
  if (current === String(revision || '')) result.unchanged = true;
  else if (size <= CDQ_DOCUMENT_CHUNK_BYTES_) {
    result.base64 = Utilities.base64Encode(f.getBlob().getBytes());
    if (f.getLastUpdated().toISOString() !== current) throw new Error('Le PDF a changé pendant son ouverture. Réessayez.');
  }
  return result;
}

function enregistrerPdfLecteurCDQV2520(id, base64, uploadId, expectedRevision) {
  const acces = verifierDroit_('ecriture');
  id = String(id || ''); uploadId = String(uploadId || '');
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(id) || !/^[A-Za-z0-9_-]{8,100}$/.test(uploadId)) throw new Error('Envoi PDF invalide.');
  if (typeof base64 !== 'string' || base64.length > Math.ceil(CDQ_DOCUMENT_MAX_BYTES_/3)*4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw new Error('Contenu PDF invalide.');
  const bytes = Utilities.base64Decode(base64);
  if (bytes.length < 8 || bytes.length > CDQ_DOCUMENT_MAX_BYTES_ || bytes.slice(0,5).map(b=>String.fromCharCode(b)).join('') !== '%PDF-') throw new Error('PDF invalide (32 Mo maximum).');
  const hash = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes));
  const author = empreinteCDQ_(String(acces.email || '').toLowerCase());
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    cdqDriveScopeV2521_(id,{},[CONFIG.MASTER_FOLDER_ID,CDQ_GENERAL_DRIVE_V2521_]);
    const cible = obtenirPdfClientCDQ_(id);
    const before = Drive.Files.get(id,{fields:'id,name,mimeType,trashed,modifiedTime,appProperties',supportsAllDrives:true});
    if (before.trashed || before.mimeType !== 'application/pdf') throw new Error('PDF client introuvable.');
    const props = before.appProperties || {};
    if (props.cdqReaderUpload === uploadId && props.cdqReaderAuthor === author) {
      if (props.cdqReaderHash !== hash) throw new Error('Cet envoi existe avec un autre contenu.');
      return {ok:true,id:id,nom:before.name,revision:before.modifiedTime,clientId:cible.client.getId()};
    }
    if (!expectedRevision || Date.parse(before.modifiedTime) !== Date.parse(String(expectedRevision)))
      throw new Error('Ce PDF a été modifié depuis son ouverture. Vos réponses restent sur cet appareil; aucune version du dossier client n’a été écrasée.');
    const properties={cdqReaderUpload:uploadId,cdqReaderHash:hash,cdqReaderAuthor:author};if(uploadId.startsWith('save-copy_'))properties.cdqCreationPrefill=uploadId;
    const result = Drive.Files.update({appProperties:properties},id,
      Utilities.newBlob(bytes,'application/pdf',before.name),{fields:'id,name,modifiedTime',supportsAllDrives:true});
    invaliderCacheContenuClient_(cible.client.getId()); invaliderCacheCompagnies_();
    return {ok:true,id:result.id,nom:result.name,revision:result.modifiedTime,clientId:cible.client.getId()};
  } finally { lock.releaseLock(); }
}
