import fs from 'node:fs';
import vm from 'node:vm';

function replaceOne(source,before,after){
  if(source.split(before).length!==2)throw Error('Fast startup anchor mismatch: '+before.slice(0,120));
  return source.replace(before,after);
}

export function applyFastStartupShell2537(source){
  source=replaceOne(source,
    "if (!['pending','input','ready'].includes(state)) return;",
    "if (!['pending','input','local','ready'].includes(state)) return;");
  source=replaceOne(source,
    "if(authMask)authMask.classList.toggle('cdq-auth-ready-v2507',state==='ready');",
    "if(authMask)authMask.classList.toggle('cdq-auth-ready-v2507',state==='ready'||state==='local');");
  return source;
}

export function applyFastStartupSelector2537(source){
  if(source.includes('id="cdqFastLocalV2537"'))throw Error('Fast startup already applied');
  const runtime=fs.readFileSync(new URL('../fast-start-v2537.js',import.meta.url),'utf8');
  new vm.Script(runtime);
  source=replaceOne(source,'<head>','<head>\n<script id="cdqFastLocalV2537">\n'+runtime+'\n</script>');

  source=replaceOne(source,
    '        const direct=CDQ_RPC_DIRECT_V58.has(prop);\n        const session=String(cdqSessionRpcV58||"");',
    '        const direct=CDQ_RPC_DIRECT_V58.has(prop);\n        if(cdqAccessState==="local"&&!direct){\n          const error=new Error("Validation sécurisée en arrière-plan. Réessayez dans un instant.");\n          if(typeof failure==="function")queueMicrotask(()=>failure(error,hasUserObject?userObject:undefined));\n          return;\n        }\n        const session=String(cdqSessionRpcV58||"");');

  source=replaceOne(source,
    "  const current=()=>sequence===chargerClients.sequence&&cdqAccessState==='ready'&&email===String(utilisateurCourantEmail||'');",
    "  const current=()=>sequence===chargerClients.sequence&&(cdqAccessState==='ready'||cdqAccessState==='local')&&email===String(utilisateurCourantEmail||'');");

  source=replaceOne(source,
    '  function server(forceServer=force){\n    if(!current())return;',
    '  function server(forceServer=force){\n    if(!current()||cdqAccessState!=="ready")return;');

  source=replaceOne(source,
    "  function refreshLater(){setTimeout(()=>{if(typeof navigator==='undefined'||navigator.onLine!==false)server(true);},3000);}",
    "  function refreshLater(){setTimeout(()=>{if(cdqAccessState==='ready'&&(typeof navigator==='undefined'||navigator.onLine!==false))server(true);},3000);}");

  source=replaceOne(source,
    'function chargerContenuServeurRapide(idCompagnie){\n  const owner=String(utilisateurCourantEmail||\'\');',
    'function chargerContenuServeurRapide(idCompagnie){\n  if(cdqAccessState!==\'ready\')return;\n  const owner=String(utilisateurCourantEmail||\'\');');

  source=replaceOne(source,
    'function planifierActualisationCompagnie(idCompagnie,verifiedAt){\n  const age = Date.now() - (Number(verifiedAt) || 0);',
    'function planifierActualisationCompagnie(idCompagnie,verifiedAt){\n  if(cdqAccessState!==\'ready\')return;\n  const age = Date.now() - (Number(verifiedAt) || 0);');

  return source;
}
