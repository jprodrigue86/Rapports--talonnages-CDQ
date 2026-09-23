// Unmodified copy functions from the V25.18 Selector; no credentials or client data.
function cdqCreerCopiePwaHorsLigne(modeleId,destinationId,idClient,nomDestination,stableRequestId){
  if(!cdqPwaAvailable()){
    return Promise.reject(new Error("Le modèle hors ligne doit être préparé dans l’application Balance CDQ installée."));
  }
  const requestId=stableRequestId || "local_"+(crypto.randomUUID ? crypto.randomUUID() : (Date.now()+"_"+Math.random().toString(36).slice(2)));
  return new Promise(function(resolve,reject){
    let termine=false;
    const timer=setTimeout(function(){
      if(termine)return;termine=true;window.removeEventListener("message",recevoir);
      reject(new Error("Le stockage hors ligne n’a pas répondu. Reconnectez CDQ une fois pour préparer le modèle."));
    },12000);
    function recevoir(e){
      if(!cdqFromPwa(e))return;
      const d=e.data||{};
      if(d.type!=="CDQ_OFFLINE_CREATE_LOCAL_RESULT" || String(d.requestId||"")!==requestId)return;
      if(termine)return;termine=true;clearTimeout(timer);window.removeEventListener("message",recevoir);
      if(d.ok)resolve(d);
      else reject(new Error(d.message||"Impossible de créer la copie locale."));
    }
    window.addEventListener("message",recevoir);
    cdqPostToPwa({
      type:"CDQ_OFFLINE_CREATE_LOCAL",
      requestId:requestId,
      modeleId:String(modeleId||"camion"),
      clientId:String(idClient||""),
      folderId:String(destinationId||""),
      destinationName:String(nomDestination||"Dossier client")
    });
  });
}

async function confirmerCopie(){

  if(cdqCopieEnCours)return;

  const type = typeCopieEnAttente;
  const modeleId = type === "precision" || type === "camion" ? type : modeleCopieEnAttente;
  const nomModele = CDQ_MODELES_INTERMEDIAIRES[modeleId] || "Balance intermédiaire";
  const destinationId = cdqDestinationCreationId();
  const idClient = String(compagnieSelectionnee || "");

  const overlay=document.getElementById("copyModalOverlay");
  const statut=document.getElementById("copyModalStatus");
  const confirmer=overlay ? overlay.querySelector(".copy-confirm") : null;
  const annuler=overlay ? overlay.querySelector(".copy-cancel") : null;

  function setStatus(texte,classe){
    if(!statut)return;
    statut.textContent=texte||"";
    statut.className="copy-modal-status"+(classe?(" "+classe):"");
  }

  function setBusy(on){
    if(confirmer){
      confirmer.disabled=!!on;
      confirmer.textContent=on ? "Création…" : "Confirmer";
    }
    if(annuler)annuler.disabled=!!on;
    document.querySelectorAll('input[name="cdqModeleIntermediaire"]').forEach(function(input){input.disabled=!!on;});
  }

  if(!["intermediaire","precision","camion"].includes(type)){
    setStatus("Ce modèle vierge doit encore être configuré.","error");
    return;
  }

  if(!modeleId || !Object.prototype.hasOwnProperty.call(CDQ_MODELES_INTERMEDIAIRES,modeleId)){
    setStatus("Choisissez le PDF à ajouter.","error");
    return;
  }

  if(!idClient || !destinationId){
    setStatus("Choisissez d’abord une compagnie.","error");
    return;
  }

  const requestScope=[utilisateurCourantEmail,idClient,destinationId,modeleId].join(":");
  if(cdqCopieRequestScope!==requestScope || !cdqCopieRequestId){
    cdqCopieRequestScope=requestScope;cdqCopieRequestId="copy_"+crypto.randomUUID();
  }
  cdqCopieEnCours=true;
  setBusy(true);
  setStatus("Création : "+nomModele+"…","working");

  try{
    
    if(navigator.onLine === false){
      await window.cdqCopierTemplateHorsLigne(String(destinationId),idClient,modeleId,cdqCopieRequestId);
      cdqCopieRequestId="";cdqCopieRequestScope="";
      setStatus("PDF vierge créé hors ligne.","success");
      setTimeout(function(){ fermerCopie(); },700);
      return;
    }

    
    const resultat = await window.cdqAppelServeur("copierTemplateBalanceIntermediaire",[
      idClient,
      String(destinationId),
      modeleId,
      cdqCopieRequestId
    ]);

    if(!resultat || resultat.ok !== true){
      throw new Error(
        resultat && resultat.message
          ? resultat.message
          : "La copie du template n’a pas été confirmée par le serveur."
      );
    }

    
    
    
    
    

    cdqCopieRequestId="";cdqCopieRequestScope="";
    setStatus(
      "Copie créée : " + String(resultat.nom || "Balance intermédiaire.pdf"),
      "success"
    );

    afficherMessage(
      resultat.message || (nomModele+" créée : " + (resultat.nom || "PDF")),
      true
    );

    
    try{
      delete cacheContenuCompagnies[idClient];
      delete cacheDerniereVerificationCompagnies[idClient];
    }catch(e){}

    
    setTimeout(function(){
      fermerCopie();
    },700);

    
    Promise.resolve()
      .then(function(){return window.cdqAppelServeur("obtenirContenuClientOptimise",[idClient,true]);})
      .then(function(fresh){
        const contenu=fresh&&fresh.contenu?fresh.contenu:fresh;
        const verifiedAt=fresh&&fresh.genereLe?Number(fresh.genereLe):Date.now();
        if(contenu){
          cacheContenuCompagnies[idClient]=contenu;
          cacheDerniereVerificationCompagnies[idClient]=verifiedAt;
          sauvegarderCachePersistantClient(idClient,contenu,verifiedAt);
          if(String(compagnieSelectionnee)===idClient)afficherContenu(contenu);
        }
      })
      .catch(function(){
        try{actualiserCompagnieEnArrierePlan(idClient);}catch(e){}
      });

  }catch(erreur){
    console.error("Copie modèle de balance:",erreur);
    const texte =
      erreur && erreur.message
        ? erreur.message
        : String(erreur || "Erreur inconnue");

    setStatus(texte,"error");
    setBusy(false);
    afficherErreur(erreur);
  }finally{
    cdqCopieEnCours=false;
  }
}

