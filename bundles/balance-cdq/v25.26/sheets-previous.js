function cdqV19OpenOfflineSheet(id){
  id=String(id||'');
  if(!/^[A-Za-z0-9_-]+$/.test(id))throw new Error('Identifiant de feuille invalide.');

  const web='https://docs.google.com/spreadsheets/d/'+encodeURIComponent(id)+'/edit';

  let href=web;
  if(/Android/i.test(navigator.userAgent||'')){
    href='intent://open?fileId='+encodeURIComponent(id)+
      '#Intent;scheme=cdqsheet;package=ca.balancecdq.android;'+
      'S.browser_fallback_url='+encodeURIComponent(web)+';end';
  }

  const a=document.createElement('a');
  a.href=href;
  a.target='_self';
  a.rel='noopener';
  a.style.display='none';
  document.body.appendChild(a);
  a.click();
  a.remove();

  if(String(utilisateurCourantRole||'')!=='lecture'){
    fichierOuvertPourModification=id;
    sessionStorage.setItem('fichierEnModification',id);
    sessionStorage.setItem('ancienneDateModification',(cdqDocumentMeta(id)||{}).dateModification||'');
    sessionStorage.setItem('momentModification',String(Date.now()));
  }
  return true;
}
