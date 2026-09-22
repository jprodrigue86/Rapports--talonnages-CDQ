function cdqInstallFolderInteractions(row,folder){
    let sx=0,sy=0,pid=null,longTimer=null,longFired=false;
    const folderId=String(folder.id||"");

    function clearLong(){ if(longTimer){ clearTimeout(longTimer); longTimer=null; } }
    function selectFolder(value){
      if(value) dossiersSelectionnes.add(folderId); else dossiersSelectionnes.delete(folderId);
      document.querySelectorAll('[data-folder-select-id="'+CSS.escape(folderId)+'"],[data-folder-id="'+CSS.escape(folderId)+'"]').forEach(function(el){
        if(el.classList.contains("folder-header") || el.classList.contains("cdq-desktop-folder-row")) el.classList.toggle("selected",value);
      });
      mettreAJourInterface();
    }

    row.addEventListener("pointerdown",function(e){
      if(e.target.closest("button")) return;
      if(e.pointerType === "mouse" && e.button !== 0) return;
      sx=e.clientX; sy=e.clientY; pid=e.pointerId; longFired=false;
      clearLong();
      try{ row.setPointerCapture(e.pointerId); }catch(err){}

      if(!modeSelectionFichiers && String(utilisateurCourantRole||"")!=="lecture"){
        longTimer=setTimeout(function(){
          longTimer=null;
          longFired=true;
          cdqCloseSwipes();
          modeSelectionFichiers=true;
          selectFolder(true);
          row.dataset.cdqSuppressClick="1";
          if(navigator.vibrate) navigator.vibrate([45,30,45]);
        },obtenirDureeAppuiLongSelection());
      }
    });

    row.addEventListener("pointermove",function(e){
      if(pid!==e.pointerId) return;
      const dx=e.clientX-sx,dy=e.clientY-sy;
      if(Math.abs(dx)>22 || Math.abs(dy)>22) clearLong();
    });

    row.addEventListener("pointerup",function(e){
      if(pid!==e.pointerId || e.target.closest("button")) return;
      clearLong();
      try{ row.releasePointerCapture(e.pointerId); }catch(err){}
      const dx=e.clientX-sx,dy=e.clientY-sy; pid=null;
      if(longFired) return;
      if(modeSelectionFichiers) return;
      const seuil=obtenirSeuilGlissement(),ratio=obtenirRatioGlissement();
      if(Math.abs(dx)>=seuil && Math.abs(dx)>Math.abs(dy)*ratio){
        row.dataset.cdqSuppressClick="1";
        cdqCloseSwipes(row);
        row.classList.remove("cdq-swiped-left","cdq-swiped-right");
        row.classList.add(dx<0?"cdq-swiped-left":"cdq-swiped-right");
        setTimeout(function(){row.dataset.cdqSuppressClick="0";},500);
      }
    });

    row.addEventListener("pointercancel",function(){ clearLong(); pid=null; });

    row.addEventListener("click",function(e){
      if(e.target.closest("button")) return;
      if(row.dataset.cdqSuppressClick==="1"){
        row.dataset.cdqSuppressClick="0";
        e.preventDefault();e.stopImmediatePropagation();return;
      }
      if(modeSelectionFichiers){
        e.preventDefault();e.stopImmediatePropagation();
        selectFolder(!dossiersSelectionnes.has(folderId));
        return;
      }
      if(row.classList.contains("cdq-swiped-left")||row.classList.contains("cdq-swiped-right")){
        e.preventDefault();e.stopImmediatePropagation();
        row.classList.remove("cdq-swiped-left","cdq-swiped-right");
      }
    },true);
  }

  
function cdqInstallSwipeGesture(row){
    let sx=0,sy=0,pid=null;
    row.addEventListener("pointerdown",function(e){
      if(modeSelectionFichiers||e.target.closest("button"))return;
      sx=e.clientX;sy=e.clientY;pid=e.pointerId;
    });
    row.addEventListener("pointerup",function(e){
      if(pid!==e.pointerId||e.target.closest("button"))return;
      const dx=e.clientX-sx,dy=e.clientY-sy; pid=null;
      const seuil=obtenirSeuilGlissement(),ratio=obtenirRatioGlissement();
      if(Math.abs(dx)>=seuil && Math.abs(dx)>Math.abs(dy)*ratio){
        row.dataset.cdqSuppressClick="1";
        cdqCloseSwipes(row);
        row.classList.remove("cdq-swiped-left","cdq-swiped-right");
        row.classList.add(dx<0?"cdq-swiped-left":"cdq-swiped-right");
        setTimeout(function(){row.dataset.cdqSuppressClick="0";},350);
      }
    });
    row.addEventListener("click",function(e){
      if(row.dataset.cdqSuppressClick==="1"){e.preventDefault();e.stopImmediatePropagation();return;}
      if((row.classList.contains("cdq-swiped-left")||row.classList.contains("cdq-swiped-right"))&&!e.target.closest("button")){
        e.preventDefault();e.stopImmediatePropagation();row.classList.remove("cdq-swiped-left","cdq-swiped-right");
      }
    },true);
  }

  function cdqSwipeButton(text,cls,fn){ const b=document.createElement("button");b.type="button";b.className="cdq-swipe-action "+(cls||"");b.textContent=text;b.onclick=fn;return b; }
  function cdqCloseSwipes(except){ document.querySelectorAll(".file-row.cdq-swiped-left,.file-row.cdq-swiped-right,.folder-header.cdq-swiped-left,.folder-header.cdq-swiped-right,.cdq-desktop-folder-row.cdq-swiped-left,.cdq-desktop-folder-row.cdq-swiped-right").forEach(function(r){if(r!==except)r.classList.remove("cdq-swiped-left","cdq-swiped-right");}); }
