// Inside cdqV19Features: the template cache belongs to this closure.
async function cdqEnsureEmbeddedFloorV2521(){
  const email=String(utilisateurCourantEmail||'');
  const valid=()=>{if(!email||email!==String(utilisateurCourantEmail||'')||cdqAccessState!=='ready')throw Error('Déverrouillez votre compte pour utiliser le modèle.');};
  valid();const t=await window.cdqFloorTemplateV2519();valid();
  const old=await cdqV2112GetCachedTemplate('plancher');valid();
  if(!old||old.templateId!==t.templateId||old.sha256!==t.sha256||!(old.blob instanceof Blob)||old.blob.size!==t.taille){
    await cdqV19PutRecord('template-pdf',cdqTemplateRecord('plancher'),{...t,templateType:'plancher',nom:t.name,revision:CDQ_TEMPLATE_REVISION,cachedAt:Date.now()});valid();
  }
  return true;
}
window.cdqEnsureFloorV2519=cdqEnsureEmbeddedFloorV2521;
window.cdqEmbeddedFloorBridgeV2521={warm:async function(){
  if(cdqAccessState!=='ready')return;
  const email=String(utilisateurCourantEmail||'');
  try{
    await cdqEnsureEmbeddedFloorV2521();const t=await window.cdqFloorTemplateV2519();
    if(cdqAccessState!=='ready'||email!==String(utilisateurCourantEmail||''))return;
    cdqPublierSessionHorsLigne();
    cdqPostToPwa({...t,type:'CDQ_OFFLINE_TEMPLATE',email,revision:CDQ_TEMPLATE_REVISION});
  }catch(e){console.warn('Modèle intégré :',e.message||String(e));}
}};