const cdqTemplateLoads=new Map();
const cdqTemplateChecks=new Map();
const CDQ_TEMPLATE_META_TTL=5*60*1000;
function cdqV2112EnsureTemplateOfflineCached(showProgress,modeleId){
  const id=cdqModeleIntermediaireId(modeleId);
  const key=String(utilisateurCourantEmail||'')+'|'+id;
  if(cdqTemplateLoads.has(key))return cdqTemplateLoads.get(key);
  const work=cdqV2112EnsureTemplateOfflineCachedImpl(showProgress,id).finally(()=>cdqTemplateLoads.delete(key));
  cdqTemplateLoads.set(key,work);return work;
}
async function cdqV2112EnsureTemplateOfflineCachedImpl(showProgress,modeleId){
  modeleId=cdqModeleIntermediaireId(modeleId);
  const email=String(utilisateurCourantEmail||'');
  const sessionValide=()=>{
    if(!email || utilisateurCourantEmail!==email || cdqAccessState!=='ready')
      throw new Error('La session a changé. Reconnectez votre compte pour préparer les modèles.');
  };
  sessionValide();
  const checkKey=email+'|'+modeleId;
  const existant=await cdqV2112GetCachedTemplate(modeleId); sessionValide();
  const localValide=!!(existant && existant.revision===CDQ_TEMPLATE_REVISION && existant.blob instanceof Blob && existant.blob.size>0);
  if(!navigator.onLine)return localValide;
  // Une vérification serveur par session / cinq minutes, pas un nouveau PDF à chaque copie.
  if(localValide && Date.now()-(cdqTemplateChecks.get(checkKey)||0)<CDQ_TEMPLATE_META_TTL)return true;
  if(showProgress)cdqV19OfflineStatus("↻ Vérification du modèle PDF…","pending");
  const meta=await cdqV19Gs("obtenirMetaTemplateBalanceIntermediaireHorsLigne",[modeleId]); sessionValide();
  if(!meta || !meta.ok || !Number.isInteger(meta.chunks) || meta.chunks<1 || meta.chunks>32 ||
     !Number.isInteger(meta.chunkSize) || meta.chunkSize<1 || !Number.isInteger(meta.taille) ||
     meta.taille<5 || meta.taille>32*1024*1024 || meta.chunks!==Math.ceil(meta.taille/meta.chunkSize))
    throw new Error("Métadonnées du modèle PDF invalides ou indisponibles.");
  const memeFichier=!!(existant && existant.blob instanceof Blob && existant.blob.size===meta.taille &&
    String(existant.templateId||'')===String(meta.id||'') &&
    Number(existant.modifieLe||0)===Number(meta.modifieLe||0) &&
    String(existant.sha256||'')===String(meta.sha256||''));
  if(memeFichier){
    // Une nouvelle version de l'application ne force pas le transfert des PDF inchangés.
    if(existant.revision!==CDQ_TEMPLATE_REVISION){
      sessionValide();
      await cdqV19PutRecord('template-pdf',cdqTemplateRecord(modeleId),Object.assign({},existant,{revision:CDQ_TEMPLATE_REVISION}));
      sessionValide();
    }
    cdqTemplateChecks.set(checkKey,Date.now()); return true;
  }
  const morceaux=[];
  for(let i=0;i<meta.chunks;i++){
    sessionValide();
    if(showProgress)cdqV19OfflineStatus('↻ Modèle PDF '+(i+1)+'/'+meta.chunks,'pending');
    const part=await cdqV19Gs('obtenirChunkTemplateBalanceIntermediaireHorsLigne',[i,{id:meta.id,modifieLe:meta.modifieLe},modeleId]);
    sessionValide();
    if(!part || !part.ok || !part.base64)throw new Error('Bloc PDF '+(i+1)+' manquant.');
    const bytes=cdqV2112Base64ToBytes(part.base64);
    if(bytes.byteLength!==Math.min(meta.chunkSize,meta.taille-i*meta.chunkSize))throw new Error('Bloc PDF incomplet.');
    morceaux.push(bytes);
  }
  const blob=new Blob(morceaux,{type:'application/pdf'});
  if(blob.size!==meta.taille || (await blob.slice(0,5).text())!=='%PDF-')throw new Error('Le modèle PDF reçu est incomplet ou invalide.');
  if(meta.sha256){
    const digest=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());
    const hex=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
    if(hex!==meta.sha256)throw new Error('Le modèle reçu diffère du modèle approuvé.');
  }
  sessionValide();
  await cdqV19PutRecord('template-pdf',cdqTemplateRecord(modeleId),{
    templateType:modeleId,revision:CDQ_TEMPLATE_REVISION,templateId:String(meta.id||''),sha256:String(meta.sha256||''),
    blob:blob,nom:String(meta.nom||'Modèle CDQ.pdf'),taille:blob.size,modifieLe:Number(meta.modifieLe||0),cachedAt:Date.now()
  });
  sessionValide(); cdqTemplateChecks.set(checkKey,Date.now()); return true;
}

