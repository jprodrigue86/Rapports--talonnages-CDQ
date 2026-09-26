/* V25.44 — faster client opening + integrated mobile progress.
 * Keeps V25.43 startup/biometric/icon stabilization unchanged.
 * - Recent client caches are warmed from IndexedDB after unlock.
 * - A client tap shares one local-cache read and one server request.
 * - If IndexedDB is slow/missing, the optimized server read starts after a
 *   short grace period instead of waiting for the local miss to finish.
 * - The existing global progress control is mounted in normal mobile flow,
 *   immediately before the client file list, instead of floating over content.
 */
(() => {
  'use strict';

  if(window.cdqClientSpeedV2544)return;

  const HOT_LIMIT=5;
  const SERVER_GRACE_MS=110;
  const warmJobs=new Map();
  const serverJobs=new Map();

  const account=()=>String(window.utilisateurCourantEmail||'').trim().toLowerCase();
  const client=()=>String(window.compagnieSelectionnee||'');
  const ready=()=>String(window.cdqAccessState||'')==='ready'&&!!account();

  function storageKey(){
    return 'cdqRecentClientsV2544:'+(account()||'sans-compte');
  }

  function recentIds(){
    try{
      const a=JSON.parse(localStorage.getItem(storageKey())||'[]');
      return Array.isArray(a)?a.map(String).filter(Boolean).slice(0,HOT_LIMIT):[];
    }catch(_){return [];}
  }

  function remember(id){
    id=String(id||'');if(!id||!ready())return;
    try{
      const next=[id,...recentIds().filter(x=>x!==id)].slice(0,HOT_LIMIT);
      localStorage.setItem(storageKey(),JSON.stringify(next));
    }catch(_){}
  }

  function current(id,email){
    return ready()&&account()===email&&client()===String(id);
  }

  function serverKey(id,email){return email+'|'+String(id);}

  function clearMessage(){
    const message=document.getElementById('message');
    if(message&&/Chargement des fichiers/i.test(String(message.textContent||''))){
      message.textContent='';
      message.className='message';
    }
  }

  function displayCached(id,email){
    if(!current(id,email))return false;
    const content=window.cacheContenuCompagnies&&window.cacheContenuCompagnies[String(id)];
    if(!content)return false;
    window.afficherContenu(content);
    clearMessage();
    const k=serverKey(id,email);
    if(!serverJobs.has(k)&&typeof window.planifierActualisationCompagnie==='function'){
      window.planifierActualisationCompagnie(
        String(id),
        Number(window.cacheDerniereVerificationCompagnies?.[String(id)]||0)
      );
    }
    return true;
  }

  function warm(id,email=account()){
    id=String(id||'');
    if(!id||!email||!ready()||account()!==email)return Promise.resolve(null);
    if(window.cacheContenuCompagnies?.[id]){
      return Promise.resolve({
        contenu:window.cacheContenuCompagnies[id],
        verifiedAt:Number(window.cacheDerniereVerificationCompagnies?.[id]||0)
      });
    }
    const key=serverKey(id,email);
    if(warmJobs.has(key))return warmJobs.get(key);
    if(typeof window.lireCachePersistantClient!=='function')return Promise.resolve(null);

    const job=Promise.resolve()
      .then(()=>window.lireCachePersistantClient(id))
      .then(record=>{
        if(!ready()||account()!==email)return null;
        if(record?.contenu){
          window.cacheContenuCompagnies[id]=record.contenu;
          window.cacheDerniereVerificationCompagnies[id]=Number(record.verifiedAt)||0;
        }
        return record||null;
      })
      .catch(()=>null)
      .finally(()=>warmJobs.delete(key));
    warmJobs.set(key,job);
    return job;
  }

  function requestServer(id,email=account()){
    id=String(id||'');
    if(!id||!email||!ready()||account()!==email)return Promise.resolve(null);
    const key=serverKey(id,email);
    if(serverJobs.has(key))return serverJobs.get(key);

    const job=new Promise((resolve,reject)=>{
      try{
        window.cdqApiRun()
          .withSuccessHandler(resolve)
          .withFailureHandler(reject)
          .obtenirContenuClientOptimise(id,false);
      }catch(error){reject(error);}
    }).then(result=>{
      if(!ready()||account()!==email)return null;
      let content=result&&result.contenu?result.contenu:result;
      const verifiedAt=result&&result.genereLe?Number(result.genereLe):Date.now();
      const source=result&&result.source?String(result.source):'drive';
      if(!content)return null;

      if(window.cdqInstantFiles2530?.overlay){
        content=window.cdqInstantFiles2530.overlay(id,content);
      }
      const old=window.cacheContenuCompagnies?.[id];
      if(old&&window.cdqMergeClientV2527){
        content=window.cdqMergeClientV2527(old,content);
      }

      window.cacheContenuCompagnies[id]=content;
      window.cacheDerniereVerificationCompagnies[id]=verifiedAt;
      try{window.sauvegarderCachePersistantClient(id,content,verifiedAt);}catch(_){}

      if(current(id,email)){
        window.afficherContenu(content);
        clearMessage();
      }
      if(source==='cache'&&typeof window.planifierActualisationCompagnie==='function'){
        setTimeout(()=>{
          if(ready()&&account()===email){
            window.planifierActualisationCompagnie(id,verifiedAt);
          }
        },0);
      }
      return content;
    }).catch(error=>{
      if(current(id,email)&&!window.cacheContenuCompagnies?.[id]){
        window.afficherErreur(error);
      }else{
        try{console.log('Chargement client V25.44 :',error);}catch(_){}
      }
      return null;
    }).finally(()=>serverJobs.delete(key));

    serverJobs.set(key,job);
    return job;
  }

  function loadClient(){
    if(!window.compagnieSelectionnee)return;
    const id=client(),email=account();
    if(!id||!email||!ready())return;
    remember(id);

    if(window.cacheContenuCompagnies?.[id]){
      displayCached(id,email);
      return;
    }

    if(typeof window.afficherMessage==='function'){
      window.afficherMessage('Chargement des fichiers...',false);
    }

    let serverStarted=false;
    const startServer=()=>{
      if(serverStarted||!current(id,email)||window.cacheContenuCompagnies?.[id])return;
      serverStarted=true;
      requestServer(id,email);
    };

    const timer=setTimeout(startServer,SERVER_GRACE_MS);
    warm(id,email).then(record=>{
      clearTimeout(timer);
      if(!current(id,email))return;
      if(record?.contenu||window.cacheContenuCompagnies?.[id]){
        displayCached(id,email);
        return;
      }
      startServer();
    }).catch(()=>{
      clearTimeout(timer);
      startServer();
    });
  }

  function prewarm(){
    if(!ready())return;
    const email=account();
    for(const id of recentIds())warm(id,email);
  }

  function mobile(){
    const root=document.documentElement;
    return root.classList.contains('android')||root.classList.contains('ios')||root.classList.contains('mobile-device');
  }

  function mountProgress(){
    if(!mobile())return;
    const box=document.getElementById('cdqGlobalProgressV2293');
    const files=document.getElementById('filesContainer');
    if(!box||!files||!files.parentNode)return;
    box.dataset.cdqIntegratedV2544='1';
    if(box.parentNode!==files.parentNode||box.nextSibling!==files){
      files.parentNode.insertBefore(box,files);
    }
  }

  function installProgressStyle(){
    if(document.getElementById('cdqProgressIntegratedV2544'))return;
    const style=document.createElement('style');
    style.id='cdqProgressIntegratedV2544';
    style.textContent=`
html:is(.android,.ios,.mobile-device) #cdqGlobalProgressV2293[data-cdq-integrated-v2544="1"]{
  position:relative!important;right:auto!important;bottom:auto!important;left:auto!important;
  z-index:2!important;width:100%!important;min-width:0!important;max-width:none!important;
  box-sizing:border-box!important;margin:2px 0 8px!important;padding:4px 5px 6px!important;
  border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;
  transform:none!important;pointer-events:none!important;
}
html:is(.android,.ios,.mobile-device) #cdqGlobalProgressV2293[data-cdq-integrated-v2544="1"]:not(.show){
  display:none!important;
}
html:is(.android,.ios,.mobile-device) #cdqGlobalProgressV2293[data-cdq-integrated-v2544="1"].show{
  display:block!important;opacity:1!important;transform:none!important;
}
html:is(.android,.ios,.mobile-device) #cdqGlobalProgressV2293[data-cdq-integrated-v2544="1"] .cdq-progress-head{
  padding:0 3px 3px!important;gap:8px!important;
}
html:is(.android,.ios,.mobile-device) #cdqGlobalProgressV2293[data-cdq-integrated-v2544="1"] .cdq-progress-label{
  font-size:11px!important;font-weight:750!important;color:#cdd9e3!important;
}
html:is(.android,.ios,.mobile-device) #cdqGlobalProgressV2293[data-cdq-integrated-v2544="1"] .cdq-progress-pct{
  font-size:11px!important;min-width:34px!important;color:#d9f8ff!important;
}
html:is(.android,.ios,.mobile-device) #cdqGlobalProgressV2293[data-cdq-integrated-v2544="1"] .cdq-progress-track{
  height:5px!important;margin-top:1px!important;border-radius:999px!important;
  background:rgba(139,160,178,.22)!important;
}
html:is(.android,.ios,.mobile-device) #cdqGlobalProgressV2293[data-cdq-integrated-v2544="1"] .cdq-progress-fill{
  border-radius:999px!important;background:#58e4ff!important;
}
html:is(.android,.ios,.mobile-device) #cdqGlobalProgressV2293[data-cdq-integrated-v2544="1"].failed .cdq-progress-fill{
  background:#ff6969!important;
}
`;
    document.head.appendChild(style);
  }

  installProgressStyle();
  mountProgress();
  new MutationObserver(mountProgress).observe(document.body,{childList:true,subtree:true});

  document.addEventListener('pointerdown',event=>{
    const row=event.target?.closest?.('.company-item[data-company-id]');
    if(!row||!ready())return;
    const id=String(row.dataset.companyId||'');
    if(id)warm(id,account());
  },true);

  window.addEventListener('cdq:access-ready',()=>setTimeout(prewarm,30));
  window.addEventListener('cdq:access-state-v2527',event=>{
    if(event.detail==='ready')setTimeout(prewarm,30);
    else{warmJobs.clear();serverJobs.clear();}
  });

  // Replace only the client-list loading path. Startup, authentication,
  // rendering, file opening and the V25.43 first-frame gate remain untouched.
  if(typeof window.chargerFichiers==='function'){
    window.chargerFichiers=loadClient;
    try{chargerFichiers=loadClient;}catch(_){}
  }
  if(typeof window.chargerContenuServeurRapide==='function'){
    window.chargerContenuServeurRapide=function(id){return requestServer(id,account());};
    try{chargerContenuServeurRapide=window.chargerContenuServeurRapide;}catch(_){}
  }

  window.cdqClientSpeedV2544={
    warm,requestServer,prewarm,mountProgress,remember,
    state:{warmJobs,serverJobs},
    version:'25.44'
  };

  setTimeout(prewarm,80);
})();
