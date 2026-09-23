// Runs inside cdqV19Features so storage, RPC and the account guard are shared.
const cdqOffline24 = (() => {
  let records=[],catalog=null,selected=new Set(),job=null,view=0,owner='',refreshing=null;
  const pending=new Map();
  const account=()=>cdqReaderOwnerV2520();
  const valid=email=>cdqReaderGuardV2520(email);
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
  const button=(parent,title,fn)=>{const b=el('button',title);b.type='button';b.onclick=()=>Promise.resolve().then(fn).catch(afficherErreur);parent.append(b);return b;};
  function company(){return compagnieSelectionnee?{id:String(compagnieSelectionnee),nom:nomCompagnieSelectionnee||'Compagnie'}:null;}
  function bridge(type,data={}){
    if(!cdqPwaAvailable())return Promise.resolve(null);
    const email=account(),requestId='offline24_'+crypto.randomUUID();
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{pending.delete(requestId);reject(Error('Le stockage de l’application n’a pas confirmé la copie. Réessayez.'));},60000);
      pending.set(requestId,{resolve,reject,timer,email});cdqPostToPwa({type,email,requestId,...data});
    });
  }
  window.addEventListener('message',event=>{
    if(!cdqFromPwa(event))return;
    const d=event.data||{},p=pending.get(d.requestId);
    if(d.type==='CDQ_OFFLINE_DOCUMENT_RESULT'&&p){
      clearTimeout(p.timer);pending.delete(d.requestId);
      try{valid(p.email);if(!d.ok)throw Error(d.message||'Stockage non confirmé.');p.resolve(d);}catch(e){p.reject(e);}
    }
    if(d.type==='CDQ_OFFLINE_DOCUMENT_REMOVED'&&d.email===String(utilisateurCourantEmail||'')){
      removeLocal(d.fileId).then(()=>refresh()).catch(afficherErreur);
    }
    if(d.type==='CDQ_OFFLINE_DOCUMENT_UPDATED'&&d.email===String(utilisateurCourantEmail||'')&&d.blob instanceof Blob){
      (async()=>{const email=account(),q=await cdqV19QueueGet();valid(email);
        if(q.some(a=>String(a.targetId)===String(d.fileId)&&/pdf/.test(a.kind)))return;
        await cdqV19PutRecord('document-pdf',d.fileId,{id:d.fileId,nom:d.name,clientId:d.clientId,clientName:d.clientName,revision:d.revision,taille:d.blob.size,blob:d.blob});valid(email);await refresh();
      })().catch(afficherErreur);
    }
  });
  async function scan(){
    const email=account(),prefix=cdqV19Key('document-pdf',''),db=await ouvrirBaseCache();valid(email);
    return new Promise((resolve,reject)=>{
      const found=[],tx=db.transaction(CACHE_STORE_NAME,'readonly'),req=tx.objectStore(CACHE_STORE_NAME).openCursor(IDBKeyRange.bound(prefix,prefix+'\uffff'));
      req.onsuccess=()=>{const c=req.result;if(!c)return;const r=c.value;if(r.blob?.size)found.push({...r,id:r.id||String(c.key).slice(prefix.length)});c.continue();};
      tx.oncomplete=()=>{db.close();try{valid(email);resolve(found);}catch(e){reject(e);}};
      tx.onerror=tx.onabort=()=>{db.close();reject(tx.error||Error('Stockage local inaccessible.'));};
    });
  }
  async function refresh(){
    if(refreshing)return refreshing;
    refreshing=(async()=>{owner=account();records=await scan();paintDots();status();renderStored();})();
    try{await refreshing;}finally{refreshing=null;}
  }
  function status(){
    const count=records.filter(r=>!company()||String(r.clientId)===company().id).length;
    const running=job?.running;
    const label=running?'Préparation '+percent()+' %':count+' PDF disponibles hors ligne';
    cdqV19OfflineStatus(label,running?'pending':count?'ready':'',company()?.id);
    const b=document.getElementById('cdqV19OfflineStatus');
    if(b){b.disabled=false;const s=b.querySelector('span:last-child');if(s&&s.textContent!==(running?'Hors ligne '+percent()+' %':'Hors ligne'))s.textContent=running?'Hors ligne '+percent()+' %':'Hors ligne';}
  }
  function percent(){return job?Math.min(job.running?99:100,Math.floor((job.finished+job.fraction)/Math.max(1,job.total)*100)):0;}
  function paintDots(){
    const ids=new Set(records.map(r=>String(r.id)));
    document.querySelectorAll('.file-row,[data-file-id],.pc17-files tbody tr').forEach(row=>{
      if(row.matches('input,button,.cdq24-offline-dot'))return;
      const id=row.dataset.fileId||row.querySelector('.file-checkbox')?.dataset.fileId||row.dataset.file||row.dataset.id;
      if(!id)return;const host=row.querySelector('.file-name,.pc17-file-title b,.cdq23-drive-label')||row.querySelector('td')||row;
      let dot=host.querySelector(':scope > .cdq24-offline-dot');
      if(ids.has(String(id))&&!dot){dot=el('span','', 'cdq24-offline-dot');dot.title='Disponible hors ligne';dot.setAttribute('aria-label','Disponible hors ligne');host.append(dot);}
      if(dot)dot.hidden=!ids.has(String(id));
    });
  }
  function progress(){
    const host=document.querySelector('#cdqDocumentPrepare [data-progress24]');if(!host||!job)return;
    host.replaceChildren();const label=el('p');label.setAttribute('role','status');
    label.textContent=(job.running?'Préparation':job.cancelled?'Préparation annulée':job.error?'Préparation interrompue':'Préparation terminée')+' — '+percent()+' % • '+job.ready+' / '+job.total+' PDF conservés';
    host.append(label);const bar=el('progress');bar.max=100;bar.value=percent();host.append(bar);
    host.append(el('p',job.message||''));
    if(job.running){const b=button(host,job.cancelled?'Annulation en cours…':'Annuler la préparation',()=>{job.cancelled=true;job.message='Arrêt après la requête en cours. Les fichiers déjà conservés restent disponibles.';progress();});b.disabled=job.cancelled;}
    else if(job.failures.length)host.append(el('p',job.failures.join('\n')));
    status();
  }
  async function removeLocal(id){
    const email=account(),q=await cdqV19QueueGet();valid(email);
    if(q.some(a=>String(a.targetId)===String(id)&&/pdf/.test(a.kind)))throw Error('Ce PDF contient des modifications en attente. Synchronisez-les avant de le retirer.');
    await supprimerCacheLocal(cdqV19Key('document-pdf',id));valid(email);
  }
  async function remove(id){
    if(job?.running)throw Error('Annulez ou terminez la préparation avant de retirer un fichier.');
    const email=account(),q=await cdqV19QueueGet();valid(email);
    if(q.some(a=>String(a.targetId)===String(id)&&/pdf/.test(a.kind)))throw Error('Synchronisez les modifications de ce PDF avant de le retirer.');
    await bridge('CDQ_OFFLINE_DOCUMENT_REMOVE',{fileId:id});valid(email);
    await removeLocal(id);await refresh();
  }
  function renderStored(){
    const host=document.querySelector('#cdqDocumentPrepare [data-stored24]');if(!host)return;
    host.replaceChildren(el('h3','Fichiers conservés sur cet appareil'));
    if(!records.length){host.append(el('p','Aucun PDF préparé.'));return;}
    const groups=new Map();
    for(const r of records){const cid=String(r.clientId||''),known=(toutesLesCompagnies||[]).find(c=>String(c.id)===cid);const name=r.clientName||known?.nom||'Autres documents';if(!groups.has(name))groups.set(name,[]);groups.get(name).push(r);}
    for(const [name,list] of [...groups].sort((a,b)=>a[0].localeCompare(b[0],'fr'))){
      host.append(el('h4',name));
      for(const r of list){const row=el('div','', 'cdq24-saved-row');const b=button(row,r.nom||r.name||r.id,()=>{document.getElementById('cdqDocumentPrepare').style.display='none';return cdqOpenPdf(r.id,r);});b.className='cdq24-file-open';row.append(el('span','●','cdq24-ready-mark'));const del=button(row,'Retirer',()=>remove(r.id));del.setAttribute('aria-label','Retirer '+(r.nom||r.id)+' du mode hors ligne');del.disabled=!!job?.running;host.append(row);}
    }
  }
  function checkJob(j){valid(j.email);if(j.cancelled){const e=Error('Préparation annulée');e.name='AbortError';throw e;}}
  async function download(file,j){
    checkJob(j);const old=await cdqV19GetRecord('document-pdf',file.id);checkJob(j);
    const q=await cdqV19QueueGet();checkJob(j);
    if(q.some(a=>String(a.targetId)===String(file.id)&&/pdf/.test(a.kind)))throw Error('Modifications en attente : synchronisez ce PDF avant sa préparation.');
    const meta=await cdqV19Gs('obtenirPdfLecteurCDQV2520',[file.id,old?.revision||'']);checkJob(j);
    let blob=old?.blob;
    if(!meta.unchanged||!blob||blob.size!==meta.taille){
      const parts=[];
      if(meta.taille>CDQ_DOCUMENT_MAX_BYTES||meta.taille<6)throw Error('Taille PDF invalide.');
      if(meta.base64)parts.push(cdqV2112Base64ToBytes(meta.base64));
      else{if(!meta.chunks||meta.chunks>32)throw Error('PDF trop volumineux.');
        for(let i=0;i<meta.chunks;i++){
          checkJob(j);const part=await cdqV19Gs('obtenirChunkDocumentPdfCDQ',[file.id,meta.revision,i]);checkJob(j);
          if(part.revision!==meta.revision)throw Error('Le PDF a changé. Réessayez.');
          parts.push(cdqV2112Base64ToBytes(part.base64));j.fraction=(i+1)/meta.chunks*.9;progress();
        }
      }
      blob=new Blob(parts,{type:'application/pdf'});
    }
    if(!blob||blob.size!==meta.taille||(await blob.slice(0,5).text())!=='%PDF-')throw Error('PDF reçu incomplet.');
    checkJob(j);
    const rec={...meta,id:String(file.id),nom:file.nom||meta.nom,clientId:j.company.id,clientName:j.company.nom,blob};delete rec.base64;
    // Mirror in the installed shell, which remains reachable after an offline restart.
    await bridge('CDQ_OFFLINE_DOCUMENT_STORE',{fileId:rec.id,name:rec.nom,clientId:rec.clientId,clientName:rec.clientName,revision:rec.revision,blob});valid(j.email);
    await cdqV19PutRecord('document-pdf',rec.id,rec);valid(j.email);
    records=records.filter(r=>r.id!==rec.id).concat(rec);paintDots();
  }
  async function run(files,comp){
    if(job?.running)return;
    if(!files.length)throw Error('Cochez au moins un PDF à préparer.');
    if(navigator.onLine===false)throw Error('Reconnectez Internet pour préparer des fichiers.');
    const j=job={email:account(),company:comp,total:files.length,ready:0,finished:0,fraction:0,running:true,cancelled:false,failures:[],message:''};progress();renderStored();
    try{
      try{await navigator.storage?.persist?.();}catch(_){}
      for(const f of files){checkJob(j);j.fraction=0;j.message=f.nom||f.id;progress();
        try{await download(f,j);j.ready++;}
        catch(e){if(e.name==='AbortError')throw e;j.failures.push((f.nom||f.id)+' : '+(e.message||e));}
        j.finished++;j.fraction=0;progress();
      }
      j.message=j.failures.length?'Certains fichiers n’ont pas été préparés. Décochez les fichiers prêts et réessayez.':'Les PDF cochés sont conservés, même après fermeture de CDQ.';
    }catch(e){j.error=e.name!=='AbortError';j.message=e.message;}
    finally{j.running=false;progress();renderStored();paintDots();}
  }
  async function open(comp=company()){
    const email=account(),ticket=++view,o=cdqV19CreateModal('cdqDocumentPrepare','Documents hors ligne','cdq-v19-offline-modal');
    const body=o.querySelector('.cdq-v19-body');body.replaceChildren();o.style.display='flex';
    const prog=el('section');prog.dataset.progress24='';body.append(prog);progress();
    const choose=el('section');body.append(choose);choose.append(el('p','Chargement de la liste des fichiers…'));
    const stored=el('section');stored.dataset.stored24='';body.append(stored);
    if(cdqPwaAvailable())button(body,'Ouvrir les documents et copies de l’application',()=>cdqPostToPwa({type:'CDQ_OFFLINE_SHOW_LOCAL'}));
    body.append(el('p','Fermer ce menu laisse la préparation en cours. Si CDQ est fermé complètement, les fichiers terminés restent disponibles; relancez la préparation des autres.','cdq24-help'));
    await refresh();valid(email);
    if(ticket!==view)return;
    // Reconcile removals performed in the offline-startup screen.
    try{const mirror=await bridge('CDQ_OFFLINE_DOCUMENT_LIST');valid(email);for(const id of mirror?.removed||[])await removeLocal(id);if(mirror?.removed?.length)await refresh();}catch(e){if(ticket===view)choose.append(el('p',e.message));}
    let manifest=null,error='';
    if(comp){try{manifest=navigator.onLine?await cdqV19Gs('obtenirManifestHorsLigneClient',[comp.id]):(await cdqV19GetRecord('documents-manifest',comp.id))?.manifest;valid(email);
      if(manifest)await cdqV19PutRecord('documents-manifest',comp.id,{manifest});
    }catch(e){error=e.message;}}
    if(ticket!==view)return;valid(email);choose.replaceChildren();
    if(!comp){choose.append(el('p','Choisissez une compagnie pour ajouter des fichiers hors ligne.'));return;}
    catalog={company:comp,files:manifest?.fichiers||[]};
    choose.append(el('h3','Ajouter des fichiers — '+comp.nom));
    if(error)choose.append(el('p',error));
    const inputs=[],ids=new Set(Array.from(document.querySelectorAll('.file-checkbox:checked')).map(n=>n.dataset.fileId));
    const tools=el('div','', 'cdq24-actions');choose.append(tools);
    button(tools,'Tout sélectionner',()=>{inputs.forEach(i=>i.checked=true);});button(tools,'Tout désélectionner',()=>{inputs.forEach(i=>i.checked=false);});
    const list=el('div','', 'cdq24-checklist');choose.append(list);
    for(const file of catalog.files){
      if(file.type!=='PDF')continue;
      const label=el('label'),input=el('input');input.type='checkbox';input.value=file.id;input.checked=ids.has(String(file.id));inputs.push(input);label.append(input,el('span',file.nom||file.id));list.append(label);
    }
    if(!inputs.length)choose.append(el('p','Aucun PDF dans cette compagnie.'));
    const start=button(choose,'Préparer les fichiers cochés',()=>run(catalog.files.filter(f=>inputs.some(i=>i.checked&&i.value===String(f.id))),comp));start.disabled=!inputs.length||navigator.onLine===false;
    if(catalog.files.some(f=>f.type==='GOOGLE_SHEETS'))choose.append(el('p','Les feuilles Google Sheets se préparent dans Google Sheets → ⋮ → Disponible hors connexion. CDQ ne peut pas confirmer leur état hors ligne.','cdq24-help'));
  }
  let scheduled=false;
  new MutationObserver(changes=>{if(changes.some(c=>Array.from(c.addedNodes).some(n=>n.nodeType===1&&!n.classList.contains('cdq24-offline-dot')))&&!scheduled){scheduled=true;requestAnimationFrame(()=>{scheduled=false;if(cdqAccessState==='ready')paintDots();});}}).observe(document.body,{childList:true,subtree:true});
  function lock(){
    if(job?.running)job.cancelled=true;
    job=null;records=[];view++;
    const modal=document.getElementById('cdqDocumentPrepare');if(modal)modal.style.display='none';
    for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Déverrouillez de nouveau votre compte.'));}pending.clear();
    paintDots();
  }
  const access=document.getElementById('accessOverlay');if(access)new MutationObserver(()=>{if(cdqAccessState!=='ready')lock();}).observe(access,{attributes:true,attributeFilter:['data-state']});
  window.addEventListener('cdq:access-ready',()=>{if(owner&&owner!==String(utilisateurCourantEmail||''))lock();refresh().catch(()=>{});});
  window.addEventListener('cdq:pdf-saved',()=>refresh().catch(()=>{}));
  return {open,refresh,remove,get job(){return job;}};
})();
window.cdqOffline24=cdqOffline24;
