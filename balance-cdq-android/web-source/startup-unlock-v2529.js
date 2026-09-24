/* Begin the native prompt before the large Selector is parsed. No access is
   granted here: the existing Selector must still accept a server session. */
(() => {
  'use strict';
  if(window.top!==window || !window.BalanceCDQNative?.biometric)return;
  const tokenKey='cdq_auth_device_token_v2',emailKey='cdqLastUnlockEmailV2511';
  const read=key=>{try{return localStorage.getItem(key)||'';}catch(_){return '';}};
  const token=read(tokenKey),email=read(emailKey).trim().toLowerCase();
  let activation;try{activation=JSON.parse(sessionStorage.getItem('cdq_activation_pending_v41')||'null');}catch(_){}
  if(!token||!email||navigator.onLine===false||activation?.expiresAt>Date.now())return;
  const id='startup-'+crypto.randomUUID(),expires=Date.now()+65000;
  let result=null,claim=null,session=null,sessionTaken=false,cancelled=false;
  function valid(){return !cancelled&&Date.now()<expires&&read(tokenKey)===token&&read(emailKey).trim().toLowerCase()===email;}
  function cancel(requestId){
    if(requestId&&claim?.id!==requestId)return;
    if(cancelled)return;
    cancelled=true;clearTimeout(timer);
    try{BalanceCDQNative.cancelBiometric?.(id);}catch(_){}
  }
  function prepareSession(){
    if(!valid()||!result?.success||session||!window.cdqEmbeddedRpcV2529)return;
    // Authentication starts only AFTER the actual Android success callback,
    // while the rest of the installed UI can still be loading.
    session=window.cdqEmbeddedRpcV2529.prepareSession(token);
    session.catch(()=>{}); // The normal Selector error handler consumes it later.
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
    prepareSession();deliver();return true;
  }
  const timer=setTimeout(()=>cancel(),65000);
  window.cdqStartupUnlockV2529={
    receive,cancel,
    activeFor:value=>valid()&&value===token,
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
  // MainActivity can return before the ordinary shell callback is installed.
  window.cdqNativeBiometricResultV2507=receive;
  window.addEventListener('cdq:rpc-ready-v2529',prepareSession);
  window.addEventListener('pagehide',()=>cancel(),{once:true});
  window.addEventListener('storage',()=>{if(!valid())cancel();});
  try{BalanceCDQNative.biometric(id);}catch(_){cancel();}
})();
