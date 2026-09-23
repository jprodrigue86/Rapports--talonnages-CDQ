/* Local UI; only authenticated data calls cross the Apps Script iframe. */
(() => {
  'use strict';
  const endpoint='https://script.google.com/macros/s/AKfycbx8NuvklaL-azJBIVyCMKjPk_Hd9z62Q_2-NPl3vqw2kJRpI5wy63J8xkBN5toOFxEw/exec';
  const allowed=new Set(['cdqRpc','reprendreActivationCDQ','creerDefiConnexionGoogleCDQ','verifierJetonGoogleCDQ','obtenirEtatAcces','connecterAvecCodeAcces','definirNip4ApresActivation','deverrouillerAvecNip','restaurerSessionApresBiometrie','reprendreSessionCourteCDQV2524']);
  const channel=crypto.randomUUID(), pending=new Map();
  let frame, peer, peerOrigin='', serial=0, failed='';
  const unavailable='La connexion CDQ ne répond pas. Vérifiez Internet et publiez la mise à jour V25.28 dans Script Manager, puis réessayez.';
  function settle(id,ok,value){
    const job=pending.get(id);if(!job)return;
    pending.delete(id);clearTimeout(job.timer);
    const handler=ok?job.success:job.failure;
    if(typeof handler==='function')handler(ok?value:Error(String(value||unavailable)),job.userObject);
  }
  function fail(message){
    failed=message;
    for(const id of [...pending.keys()])settle(id,false,message);
  }
  function send(job){
    if(!peer||job.sent)return;
    job.sent=true;
    peer.postMessage({type:'CDQ_EMBEDDED_CALL',protocol:1,channel,id:job.id,name:job.name,args:job.args},peerOrigin);
  }
  function runner(success,failure,userObject){
    return new Proxy(Object.create(null),{get(_target,name){
      if(name==='withSuccessHandler')return fn=>runner(fn,failure,userObject);
      if(name==='withFailureHandler')return fn=>runner(success,fn,userObject);
      if(name==='withUserObject')return obj=>runner(success,failure,obj);
      if(typeof name!=='string'||name==='then')return undefined;
      return (...args)=>{
        const id=String(++serial),job={id,name,args,success,failure,userObject,sent:false};
        pending.set(id,job);
        job.timer=setTimeout(()=>settle(id,false,'La demande a expiré. Vérifiez son résultat avant de relancer une écriture.'),90000);
        if(!allowed.has(name)){settle(id,false,'Appel serveur non autorisé.');return;}
        if(navigator.onLine===false){settle(id,false,'Connexion Internet indisponible. Utilisez les copies hors ligne.');return;}
        if(failed){settle(id,false,failed);return;}
        send(job);
      };
    }});
  }
  function trusted(event){
    if(!frame||!event.source)return false;
    let origin;try{origin=new URL(event.origin);}catch(_){return false;}
    const host=origin.hostname;
    if(origin.protocol!=='https:'||origin.port||!(host==='script.google.com'||host==='script.googleusercontent.com'||host.endsWith('-script.googleusercontent.com')))return false;
    let source=event.source;
    for(let i=0;source&&i<8;i++){
      if(source===frame.contentWindow)return true;
      try{const parent=source.parent;if(parent===source)break;source=parent;}catch(_){break;}
    }
    return false;
  }
  const bootTimer=setTimeout(()=>{if(!peer)fail(unavailable);},30000);
  window.addEventListener('message',event=>{
    const data=event.data;
    if(!data||data.protocol!==1||data.channel!==channel||!trusted(event))return;
    if(data.type==='CDQ_EMBEDDED_READY'){
      if(peer&&peer!==event.source)return;
      peer=event.source;peerOrigin=event.origin;failed='';clearTimeout(bootTimer);
      for(const job of pending.values())send(job);
    }else if(data.type==='CDQ_EMBEDDED_RESULT'&&event.source===peer&&event.origin===peerOrigin){
      settle(String(data.id),data.ok===true,data.ok?data.value:data.error);
    }
  });
  window.addEventListener('offline',()=>{
    // Do not replay a write whose response may have been lost.
    for(const id of [...pending.keys()])settle(id,false,'Connexion interrompue. Vérifiez le résultat avant de relancer une écriture.');
  });
  window.google={script:{run:runner()}};
  function boot(){
    frame=document.createElement('iframe');frame.id='cdq-data-connection';frame.title='Connexion sécurisée CDQ';
    frame.hidden=true;frame.tabIndex=-1;frame.setAttribute('aria-hidden','true');
    frame.src=endpoint+'?cdq_native_bridge=1&channel='+encodeURIComponent(channel);
    document.body.append(frame);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
