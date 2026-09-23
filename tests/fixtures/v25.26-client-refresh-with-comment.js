function actualiserCompagnieEnArrierePlan(idCompagnie){
  idCompagnie = String(idCompagnie || "");
  if(!idCompagnie || rafraichissementsEnCours[idCompagnie]) return;

  rafraichissementsEnCours[idCompagnie] = true;

  cdqApiRun()
    .withSuccessHandler(function(resultat){
      delete rafraichissementsEnCours[idCompagnie];

      const contenu = resultat && resultat.contenu ? resultat.contenu : resultat;
      const verifiedAt = resultat && resultat.genereLe ? Number(resultat.genereLe) : Date.now();
      if(!contenu) return;

      const ancien = cacheContenuCompagnies[idCompagnie];
      const change = signatureContenuCache(ancien) !== signatureContenuCache(contenu);

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

/* =====================================================
   RECUPERER FICHIER MODIFICATION
===================================================== */

