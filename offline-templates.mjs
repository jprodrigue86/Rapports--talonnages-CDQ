// Private PDF bytes live only in this device's IndexedDB, never in the public shell cache.
const DB_NAME = 'cdq-offline-templates-v1';
const MODELS = Object.freeze({
  cuve4: Object.freeze({id:'cuve4', name:'Balance Quvre 4'}),
  camion: Object.freeze({id:'camion', name:'Balance à camion'})
});
const MODEL_IDS = Object.freeze(Object.keys(MODELS));

export function validDestination(d) {
  return !!d && /^[\w-]+$/.test(d.clientId || '') && /^[\w-]+$/.test(d.folderId || '') && typeof d.name === 'string';
}
export function validTemplate(t) {
  return !!t && !!MODELS[t.modeleId] && t.blob instanceof Blob && t.blob.type === 'application/pdf' &&
    t.blob.size > 5 && t.blob.size <= 15 * 1024 * 1024 && /^[\w-]+$/.test(t.templateId || '');
}
export function makeCopy(template, destination, email, requestId) {
  if (!validTemplate(template) || !validDestination(destination) || !email) throw new Error('Préparez le modèle et le dossier avec Internet.');
  const model=MODELS[template.modeleId];
  return {id:requestId, email, modeleId:model.id, blob:template.blob, templateId:template.templateId,
    modifieLe:template.modifieLe, destination:{...destination}, name:model.name + ' — ' + new Date().toISOString().replace(/[:.]/g,'-') + '.pdf',
    createdAt:Date.now(), status:'pending'};
}
export function syncRequest(copy) {
  if(!copy || !MODELS[copy.modeleId]) throw new Error('Modèle hors ligne inconnu.');
  return {requestId:copy.id, modeleId:copy.modeleId, clientId:copy.destination.clientId,
    folderId:copy.destination.folderId, templateId:copy.templateId, modifieLe:copy.modifieLe};
}
function database() {
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,1);
    req.onupgradeneeded=()=>{for(const name of ['state','destinations','copies'])req.result.createObjectStore(name,{keyPath:'id'});};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
}
async function storeAction(name,mode,fn) {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(name,mode);let result;
    const req=fn(tx.objectStore(name));req.onsuccess=()=>{result=req.result;};
    tx.oncomplete=()=>{db.close();resolve(result);};
    tx.onerror=tx.onabort=()=>{db.close();reject(tx.error||new Error('Espace local indisponible.'));};
  });
}
const get=(s,id)=>storeAction(s,'readonly',o=>o.get(id));
const put=(s,value)=>storeAction(s,'readwrite',o=>o.put(value));
const all=s=>storeAction(s,'readonly',o=>o.getAll());
function download(blob,name) {
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function templateKey(email,modeleId){return 'template:'+email+':'+modeleId;}
async function getTemplate(email,modeleId){
  const current=await get('state',templateKey(email,modeleId));
  if(validTemplate(current))return current;
  // V21.37 stored Balance Quvre 4 without a model suffix. Keep it usable after upgrade.
  if(modeleId==='cuve4'){
    const legacy=await get('state','template:'+email);
    if(validTemplate(legacy) && legacy.modeleId==='cuve4')return legacy;
  }
  return null;
}
export function createOfflineTemplates({send,unlock,openPdf,warmPdf}) {
  let session=null,localEmail='',profile=null,busy=false,chain=Promise.resolve();
  const inflight=new Set(),requested=new Set();
  const launch=document.createElement('button');launch.type='button';launch.id='cdq-offline-launch';
  launch.textContent='Modèles hors ligne';launch.hidden=true;
  launch.style.cssText='position:fixed;right:14px;bottom:96px;z-index:10001;padding:12px 18px;border:1px solid #739aab;border-radius:12px;background:#132832;color:white;font:600 15px system-ui';
  const panel=document.createElement('section');panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Modèles hors ligne');
  panel.style.cssText='position:fixed;inset:0;z-index:10002;overflow:auto;background:#101820;color:#eef4f7;padding:24px;box-sizing:border-box;font:16px system-ui';
  const header=document.createElement('h2');header.textContent='Modèles hors ligne';panel.append(header);
  const close=document.createElement('button');close.textContent='Retour';close.onclick=()=>{panel.hidden=true;};panel.append(close);
  const status=document.createElement('p');status.setAttribute('role','status');panel.append(status);
  const content=document.createElement('div');panel.append(content);document.body.append(launch,panel);
  function button(parent,label,fn) {
    const b=document.createElement('button');b.type='button';b.textContent=label;
    b.style.cssText='padding:12px 16px;margin:6px 8px 6px 0;border:1px solid #7896a5;border-radius:9px;background:#193545;color:white;font:inherit';
    b.onclick=()=>Promise.resolve().then(fn).catch(e=>{status.textContent=e.message||String(e);});parent.append(b);return b;
  }
  function text(parent,value){const p=document.createElement('p');p.textContent=value;parent.append(p);return p;}
  function requestModel(modeleId,force=false){
    if(!session || !MODELS[modeleId] || (!force && requested.has(modeleId)))return;
    requested.add(modeleId);
    send({type:'CDQ_OFFLINE_PREPARE',modeleId});
  }
  async function refresh() {
    profile=await get('state','profile');
    launch.hidden=!profile;
    if(panel.hidden)return;
    content.replaceChildren();
    if(!profile){status.textContent='Ouvrez CDQ une fois avec Internet pour préparer les modèles.';return;}
    if(localEmail!==profile.email && session?.email!==profile.email){
      status.textContent='Déverrouillez les fichiers préparés sur cet appareil.';
      button(content,'Déverrouiller avec la sécurité de l’appareil',async()=>{await unlock(profile.email);localEmail=profile.email;await refresh();});return;
    }
    const email=profile.email;
    const destinations=(await all('destinations')).filter(d=>d.email===email).sort((a,b)=>b.savedAt-a.savedAt);
    const templates={};let available=0;
    for(const id of MODEL_IDS){templates[id]=await getTemplate(email,id);if(templates[id])available++;}
    status.textContent=available+'/'+MODEL_IDS.length+' modèles disponibles sur cet appareil.';
    for(const id of MODEL_IDS){
      const model=MODELS[id],template=templates[id];
      const section=document.createElement('div');section.style.cssText='border-top:1px solid #385360;margin-top:18px;padding-top:12px';content.append(section);
      const title=document.createElement('h3');title.textContent=model.name;title.style.cssText='margin:0 0 8px';section.append(title);
      if(template){
        text(section,'Disponible hors ligne.');
        button(section,'Ouvrir '+model.name,()=>openPdf({blob:template.blob,name:model.name+'.pdf'}));
        button(section,'Télécharger le modèle',()=>download(template.blob,model.name+'.pdf'));
        if(profile.canWrite && destinations.length){
          const label=document.createElement('label');label.textContent='Dossier du client';label.htmlFor='cdq-local-destination-'+id;section.append(label);
          const select=document.createElement('select');select.id='cdq-local-destination-'+id;select.style.cssText='display:block;width:100%;max-width:650px;padding:12px;margin:10px 0;font:inherit';
          for(const d of destinations){const o=document.createElement('option');o.value=d.folderId;o.textContent=d.name;select.append(o);}section.append(select);
          button(section,'Créer une copie dans ce dossier',async()=>{
            if(busy)return;busy=true;
            try{
              const d=destinations.find(d=>d.folderId===select.value);
              const copy=makeCopy(template,d,email,'local_'+crypto.randomUUID());
              await put('copies',copy);await refresh();await sync();
            }finally{busy=false;}
          });
        }else if(profile.canWrite){text(section,'Avec Internet, ouvrez le dossier du client pour le préparer ici.');}
      }else{
        text(section,navigator.onLine?'Préparation en cours depuis le modèle maître CDQ.':'Non préparé sur cet appareil. Reconnectez CDQ une fois pour le rendre disponible hors ligne.');
        if(navigator.onLine && session)button(section,'Préparer maintenant',()=>{requestModel(id,true);status.textContent='Préparation de '+model.name+' demandée…';});
      }
    }
    text(content,'Les modèles maîtres restent dans CDQ Système. Les copies locales sont ajoutées au dossier du client dès que CDQ est reconnecté et déverrouillé.');
    const copies=(await all('copies')).filter(c=>c.email===email).sort((a,b)=>b.createdAt-a.createdAt);
    for(const c of copies){
      const row=document.createElement('div');row.style.cssText='border-top:1px solid #385360;margin-top:18px;padding-top:10px';content.append(row);
      text(row,c.name);text(row,c.destination.name+' — '+(c.status==='synced'?'Ajouté au dossier client':'En attente de connexion'));
      if(c.error)text(row,c.error);
      button(row,'Ouvrir la copie',()=>openPdf({blob:c.blob,name:c.name}));
      button(row,'Télécharger la copie',()=>download(c.blob,c.name));
    }
  }
  async function sync() {
    if(!navigator.onLine || !session?.canWrite)return;
    const pending=(await all('copies')).filter(c=>c.email===session.email&&c.status==='pending'&&MODELS[c.modeleId]&&!inflight.has(c.id));
    for(const c of pending){
      inflight.add(c.id);send({type:'CDQ_OFFLINE_COPY',...syncRequest(c)});
      setTimeout(()=>inflight.delete(c.id),90000);
    }
  }
  async function handleNow(data) {
    if(data.type==='CDQ_OFFLINE_SESSION'){
      if(!data.email || typeof data.email!=='string')return;
      session={email:data.email,canWrite:!!data.canWrite};localEmail=data.email;requested.clear();
      await put('state',{id:'profile',...session});
      navigator.storage?.persist?.().catch(()=>{});
      // The V21.37 generic prepare request still handles its original model.
      // Request the truck-scale master explicitly so it gets its own private IndexedDB cache.
      requestModel('camion');
      await refresh();await sync();return;
    }
    if(!session)return;
    if(data.email && data.email!==session.email)return;
    if(data.type==='CDQ_OFFLINE_TEMPLATE' && validTemplate(data)){
      await put('state',{...data,id:templateKey(session.email,data.modeleId)});await refresh();
      send({type:'CDQ_OFFLINE_STORED',modeleId:data.modeleId});
      if(warmPdf && data.modeleId==='cuve4')warmPdf(data);
    }
    if(data.type==='CDQ_OFFLINE_DESTINATION' && validDestination(data)){
      await put('destinations',{id:session.email+':'+data.folderId,email:session.email,clientId:data.clientId,folderId:data.folderId,name:data.name,savedAt:Date.now()});await refresh();
    }
    if(data.type==='CDQ_OFFLINE_CREATE_LOCAL'){
      const requestId=String(data.requestId||'');
      try{
        if(!requestId || !MODELS[data.modeleId])throw new Error('Demande de copie locale invalide.');
        const destination={clientId:String(data.clientId||''),folderId:String(data.folderId||''),name:String(data.destinationName||data.name||'Dossier client')};
        if(!validDestination(destination))throw new Error('Dossier client non préparé sur cet appareil.');
        const template=await getTemplate(session.email,data.modeleId);
        if(!template)throw new Error('Le modèle '+MODELS[data.modeleId].name+' n’est pas encore disponible hors ligne sur cet appareil.');
        await put('destinations',{id:session.email+':'+destination.folderId,email:session.email,...destination,savedAt:Date.now()});
        const existing=await get('copies',requestId);
        const copy=existing || makeCopy(template,destination,session.email,requestId);
        if(!existing)await put('copies',copy);
        await refresh();
        send({type:'CDQ_OFFLINE_CREATE_LOCAL_RESULT',requestId,ok:true,modeleId:copy.modeleId,name:copy.name});
        await sync();
      }catch(e){
        send({type:'CDQ_OFFLINE_CREATE_LOCAL_RESULT',requestId,ok:false,message:e.message||String(e)});
      }
      return;
    }
    if(data.type==='CDQ_OFFLINE_COPY_RESULT'){
      inflight.delete(data.requestId);
      const copy=await get('copies',data.requestId);
      if(!copy || copy.email!==session.email)return;
      if(data.ok){copy.status='synced';copy.driveId=data.id;copy.error='';}
      else copy.error=data.message||'La copie sera réessayée à la prochaine connexion.';
      await put('copies',copy);await refresh();
    }
  }
  launch.onclick=()=>{panel.hidden=false;refresh().catch(e=>{status.textContent=e.message;});};
  window.addEventListener('online',()=>{
    if(session)requestModel('camion',true);
    sync().catch(()=>{});
  });
  refresh().catch(()=>{});
  return {
    handle(data){chain=chain.then(()=>handleNow(data)).catch(e=>{status.textContent=e.message||String(e);});return chain;},
    lock(){session=null;localEmail='';inflight.clear();requested.clear();panel.hidden=true;},
    refresh
  };
}
