async function cdqV19GetOfflineState(comp){
  const m=comp&&comp.id?await cdqV19GetRecord('documents-manifest',String(comp.id)):null;
  return {ready:!!(m&&m.completed),manifest:m,templateReady:false};
}
async function cdqV19RefreshOfflineClientStatus(comp){
  const s=await cdqV19GetOfflineState(comp),m=s.manifest;
  cdqV19OfflineStatus(m?'Documents : '+Number(m.pdfReady||0)+' PDF prêts':'Préparer hors ligne',m&&m.completed?'ready':'pending',comp&&comp.id);return s.ready;
}
async function cdqV19PrepareClientOffline(comp){
  if(!comp||!comp.id)return false;
  const id=String(comp.id),o=cdqV19CreateModal('cdqDocumentPrepare','Documents hors ligne — '+(comp.nom||'Client'),'cdq-v19-offline-modal');
  const b=o.querySelector('.cdq-v19-body');b.innerHTML='';o.style.display='flex';
  if(cdqPwaAvailable())cdqDocumentButton(b,'Documents en attente sur cet appareil',()=>cdqPostToPwa({type:'CDQ_OFFLINE_SHOW_LOCAL'}));
  const info=cdqDocumentText(b,'Préparation…');
  try{
    let manifest;
    if(navigator.onLine){
      manifest=await cdqV19Gs('obtenirManifestHorsLigneClient',[id]);
      // Préparer uniquement le modèle Balance de Plancher quand l'utilisateur
      // demande explicitement le mode hors ligne.
      try{await cdqV2112EnsureTemplateOfflineCached(true,'plancher');}catch(e){console.warn('Préparation Balance de Plancher hors ligne :',e);}
    }else{const old=await cdqV19GetRecord('documents-manifest',id);manifest=old&&old.manifest;}
    if(!manifest)throw new Error('Préparez les documents de ce client pendant que vous avez Internet.');
    const files=manifest.fichiers||[];let ready=0,failed=0,sheets=0;
    for(const f of files){
      if(f.type==='PDF'){
        try{await cdqEnsurePdf(f.id,true);ready++;cdqDocumentButton(b,'PDF : '+f.nom,function(){cdqOpenPdf(f.id);});}
        catch(e){failed++;cdqDocumentText(b,f.nom+' — '+(e.message||e));}
      }else if(f.type==='GOOGLE_SHEETS'){
        sheets++;cdqDocumentLink(b,'Sheets : '+f.nom,cdqSheetAppUrl(f.id));
      }
      info.textContent='PDF prêts : '+ready+' • Feuilles à préparer dans Sheets : '+sheets;
    }
    if(!files.length)info.textContent='Aucun PDF ou Google Sheets dans ce client.';
    cdqDocumentText(b,'Pour chaque feuille : ouvrez Google Sheets → ⋮ → Disponible hors connexion. CDQ ne peut pas vérifier cette préparation. Pour les PDF : ouvrez chacun avec votre lecteur et enregistrez-le sur le téléphone.');
    cdqDocumentText(b,'Sans réseau au démarrage, ouvrez les fichiers directement dans Google Sheets ou votre lecteur PDF. Conservez le PDF rempli jusqu’à son retour dans CDQ.');
    await cdqV19PutRecord('documents-manifest',id,{manifest:manifest,completed:failed===0,pdfReady:ready,sheets:sheets,failed:failed});
    await cdqV19RefreshOfflineClientStatus(comp);return !failed;
  }catch(e){info.textContent=e.message||String(e);return false;}
}
async function cdqV19ToggleClientOffline(){
  if(cdqV19OfflineToggleRunning)return;
  if(!compagnieSelectionnee){alert('Choisissez d’abord une compagnie.');return;}
  const comp=(toutesLesCompagnies||[]).find(c=>String(c.id)===String(compagnieSelectionnee))||{id:String(compagnieSelectionnee),nom:nomCompagnieSelectionnee||'Client'};
  cdqV19OfflineToggleRunning=true;
  try{await cdqV19PrepareClientOffline(comp);}finally{cdqV19OfflineToggleRunning=false;await cdqV19RefreshOfflineClientStatus(comp);}
}
window.cdqPreparerClientHorsLigne=cdqV19PrepareClientOffline;
window.cdqBasculerModeHorsLigne=cdqV19ToggleClientOffline;