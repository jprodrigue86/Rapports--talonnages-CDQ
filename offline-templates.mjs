// Private PDF bytes live only in this device's IndexedDB, never in the public shell cache.
const DB_NAME = 'cdq-offline-templates-v1';
const MODEL = 'cuve4';
const NAME = 'Balance Quvre 4';
export function validDestination(d) {
  return !!d && /^[\w-]+$/.test(d.clientId || '') && /^[\w-]+$/.test(d.folderId || '') && typeof d.name === 'string';
}
export function validTemplate(t) {
  return !!t && t.modeleId === MODEL && t.blob instanceof Blob && t.blob.type === 'application/pdf' &&
    t.blob.size > 5 && t.blob.size <= 15 * 1024 * 1024 && /^[\w-]+$/.test(t.templateId || '');
}
export function makeCopy(template, destination, email, requestId) {
  if (!validTemplate(template) || !validDestination(destination) || !email) throw new Error('Préparez le modèle et le dossier avec Internet.');
  return {id:requestId, email, modeleId:MODEL, blob:template.blob, templateId:template.templateId,
    modifieLe:template.modifieLe, destination:{...destination}, name:NAME + ' — ' + new Date().toISOString().replace(/[:.]/g,'-') + '.pdf',
    createdAt:Date.now(), status:'pending'};
}
export function syncRequest(copy) {
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
export function createOfflineTemplates({send,unlock,openPdf,warmPdf}) {
  let session=null,localEmail='',profile=null,busy=false,chain=Promise.resolve();
  const inflight=new Set();
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
  function text(parent,value){const p=document.createElement('p');p.textContent=value;parent.append(p);}
  async function refresh() {
    profile=await get('state','profile');
    launch.hidden=!profile;
    if(panel.hidden)return;
    content.replaceChildren();
    if(!profile){status.textContent='Ouvrez CDQ une fois avec Internet pour préparer le modèle.';return;}
    if(localEmail!==profile.email && session?.email!==profile.email){
      status.textContent='Déverrouillez les fichiers préparés sur cet appareil.';
      button(content,'Déverrouiller avec la sécurité de l’appareil',async()=>{await unlock(profile.email);localEmail=profile.email;await refresh();});return;
    }
    const email=profile.email,template=await get('state','template:'+email);
    const destinations=(await all('destinations')).filter(d=>d.email===email).sort((a,b)=>b.savedAt-a.savedAt);
    status.textContent=validTemplate(template)?NAME+' — disponible sur cet appareil.':'Le modèle est en cours de préparation. Gardez CDQ ouvert avec Internet.';
    if(validTemplate(template)){
      button(content,'Ouvrir '+NAME,()=>openPdf({blob:template.blob,name:NAME+'.pdf'}));
      button(content,'Télécharger le modèle',()=>download(template.blob,NAME+'.pdf'));
      if(profile.canWrite && destinations.length){
        const label=document.createElement('label');label.textContent='Dossier du client';label.htmlFor='cdq-local-destination';content.append(label);
        const select=document.createElement('select');select.id='cdq-local-destination';select.style.cssText='display:block;width:100%;max-width:650px;padding:12px;margin:10px 0;font:inherit';
        for(const d of destinations){const o=document.createElement('option');o.value=d.folderId;o.textContent=d.name;select.append(o);}content.append(select);
        button(content,'Créer une copie dans ce dossier',async()=>{
          if(busy)return;busy=true;
          try{
            const d=destinations.find(d=>d.folderId===select.value);
            const copy=makeCopy(template,d,email,'local_'+crypto.randomUUID());
            await put('copies',copy);await refresh();await sync();
          }finally{busy=false;}
        });
      }else if(profile.canWrite){text(content,'Avec Internet, ouvrez le dossier du client et le menu Balance Intermédiaire pour le préparer ici.');}
      text(content,'Les copies restent sur cet appareil. Elles sont ajoutées au dossier du client dès que CDQ est reconnecté et déverrouillé.');
    }
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
    const pending=(await all('copies')).filter(c=>c.email===session.email&&c.status==='pending'&&!inflight.has(c.id));
    for(const c of pending){
      inflight.add(c.id);send({type:'CDQ_OFFLINE_COPY',...syncRequest(c)});
      setTimeout(()=>inflight.delete(c.id),90000);
    }
  }
  async function handleNow(data) {
    if(data.type==='CDQ_OFFLINE_SESSION'){
      if(!data.email || typeof data.email!=='string')return;
      session={email:data.email,canWrite:!!data.canWrite};localEmail=data.email;
      await put('state',{id:'profile',...session});
      navigator.storage?.persist?.().catch(()=>{});
      await refresh();await sync();return;
    }
    if(!session)return;
    if(data.email && data.email!==session.email)return;
    if(data.type==='CDQ_OFFLINE_TEMPLATE' && validTemplate(data)){
      await put('state',{...data,id:'template:'+session.email});await refresh();
      send({type:'CDQ_OFFLINE_STORED',modeleId:MODEL});
      if(warmPdf)warmPdf(data);
    }
    if(data.type==='CDQ_OFFLINE_DESTINATION' && validDestination(data)){
      await put('destinations',{id:session.email+':'+data.folderId,email:session.email,clientId:data.clientId,folderId:data.folderId,name:data.name,savedAt:Date.now()});await refresh();
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
  window.addEventListener('online',()=>sync().catch(()=>{}));
  refresh().catch(()=>{});
  return {
    handle(data){chain=chain.then(()=>handleNow(data)).catch(e=>{status.textContent=e.message||String(e);});return chain;},
    lock(){session=null;localEmail='';inflight.clear();panel.hidden=true;},
    refresh
  };
}
