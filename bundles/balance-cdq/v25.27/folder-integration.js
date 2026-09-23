  const cdqFoldersV2527=cdqCreateFolderLoaderV2527({
    root:()=>cdqRootContent,client:()=>compagnieSelectionnee,
    owner:()=>String(utilisateurCourantEmail||''),
    allowed:()=>cdqAccessState==='ready'&&!!compagnieSelectionnee&&cacheContenuCompagnies[String(compagnieSelectionnee)]===cdqRootContent,
    hidden:()=>document.hidden,offline:()=>navigator.onLine===false,
    request:(id,client)=>new Promise((resolve,reject)=>{
      let finished=false;
      const timer=setTimeout(()=>{finished=true;reject(new Error('Le dossier met trop de temps à répondre. Réessayez.'));},30000);
      const finish=fn=>value=>{if(finished)return;finished=true;clearTimeout(timer);fn(value);};
      try{cdqApiRun().withSuccessHandler(finish(resolve)).withFailureHandler(finish(reject)).obtenirContenuDossierParesseux(id,client);}
      catch(error){finish(reject)(error);}
    }),
    loaded:root=>{
      cdqBuildFolderMaps(root);
      sauvegarderCachePersistantClient(compagnieSelectionnee,root,cacheDerniereVerificationCompagnies[String(compagnieSelectionnee)]||0);
    }
  });
  window.cdqMergeClientV2527=function(previous,next){
    if(!previous)return next;
    const merged=cdqFoldersV2527.merge(previous,next);
    if(previous===cdqRootContent)cdqBuildFolderMaps(merged);
    return merged;
  };
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)cdqFoldersV2527.plan(cdqRootContent);});
  window.addEventListener('cdq:access-state-v2527',event=>{if(event.detail!=='ready')cdqFoldersV2527.invalidate();});

  function cdqLoadFolderNode(folder,success,failure){
    cdqFoldersV2527.load(folder).then(function(loaded){
      if(success)success(loaded);
      cdqFoldersV2527.plan(loaded);
    }).catch(function(error){if(failure)failure(error);else afficherErreur(error);});
  }
