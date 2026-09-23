function cdqReaderOwnerV2520(){
  const email=String(utilisateurCourantEmail||'');
  if(!email||cdqAccessState!=='ready')throw new Error('Déverrouillez votre compte CDQ.');
  return email;
}
function cdqReaderGuardV2520(email){if(cdqReaderOwnerV2520()!==email)throw new Error('Le compte a changé. Rouvrez le PDF.');}
async function cdqLoadPdfRecord(id){
  const email=cdqReaderOwnerV2520();
  const pending=(await cdqV19QueueGet()).filter(a=>a.targetId===id&&a.kind==='pdf-save-v2520').at(-1);
  cdqReaderGuardV2520(email);
  let old=await cdqV19GetRecord('document-pdf',id);cdqReaderGuardV2520(email);
  if(pending)return {...old,id,nom:pending.fileName,revision:pending.expectedRevision,pendingSaveId:pending.id,blob:new Blob([cdqV2112Base64ToBytes(pending.data)],{type:'application/pdf'})};
  if(navigator.onLine===false){if(old?.blob)return old;throw new Error('Ouvrez ce PDF une fois avec Internet pour le conserver hors ligne.');}
  const meta=await cdqV19Gs('obtenirPdfLecteurCDQV2520',[id,old?.revision||'']);cdqReaderGuardV2520(email);
  if(meta.unchanged&&old?.blob&&old.blob.size===meta.taille)return {...old,...meta};
  const parts=[];
  if(meta.base64)parts.push(cdqV2112Base64ToBytes(meta.base64));
  else {
    if(!meta.chunks||meta.chunks>32||meta.taille>CDQ_DOCUMENT_MAX_BYTES)throw new Error('Taille PDF invalide.');
    for(let i=0;i<meta.chunks;i+=3){
      const group=await Promise.all(Array.from({length:Math.min(3,meta.chunks-i)},(_,n)=>cdqV19Gs('obtenirChunkDocumentPdfCDQ',[id,meta.revision,i+n])));
      cdqReaderGuardV2520(email);
      for(const part of group){if(part.revision!==meta.revision)throw new Error('Le PDF a changé pendant sa lecture.');parts.push(cdqV2112Base64ToBytes(part.base64));}
    }
  }
  const blob=new Blob(parts,{type:'application/pdf'});
  if(blob.size!==meta.taille||(await blob.slice(0,5).text())!=='%PDF-')throw new Error('PDF reçu incomplet.');
  const rec={...meta,blob};delete rec.base64;cdqReaderGuardV2520(email);
  await cdqV19PutRecord('document-pdf',id,rec);cdqReaderGuardV2520(email);return rec;
}
async function cdqReaderProcessSaveV2520(a){
  const email=cdqReaderOwnerV2520();if(a.owner!==email)throw new Error('Le compte a changé. Rouvrez le PDF.');
  if(!['admin','technicien'].includes(utilisateurCourantRole))throw new Error('Accès en lecture seule.');
  let revision=a.expectedRevision;
  if(a.predecessor){const receipt=await cdqV19GetRecord('pdf-save-receipt',a.predecessor);cdqReaderGuardV2520(email);if(!receipt?.revision)throw new Error('La sauvegarde précédente doit être synchronisée en premier.');revision=receipt.revision;}
  const r=await cdqV19Gs('enregistrerPdfLecteurCDQV2520',[a.targetId,a.data,a.id,revision]);cdqReaderGuardV2520(email);
  if(!r?.ok||r.id!==a.targetId||!r.revision)throw new Error('Enregistrement non confirmé.');
  await cdqV19PutRecord('pdf-save-receipt',a.id,{revision:r.revision});cdqReaderGuardV2520(email);
  await cdqV19PutRecord('document-pdf',a.targetId,{id:r.id,nom:r.nom,taille:cdqV2112Base64ToBytes(a.data).length,revision:r.revision,clientId:r.clientId,type:'PDF',blob:new Blob([cdqV2112Base64ToBytes(a.data)],{type:'application/pdf'})});
  if(r.clientId){delete cacheContenuCompagnies[r.clientId];delete cacheDerniereVerificationCompagnies[r.clientId];try{actualiserCompagnieEnArrierePlan(r.clientId)}catch(_){}}
  window.dispatchEvent(new CustomEvent('cdq:pdf-saved',{detail:r}));return r;
}
let cdqReaderOpeningV2520=false;
async function cdqOpenPdfInternal(id,preparedRecord){
  if(cdqReaderOpeningV2520||document.getElementById('cdqReaderFrame'))return;
  const email=cdqReaderOwnerV2520();cdqReaderOpeningV2520=true;let frame=null,rec,disposed=false;
  const inPwa=cdqPwaAvailable(),requests=new Map(),unconfirmed=new Set();let lastSaveId='';
  const valid=()=>cdqReaderGuardV2520(email);
  const reply=d=>inPwa?cdqPostToPwa({...d,type:'CDQ_PDF_SAVE_RESULT_V2304'}):frame?.contentWindow.postMessage({...d,type:'CDQ_READER_SAVED'},CDQ_PWA_ORIGIN);
  function close(){if(disposed)return;disposed=true;window.removeEventListener('message',receive);frame?.remove();cdqReaderOpeningV2520=false;}
  async function save(d){
    valid();if(!['admin','technicien'].includes(utilisateurCourantRole))throw new Error('Accès en lecture seule.');
    const bytes=new Uint8Array(await d.blob.arrayBuffer());valid();
    if(bytes.length<8||bytes.length>CDQ_DOCUMENT_MAX_BYTES||String.fromCharCode(...bytes.slice(0,5))!=='%PDF-')throw new Error('PDF invalide.');
    let bin='';for(let i=0;i<bytes.length;i+=32768)bin+=String.fromCharCode.apply(null,bytes.subarray(i,i+32768));
    const q=await cdqV19QueueGet();valid();
    const previous=q.filter(a=>a.kind==='pdf-save-v2520'&&a.targetId===id).at(-1);
    let revision=rec.revision;
    if(!previous&&lastSaveId){const receipt=await cdqV19GetRecord('pdf-save-receipt',lastSaveId);valid();if(receipt?.revision)revision=receipt.revision;}
    if(!q.some(a=>a.id===d.requestId))await cdqV19QueueAdd({id:d.requestId,kind:'pdf-save-v2520',owner:email,targetId:id,data:btoa(bin),fileName:rec.nom,expectedRevision:revision,predecessor:previous?.id||''});
    lastSaveId=d.requestId;unconfirmed.add(d.requestId);
    valid();if(navigator.onLine)await cdqSynchroniserEnAttente();valid();
    const remaining=(await cdqV19QueueGet()).find(a=>a.id===d.requestId);valid();
    if(remaining?.lastError)throw new Error(remaining.lastError);
    if(!remaining){const stored=await cdqV19GetRecord('document-pdf',id);valid();if(stored?.revision)rec=stored;}
    afficherMessage(remaining?'PDF conservé sur cet appareil — synchronisation en attente.':'PDF enregistré dans le dossier client.',true);
    unconfirmed.delete(d.requestId);return {queued:!!remaining};
  }
  async function receive(event){
    if(disposed||(inPwa?!cdqFromPwa(event):event.source!==frame?.contentWindow||event.origin!==CDQ_PWA_ORIGIN))return;
    const d=event.data||{};
    if(d.type==='CDQ_PDF_CLOSED_V2520'&&d.fileId===id||d.type==='CDQ_READER_CLOSE'){if(d.error)afficherErreur(new Error(d.error));close();return;}
    if(d.type==='CDQ_READER_READY'&&!inPwa)frame.contentWindow.postMessage({type:'CDQ_READER_OPEN',blob:rec.blob,name:rec.nom,fileId:id,readOnly:utilisateurCourantRole==='lecture'},CDQ_PWA_ORIGIN);
    if(d.type===(inPwa?'CDQ_PDF_DISCARD_REQUEST_V2520':'CDQ_READER_DISCARD')){
      if(inPwa&&d.fileId!==id||!/^discard-[\w-]{8,80}$/.test(String(d.requestId||'')))return;
      try{
        valid();
        await cdqV19MutateQueue(q=>{valid();if(cdqV19SyncRunning)throw new Error('Une synchronisation est en cours. Attendez sa fin avant de fermer.');return q.filter(a=>!unconfirmed.has(a.id));});
        unconfirmed.clear();reply({requestId:d.requestId,ok:true});
      }catch(e){reply({requestId:d.requestId,ok:false,error:e.message||String(e)});}return;
    }
    if(d.type!==(inPwa?'CDQ_PDF_SAVE_REQUEST_V2304':'CDQ_READER_SAVE')||inPwa&&d.fileId!==id)return;
    if(!/^save-[\w-]{8,80}$/.test(String(d.requestId||''))||!(d.blob instanceof Blob)||d.blob.type!=='application/pdf')return;
    if(!requests.has(d.requestId))requests.set(d.requestId,save(d));
    try{const result=await requests.get(d.requestId);reply({requestId:d.requestId,ok:true,...result});}
    catch(e){requests.delete(d.requestId);reply({requestId:d.requestId,ok:false,error:e.message||String(e)});}
  }
  try{
    afficherMessage('Ouverture du PDF…',true);rec=preparedRecord||await cdqLoadPdfRecord(id);lastSaveId=rec.pendingSaveId||'';valid();
    window.addEventListener('message',receive);
    if(inPwa){cdqPostToPwa({type:'CDQ_OPEN_PDF_V2304',readerProtocol:2520,blob:rec.blob,name:rec.nom,fileId:id,readOnly:utilisateurCourantRole==='lecture'});}
    else{frame=document.createElement('iframe');frame.id='cdqReaderFrame';frame.title=rec.nom;frame.referrerPolicy='origin';frame.src=CDQ_PWA_ORIGIN+'/Rapports--talonnages-CDQ/reader-v2520.html';frame.style.cssText='position:fixed;inset:0;width:100%;height:100%;border:0;z-index:2147483000';document.body.append(frame);}
  }catch(e){close();afficherErreur(e);}
}
const CDQ_PDF_READER_KEY='cdqPdfReaderPreferenceV1';
function cdqPdfReaderPreference(){const v=localStorage.getItem(CDQ_PDF_READER_KEY)||'ask';return ['ask','cdq','ilovepdf','acrobat'].includes(v)?v:'ask';}
function cdqSetPdfReaderPreference(value){localStorage.setItem(CDQ_PDF_READER_KEY,value);return value;}
async function cdqExternalPdfV2520(id,preferred){
  if(/BalanceCDQAndroid\//.test(navigator.userAgent)&&window.cdqDocumentOpen){window.cdqDocumentOpen.open(id,'pdf',preferred);return;}
  const rec=await cdqLoadPdfRecord(id);cdqDownloadPdf(rec);afficherMessage('Ouvrez le PDF téléchargé dans '+(preferred==='ilovepdf'?'iLovePDF':'Acrobat')+'.',true);
}
function cdqShowPdfReaderChoice(id,meta={}){
  const o=cdqV19CreateModal('cdqPdfReaderChoice','Ouvrir — '+(meta.nom||meta.name||'Rapport PDF'),'cdq-pdf-reader-choice'),body=o.querySelector('.cdq-v19-body');body.innerHTML='';
  const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=true;label.append(check,document.createTextNode(' Utiliser ce lecteur par défaut'));body.append(label);
  for(const [value,title] of [['cdq','Lecteur CDQ — remplir et enregistrer'],['ilovepdf','iLovePDF'],['acrobat','Adobe Acrobat']]){
    const b=cdqDocumentButton(body,title,()=>{if(check.checked){cdqSetPdfReaderPreference(value);try{cdqScheduleSavePreferencesV72()}catch(_){}}o.style.display='none';Promise.resolve(value==='cdq'?cdqOpenPdfInternal(id):cdqExternalPdfV2520(id,value)).catch(afficherErreur);});if(value==='cdq')b.classList.add('primary-button');
  }
  o.style.display='flex';
}
async function cdqOpenPdf(id,meta){
  if(!/^[A-Za-z0-9_-]{10,200}$/.test(String(id)))throw new Error('Identifiant PDF invalide.');
  const preferred=cdqPdfReaderPreference();
  if(preferred==='ask'){cdqShowPdfReaderChoice(id,meta);return true;}
  if(preferred==='cdq')await cdqOpenPdfInternal(id);else await cdqExternalPdfV2520(id,preferred);
  return true;
}
window.cdqOpenPdfV2520=cdqOpenPdf;
