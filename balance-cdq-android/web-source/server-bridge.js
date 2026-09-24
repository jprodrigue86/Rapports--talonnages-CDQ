/* Runs inside Google's HTML-service sandbox. No session or data is embedded. */
(() => {
  'use strict';
  const origin='https://jprodrigue86.github.io',channel=CDQ_EMBEDDED_CHANNEL;
  const allowed=new Set(['cdqRpc','reprendreActivationCDQ','creerDefiConnexionGoogleCDQ','verifierJetonGoogleCDQ','obtenirEtatAcces','connecterAvecCodeAcces','definirNip4ApresActivation','deverrouillerAvecNip','restaurerSessionApresBiometrie','reprendreSessionCourteCDQV2524']);
  let peer=null;
  const seen=new Set();
  function announce(){
    const message={type:'CDQ_EMBEDDED_READY',protocol:1,channel};
    let parent=window.parent;
    for(let i=0;parent&&i<8;i++){
      try{parent.postMessage(message,origin);const next=parent.parent;if(next===parent)break;parent=next;}catch(_){break;}
    }
  }
  function ancestor(source){
    let parent=window.parent;
    for(let i=0;parent&&i<8;i++){
      if(parent===source)return true;
      try{const next=parent.parent;if(next===parent)break;parent=next;}catch(_){break;}
    }
    return false;
  }
  window.addEventListener('message',event=>{
    const data=event.data;
    if(event.origin!==origin||!ancestor(event.source)||!data||data.type!=='CDQ_EMBEDDED_CALL'||data.protocol!==1||data.channel!==channel)return;
    if(peer&&peer!==event.source)return;
    if(!allowed.has(data.name)||!Array.isArray(data.args)||!/^\d{1,12}$/.test(String(data.id)))return;
    if(seen.has(data.id))return;
    peer=event.source;seen.add(data.id);
    const send=(ok,value)=>event.source.postMessage({type:'CDQ_EMBEDDED_RESULT',protocol:1,channel,id:data.id,ok,...(ok?{value}:{error:String(value&&value.message||value||'Erreur serveur CDQ.')})},origin);
    try{
      const runner=google.script.run.withSuccessHandler(value=>send(true,value)).withFailureHandler(error=>send(false,error));
      runner[data.name](...data.args);
    }catch(error){send(false,error);}
  });
  announce();setTimeout(announce,150);setTimeout(announce,700);
})();