async function cdqV2112CreerCopieLocaleTemplate(destinationId,idClient,modeleId,requestId){
  if(cdqPwaAvailable()){
    return cdqCreerCopiePwaHorsLigne(modeleId,destinationId,idClient,nomCompagnieSelectionnee+(cdqDossierOuvertId?' / '+(cdqDossierOuvertNom||'Dossier ouvert'):''),requestId);
  }
  modeleId=cdqModeleIntermediaireId(modeleId);
  const rec=await cdqV2112GetCachedTemplate(modeleId);
  if(!rec || rec.revision!==CDQ_TEMPLATE_REVISION || !(rec.blob instanceof Blob) || !rec.blob.size){
    throw new Error(
      "Le modèle "+CDQ_MODELES_INTERMEDIAIRES[modeleId]+" n’est pas encore enregistré sur ce téléphone. "+
      "Reconnectez-vous une fois, activez Hors ligne ON, puis réessayez."
    );
  }

  const nom=cdqV2112NomCopieLocale(modeleId);
  const blobTechnicien=await cdqPersonnaliserBlobTechnicienPdf(rec.blob);
  const url=URL.createObjectURL(blobTechnicien);
  const a=document.createElement("a");
  a.href=url;
  a.download=nom;
  a.style.display="none";
  document.body.appendChild(a);
  a.click();
  setTimeout(function(){
    try{URL.revokeObjectURL(url);}catch(e){}
    try{a.remove();}catch(e){}
  },3000);

  // Mémorise le dossier visé. Au retour du réseau, une copie vierge
  // correspondante sera créée dans Drive.
  await cdqV19QueueAdd({
    kind:"template-copy",
    templateType:"intermediaire",
    modeleId:modeleId,
    idCompagnie:String(idClient||compagnieSelectionnee||""),
    dossierDestinationId:String(destinationId||idClient||compagnieSelectionnee||""),
    localName:nom
  });

  afficherMessage(
    "PDF vierge disponible hors ligne. Une copie sera créée dans Drive au retour d’Internet.",
    true
  );
  return true;
}


window.cdqCopierTemplateHorsLigne=cdqV2112CreerCopieLocaleTemplate;
