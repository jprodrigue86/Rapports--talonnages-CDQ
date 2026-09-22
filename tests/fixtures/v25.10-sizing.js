// Historical V25.10 sizing functions, retained from the published V25.11 patch input.
function cdqApplyGeneralScaleV89(value,noSync){
  value=cdqClampScaleV89(value);
  localStorage.setItem("cdqUiGeneralScaleV89",String(value));
  localStorage.setItem("cdqUiScaleV86",String(value)); // compatibilité diagnostic.

  if(cdqIsMobileUiV89()){
    document.body.classList.remove(
      "cdq-text-small","cdq-text-normal","cdq-text-large","cdq-text-xlarge",
      "cdq-density-compact","cdq-density-normal","cdq-density-comfortable"
    );
    document.body.classList.add("cdq-text-normal","cdq-density-normal");
    cdqFitGeneralScaleV92(value);
    setTimeout(cdqFitQuickButtonsV2202,0);
  }

  if(!noSync)cdqScheduleSavePreferencesV72();
  return value;
}

function cdqRefitGeneralScaleV92(){}
function cdqApplyTextScaleV89(value,noSync){
  value=cdqClampScaleV89(value);
  localStorage.setItem("cdqUiTextScaleV89",String(value));
  if(cdqIsMobileUiV89()){
    const s=cdqTextZoomV89(value), px=n=>(Math.round(n*s*10)/10)+"px";
    cdqEnsureRuntimeStyleV89("cdqUserTextScaleV89").textContent=`
      /* V21.91 : 50 = tailles mobiles réellement utilisées par l'interface. */
      html:is(.android,.ios,.mobile-device) .company-button{
        font-size:${px(18)}!important
      }
      html:is(.android,.ios,.mobile-device) .quick-name{
        font-size:${px(12.5)}!important;line-height:1.12!important
      }

      /* Noms des rapports, balances, PDF, Google Sheets et autres fichiers */
      html:is(.android,.ios,.mobile-device) .file-row .file-info .file-name,
      html:is(.android,.ios,.mobile-device) .file-row .file-info .file-name-text,
      html:is(.android,.ios,.mobile-device) .file-name,
      html:is(.android,.ios,.mobile-device) .file-name-text{
        font-size:${px(21)}!important;
        line-height:1.18!important;
        font-weight:700!important
      }

      html:is(.android,.ios,.mobile-device) .file-row .file-date,
      html:is(.android,.ios,.mobile-device) .file-date{
        font-size:${px(15)}!important;
        line-height:1.22!important
      }

      /* Noms des dossiers, y compris sous-dossiers */
      html:is(.android,.ios,.mobile-device) .folder-header .folder-name,
      html:is(.android,.ios,.mobile-device) .folder-header .folder-name-text,
      html:is(.android,.ios,.mobile-device) .folder-name,
      html:is(.android,.ios,.mobile-device) .folder-name-text,
      html:is(.android,.ios,.mobile-device) .cdq-desktop-folder-row .name,
      html:is(.android,.ios,.mobile-device) .cdq-desktop-folder-row .folder-name-text{
        font-size:${px(19)}!important;
        line-height:1.18!important;
        font-weight:800!important
      }

      /* Noms dans les favoris */
      html:is(.android,.ios,.mobile-device) .cdq-favorite-name{
        font-size:${px(14)}!important;
        line-height:1.18!important
      }

      html:is(.android,.ios,.mobile-device) .cdq-company-name{
        font-size:${px(17)}!important
      }
      html:is(.android,.ios,.mobile-device) .client-info-name{
        font-size:${px(17)}!important
      }
      html:is(.android,.ios,.mobile-device) .client-stats{
        font-size:${px(13)}!important
      }
      html:is(.android,.ios,.mobile-device) .bottom-nav-item small{
        font-size:${px(12.5)}!important
      }
      html:is(.android,.ios,.mobile-device) .app-header-copy h1{
        font-size:${px(23)}!important
      }
      html:is(.android,.ios,.mobile-device) .app-subtitle{
        font-size:${px(11)}!important
      }
      html:is(.android,.ios,.mobile-device) .cdq-display-label{
        font-size:${px(16)}!important
      }
      html:is(.android,.ios,.mobile-device) .cdq-setting-row,
      html:is(.android,.ios,.mobile-device) .cdq-update-line,
      html:is(.android,.ios,.mobile-device) .cdq-ui-scale-head{
        font-size:${px(13)}!important
      }
      html:is(.android,.ios,.mobile-device) .cdq-modal-title{
        font-size:${px(20)}!important
      }
      html:is(.android,.ios,.mobile-device) .cdq-modal-body button,
      html:is(.android,.ios,.mobile-device) .cdq-modal-body input,
      html:is(.android,.ios,.mobile-device) .cdq-modal-body select,
      html:is(.android,.ios,.mobile-device) .cdq-modal-body textarea{
        font-size:${px(14)}!important
      }
      html:is(.android,.ios,.mobile-device) .message{
        font-size:${px(13)}!important
      }
    `;
  }
  if(typeof cdqFitQuickButtonsV2202==="function")cdqFitQuickButtonsV2202();
  if(!noSync)cdqScheduleSavePreferencesV72();
  return value;
}

