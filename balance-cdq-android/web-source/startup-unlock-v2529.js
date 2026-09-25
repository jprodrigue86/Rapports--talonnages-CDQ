/* V25.37: start native biometric before Selector parses, then expose only
   a short Keystore-backed local display ticket. Server authentication still
   runs independently and remains required before any network mutation/read. */
(() => {
  'use strict';
  if(window.top!==window || !window.BalanceCDQNative?.biometric)return;
  const tokenKey='cdq_auth_device_token_v2',emailKey='cdqLastUnlockEmailV2511';
  const read=key=>{try{return localStorage.getItem(key)||'';}catch(_){return '';}};
  const token=read(tokenKey),email=read(emailKey).trim().toLowerCase();
  let activation;try{activation=JSON.parse(sessionStorage.getItem('cdq_activation_pending_v41')||'null');}catch(_){}
  if(!token||!email||activation?.expiresAt>Date.now())return;

  const id='startup-'+crypto.randomUUID(),expires=Date.now()+65000;
  const startedAt=performance.now();
  let result=null,claim=null,session=null,sessionTaken=false,cancelled=false,localTicket=null;
  const timing={startedAt,biometricRequestedAt:0,biometricSuccessAt:0,localTicketAt:0,localVisibleAt:0,serverReadyAt:0};

  function valid(){
    return !cancelled&&Date.now()<expires&&read(tokenKey)===token&&read(emailKey).trim().toLowerCase()===email;
  }
  function mark(name){
    timing[name]=performance.now();
    if(name==='localVisibleAt'&&timing.biometricSuccessAt){
      console.info('[CDQ startup] local UI after biometric:',Math.round(timing[name]-timing.biometricSuccessAt),'ms');
    }
    if(name==='serverReadyAt'&&timing.biometricSuccessAt){
      console.info('[CDQ startup] server ready after biometric:',Math.round(timing[name]-timing.biometricSuccessAt),'ms');
    }
  }
  function cancel(requestId){
    if(requestId&&claim?.id!==requestId)return;
    if(cancelled)return;
    cancelled=true;clearTimeout(timer);
    try{BalanceCDQNative.cancelBiometric?.(id);}catch(_){}
  }
  function loadLocalTicket(){
    if(localTicket||!valid()||!result?.success)return localTicket;
    try{
      const raw=BalanceCDQNative.consumeLocalSession?.(email,token);
      if(!raw)return null;
      const parsed=JSON.parse(String(raw));
      if(parsed&&parsed.schema===1&&String(parsed.email||'').toLowerCase()===email&&Number(parsed.expiresAt)>Date.now()){
        localTicket={
          schema:1,
          email,
          role:String(parsed.role||'technicien').toLowerCase(),
          issuedAt:Number(parsed.issuedAt)||0,
          expiresAt:Number(parsed.expiresAt)||0
        };
        mark('localTicketAt');
      }
    }catch(_){}
    return localTicket;
  }
  function prepareSession(){
    if(!valid()||!result?.success||session||!window.cdqEmbeddedRpcV2529||navigator.onLine===false)return;
    session=window.cdqEmbeddedRpcV2529.prepareSession(token);
    session.catch(()=>{});
  }
  function deliver(){
    if(!claim||!result||claim.delivered||!valid())return;
    claim.delivered=true;
    const current=claim;
    queueMicrotask(()=>{if(valid()&&claim===current)current.done(result.success,result.message);});
  }
  function receive(requestId,success,message){
    if(requestId!==id)return false;
    if(result||!valid())return true;
    result={success:success===true,message:String(message||'')};
    if(result.success){
      mark('biometricSuccessAt');
      loadLocalTicket();
      prepareSession();
    }
    deliver();
    return true;
  }
  const timer=setTimeout(()=>cancel(),65000);
  window.cdqStartupUnlockV2529={
    receive,cancel,
    activeFor:value=>valid()&&value===token,
    takeLocalTicket(value){
      if(!valid()||value!==token||!result?.success)return null;
      return loadLocalTicket();
    },
    markLocalVisible(){if(valid()&&!timing.localVisibleAt)mark('localVisibleAt');},
    markServerReady(){if(valid()&&!timing.serverReadyAt)mark('serverReadyAt');},
    timing:()=>Object.assign({},timing),
    attach(account,requestId,done){
      if(!valid()||claim||String(account||'').trim().toLowerCase()!==email){cancel();return false;}
      claim={id:requestId,done,delivered:false};deliver();return true;
    },
    takeSession(value,success,failure,userObject){
      if(!valid()||value!==token||!claim?.delivered||!result?.success||sessionTaken)return false;
      prepareSession();if(!session)return false;
      sessionTaken=true;
      session.then(state=>{if(valid())success?.(state,userObject);},error=>{if(valid())failure?.(error,userObject);});
      return true;
    }
  };

  window.cdqNativeBiometricResultV2507=receive;
  window.addEventListener('cdq:rpc-ready-v2529',prepareSession);
  window.addEventListener('online',prepareSession,{passive:true});
  window.addEventListener('pagehide',()=>cancel(),{once:true});
  window.addEventListener('storage',()=>{if(!valid())cancel();});
  try{
    mark('biometricRequestedAt');
    BalanceCDQNative.biometric(id);
  }catch(_){cancel();}
})();
