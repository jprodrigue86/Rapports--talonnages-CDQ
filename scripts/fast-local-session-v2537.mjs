import assert from 'node:assert/strict';

function once(source,before,after,label){
  assert.equal(source.split(before).length,2,label||before.slice(0,100));
  return source.replace(before,after);
}

export function applyFastLocalShell2537(source){
  source=once(
    source,
    'window.cdqNativeBiometricResultV2507=function(requestId,success,message){\nif(window.cdqStartupUnlockV2529?.receive(requestId,success,message))return;',
    'window.cdqNativeBiometricResultV2507=function(requestId,success,message,localGrant){\nif(window.cdqStartupUnlockV2529?.receive(requestId,success,message,localGrant))return;',
    'native biometric callback'
  );
  return source;
}

export function applyFastLocalSelector2537(source){
  source=once(
    source,
    '        const args=Array.prototype.slice.call(arguments);\n        let runner=google["script"]["run"];',
    `        const args=Array.prototype.slice.call(arguments);
        if(window.cdqLocalProvisionalV2537 && !CDQ_RPC_DIRECT_V58.has(prop)){
          const error=new Error('Connexion sécurisée en arrière-plan. Réessayez dans un instant.');
          if(typeof failure==='function')queueMicrotask(()=>failure(error,userObject));
          return;
        }
        let runner=google["script"]["run"];`,
    'provisional RPC gate'
  );

  source=once(
    source,
    '      if(etat&&etat.autorise){cdqBiometricRequestId="";appliquerAccesAutorise(etat);return;}',
    `      if(etat&&etat.autorise){
        if(etat.cdqLocalProvisionalV2537){appliquerAccesAutorise(etat);return;}
        cdqBiometricRequestId="";appliquerAccesAutorise(etat);return;
      }`,
    'double-stage biometric success'
  );

  source=once(
    source,
    '    .withFailureHandler(function(){\n      if(!actuel())return;\n      if(cdqFastUnlockV2511){',
    `    .withFailureHandler(function(){
      if(!actuel())return;
      if(window.cdqLocalProvisionalV2537){
        cdqArreterDelaiBiometrique();
        cdqBiometricRequestId="";cdqBiometricPending=false;cdqFastUnlockV2511=false;
        try{afficherMessage('Mode local actif — validation serveur en attente.',true);}catch(_){}
        return;
      }
      if(cdqFastUnlockV2511){`,
    'network failure keeps validated local ticket visible'
  );

  source=once(
    source,
    'function appliquerAccesAutorise(etat){\n  try{if(etat&&etat.email&&cdqObtenirJetonAppareil())localStorage.setItem(\'cdqLastUnlockEmailV2511\',String(etat.email));}catch(_){}',
    `function appliquerAccesAutorise(etat){
  const provisional=!!(etat&&etat.cdqLocalProvisionalV2537);
  window.cdqLocalProvisionalV2537=provisional;
  document.documentElement.dataset.cdqServerConfirmed=provisional?'0':'1';
  try{if(etat&&etat.email&&cdqObtenirJetonAppareil())localStorage.setItem('cdqLastUnlockEmailV2511',String(etat.email));}catch(_){}`,
    'provisional access state'
  );

  source=once(
    source,
    '  if(adminButton)adminButton.style.display=etat.role==="admin"?"block":"none";',
    '  if(adminButton)adminButton.style.display=!provisional&&etat.role==="admin"?"block":"none";',
    'hide admin during provisional'
  );
  source=once(
    source,
    '  if(headerAdminButton)headerAdminButton.style.display=etat.role==="admin"?"grid":"none";',
    '  if(headerAdminButton)headerAdminButton.style.display=!provisional&&etat.role==="admin"?"grid":"none";',
    'hide header admin during provisional'
  );
  source=once(
    source,
    '  utilisateurCourantRole=String(etat.role||"technicien").trim().toLowerCase();',
    '  utilisateurCourantRole=provisional?"lecture":String(etat.role||"technicien").trim().toLowerCase();',
    'read-only provisional role'
  );
  source=once(
    source,
    '  setTimeout(function(){if(cdqAccessState==="ready")nettoyerAncienCache();},3000);',
    '  if(!provisional)setTimeout(function(){if(cdqAccessState==="ready")nettoyerAncienCache();},3000);',
    'preserve cache while server pending'
  );

  source=once(
    source,
    'function cdqOpenSheetV2526(id){\n  id=String(id||\'\');',
    `function cdqOpenSheetV2526(id){
  if(window.cdqLocalProvisionalV2537){afficherMessage('Google Sheets sera disponible dès que le serveur aura confirmé la session.',true);return true;}
  id=String(id||'');`,
    'block Sheets until server confirmation'
  );

  source=once(
    source,
    'async function cdqExternalPdfV2520(id,preferred){\n  if(/BalanceCDQAndroid\\//.test(navigator.userAgent)&&window.cdqDocumentOpen){',
    `async function cdqExternalPdfV2520(id,preferred){
  if(window.cdqLocalProvisionalV2537){afficherMessage('Les lecteurs externes seront disponibles dès que le serveur aura confirmé la session.',true);return;}
  if(/BalanceCDQAndroid\\//.test(navigator.userAgent)&&window.cdqDocumentOpen){`,
    'block external PDF until server confirmation'
  );

  source=once(
    source,
    '    const m = meta(id), type = requestedKind || kind(m);\n    if (!type || !native()) return false;',
    `    const m = meta(id), type = requestedKind || kind(m);
    if (window.cdqLocalProvisionalV2537 && type==='note') { try{afficherMessage('Les fichiers distants seront disponibles dès que le serveur aura confirmé la session.',true);}catch(_){} return true; }
    if (!type || !native()) return false;`,
    'block native note handoff until server confirmation'
  );

  return source;
}
