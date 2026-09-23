function chargerClients(forceRefresh){
  const forcer = !!forceRefresh;
  let cacheAffiche = false;

  function appliquerListe(compagnies){
    toutesLesCompagnies = (compagnies || []).slice();
    toutesLesCompagnies.sort(function(a,b){
      return String(a.nom||"").localeCompare(String(b.nom||""),"fr",{sensitivity:"base"});
    });
    remplirListeCompagnies();
  }

  function chargerDepuisServeur(forcerServeur){
    cdqApiRun()
      .withSuccessHandler(function(compagnies){
        appliquerListe(compagnies || []);
        sauvegarderCachePersistantCompagnies(toutesLesCompagnies);
      })
      .withFailureHandler(function(erreur){
        // Si le cache local est déjà affiché, on ne bloque pas l'application.
        if(cacheAffiche){
          console.log("Actualisation compagnies :",erreur);
        }else{
          afficherErreur(erreur);
        }
      })
      .obtenirDossiersClients(!!forcerServeur);
  }

  lireCachePersistantCompagnies()
    .then(function(enregistrement){
      if(enregistrement && Array.isArray(enregistrement.compagnies) && !forcer){
        cacheAffiche = true;
        appliquerListe(enregistrement.compagnies);
        // La liste locale apparaît tout de suite, puis Drive est vérifié silencieusement.
        planifierTravailSilencieux(function(){ chargerDepuisServeur(true); });
      }else{
        chargerDepuisServeur(forcer);
      }
    })
    .catch(function(){
      chargerDepuisServeur(forcer);
    });
}


