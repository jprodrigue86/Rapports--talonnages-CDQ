function cdqOpenSheetV2526(id){
  id=String(id||'');if(!/^[A-Za-z0-9_-]{1,200}$/.test(id))throw Error('Identifiant Google Sheets invalide.');
  const email=cdqDefaultGoogleAccountV2299(),readOnly=String(utilisateurCourantRole||'')==='lecture';
  cdqMarkOpenedV2299(id);
  if(cdqPostToPwa({type:'CDQ_OPEN_SHEET',id,email,readOnly}))return true;
  const url='https://docs.google.com/spreadsheets/d/'+encodeURIComponent(id)+(readOnly?'/preview':'/edit')+'?usp=drivesdk'+(email?'&authuser='+encodeURIComponent(email):'');
  const a=document.createElement('a');a.target='_blank';a.rel='noopener';a.href=url;
  if(/Android/i.test(navigator.userAgent||''))a.href=url.replace('https://','intent://')+'#Intent;scheme=https;package=com.google.android.apps.docs.editors.sheets;S.browser_fallback_url='+encodeURIComponent(url)+';end';
  document.body.append(a);a.click();a.remove();return true;
}
window.cdqOpenSheetV2526=cdqOpenSheetV2526;
function cdqV19OpenOfflineSheet(id){return cdqOpenSheetV2526(id);}
