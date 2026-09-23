  function cdqEnhanceFileSwipe(row,file){
    if(!row)return;
    if(isWindows()){
      cdqInstallDesktopFileActions(row,file);
      return;
    }
    if(row.dataset.cdqSwipe==="1") return; row.dataset.cdqSwipe="1";
    const left=document.createElement("div"); left.className="cdq-swipe-overlay left";
    const note=cdqSwipeButton("🗒 Note","note",function(e){e.stopPropagation();cdqCloseSwipes();ouvrirNoteFichier(file);});
    const photo=cdqSwipeButton("📷 Photo","photo",function(e){e.stopPropagation();cdqCloseSwipes();ouvrirPhotosCible("fichier",file.id,file.nom||"Rapport");});
    const rename=cdqSwipeButton("✏️","rename",function(e){e.stopPropagation();cdqCloseSwipes();renommerFichier(file);});
    const del=cdqSwipeButton("🗑","delete",function(e){e.stopPropagation();cdqCloseSwipes();cdqSelectOnly(row);ouvrirConfirmationSuppression();});
    left.append(note,photo,rename,del);
    const right=document.createElement("div"); right.className="cdq-swipe-overlay right";
    const fav=cdqSwipeButton(file.favori?"★ Retirer":"★ Favori","favorite",function(e){e.stopPropagation();cdqToggleFileFavorite(file,row,fav);});
    const send=cdqSwipeButton("Envoyer","send",function(e){e.stopPropagation();cdqCloseSwipes();cdqSelectOnly(row);ouvrirConfirmation();});
    if(window.cdqCopyV2522?.authorized())right.append(window.cdqCopyV2522.swipeButton({...file,kind:'file'}));right.append(fav,send); row.append(left,right);

    cdqInstallSwipeGesture(row);
  }
function cdqEnhanceFolderSwipe(row,folder,isDesktop){
    if(!row)return;
    if(isDesktop || isWindows()){
      cdqInstallDesktopFolderActions(row,folder);
      cdqInstallFolderInteractions(row,folder);
      return;
    }
    if(row.dataset.cdqFolderSwipe==="1") return;
    row.dataset.cdqFolderSwipe="1";
    row.dataset.favorite=folder.favori?"1":"0";
    row.dataset.folderSelectId=String(folder.id||"");
    row.classList.toggle("selected",dossiersSelectionnes.has(String(folder.id||"")));

    const left=document.createElement("div"); left.className="cdq-swipe-overlay left";
    const note=cdqSwipeButton("🗒 Note","note",function(e){e.stopPropagation();cdqCloseSwipes();ouvrirNoteDossier(folder);});
    const photo=cdqSwipeButton("📷 Photo","photo",function(e){e.stopPropagation();cdqCloseSwipes();ouvrirPhotosCible("dossier",folder.id,folder.nom||"Dossier");});
    const rename=cdqSwipeButton("✏️","rename",function(e){e.stopPropagation();cdqCloseSwipes();renommerDossierDepuisInterface(folder);});
    const del=cdqSwipeButton("🗑","delete",function(e){e.stopPropagation();cdqCloseSwipes();ouvrirConfirmationSuppressionDossier(folder.id,folder.nom);});
    left.append(note,photo,rename,del);

    const right=document.createElement("div"); right.className="cdq-swipe-overlay right";
    const fav=cdqSwipeButton(folder.favori?"★ Retirer":"★ Favori","favorite",function(e){e.stopPropagation();cdqToggleFolderFavorite(folder,fav);});
    if(window.cdqCopyV2522?.authorized())right.appendChild(window.cdqCopyV2522.swipeButton({...folder,kind:'folder'}));right.appendChild(fav);

    if(cdqIsOwner()){
      const protect=cdqSwipeButton(folder.protege?"🔓 Déprotéger":"🔒 Protéger","protect"+(folder.protege?" active":""),function(e){
        e.stopPropagation();
        cdqToggleFolderProtection(folder,protect);
      });
      right.appendChild(protect);
    }

    row.append(left,right);
    cdqInstallFolderInteractions(row,folder);
  }

  
