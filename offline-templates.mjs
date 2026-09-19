// Private PDFs are account-scoped in IndexedDB, never published in the shell cache.
const DB_NAME = 'cdq-offline-templates-v1';
export const MODELS = Object.freeze({plancher:'Balance de plancher',cuve4:'Balance Quvre 4',precision:'Balance de précision',camion:'Balance à camion',cuve3:'Balance de cuve 3 points'});
const known = key => Object.prototype.hasOwnProperty.call(MODELS,key);
const identifier = value => typeof value==='string' && /^[\w-]{1,150}$/.test(value);
export function validDestination(d) {
  return !!d && identifier(d.clientId) && identifier(d.folderId) && typeof d.name==='string' && d.name.length>0;
}
export function validPdf(blob) {
  return blob instanceof Blob && blob.type==='application/pdf' && blob.size>5 && blob.size<=32*1024*1024;
}
export function validTemplate(t) {
  return !!t && known(t.modeleId) && validPdf(t.blob) && identifier(t.templateId);
}
export function makeCopy(template,destination,email,requestId) {
  if(!validTemplate(template)||!validDestination(destination)||!email||!/^[\w-]{8,100}$/.test(requestId||''))
    throw new Error('Préparez le modèle et choisissez le dossier du client.');
  return {id:requestId,email,modeleId:template.modeleId,blob:template.blob,templateId:template.templateId,
    modifieLe:template.modifieLe,destination:{...destination},name:MODELS[template.modeleId]+' — '+new Date().toISOString().replace(/[:.]/g,'-')+'.pdf',
    createdAt:Date.now(),status:'pending',editVersion:0,uploadId:'',syncedUploadId:'',driveId:''};
}
export function syncRequest(copy) {
  return {requestId:copy.id,modeleId:copy.modeleId,clientId:copy.destination.clientId,folderId:copy.destination.folderId,
    templateId:copy.templateId,modifieLe:copy.modifieLe};
}
export function nextSync(copy,protocol=0) {
  if(!known(copy.modeleId)||!validDestination(copy.destination))return null;
  // Blank-copy requests remain compatible with the parallel multi-model server fixes.
  // Filled-PDF uploads require the explicit protocol-38 acknowledgement.
  if(!copy.driveId)return {type:'CDQ_OFFLINE_COPY',...syncRequest(copy)};
  if(copy.uploadId && copy.uploadId!==copy.syncedUploadId && protocol>=38)
    return {type:'CDQ_OFFLINE_SAVE',requestId:copy.id,driveId:copy.driveId,uploadId:copy.uploadId,blob:copy.blob};
  return null;
}
export function applyResult(copy,data) {
  if(!copy||data.requestId!==copy.id)return copy;
  const c={...copy};
  if(data.type==='CDQ_OFFLINE_COPY_RESULT') {
    if(!data.ok){c.error=data.message||'La copie reste sur cet appareil.';return c;}
    if(!identifier(data.id))return copy;
    c.driveId=data.id;c.error='';
    c.status=c.uploadId && c.uploadId!==c.syncedUploadId?'pending':'synced';
  } else if(data.type==='CDQ_OFFLINE_SAVE_RESULT' && data.uploadId===c.uploadId) {
    if(!data.ok){c.error=data.message||'Le PDF rempli reste sur cet appareil.';return c;}
    if(!identifier(data.id))return copy;
    c.syncedUploadId=data.uploadId;c.filledDriveId=data.id;c.status='synced';c.error='';
  }
  return c;
}
async function verifyPdf(blob,sha256) {
  if(!validPdf(blob)||await blob.slice(0,5).text()!=='%PDF-')throw new Error('Le fichier reçu n’est pas un PDF valide.');
  if(sha256){
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
    if(hash!==sha256)throw new Error('Le modèle reçu est incomplet. Réessayez sa préparation.');
  }
}
function database() {
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,1);
    req.onupgradeneeded=()=>{for(const n of ['state','destinations','copies'])if(!req.result.objectStoreNames.contains(n))req.result.createObjectStore(n,{keyPath:'id'});};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
}
async function storeAction(name,mode,fn) {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(name,mode);let result;
    const req=fn(tx.objectStore(name));req.onsuccess=()=>{result=req.result;};
    tx.oncomplete=()=>{db.close();resolve(result);};
    tx.onerror=tx.onabort=()=>{db.close();reject(tx.error||new Error('Espace local indisponible. Le PDF n’a pas été enregistré.'));};
  });
}
const nativeStorage={get:(s,id)=>storeAction(s,'readonly',o=>o.get(id)),put:(s,v)=>storeAction(s,'readwrite',o=>o.put(v)),all:s=>storeAction(s,'readonly',o=>o.getAll())};
function download(blob,name) {
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}
export function createOfflineTemplates({send,unlock,openPdf,warmPdf,storage=nativeStorage}) {
  const {get,put,all}=storage;
  let session=null,localEmail='',profile=null,chain=Promise.resolve(),epoch=0;
  const inflight=new Map(),requested=new Set();
  // Le moteur hors ligne reste actif, mais aucun bouton séparé n'est montré.
  // Les modèles locaux sont utilisés depuis les boutons principaux du Selector.
  const launch=document.createElement('button');launch.type='button';launch.id='cdq-offline-launch';launch.textContent='Modèles hors ligne';launch.hidden=true;
  launch.style.cssText='display:none!important;position:fixed;right:14px;bottom:96px;z-index:10001;padding:12px 18px;border:1px solid #739aab;border-radius:12px;background:#132832;color:white;font:600 15px system-ui';
  const panel=document.createElement('section');panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Modèles hors ligne');
  panel.style.cssText='position:fixed;inset:0;z-index:10002;overflow:auto;background:#101820;color:#eef4f7;padding:24px;box-sizing:border-box;font:16px system-ui';
  const header=document.createElement('h2');header.textContent='Modèles hors ligne';panel.append(header);
  const close=document.createElement('button');close.textContent='Retour';close.onclick=()=>{panel.hidden=true;};panel.append(close);
  const status=document.createElement('p');status.setAttribute('role','status');panel.append(status);
  const content=document.createElement('div');panel.append(content);document.body.append(launch,panel);
  const serial=fn=>{const p=chain.then(fn);chain=p.catch(()=>{});return p;};
  const allowed=email=>localEmail===email||session?.email===email;
  function button(parent,label,fn) {
    const b=document.createElement('button');b.type='button';b.textContent=label;
    b.style.cssText='padding:12px 16px;margin:6px 8px 6px 0;border:1px solid #7896a5;border-radius:9px;background:#193545;color:white;font:inherit';
    b.onclick=async()=>{b.disabled=true;try{await fn();}catch(e){status.textContent=e.message||String(e);}finally{b.disabled=false;}};parent.append(b);return b;
  }
  function text(parent,value){const p=document.createElement('p');p.textContent=value;parent.append(p);}
  async function loadTemplate(email,key) {
    let t=await get('state','template:'+email+':'+key);
    // Preserve bytes prepared by V21.37, without changing or discarding legacy copies.
    if(!t&&key==='cuve4')t=await get('state','template:'+email);
    return t;
  }
  function requestModel(key){
    if(!session||!known(key)||requested.has(session.email+':'+key))return;
    requested.add(session.email+':'+key);send({type:'CDQ_OFFLINE_PREPARE',modeleId:key});
  }
  async function refresh() {
    const stamp=epoch,p=await get('state','profile');if(stamp!==epoch)return;
    profile=p;launch.hidden=true;launch.style.display='none';
    if(panel.hidden)return;
    content.replaceChildren();
    if(!p){status.textContent='Ouvrez CDQ avec Internet pour préparer vos modèles.';return;}
    if(!allowed(p.email)){
      status.textContent='Déverrouillez les fichiers préparés sur cet appareil.';
      button(content,'Déverrouiller avec la sécurité de l’appareil',async()=>{
        await unlock(p.email);if(stamp!==epoch)throw new Error('Demande annulée.');localEmail=p.email;await refresh();
      });return;
    }
    const email=p.email,templates=await Promise.all(Object.keys(MODELS).map(k=>loadTemplate(email,k)));
    const destinations=(await all('destinations')).filter(d=>d.email===email).sort((a,b)=>b.savedAt-a.savedAt);
    const copies=(await all('copies')).filter(c=>c.email===email).sort((a,b)=>b.createdAt-a.createdAt);
    if(stamp!==epoch||!allowed(email))return;
    const count=templates.filter(validTemplate).length;
    status.textContent=count+' / '+Object.keys(MODELS).length+' modèles prêts sur cet appareil.';
    if(session && session.protocol<38)text(content,'La synchronisation des PDF remplis exige le serveur avec protocole 38. En attendant, vos réponses restent conservées sur cet appareil.');
    let select;
    if(p.canWrite&&destinations.length){
      const label=document.createElement('label');label.textContent='Dossier du client';label.htmlFor='cdq-local-destination';content.append(label);
      select=document.createElement('select');select.id='cdq-local-destination';select.style.cssText='display:block;width:100%;max-width:650px;padding:12px;margin:10px 0;font:inherit';
      const first=document.createElement('option');first.value='';first.textContent='Choisir le dossier du client';select.append(first);
      for(const d of destinations){const o=document.createElement('option');o.value=d.folderId;o.textContent=d.name;select.append(o);}content.append(select);
    }else if(p.canWrite)text(content,'Avec Internet, ouvrez le dossier du client et le menu de copie pour préparer cette destination.');
    for(const [key,name] of Object.entries(MODELS)){
      const row=document.createElement('div');row.style.cssText='border-top:1px solid #385360;padding-top:10px;margin-top:16px';content.append(row);
      const t=templates.find(t=>t?.modeleId===key);text(row,name+(validTemplate(t)?' — prêt':' — non préparé'));
      if(!validTemplate(t)){
        if(session&&navigator.onLine!==false)button(row,'Préparer maintenant',()=>{requested.delete(session.email+':'+key);requestModel(key);status.textContent='Préparation de '+name+' demandée…';});
        continue;
      }
      button(row,'Consulter le modèle',()=>openPdf({blob:t.blob,name:name+'.pdf',readOnly:true}));
      if(p.canWrite&&select)button(row,'Créer une copie',()=>serial(async()=>{
        if(stamp!==epoch||!allowed(email))throw new Error('Déverrouillez CDQ de nouveau.');
        const d=destinations.find(d=>d.folderId===select.value);if(!d)throw new Error('Choisissez d’abord le dossier du client.');
        if(!window.confirm('Copier « '+name+' » dans « '+d.name+' » ?'))return;
        await put('copies',makeCopy(t,d,email,'local_'+crypto.randomUUID()));await refresh();await sync();
      }));
    }
    text(content,'Les originaux restent inchangés. Une copie créée ici est conservée sur cet appareil, puis ajoutée au dossier client après reconnexion et déverrouillage.');
    if(session?.canWrite)button(content,'Réessayer la synchronisation',()=>serial(sync));
    for(const c of copies){
      const row=document.createElement('div');row.style.cssText='border-top:1px solid #385360;padding-top:10px;margin-top:18px';content.append(row);
      text(row,c.name);text(row,c.destination.name+' — '+(c.status==='synced'?'Ajouté au dossier client':c.uploadId?'PDF rempli conservé ici — envoi en attente':'Copie conservée ici — envoi en attente'));
      if(c.error)text(row,c.error);
      button(row,'Ouvrir la copie',()=>openPdf({blob:c.blob,name:c.name,fileId:c.id,readOnly:!p.canWrite,
        onSave:p.canWrite?(blob,requestId)=>saveCopy(c.id,email,blob,requestId):null}));
      button(row,'Télécharger la copie',()=>download(c.blob,c.name));
    }
  }
  async function saveCopy(id,email,blob,readerRequestId) {
    const stamp=epoch;
    await verifyPdf(blob);
    return serial(async()=>{
      if(stamp!==epoch||!allowed(email)||!profile?.canWrite)throw new Error('Déverrouillez CDQ pour enregistrer.');
      const c=await get('copies',id);if(!c||c.email!==email)throw new Error('Copie locale introuvable.');
      // Repeated reader requests are idempotent. Resolve only after IndexedDB commits.
      if(c.readerRequestId!==readerRequestId){
        await put('copies',{...c,blob,readerRequestId,editVersion:(c.editVersion||0)+1,uploadId:id+'_e_'+crypto.randomUUID(),status:'pending',error:''});
      }
      await refresh();await sync();return {queued:true};
    });
  }
  async function sync() {
    const current=session,stamp=epoch;if(navigator.onLine===false||!current?.canWrite)return;
    const copies=await all('copies');if(stamp!==epoch||session!==current)return;
    for(const c of copies){
      if(c.email!==current.email||inflight.has(c.id))continue;
      const message=nextSync(c,current.protocol);if(!message)continue;
      const job={type:message.type,uploadId:message.uploadId||'',epoch:stamp};inflight.set(c.id,job);
      job.timer=setTimeout(()=>{if(inflight.get(c.id)===job){inflight.delete(c.id);status.textContent='Réponse non reçue. La copie reste conservée ici. Utilisez « Réessayer la synchronisation ».';}},90000);
      try{send(message);}catch(e){clearTimeout(job.timer);inflight.delete(c.id);throw e;}
    }
  }
  async function handleNow(data,stamp) {
    if(stamp!==epoch)return;
    if(data.type==='CDQ_OFFLINE_SESSION'){
      if(typeof data.email!=='string'||!data.email||data.email.length>320)return;
      if(session?.email!==data.email)for(const job of inflight.values())clearTimeout(job.timer);
      if(session?.email!==data.email)inflight.clear();
      session={email:data.email,canWrite:!!data.canWrite,protocol:Number(data.protocol)||0};localEmail=data.email;
      await put('state',{id:'profile',...session});navigator.storage?.persist?.().catch(()=>{});
      if(session.protocol<38)requestModel('camion');
      await refresh();await sync();return;
    }
    const current=session;if(!current||(data.email&&data.email!==current.email))return;
    if(data.type==='CDQ_OFFLINE_TEMPLATE'&&validTemplate(data)){
      await verifyPdf(data.blob,data.sha256);if(stamp!==epoch)return;
      await put('state',{...data,id:'template:'+current.email+':'+data.modeleId,email:current.email});
      await refresh();send({type:'CDQ_OFFLINE_STORED',modeleId:data.modeleId});if(warmPdf)warmPdf(data);
    }
    if(data.type==='CDQ_OFFLINE_DESTINATION'&&validDestination(data)){
      await put('destinations',{id:current.email+':'+data.folderId,email:current.email,clientId:data.clientId,folderId:data.folderId,name:data.name,savedAt:Date.now()});await refresh();
    }
    if(data.type==='CDQ_OFFLINE_CREATE_LOCAL'){
      const id=String(data.requestId||'');
      try{
        if(!current.canWrite||!/^[\w-]{8,100}$/.test(id)||!known(data.modeleId))throw new Error('Copie locale non autorisée ou demande invalide.');
        const d={clientId:String(data.clientId||''),folderId:String(data.folderId||''),name:String(data.destinationName||data.name||'Dossier client')};
        if(!validDestination(d))throw new Error('Dossier client invalide.');
        const t=await loadTemplate(current.email,data.modeleId);if(!validTemplate(t))throw new Error('Préparez ce modèle avec Internet avant de le copier hors ligne.');
        let c=await get('copies',id);
        if(c&&(c.email!==current.email||c.modeleId!==data.modeleId||c.destination.clientId!==d.clientId||c.destination.folderId!==d.folderId))throw new Error('Identifiant déjà utilisé pour une autre copie.');
        if(stamp!==epoch)return;
        if(!c){c=makeCopy(t,d,current.email,id);await put('copies',c);}
        await put('destinations',{id:current.email+':'+d.folderId,email:current.email,...d,savedAt:Date.now()});
        await refresh();send({type:'CDQ_OFFLINE_CREATE_LOCAL_RESULT',requestId:id,ok:true,modeleId:c.modeleId,name:c.name});await sync();
      }catch(e){send({type:'CDQ_OFFLINE_CREATE_LOCAL_RESULT',requestId:id,ok:false,message:e.message||String(e)});}
      return;
    }
    if(['CDQ_OFFLINE_COPY_RESULT','CDQ_OFFLINE_SAVE_RESULT'].includes(data.type)){
      const job=inflight.get(data.requestId);
      if(!job||job.epoch!==stamp||job.type+'_RESULT'!==data.type||(job.uploadId&&job.uploadId!==data.uploadId))return;
      clearTimeout(job.timer);inflight.delete(data.requestId);
      const copy=await get('copies',data.requestId);if(!copy||copy.email!==current.email||stamp!==epoch)return;
      await put('copies',applyResult(copy,data));await refresh();if(data.ok)await sync();
    }
  }
  launch.onclick=()=>{panel.hidden=false;refresh().catch(e=>{status.textContent=e.message;});};
  window.addEventListener('online',()=>serial(sync).catch(()=>{}));
  refresh().catch(()=>{});
  return {handle(data){const stamp=epoch;return serial(()=>handleNow(data,stamp)).catch(e=>{status.textContent=e.message||String(e);});},
    lock(){epoch++;session=null;localEmail='';for(const job of inflight.values())clearTimeout(job.timer);inflight.clear();requested.clear();panel.hidden=true;},refresh};
}
