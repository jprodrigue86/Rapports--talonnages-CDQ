/* V25.40 — reusable fast unlock for warm app reopens.
 * Does not modify Selector/UI. A fresh Android biometric grant is required
 * for every cycle; remote access remains locked until server confirmation. */
(() => {
  'use strict';
  const tokenKey='cdq_auth_device_token_v2';
  const emailKey='cdqLastUnlockEmailV2511';
  const read=key=>{try{return localStorage.getItem(key)||'';}catch(_){return '';}};
  let cycle=null;

  function clearCycle(){
    cycle=null;
  }

  function observe(requestId,success,message,grant){
    if(success!==true){clearCycle();return false;}
    const token=read(tokenKey);
    const email=read(emailKey).trim().toLowerCase();
    const g=String(grant||'');
    if(!token||!email||g.length<20||!window.BalanceCDQNative?.localStartupTicket)return false;

    try{
      const raw=String(BalanceCDQNative.localStartupTicket(
        String(requestId||''),g,email,token
      )||'');
      const local=JSON.parse(raw||'null');
      if(local?.ok!==true ||
         String(local.email||'').trim().toLowerCase()!==email ||
         Number(local.expiresAt)<=Date.now()){
        clearCycle();return false;
      }
      cycle={
        requestId:String(requestId||''),
        token,email,grant:g,
        localState:{
          autorise:true,
          email,
          role:'technicien',
          jetonSession:'',
          compagniesInitiales:null,
          cdqWarmReadOnlyV2540:true
        },
        taken:false,
        confirmed:false
      };
      return true;
    }catch(_){clearCycle();return false;}
  }

  function isProvisional(){
    return !!cycle&&cycle.taken&&!cycle.confirmed;
  }

  function takeSession(value,success,failure,userObject,serverFactory){
    const c=cycle;
    if(!c||c.taken||String(value||'')!==c.token||typeof serverFactory!=='function')return false;
    c.taken=true;
    queueMicrotask(()=>{
      if(cycle===c)success?.({...c.localState},userObject);
    });

    let session;
    try{session=serverFactory(c.token);}catch(error){
      try{window.dispatchEvent(new Event('cdq:warm-offline-v2540'));}catch(_){}
      return true;
    }
    Promise.resolve(session).then(state=>{
      if(cycle!==c)return;
      if(state?.autorise===true &&
         String(state.email||'').trim().toLowerCase()===c.email){
        try{
          BalanceCDQNative.confirmStartupTicket?.(
            c.requestId,c.grant,c.email,c.token
          );
        }catch(_){}
        c.confirmed=true;
        try{window.dispatchEvent(new Event('cdq:warm-confirmed-v2540'));}catch(_){}
        success?.(state,userObject);
        // Keep only no reusable biometric secret after confirmation.
        clearCycle();
        return;
      }
      if(state&&state.autorise===false){
        try{BalanceCDQNative.clearStartupTicket?.(c.requestId,c.grant);}catch(_){}
        try{window.dispatchEvent(new Event('cdq:warm-revoked-v2540'));}catch(_){}
        success?.(state,userObject);
        clearCycle();
      }
    },_error=>{
      if(cycle!==c)return;
      try{window.dispatchEvent(new Event('cdq:warm-offline-v2540'));}catch(_){}
      // The local screen remains read-only; no remote operation is released.
    });
    return true;
  }

  window.cdqWarmUnlockV2540={observe,takeSession,isProvisional};
})();
