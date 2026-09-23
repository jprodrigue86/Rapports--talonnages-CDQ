function afficherDossierRecursif(dossier, parent){
  if(dossier.fichiers && dossier.fichiers.length){
    dossier.fichiers.forEach(function(fichier){
      parent.appendChild(creerLigneFichier(fichier));
    });
  }

  if(dossier.dossiers && dossier.dossiers.length){
    dossier.dossiers.forEach(function(sousDossier){
      const folder = document.createElement("div");
      folder.className = "folder";
      folder.dataset.folderId = String(sousDossier.id || "");
      folder.dataset.hasNote = sousDossier.notePresente ? "1" : "0";

      const header = document.createElement("div");
      header.className = "folder-header";

      const nom = document.createElement("span");
      nom.className = "folder-name";
      const nomDossierTexte = document.createElement("span");
      nomDossierTexte.className = "folder-name-text";
      nomDossierTexte.textContent = "📁 " + sousDossier.nom;
      nom.appendChild(nomDossierTexte);

      const noteBadgeDossier = document.createElement("span");
      noteBadgeDossier.className = "note-presence-badge";
      noteBadgeDossier.title = "Ce dossier contient une note";
      noteBadgeDossier.setAttribute("aria-label","Ce dossier contient une note");
      noteBadgeDossier.hidden = !sousDossier.notePresente;
      nom.appendChild(noteBadgeDossier);

      const photoBadgeDossier = cdqCreerBadgePhoto('dossier',sousDossier.id,sousDossier.nom||'Dossier',!!sousDossier.photoPresente);
      nom.appendChild(photoBadgeDossier);

      header.appendChild(nom);

      const actionsDossier = document.createElement("div");
      actionsDossier.className = "folder-header-actions";

      const arrow = document.createElement("span");
      arrow.className = "folder-arrow";
      arrow.textContent = "▶";
      actionsDossier.appendChild(arrow);
      header.appendChild(actionsDossier);

      const contenu = document.createElement("div");
      contenu.className = "folder-content";

      header.onclick = function(){
        const vaOuvrir = !folder.classList.contains("open");
        if(sousDossier && sousDossier.charge === false && typeof window.cdqLazyOpenFolder === "function"){
          cdqDossierOuvertId = String(sousDossier.id || "");
          cdqDossierOuvertNom = String(sousDossier.nom || "");
          window.cdqLazyOpenFolder(sousDossier,folder,contenu);
          return;
        }
        folder.classList.toggle("open");
        if(vaOuvrir){
          cdqDossierOuvertId = String(sousDossier.id || "");
          cdqDossierOuvertNom = String(sousDossier.nom || "");
        }else if(String(cdqDossierOuvertId || "") === String(sousDossier.id || "")){
          cdqDossierOuvertId = null;
          cdqDossierOuvertNom = "";
        }
        mettreAJourInterface();
      };

      folder.appendChild(header);
      folder.appendChild(contenu);
      parent.appendChild(folder);
      afficherDossierRecursif(sousDossier, contenu);
    });
  }
}






  window.cdqLazyOpenFolder=function(folder,folderEl,contentEl){
    if(!folderEl || !contentEl) return;
    folderEl.classList.add("cdq-folder-loading");
    cdqLoadFolderNode(folder,function(){
      folderEl.classList.remove("cdq-folder-loading");
      contentEl.innerHTML="";
      afficherDossierRecursif(folder,contentEl);
      folderEl.classList.add("open");
      cdqEnhanceMobileFolders();
      appliquerFiltresFichiers();
      mettreAJourInterface();
      cdqSchedulePhotoPresenceRefresh();
    },function(e){
      folderEl.classList.remove("cdq-folder-loading");
      afficherErreur(e);
    });
  };

  
