/* V25.39 clean startup:
 * - Android may start biometrics before WebView.
 * - A Keystore-protected ticket can reveal the unchanged Selector immediately.
 * - Remote calls stay held until the authoritative server confirms.
 * - No Selector/UI/icon code is patched here. */
(() => {
  'use strict';
  if(window.top!==window || !window.BalanceCDQNative?.biometric)return;

  const tokenKey='cdq_auth_device_token_v2';
  const emailKey='cdqLastUnlockEmailV2511';
  const read=key=>{try{return localStorage.getItem(key)||'';}catch(_){return '';}};
  const token=read(tokenKey);
  const email=read(emailKey).trim().toLowerCase();

  let activation;
  try{activation=JSON.parse(sessionStorage.getItem('cdq_activation_pending_v41')||'null');}catch(_){}
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
    return !cancelled &&
      Date.now()<expires &&
      read(tokenKey)===token &&
      read(emailKey).trim().toLowerCase()===email;
  }

  function cancel(requestId){
    if(requestId&&claim?.id!==requestId)return;
    if(cancelled)return;
    cancelled=true;
    clearTimeout(timer);
    try{BalanceCDQNative.cancelBiometric?.(id);}catch(_){}
  }

  function clearLocal(){
    try{
      if(localGrant)BalanceCDQNative.clearStartupTicket?.(id,localGrant);
    }catch(_){}
    localState=null;
    serverConfirmed=false;
    try{window.dispatchEvent(new Event('cdq:startup-revoked-v2539'));}catch(_){}
  }

  function readLocal(){
    if(!valid()||!result?.success||!localGrant||!BalanceCDQNative.localStartupTicket)return;
    try{
      const raw=String(BalanceCDQNative.localStartupTicket(id,localGrant,email,token)||'');
      const state=JSON.parse(raw||'null');
      if(state?.ok===true &&
         String(state.email||'').trim().toLowerCase()===email &&
         Number(state.expiresAt)>Date.now()){
        // Deliberately use the ordinary technician UI. Admin-only UI never appears
        // until the server returns the real role.
        localState={
          autorise:true,
          email,
          role:'technicien',
          jetonSession:'',
          compagniesInitiales:null,
          cdqReadOnlyStartupV2539:true
        };
      }
    }catch(_){localState=null;}
  }

  function rememberConfirmed(state){
    if(!valid()||!localGrant||!state?.autorise||
       String(state.email||'').trim().toLowerCase()!==email)return;
    try{
      BalanceCDQNative.confirmStartupTicket?.(id,localGrant,email,token);
    }catch(_){}
    serverConfirmed=true;
    try{window.dispatchEvent(new Event('cdq:startup-confirmed-v2539'));}catch(_){}
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
    prepareSession();
    deliver();
    return true;
  }

  const timer=setTimeout(()=>cancel(),65000);

  window.cdqStartupUnlockV2529={
    receive,
    cancel,
    activeFor:value=>valid()&&value===token,
    isProvisional:()=>valid()&&!!localState&&sessionTaken&&!serverConfirmed,

    attach(account,requestId,done){
      if(!valid()||claim||String(account||'').trim().toLowerCase()!==email){
        cancel();
        return false;
      }
      claim={id:requestId,done,delivered:false};
      deliver();
      return true;
    },

    takeSession(value,success,failure,userObject){
      if(!valid()||value!==token||!claim?.delivered||!result?.success||sessionTaken)return false;
      prepareSession();
      if(!session)return false;
      sessionTaken=true;
      const current=claim;

      if(localState){
        const snapshot={...localState};
        queueMicrotask(()=>{
          if(valid()&&claim===current)success?.(snapshot,userObject);
        });
      }

      session.then(state=>{
        if(!valid()||claim!==current)return;
        if(state?.autorise===true &&
           String(state.email||'').trim().toLowerCase()===email){
          rememberConfirmed(state);
          success?.(state,userObject);
          return;
        }
        if(state&&state.autorise===false)clearLocal();
        success?.(state,userObject);
      },error=>{
        if(!valid()||claim!==current)return;
        // A previously confirmed local ticket remains read-only if the network
        // is temporarily unavailable. No remote RPC is released.
        if(localState){
          try{window.dispatchEvent(new Event('cdq:startup-offline-v2539'));}catch(_){}
          return;
        }
        failure?.(error,userObject);
      });
      return true;
    }
  };

  window.cdqNativeBiometricResultV2507=receive;
  window.cdqNativeStartupBiometricResultV2539=receive;
  window.addEventListener('cdq:rpc-ready-v2529',prepareSession);
  window.addEventListener('pagehide',()=>cancel(),{once:true});
  window.addEventListener('storage',()=>{if(!valid())cancel();});

  const state=String(nativeStartup?.state||'none');
  if(nativeRequestId===id&&state==='success'){
    queueMicrotask(()=>receive(
      id,true,String(nativeStartup?.message||''),String(nativeStartup?.grant||'')
    ));
  }else if(nativeRequestId===id&&state==='failure'){
    queueMicrotask(()=>receive(id,false,String(nativeStartup?.message||'Biométrie annulée.'),''));
  }else if(!(nativeRequestId===id&&state==='pending')){
    try{BalanceCDQNative.biometric(id);}catch(_){cancel();}
  }
})();
