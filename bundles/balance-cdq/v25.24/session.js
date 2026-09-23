// Loaded before the first access check. Only phones retain this short session.
const cdqSession24 = (() => {
  const key='cdqResumeSessionV2524', grace=30*60*1000;
  let touched=0, restoring=false;
  const mobile=()=>/Android|iPhone|iPad|BalanceCDQAndroid\//i.test(navigator.userAgent||'');
  function clear(){try{localStorage.removeItem(key);}catch(_){}}
  function remember(){
    if(!mobile()||cdqAccessState!=='ready'||!cdqSessionRpcV58||!cdqObtenirJetonAppareil())return;
    touched=Date.now();
    try{localStorage.setItem(key,JSON.stringify({token:cdqSessionRpcV58,email:utilisateurCourantEmail,until:touched+grace}));}catch(_){}
  }
  function resume(fallback){
    if(!mobile()||restoring)return false;
    let saved;try{saved=JSON.parse(localStorage.getItem(key)||'null');}catch(_){}
    if(!saved?.token||saved.until<=Date.now()||!cdqObtenirJetonAppareil()){clear();return false;}
    restoring=true;cdqSetAccessState('pending');
    cdqApiRun().withSuccessHandler(state=>{
      restoring=false;
      if(state?.autorise&&state.email===saved.email)appliquerAccesAutorise(state);
      else{clear();fallback();}
    }).withFailureHandler(()=>{restoring=false;clear();fallback();})
      .reprendreSessionCourteCDQV2524(saved.token,cdqObtenirJetonAppareil());
    return true;
  }
  window.addEventListener('cdq:access-ready',remember);
  for(const event of ['pointerdown','keydown'])document.addEventListener(event,()=>{if(Date.now()-touched>60000)remember();},{passive:true});
  // The last visible interaction starts the grace period. Hiding never revokes it.
  document.addEventListener('visibilitychange',()=>{if(document.hidden)remember();});
  return {resume,clear,remember};
})();
