/* V25.37 — fast local display after native biometric.
 * A Keystore-backed ticket may reveal only this account's existing local cache.
 * Server calls that are not authentication remain blocked until accessState=ready. */
(function () {
  'use strict';
  const MAX_WAIT_MS=65000, LOCAL_TTL_MS=8*60*60*1000;
  let installed=false,localActive=false,revoking=false,pollStarted=0,retryTimer=0,retryCount=0,lastToken='';

  function nativeBridge(){
    try{
      if(window.BalanceCDQNative)return window.BalanceCDQNative;
      if(window.parent&&window.parent!==window&&window.parent.BalanceCDQNative)return window.parent.BalanceCDQNative;
    }catch(_){}
    return null;
  }
  function startupBridge(){
    try{return window.parent&&window.parent!==window?window.parent.cdqStartupUnlockV2529:null;}catch(_){return null;}
  }
  function currentToken(){
    try{return String(cdqObtenirJetonAppareil()||'');}catch(_){return '';}
  }
  function clearRetry(){clearTimeout(retryTimer);retryTimer=0;retryCount=0;}
  function clearNative(){
    try{nativeBridge()?.clearLocalSession?.();}catch(_){}
  }
  function localStyle(){
    if(document.getElementById('cdqFastLocalV2537Style'))return;
    const style=document.createElement('style');
    style.id='cdqFastLocalV2537Style';
    style.textContent=[
      'body[data-cdq-local-session="1"] .quick-button,',
      'body[data-cdq-local-session="1"] #createFolderButton,',
      'body[data-cdq-local-session="1"] #folderActionButton,',
      'body[data-cdq-local-session="1"] #sendButton,',
      'body[data-cdq-local-session="1"] #adminButton,',
      'body[data-cdq-local-session="1"] #headerAdminButton{pointer-events:none!important;opacity:.48!important}',
      'body[data-cdq-local-session="1"] #adminButton,body[data-cdq-local-session="1"] #headerAdminButton{display:none!important}'
    ].join('');
    document.head.appendChild(style);
  }
  function applyLocal(ticket){
    if(!ticket||localActive||!['pending','local'].includes(String(cdqAccessState||'')))return false;
    const email=String(ticket.email||'').trim().toLowerCase();
    if(!email||Number(ticket.expiresAt)<=Date.now())return false;
    utilisateurCourantEmail=email;
    utilisateurCourantRole=['admin','lecture','technicien'].includes(String(ticket.role||'').toLowerCase())
      ?String(ticket.role).toLowerCase():'technicien';
    try{appliquerDroitsRoleInterface();}catch(_){}
    cdqMasquerPanneauxAcces();
    const overlay=document.getElementById('accessOverlay');
    const status=document.getElementById('accessStatus');
    const error=document.getElementById('accessError');
    if(overlay)overlay.style.display='none';
    if(status)status.textContent='';
    if(error)error.style.display='none';
    localStyle();
    document.body.dataset.cdqLocalSession='1';
    localActive=true;
    lastToken=currentToken();
    cdqSetAccessState('local');
    try{chargerClients(false);}catch(_){}
    try{startupBridge()?.markLocalVisible?.();}catch(_){}
    window.dispatchEvent(new CustomEvent('cdq:local-access-v2537',{detail:{email,expiresAt:Number(ticket.expiresAt)}}));
    return true;
  }
  function removeLocalMode(){
    localActive=false;
    delete document.body.dataset.cdqLocalSession;
    clearRetry();
  }
  function revokeLocal(){
    revoking=true;
    clearNative();
    removeLocalMode();
    revoking=false;
  }
  function saveVerified(etat){
    const email=String(etat?.email||utilisateurCourantEmail||'').trim().toLowerCase();
    const role=String(etat?.role||utilisateurCourantRole||'technicien').trim().toLowerCase();
    const token=currentToken();
    try{
      if(email&&token)nativeBridge()?.saveLocalSession?.(email,role,token,LOCAL_TTL_MS);
    }catch(_){}
    removeLocalMode();
    try{startupBridge()?.markServerReady?.();}catch(_){}
  }
  function scheduleRetry(token,delay){
    if(!localActive)return;
    clearTimeout(retryTimer);
    if(navigator.onLine===false){
      retryTimer=setTimeout(()=>scheduleRetry(token,1500),5000);
      return;
    }
    retryTimer=setTimeout(()=>{
      if(!localActive)return;
      cdqApiRun()
        .withSuccessHandler(etat=>{
          if(!localActive)return;
          if(etat&&etat.autorise){appliquerAccesAutorise(etat);return;}
          revokeLocal();
          cdqBiometricRequestId='';
          cdqBiometricPending=false;
          cdqAfficherPlanBNip('Entrez votre NIP à 4 chiffres.');
        })
        .withFailureHandler(()=>{
          if(!localActive)return;
          retryCount++;
          scheduleRetry(token,Math.min(30000,1500*Math.pow(2,Math.min(retryCount,4))));
        })
        .restaurerSessionApresBiometrie(token);
    },Math.max(0,delay||0));
  }
  function installWrappers(){
    if(installed)return;installed=true;
    localStyle();

    const originalSet=window.cdqSetAccessState;
    if(typeof originalSet==='function')window.cdqSetAccessState=function(state){
      if(localActive&&!revoking&&(state==='pending'||state==='input'))return;
      return originalSet.apply(this,arguments);
    };

    const originalAuthorized=window.appliquerAccesAutorise;
    if(typeof originalAuthorized==='function')window.appliquerAccesAutorise=function(etat){
      const result=originalAuthorized.apply(this,arguments);
      if(etat&&etat.autorise)saveVerified(etat);
      return result;
    };

    for(const name of ['afficherConnexionCodePersonnel','afficherCreationNip4','afficherDeverrouillageNip','cdqDemanderConnexionGoogleV42']){
      const original=window[name];
      if(typeof original!=='function')continue;
      window[name]=function(){
        if(localActive)revokeLocal();
        return original.apply(this,arguments);
      };
    }

    const originalPlanB=window.cdqAfficherPlanBNip;
    if(typeof originalPlanB==='function')window.cdqAfficherPlanBNip=function(){
      if(localActive)revokeLocal();
      return originalPlanB.apply(this,arguments);
    };

    const originalTerminer=window.cdqTerminerBiometrieSucces;
    if(typeof originalTerminer==='function')window.cdqTerminerBiometrieSucces=function(){
      const requestId=cdqBiometricRequestId;
      const jeton=cdqObtenirJetonAppareil();
      cdqArreterDelaiBiometrique();
      cdqBiometricReplyTimer=setTimeout(function(){
        if(cdqBiometricRequestId===requestId&&!localActive)cdqAfficherPlanBNip('La connexion prend trop de temps. Entrez votre NIP.');
      },20000);
      function actuel(){return !cdqBiometricFallbackActive&&cdqBiometricRequestId===requestId;}
      cdqApiRun()
        .withSuccessHandler(function(etat){
          if(!actuel())return;
          cdqArreterDelaiBiometrique();
          if(etat&&etat.autorise){cdqBiometricRequestId='';appliquerAccesAutorise(etat);return;}
          if(localActive)revokeLocal();
          cdqAfficherPlanBNip('Entrez votre NIP à 4 chiffres.');
        })
        .withFailureHandler(function(){
          if(!actuel())return;
          if(localActive){
            cdqArreterDelaiBiometrique();
            cdqBiometricRequestId='';
            cdqBiometricPending=false;
            scheduleRetry(jeton,1500);
            return;
          }
          if(cdqFastUnlockV2511){
            cdqArreterDelaiBiometrique();
            cdqBiometricRequestId='';cdqBiometricPending=false;
            cdqFastUnlockV2511=false;
            verifierAccesApplication(true);
          }else cdqAfficherPlanBNip('Entrez votre NIP à 4 chiffres.');
        })
        .restaurerSessionApresBiometrie(jeton);
    };

    window.addEventListener('online',()=>{if(localActive&&lastToken)scheduleRetry(lastToken,250);},{passive:true});
    window.addEventListener('cdq:access-ready',()=>{if(localActive)removeLocalMode();});
  }
  function poll(){
    if(!pollStarted)pollStarted=performance.now();
    if(performance.now()-pollStarted>MAX_WAIT_MS||cdqAccessState==='ready')return;
    if(!localActive){
      let ticket=null;
      try{ticket=startupBridge()?.takeLocalTicket?.(currentToken())||null;}catch(_){}
      if(ticket&&applyLocal(ticket))return;
    }
    setTimeout(poll,performance.now()-pollStarted<3000?16:80);
  }
  function start(){
    installWrappers();
    poll();
  }
  window.cdqFastLocalV2537={start,revoke:revokeLocal,isActive:()=>localActive};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else setTimeout(start,0);
})();