function cdqApplyIconScaleV89(value,noSync){
  value=cdqClampScaleV89(value);
  localStorage.setItem("cdqUiIconScaleV89",String(value));
  if(cdqIsMobileUiV89()){
    const s=cdqIconZoomV89(value), px=n=>(Math.round(n*s*10)/10)+"px";
    cdqEnsureRuntimeStyleV89("cdqUserIconScaleV89").textContent=`
      html:is(.android,.ios,.mobile-device) .bottom-nav-item > span{
        font-size:${px(25)}!important;line-height:1!important;min-height:${px(27)}!important
      }
      html:is(.android,.ios,.mobile-device) .quick-icon{
        font-size:${px(21)}!important;width:${px(25)}!important;height:${px(25)}!important;
        line-height:${px(25)}!important
      }
      html:is(.android,.ios,.mobile-device) .quick-icon svg{
        width:${px(23)}!important;height:${px(23)}!important
      }
      html:is(.android,.ios,.mobile-device) .file-icon{
        width:${px(31)}!important;min-width:${px(31)}!important;height:${px(31)}!important
      }
      html:is(.android,.ios,.mobile-device) .action-icon{font-size:${px(15)}!important}
      html:is(.android,.ios,.mobile-device) .home-nav-icon,
      html:is(.android,.ios,.mobile-device) .theme-mode-icon{font-size:inherit!important}
    `;
  }
  if(typeof cdqFitQuickButtonsV2202==="function")cdqFitQuickButtonsV2202();

  // V22.09 : le slider appelle cette fonction lexicale directement.
  // Appliquer ici le rendu final, après les styles néon V22.07.
  if(typeof window.cdqApplyVisibleIconScaleV2208==="function"){
    window.cdqApplyVisibleIconScaleV2208(value);
  }

  if(!noSync)cdqScheduleSavePreferencesV72();
  return value;
}

function cdqApplyVisibleIconScaleV2208(value){
  value=clampV2208(value);

  const bottom=interpV2208(value,16,29,43);
  const top=interpV2208(value,16,27,39);
  const quick=interpV2208(value,13,24,36);
  const file=interpV2208(value,18,31,44);
  const action=interpV2208(value,9,15,22);

  const root=document.documentElement;
  root.style.setProperty("--cdq-icon-bottom-v2213",bottom.toFixed(1)+"px");
  root.style.setProperty("--cdq-icon-top-v2213",top.toFixed(1)+"px");
  root.style.setProperty("--cdq-icon-quick-v2213",quick.toFixed(1)+"px");
  root.style.setProperty("--cdq-icon-file-v2213",file.toFixed(1)+"px");
  root.style.setProperty("--cdq-icon-action-v2213",action.toFixed(1)+"px");

  localStorage.setItem("cdqUiIconScaleV89",String(value));
}

