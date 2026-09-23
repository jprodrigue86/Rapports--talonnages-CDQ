function actualiserCompagnieEnArrierePlan(idCompagnie){
  idCompagnie = String(idCompagnie || "");
  if(!idCompagnie || rafraichissementsEnCours[idCompagnie]) return;

  const owner=String(utilisateurCourantEmail||'');
  rafraichissementsEnCours[idCompagnie] = true;

  cdqApiRun()
    .withSuccessHandler(function(resultat){
      delete rafraichissementsEnCours[idCompagnie];
      if(cdqAccessState!=='ready'||owner!==String(utilisateurCourantEmail||''))return;

      let contenu = resultat && resultat.contenu ? resultat.contenu : resultat;
      const verifiedAt = resultat && resultat.genereLe ? Number(resultat.genereLe) : Date.now();
      if(!contenu) return;

      const ancien = cacheContenuCompagnies[idCompagnie];
      const before=signatureContenuCache(ancien);
      if(window.cdqMergeClientV2527)contenu=window.cdqMergeClientV2527(ancien,contenu);
      const change=before!==signatureContenuCache(contenu);

      cacheContenuCompagnies[idCompagnie] = contenu;
      cacheDerniereVerificationCompagnies[idCompagnie] = verifiedAt;
      sauvegarderCachePersistantClient(idCompagnie,contenu,verifiedAt);

      if(change && String(compagnieSelectionnee) === idCompagnie){
        afficherContenu(contenu);
      }
    })
    .withFailureHandler(function(erreur){
      delete rafraichissementsEnCours[idCompagnie];
      console.log("Actualisation arrière-plan :",erreur);
    })
    .actualiserContenuClient(idCompagnie);
}



