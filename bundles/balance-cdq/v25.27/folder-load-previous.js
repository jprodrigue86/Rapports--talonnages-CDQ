  function cdqLoadFolderNode(folder,success,failure){
    if(!folder){ if(failure)failure(new Error("Dossier introuvable.")); return; }
    if(folder.charge !== false){ if(success)success(folder); return; }
    if(folder._cdqLoading) return;
    folder._cdqLoading=true;

    cdqApiRun()
      .withSuccessHandler(function(r){
        folder._cdqLoading=false;
        const loaded = r && r.contenu ? r.contenu : null;
        if(!loaded){ if(failure)failure(new Error("Contenu du dossier introuvable.")); return; }
        Object.keys(loaded).forEach(function(k){ folder[k]=loaded[k]; });
        folder.charge=true;
        cdqBuildFolderMaps(cdqRootContent);
        if(success)success(folder);
      })
      .withFailureHandler(function(e){
        folder._cdqLoading=false;
        if(failure)failure(e); else afficherErreur(e);
      })
      .obtenirContenuDossierParesseux(folder.id,compagnieSelectionnee||"");
  }

