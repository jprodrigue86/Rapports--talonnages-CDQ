import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {applyFastStartupShell2537,applyFastStartupSelector2537} from '../scripts/fast-start-v2537.mjs';

const runtime=fs.readFileSync('fast-start-v2537.js','utf8');

test('V25.37 fast startup runtime is syntax-valid and keeps server authority',()=>{
  new vm.Script(runtime);
  assert.match(runtime,/LOCAL_TTL_MS=8\*60\*60\*1000/);
  assert.match(runtime,/takeLocalTicket/);
  assert.match(runtime,/cdqSetAccessState\('local'\)/);
  assert.match(runtime,/restaurerSessionApresBiometrie/);
  assert.match(runtime,/clearLocalSession/);
  assert.match(runtime,/saveLocalSession/);
  assert.doesNotMatch(runtime,/jetonSession.*saveLocalSession|saveLocalSession.*jetonSession/);
});

test('shell accepts local display state without treating it as server ready',()=>{
  const source="function recevoirEtatAcces(state){\nif (!['pending','input','ready'].includes(state)) return;\nconst authMask=document.getElementById('cdq-auth-bottom-mask-v2507');\nif(authMask)authMask.classList.toggle('cdq-auth-ready-v2507',state==='ready');\n}";
  const out=applyFastStartupShell2537(source);
  assert.match(out,/pending','input','local','ready/);
  assert.match(out,/state==='ready'\|\|state==='local'/);
});

test('selector permits cache reads locally but blocks ordinary server RPC',()=>{
  const source='<html><head></head><body><script>'+
    'function cdqApiRun(){let failure=null,userObject=null,hasUserObject=false;return new Proxy({},{get:function(target,prop){return function(){'+
    '        const direct=CDQ_RPC_DIRECT_V58.has(prop);\n        const session=String(cdqSessionRpcV58||"");'+
    '}}})}\n'+
    "function chargerClients(forceRefresh, initialCompanies){\n  const force=!!forceRefresh, email=String(utilisateurCourantEmail||'');\n  const sequence=chargerClients.sequence=(chargerClients.sequence||0)+1;\n  let shown=false;\n  const current=()=>sequence===chargerClients.sequence&&cdqAccessState==='ready'&&email===String(utilisateurCourantEmail||'');\n  function apply(companies){}\n  function server(forceServer=force){\n    if(!current())return;\n  }\n  function refreshLater(){setTimeout(()=>{if(typeof navigator==='undefined'||navigator.onLine!==false)server(true);},3000);}\n}\n"+
    "function chargerContenuServeurRapide(idCompagnie){\n  const owner=String(utilisateurCourantEmail||'');\n}\n"+
    "function planifierActualisationCompagnie(idCompagnie,verifiedAt){\n  const age = Date.now() - (Number(verifiedAt) || 0);\n}\n"+
    '</script></body></html>';
  const out=applyFastStartupSelector2537(source);
  assert.match(out,/id="cdqFastLocalV2537"/);
  assert.match(out,/cdqAccessState==="local"&&!direct/);
  assert.match(out,/cdqAccessState==='ready'\|\|cdqAccessState==='local'/);
  assert.match(out,/if\(!current\(\)\|\|cdqAccessState!=="ready"\)return/);
  assert.match(out,/function chargerContenuServeurRapide\(idCompagnie\)\{\n  if\(cdqAccessState!=='ready'\)return/);
  assert.match(out,/function planifierActualisationCompagnie\(idCompagnie,verifiedAt\)\{\n  if\(cdqAccessState!=='ready'\)return/);
});
