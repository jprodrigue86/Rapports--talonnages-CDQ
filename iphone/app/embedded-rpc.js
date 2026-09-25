/* iPhone connection compatibility: 2026.09.24-iphone-rpc-r1 */
/* Local UI; only authenticated data calls cross the Apps Script iframe. */
(() => {
  'use strict';
  // The installed shell owns one connection, opened before Selector parses.
  // Reuse it only through a direct, same-origin parent; web/legacy frames keep
  // their own checked connection and cannot borrow an unrelated parent's RPC.
  try{
    if(window.parent!==window && window.parent.location.origin===location.origin && window.parent.cdqEmbeddedRpcV2529){
      window.google={script:{run:window.parent.cdqEmbeddedRpcV2529.run}};
      return;
    }
  }catch(_){}
  const endpoint='https://script.google.com/macros/s/AKfycbx8NuvklaL-azJBIVyCMKjPk_Hd9z62Q_2-NPl3vqw2kJRpI5wy63J8xkBN5toOFxEw/exec';
  const allowed=new Set(['cdqRpc','reprendreActivationCDQ','creerDefiConnexionGoogleCDQ','verifierJetonGoogleCDQ','obtenirEtatAcces','connecterAvecCodeAcces','definirNip4ApresActivation','deverrouillerAvecNip','restaurerSessionApresBiometrie','reprendreSessionCourteCDQV2524']);
  const channel=crypto.randomUUID(), pending=new Map();
  let frame, peer, peerRelay=null, peerOrigin='', serial=0, failed='';
  const unavailable='La connexion CDQ ne répond pas. Vérifiez Internet et réessayez. Si CDQ est déjà installé, actualisez l’application iPhone.';
  function settle(id,ok,value){
    const job=pending.get(id);if(!job)return;
    pending.delete(id);if(job.timer)clearTimeout(job.timer);
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
    if(!job.timer)job.timer=setTimeout(
      ()=>settle(job.id,false,job.name==='obtenirEtatAcces'?'La vérification de connexion a expiré. Appuyez sur Réessayer la connexion.':'La demande a expiré. Vérifiez son résultat avant de relancer une écriture.'),
      90000
    );
    peer.postMessage({type:'CDQ_EMBEDDED_CALL',protocol:1,channel,id:job.id,name:job.name,args:job.args},peerOrigin);
  }
  function provisional(){
    try{return window.cdqStartupUnlockV2529?.isProvisional?.()===true;}catch(_){return false;}
  }
  function flushHeld(){
    if(provisional())return;
    for(const job of pending.values())send(job);
  }
  function runner(success,failure,userObject,bypassStartup=false){
    return new Proxy(Object.create(null),{get(_target,name){
      if(name==='withSuccessHandler')return fn=>runner(fn,failure,userObject,bypassStartup);
      if(name==='withFailureHandler')return fn=>runner(success,fn,userObject,bypassStartup);
      if(name==='withUserObject')return obj=>runner(success,failure,obj,bypassStartup);
      if(typeof name!=='string'||name==='then')return undefined;
      return (...args)=>{
        if(!bypassStartup&&name==='restaurerSessionApresBiometrie'&&window.cdqStartupUnlockV2529?.takeSession(args[0],success,failure,userObject))return;
        const id=String(++serial),job={id,name,args,success,failure,userObject,sent:false,timer:null};
        pending.set(id,job);
        if(!allowed.has(name)){settle(id,false,'Appel serveur non autorisé.');return;}
        // During a trusted local startup, the unchanged Selector can render
        // immediately, but nothing crosses to Apps Script until the server
        // session is confirmed.
        if(!bypassStartup&&provisional())return;
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
      // WebKit reports the HtmlService relay as the source of asynchronous
      // replies; READY still comes from its inner user-code frame. Pin only
      // that exact parent during the validated handshake, never any sibling.
      if(!peer){
        try{const relay=event.source.parent;peerRelay=relay!==frame.contentWindow?relay:null;}catch(_){}
      }
      peer=event.source;peerOrigin=event.origin;failed='';clearTimeout(bootTimer);
      for(const job of pending.values())send(job);
    }else if(data.type==='CDQ_EMBEDDED_RESULT'&&peer&&
      (event.source===peer||event.source===peerRelay)&&event.origin===peerOrigin&&
      pending.get(String(data.id))?.sent===true&&typeof data.ok==='boolean'){
      settle(String(data.id),data.ok===true,data.ok?data.value:data.error);
    }
  });
  window.addEventListener('cdq:startup-confirmed-v2539',flushHeld);
  window.addEventListener('cdq:startup-revoked-v2539',()=>{
    for(const [id,job] of [...pending.entries()])
      if(!job.sent)settle(id,false,'La session locale a été révoquée par le serveur.');
  });
  window.addEventListener('offline',()=>{
    // Do not replay a write whose response may have been lost. Held requests
    // have not crossed the network and remain blocked locally.
    for(const [id,job] of [...pending.entries()])
      if(job.sent)settle(id,false,'Connexion interrompue. Vérifiez le résultat avant de relancer une écriture.');
  });
  window.google={script:{run:runner()}};
  window.cdqEmbeddedRpcV2529={run:window.google.script.run,
    prepareSession:token=>new Promise((resolve,reject)=>runner(resolve,reject,undefined,true).restaurerSessionApresBiometrie(token))};
  window.dispatchEvent?.(new Event('cdq:rpc-ready-v2529'));
  function boot(){
    frame=document.createElement('iframe');frame.id='cdq-data-connection';frame.title='Connexion sécurisée CDQ';
    frame.hidden=true;frame.tabIndex=-1;frame.setAttribute('aria-hidden','true');
    frame.src=endpoint+'?cdq_native_bridge=1&channel='+encodeURIComponent(channel);
    (document.body||document.documentElement).append(frame);
  }
  boot();
})();
