(() => {
  const $=id=>document.getElementById(id);
  function sync(){
    const wrap=document.querySelector('#clientInfoBar .client-info-name-wrap');if(!wrap)return;
    let note=$('clientNoteDot');
    if(note&&note.tagName!=='BUTTON'){const b=document.createElement('button');b.id=note.id;b.hidden=note.hidden;note.replaceWith(b);note=b;}
    let photo=$('clientPhotoDot24');
    if(!photo){photo=document.createElement('button');photo.id='clientPhotoDot24';photo.hidden=true;wrap.append(photo);}
    for(const [dot,kind,label] of [[note,'note','Voir la note générale de la compagnie'],[photo,'photo','Voir les photos générales de la compagnie']]){
      if(!dot)continue;dot.type='button';dot.className='cdq24-company-dot cdq24-'+kind;dot.title=label;dot.setAttribute('aria-label',label);
      dot.onclick=e=>{e.stopPropagation();if(!compagnieSelectionnee)return;kind==='note'?ouvrirNoteDossierClient():ouvrirPhotosCible('client',compagnieSelectionnee,nomCompagnieSelectionnee||'Compagnie');};
    }
    if(photo)photo.hidden=!$('clientPhotoButton')?.classList.contains('has-photo');
    if(note)note.hidden=!$('clientNoteButton')?.classList.contains('has-note');
  }
  for(const name of ['mettreAJourInfosClient','mettreAJourIndicateurNote','cdqSetPhotoPresence']){
    const old=window[name];if(typeof old==='function')window[name]=function(...args){const result=old.apply(this,args);sync();return result;};
  }
  function selected(){return Array.from(document.querySelectorAll('.file-checkbox:checked'));}
  function noteAction(){const files=selected();if(files.length>1){alert('Sélectionnez un seul fichier pour sa note.');return;}if(files.length){const id=files[0].dataset.fileId,row=files[0].closest('.file-row');ouvrirNoteFichier({id,nom:row?.dataset.fileName||'Fichier'});}else ouvrirNoteDossierClient();}
  function photoAction(){const files=selected();if(files.length>1){alert('Sélectionnez un seul fichier pour ses photos.');return;}if(files.length){const id=files[0].dataset.fileId,row=files[0].closest('.file-row');ouvrirPhotosCible('fichier',id,row?.dataset.fileName||'Fichier');}else if(compagnieSelectionnee)ouvrirPhotosCible('client',compagnieSelectionnee,nomCompagnieSelectionnee||'Compagnie');else alert('Choisissez d’abord une compagnie.');}
  function mount(){sync();const note=$('clientNoteButton'),photo=$('clientPhotoButton');if(note)note.onclick=noteAction;if(photo)photo.onclick=photoAction;}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
  window.addEventListener('load',mount);window.addEventListener('cdq:access-ready',mount);
})();