function cdqDetachBottomNavV96(){
  if(!cdqIsMobileV96())return;
  const nav=document.querySelector(".bottom-nav");
  if(!nav)return;

  // Sortir la navigation de .container, qui reçoit le zoom général.
  if(nav.parentElement!==document.body)document.body.appendChild(nav);

  const count=Math.max(1,nav.querySelectorAll(":scope > .bottom-nav-item").length);
  nav.style.setProperty("position","fixed","important");
  nav.style.setProperty("left","0","important");
  nav.style.setProperty("right","0","important");
  nav.style.setProperty("bottom","0","important");
  nav.style.setProperty("width","100%","important");
  nav.style.setProperty("max-width","100%","important");
  nav.style.setProperty("min-width","0","important");
  nav.style.setProperty("zoom","1","important");
  nav.style.setProperty("transform","none","important");
  nav.style.setProperty("margin","0","important");
  nav.style.setProperty("box-sizing","border-box","important");
  nav.style.setProperty("display","grid","important");
  nav.style.setProperty("grid-template-columns",`repeat(${count},minmax(0,1fr))`,"important");
  nav.style.setProperty("gap","0","important");
  nav.style.setProperty("overflow","hidden","important");
  nav.style.setProperty("padding-left","2px","important");
  nav.style.setProperty("padding-right","2px","important");
  nav.style.setProperty("padding-bottom","max(5px,env(safe-area-inset-bottom))","important");

  const density=cdqGeneralDensityFactorV2221(cdqGeneralValueV89());
  const navHeight='calc('+Math.round(78*density)+'px + env(safe-area-inset-bottom,0px))';
  nav.style.setProperty("height",navHeight,"important");
  nav.style.setProperty("min-height",navHeight,"important");
  nav.style.setProperty("max-height",navHeight,"important");
  document.body.style.setProperty("padding-bottom",navHeight,"important");

  const iconValue=typeof cdqIconValueV89==="function"?cdqIconValueV89():50;
  const textValue=typeof cdqTextValueV89==="function"?cdqTextValueV89():50;
  // User adjustable, but bounded in navigation so every button remains accessible.
  const iconPx=Math.round(20+(Math.max(0,Math.min(100,iconValue))/100)*12);
  const textPx=Math.round((8.5+(Math.max(0,Math.min(100,textValue))/100)*3.5)*10)/10;

  nav.querySelectorAll(":scope > .bottom-nav-item").forEach(item=>{
    item.style.setProperty("min-width","0","important");
    item.style.setProperty("width","100%","important");
    item.style.setProperty("max-width","100%","important");
    item.style.setProperty("overflow","hidden","important");
    item.style.setProperty("padding-left","0","important");
    item.style.setProperty("padding-right","0","important");
    const icon=item.querySelector(":scope > span");
    const label=item.querySelector(":scope > small");
    if(icon){
      icon.style.setProperty("font-size",iconPx+"px","important");
      icon.style.setProperty("max-width","100%","important");
      icon.style.setProperty("line-height","1","important");
    }
    if(label){
      label.style.setProperty("font-size",textPx+"px","important");
      label.style.setProperty("white-space","nowrap","important");
      label.style.setProperty("overflow","hidden","important");
      label.style.setProperty("text-overflow","ellipsis","important");
      label.style.setProperty("max-width","100%","important");
      label.style.setProperty("line-height","1.02","important");
    }
  });

  const display=document.getElementById("displayModeButton") || document.getElementById("cdqTopDisplayButtonV2204");
  const rescue=cdqEnsureDisplayRescueV96();
  requestAnimationFrame(()=>{
    const vw=Math.min(
      Number(window.visualViewport&&visualViewport.width)||99999,
      Number(document.documentElement.clientWidth)||99999,
      Number(window.innerWidth)||99999
    );
    if(!display){rescue.classList.add("show");return;}
    const r=display.getBoundingClientRect();
    const ok=r.width>20&&r.left>=-1&&r.right<=vw+1&&r.bottom>0;
    rescue.classList.toggle("show",!ok);
  });
}

