function cdqOpenDisplaySettings(){
    const m=document.getElementById("cdqDisplayModal");
    const body=m.querySelector(".cdq-modal-body");
    const currentGeneral=cdqGeneralValueV89();
    const currentTextScale=cdqTextValueV89();
    const currentIconScale=cdqIconValueV89();
    const currentTheme=localStorage.getItem("cdqTheme") || (document.body.classList.contains("light")?"light":"dark");
    const currentLong=String(localStorage.getItem("cdqLongPressMs")||"1000");
    const currentSwipe=localStorage.getItem("cdqSwipeSensitivity")||"normal";
    const currentPdfReader=localStorage.getItem("cdqPdfReaderPreferenceV1")||"ask";

    const adminSection=utilisateurCourantRole==="admin"
      ? '<div class="cdq-display-group"><div class="cdq-display-label">Administration</div>'+
          '<button id="cdqAdminSettingsButton" type="button" class="cdq-admin-settings-button"><span>👑</span><span><strong>Gestion des utilisateurs</strong><small>Administrateur, technicien ou lecture seule</small></span></button>'+
          '<button id="cdqDiagnosticSettingsButton" type="button" class="cdq-admin-settings-button"><span>🩺</span><span><strong>Diagnostic de l’application</strong><small>Versions, cache, Drive et état de connexion</small></span></button>'+
        '</div>'
      : '';

    body.innerHTML=
      '<div class="cdq-display-options">'+
        '<div class="cdq-display-group"><div class="cdq-display-label">Thème</div>'+
          '<div class="cdq-theme-grid">'+
            '<button type="button" data-theme="dark">Sombre CDQ</button>'+
            '<button type="button" data-theme="light">Clair</button>'+
            '<button type="button" data-theme="metal">Métal noir</button>'+
            '<button type="button" data-theme="electric">Bleu électrique</button>'+
            '<button type="button" data-theme="steel">Acier</button>'+
            '<button type="button" data-theme="violet">Violet néon</button>'+
          '</div>'+
        '</div>'+
        '<div class="cdq-display-group"><div class="cdq-display-label">Ajustement de l’affichage</div>'+
          '<div class="cdq-ui-scale-box">'+
            '<div class="cdq-ui-scale-head"><strong>Interface générale</strong><span id="cdqGeneralScaleValue" class="cdq-ui-scale-value">'+currentGeneral+' / 100</span></div>'+
            '<input id="cdqGeneralScaleRange" class="cdq-ui-scale-range" type="range" min="0" max="100" step="1" value="'+currentGeneral+'">'+
            '<div class="cdq-ui-scale-ticks"><span>0 · compact</span><span>50 · standard</span><span>75 · ancien 100</span><span>100 · extra</span></div>'+
            '<div class="cdq-ui-scale-note">Ajuste la densité générale, la hauteur et les espacements. La largeur reste toujours verrouillée dans l’écran. À 50, la taille standard reste inchangée.</div>'+
          '</div>'+
          '<div class="cdq-ui-scale-box" style="margin-top:10px">'+
            '<div class="cdq-ui-scale-head"><strong>Texte</strong><span id="cdqTextScaleValue" class="cdq-ui-scale-value">'+currentTextScale+' / 100</span></div>'+
            '<input id="cdqTextScaleRange" class="cdq-ui-scale-range" type="range" min="0" max="100" step="1" value="'+currentTextScale+'">'+
            '<div class="cdq-ui-scale-ticks"><span>Petit</span><span>50 · standard</span><span>Grand</span></div><div class="cdq-ui-scale-note">Ajuste aussi les noms des dossiers, balances, PDF, Google Sheets et rapports.</div>'+
          '</div>'+
          '<div class="cdq-ui-scale-box" style="margin-top:10px">'+
            '<div class="cdq-ui-scale-head"><strong>Icônes</strong><span id="cdqIconScaleValue" class="cdq-ui-scale-value">'+currentIconScale+' / 100</span></div>'+
            '<input id="cdqIconScaleRange" class="cdq-ui-scale-range" type="range" min="0" max="100" step="1" value="'+currentIconScale+'">'+
            '<div class="cdq-ui-scale-ticks"><span>Petites</span><span>50 · standard</span><span>Grandes</span></div>'+
            '<div class="cdq-ui-scale-note">Ajuste notamment les icônes de navigation, dossiers, fichiers et raccourcis.</div>'+
          '</div>'+
          '<button id="cdqUiScaleResetAll" type="button" class="cdq-ui-scale-reset">Remettre les trois réglages à 50</button>'+
        '</div>'+
        '<div class="cdq-display-group"><div class="cdq-display-label">Gestes</div>'+
          '<div class="cdq-setting-row"><span>Appui long</span><div class="cdq-setting-buttons"><button data-long="700">0,7 s</button><button data-long="1000">1,0 s</button><button data-long="1300">1,3 s</button></div></div>'+
          '<div class="cdq-setting-row"><span>Glissement</span><div class="cdq-setting-buttons"><button data-swipe="souple">Souple</button><button data-swipe="normal">Normal</button><button data-swipe="ferme">Ferme</button></div></div>'+
        '</div>'+
        '<div class="cdq-display-group"><div class="cdq-display-label">Lecteur PDF par défaut</div>'+
          '<div class="cdq-setting-buttons"><button data-pdf-reader="ask">Demander</button><button data-pdf-reader="cdq">Lecteur CDQ</button><button data-pdf-reader="ilovepdf">iLovePDF</button><button data-pdf-reader="acrobat">Acrobat</button></div>'+
          '<div class="cdq-v20-note">Le choix est enregistré seulement sur cet appareil. Android affichera uniquement les applications PDF compatibles installées.</div>'+
        '</div>'+
        '<div class="cdq-display-group"><div class="cdq-display-label">Mise à jour</div>'+
          '<div class="cdq-update-center">'+
            '<div class="cdq-update-line"><strong>Version installée</strong><span id="cdqUpdateInstalled">'+cdqVersionLabelV87(CDQ_BUILD)+'</span></div>'+
            '<div class="cdq-update-line"><strong>Version disponible</strong><span id="cdqUpdateLatest">—</span></div>'+
            '<div class="cdq-update-line"><strong>État</strong><span id="cdqUpdateStatus" class="cdq-update-state checking">Vérification en cours…</span></div>'+
            '<div class="cdq-update-help">Le bouton Installer applique la dernière version publiée. Un seul redémarrage peut demander la biométrie une fois.</div>'+
            '<div class="cdq-update-actions"><button type="button" id="cdqCheckUpdateButton">Vérifier maintenant</button><button type="button" id="cdqInstallUpdateButton" disabled>Déjà à jour</button></div>'+
          '</div>'+
        '</div>'+
        adminSection+
      '</div>';

    body.querySelectorAll("[data-theme]").forEach(function(b){
      b.classList.toggle("active",b.dataset.theme===currentTheme);
      b.onclick=function(){cdqApplyTheme(b.dataset.theme);body.querySelectorAll("[data-theme]").forEach(function(x){x.classList.toggle("active",x===b);});};
    });
    function bindScaleV89(rangeId,valueId,applyFn,zoomFn){
      const range=body.querySelector(rangeId),value=body.querySelector(valueId);
      if(!range)return;
      function update(save){
        const v=cdqClampScaleV89(range.value);
        if(value)value.textContent=v+" / 100";
        cdqMarkDisplayLocalEditV2212();
        applyFn(v,!save);
        if(save){
          cdqSaveDisplayPreferencesNowV2212();
        }
      }
      range.oninput=function(){update(false)};
      range.onchange=function(){update(true)};
    }

    // Interface générale : valeur pendant glissement, application au relâchement.
    const generalRange=body.querySelector("#cdqGeneralScaleRange");
    const generalValue=body.querySelector("#cdqGeneralScaleValue");
    if(generalRange){
      const beginGeneral=function(){
        window.__cdqGeneralScaleDraggingV2211=true;
        cdqMarkDisplayLocalEditV2212();
      };
      generalRange.onpointerdown=beginGeneral;
      generalRange.ontouchstart=beginGeneral;

      generalRange.oninput=function(){
        const v=cdqClampScaleV89(generalRange.value);
        if(generalValue)generalValue.textContent=v+" / 100";
        cdqApplyGeneralScaleV89(v,true);
        cdqDetachBottomNavV96();
        cdqMarkDisplayLocalEditV2212();
      };

      const commitGeneral=function(){
        const v=cdqClampScaleV89(generalRange.value);
        window.__cdqGeneralScaleDraggingV2211=false;
        cdqMarkDisplayLocalEditV2212();
        localStorage.setItem("cdqUiGeneralScaleV89",String(v));
        localStorage.setItem("cdqUiScaleV86",String(v));
        if(generalValue)generalValue.textContent=v+" / 100";
        cdqApplyGeneralScaleV89(v,true);
        cdqSaveDisplayPreferencesNowV2212();
        // Une seule réapplication après stabilisation des dimensions Android.
        setTimeout(function(){
          if(!window.__cdqGeneralScaleDraggingV2211)cdqFitGeneralScaleV92(v);
        },180);
      };

      generalRange.onchange=commitGeneral;
      generalRange.onpointerup=commitGeneral;
      generalRange.ontouchend=commitGeneral;
      generalRange.onkeyup=function(e){
        if(e.key==="ArrowLeft"||e.key==="ArrowRight"||e.key==="Home"||e.key==="End"){
          commitGeneral();
        }
      };
    }

    const textRange=body.querySelector("#cdqTextScaleRange");
    if(textRange){
      const textValueLabel=body.querySelector("#cdqTextScaleValue");

      const beginText=function(){
        window.__cdqDisplaySliderDraggingV2217=true;
        window.__cdqAutoFitSuppressedUntilV2217=Date.now()+1200;
      };
      const applyText=function(save){
        const v=cdqClampScaleV89(textRange.value);
        if(textValueLabel)textValueLabel.textContent=v+" / 100";
        cdqMarkDisplayLocalEditV2212();
        cdqApplyTextScaleV89(v,!save);
        if(save)cdqSaveDisplayPreferencesNowV2212();
      };
      const endText=function(){
        applyText(true);
        window.__cdqDisplaySliderDraggingV2217=false;
        // Text changes may reflow rows for a moment. They are not allowed
        // to modify the global interface scale.
        window.__cdqAutoFitSuppressedUntilV2217=Date.now()+2500;
      };

      textRange.onpointerdown=beginText;
      textRange.ontouchstart=beginText;
      textRange.oninput=function(){applyText(false);};
      textRange.onchange=endText;
      textRange.onpointerup=endText;
      textRange.ontouchend=endText;
    }

    // Icons never trigger general auto-fit.
    const iconRange=body.querySelector("#cdqIconScaleRange");
    const iconValueLabel=body.querySelector("#cdqIconScaleValue");
    if(iconRange){
      const applyIcons=function(save){
        const v=cdqClampScaleV89(iconRange.value);
        cdqMarkDisplayLocalEditV2212();
        localStorage.setItem("cdqUiIconScaleV89",String(v));
        if(iconValueLabel)iconValueLabel.textContent=v+" / 100";

        if(typeof window.cdqApplyVisibleIconScaleV2208==="function"){
          window.cdqApplyVisibleIconScaleV2208(v);
        }

        if(save){
          cdqSaveDisplayPreferencesNowV2212();
          if(typeof cdqScheduleSavePreferencesV72==="function")cdqScheduleSavePreferencesV72();
        }
      };

      const beginIcons=function(){
        window.__cdqDisplaySliderDraggingV2217=true;
        window.__cdqAutoFitSuppressedUntilV2217=Date.now()+1500;
      };
      const endIcons=function(){
        applyIcons(true);
        window.__cdqDisplaySliderDraggingV2217=false;
        // Icon-only changes never modify the global interface zoom.
        window.__cdqAutoFitSuppressedUntilV2217=Date.now()+2500;
      };

      iconRange.onpointerdown=beginIcons;
      iconRange.ontouchstart=beginIcons;
      iconRange.oninput=function(){applyIcons(false);};
      iconRange.onchange=endIcons;
      iconRange.onpointerup=endIcons;
      iconRange.ontouchend=endIcons;
    }
    const resetScales=body.querySelector("#cdqUiScaleResetAll");
    if(resetScales)resetScales.onclick=function(){
      if(typeof window.cdqResetDisplayScalesV2208==="function"){
        window.cdqResetDisplayScalesV2208();
        return;
      }
      const g=body.querySelector("#cdqGeneralScaleRange");
      const t=body.querySelector("#cdqTextScaleRange");
      const i=body.querySelector("#cdqIconScaleRange");
      if(g)g.value="50";if(t)t.value="50";if(i)i.value="50";
      cdqApplyGeneralScaleV89(50,true);cdqApplyTextScaleV89(50,true);cdqApplyIconScaleV89(50,true);
      const gv=body.querySelector("#cdqGeneralScaleValue"),tv=body.querySelector("#cdqTextScaleValue"),iv=body.querySelector("#cdqIconScaleValue");
      if(gv)gv.textContent="50 / 100";if(tv)tv.textContent="50 / 100";if(iv)iv.textContent="50 / 100";
      cdqScheduleSavePreferencesV72();
    };
    body.querySelectorAll("[data-long]").forEach(function(b){
      b.classList.toggle("active",b.dataset.long===currentLong);
      b.onclick=function(){cdqSetLongPress(b.dataset.long);body.querySelectorAll("[data-long]").forEach(function(x){x.classList.toggle("active",x===b);});};
    });
    body.querySelectorAll("[data-swipe]").forEach(function(b){
      b.classList.toggle("active",b.dataset.swipe===currentSwipe);
      b.onclick=function(){cdqSetSwipeSensitivity(b.dataset.swipe);body.querySelectorAll("[data-swipe]").forEach(function(x){x.classList.toggle("active",x===b);});};
    });
    body.querySelectorAll("[data-pdf-reader]").forEach(function(b){
      b.classList.toggle("active",b.dataset.pdfReader===currentPdfReader);
      b.onclick=function(){localStorage.setItem("cdqPdfReaderPreferenceV1",b.dataset.pdfReader);cdqScheduleSavePreferencesV72();body.querySelectorAll("[data-pdf-reader]").forEach(function(x){x.classList.toggle("active",x===b);});afficherMessage("Lecteur PDF par défaut enregistré et synchronisé.",true);};
    });

    const adminSettingsButton=body.querySelector("#cdqAdminSettingsButton");
    if(adminSettingsButton) adminSettingsButton.onclick=function(){m.style.display="none";ouvrirGestionUtilisateurs();};
    const diag=body.querySelector("#cdqDiagnosticSettingsButton");
    if(diag) diag.onclick=function(){m.style.display="none";cdqOpenDiagnostic();};

    const check=body.querySelector("#cdqCheckUpdateButton");
    if(check) check.onclick=function(){cdqUpdateInfo.verifie=false;cdqRefreshUpdateCenterUI();cdqCheckUpdate();};
    const install=body.querySelector("#cdqInstallUpdateButton");
    if(install) install.onclick=cdqForceUpdate;

    cdqRefreshUpdateCenterUI();
    cdqCheckUpdate();
    m.style.display="flex";
  }

  
