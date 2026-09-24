import assert from 'node:assert/strict';
export const IPHONE_CONNECTION_REVISION='2026.09.24-iphone-rpc-r1';

/** Adapt only the iPhone copy. Keep the Google origin, channel and frame checks. */
export function adaptIphoneRpc(source){
  function once(from,to){
    assert.equal(source.split(from).length,2,'iPhone RPC anchor changed: '+from.slice(0,100));
    source=source.replace(from,to);
  }
  once("  let frame, peer, peerOrigin='', serial=0, failed='';",
       "  let frame, peer, peerRelay=null, peerOrigin='', serial=0, failed='';");
  once("      peer=event.source;peerOrigin=event.origin;failed='';clearTimeout(bootTimer);",
`      // WebKit reports the HtmlService relay as the source of asynchronous
      // replies; READY still comes from its inner user-code frame. Pin only
      // that exact parent during the validated handshake, never any sibling.
      if(!peer){
        try{const relay=event.source.parent;peerRelay=relay!==frame.contentWindow?relay:null;}catch(_){}
      }
      peer=event.source;peerOrigin=event.origin;failed='';clearTimeout(bootTimer);`);
  once("    }else if(data.type==='CDQ_EMBEDDED_RESULT'&&event.source===peer&&event.origin===peerOrigin){",
`    }else if(data.type==='CDQ_EMBEDDED_RESULT'&&peer&&
      (event.source===peer||event.source===peerRelay)&&event.origin===peerOrigin&&
      pending.get(String(data.id))?.sent===true&&typeof data.ok==='boolean'){`);
  once("  const unavailable='La connexion CDQ ne répond pas. Vérifiez Internet et publiez la mise à jour V25.28 dans Script Manager, puis réessayez.';",
       "  const unavailable='La connexion CDQ ne répond pas. Vérifiez Internet et réessayez. Si CDQ est déjà installé, actualisez l’application iPhone.';");
  once("job.timer=setTimeout(()=>settle(id,false,'La demande a expiré. Vérifiez son résultat avant de relancer une écriture.'),90000);",
       "job.timer=setTimeout(()=>settle(id,false,name==='obtenirEtatAcces'?'La vérification de connexion a expiré. Appuyez sur Réessayer la connexion.':'La demande a expiré. Vérifiez son résultat avant de relancer une écriture.'),90000);");
  return '/* iPhone connection compatibility: '+IPHONE_CONNECTION_REVISION+' */\n'+source;
}
