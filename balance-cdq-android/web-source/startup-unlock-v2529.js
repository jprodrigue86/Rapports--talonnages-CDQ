/* V25.38: start Android biometric before Selector parses and, after a valid
   Keystore-protected short ticket, reveal only cached/read-only UI while the
   existing server session is confirmed in the background. */
(() => {
  'use strict';
  if(window.top!==window || !window.BalanceCDQNative?.biometric)return;
  const tokenKey='cdq_auth_device_token_v2',emailKey='cdqLastUnlockEmailV2511';
  const read=key=>{try{return localStorage.getItem(key)||'';}catch(_){return '';}};
  const token=read(tokenKey),email=read(emailKey).trim().toLowerCase();
  let activation;try{activation=JSON.parse(sessionStorage.getItem('cdq_activation_pending_v41')||'null');}catch(_){}
  if(!token||!email||navigator.onLine===false||activation?.expiresAt>Date.now())return;

  let nativeStartup=null;
  try{
    nativeStartup=JSON.parse(BalanceCDQNative.startupBiometricState?.(email,token)||'null');
  }catch(_){nativeStartup=null;}
  const nativeRequestId=String(nativeStartup?.requestId||'');
  const id=/^native-startup-[A-Za-z0-9._-]{20,120}$/.test(nativeRequestId)
    ? nativeRequestId
    : 'startup-'+crypto.randomUUID();
  const expires=Date.now()+65000;
  let result=null,claim=null,session=null,sessionTaken=false,cancelled=false;
  let localState=null,localGrant='',serverConfirmed=false;

  function valid(){
    return !cancelled&&Date.now()<expires&&read(tokenKey)===token&&read(emailKey).trim().toLowerCase()===email;
  }
  function cancel(requestId){
    if(requestId&&claim?.id!==requestId)return;
    if(cancelled)return;
    cancelled=true;clearTimeout(timer);
    try{BalanceCDQNative.cancelBiometric?.(id);}catch(_){}
  }
  function clearLocal(){
    try{
      if(localGrant)BalanceCDQNative.clearLocalSession?.(id,localGrant);
    }catch(_){}
    localState=null;
  }
  function readLocal(){
    if(!valid()||!result?.success||!localGrant||!BalanceCDQNative.localSessionAfterBiometric)return;
    try{
      const raw=String(BalanceCDQNative.localSessionAfterBiometric(id,localGrant,email,token)||'');
      const state=JSON.parse(raw||'null');
      if(state?.ok===true && String(state.email||'').trim().toLowerCase()===email && Number(state.expiresAt)>Date.now()){
        localState={
          autorise:true,
          email,
          role:'lecture',
          jetonSession:'',
          compagniesInitiales:null,
          cdqLocalProvisionalV2537:true,
          localTicketUntil:Number(state.expiresAt)
        };
      }
    }catch(_){localState=null;}
  }
  function rememberConfirmed(state){
    if(!valid()||!localGrant||!state?.autorise||String(state.email||'').trim().toLowerCase()!==email)return;
    try{
      BalanceCDQNative.confirmLocalSession?.(id,localGrant,email,token);
      serverConfirmed=true;
    }catch(_){}
  }
  function prepareSession(){
    if(!valid()||!result?.success||session||!window.cdqEmbeddedRpcV2529)return;
    session=window.cdqEmbeddedRpcV2529.prepareSession(token);
    session.catch(()=>{});
  }
  function deliver(){
    if(!claim||!result||claim.delivered||!valid())return;
    claim.delivered=true;
    const current=claim;
    queueMicrotask(()=>{if(valid()&&claim===current)current.done(result.success,result.message);});
  }
  function receive(requestId,success,message,grant){
    if(requestId!==id)return false;
    if(result||!valid())return true;
    result={success:success===true,message:String(message||'')};
    localGrant=result.success?String(grant||''):'';
    if(result.success)readLocal();
    prepareSession();deliver();return true;
  }
  const timer=setTimeout(()=>cancel(),65000);

  window.cdqStartupUnlockV2529={
    receive,cancel,
    activeFor:value=>valid()&&value===token,
    provisional:()=>valid()&&!!localState&&sessionTaken&&!serverConfirmed,
    attach(account,requestId,done){
      if(!valid()||claim||String(account||'').trim().toLowerCase()!==email){cancel();return false;}
      claim={id:requestId,done,delivered:false};deliver();return true;
    },
    takeSession(value,success,failure,userObject){
      if(!valid()||value!==token||!claim?.delivered||!result?.success||sessionTaken)return false;
      prepareSession();if(!session)return false;
      sessionTaken=true;
      const current=claim;
      if(localState){
        const provisional={...localState};
        queueMicrotask(()=>{if(valid()&&claim===current)success?.(provisional,userObject);});
      }
      session.then(state=>{
        if(!valid()||claim!==current)return;
        if(state?.autorise===true && String(state.email||'').trim().toLowerCase()===email){
          rememberConfirmed(state);
        }else if(state && state.autorise===false){
          clearLocal();
        }
        success?.(state,userObject);
      },error=>{
        if(valid()&&claim===current)failure?.(error,userObject);
      });
      return true;
    }
  };

  // MainActivity may already be showing the system biometric prompt before
  // this packaged shell has parsed. Accept either its cached result or its
  // later callback. Fall back to the legacy JS-triggered prompt only when
  // there is no valid native startup prompt.
  window.cdqNativeBiometricResultV2507=receive;
  window.cdqNativeStartupBiometricResultV2538=receive;
  window.addEventListener('cdq:rpc-ready-v2529',prepareSession);
  window.addEventListener('pagehide',()=>cancel(),{once:true});
  window.addEventListener('storage',()=>{if(!valid())cancel();});

  const state=String(nativeStartup?.state||'none');
  if(nativeRequestId===id && state==='success'){
    queueMicrotask(()=>receive(id,true,String(nativeStartup?.message||''),String(nativeStartup?.grant||'')));
  }else if(nativeRequestId===id && state==='failure'){
    queueMicrotask(()=>receive(id,false,String(nativeStartup?.message||'Biométrie annulée.'),''));
  }else if(!(nativeRequestId===id && state==='pending')){
    try{BalanceCDQNative.biometric(id);}catch(_){cancel();}
  }
})();
