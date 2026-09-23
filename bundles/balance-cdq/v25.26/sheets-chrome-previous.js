function cdqOpenSheetChromeV2299(id){
  const email=cdqDefaultGoogleAccountV2299();
  if(!email)return false;
  cdqMarkOpenedV2299(id);

  // Le parent PWA force Chrome. L'application Sheets native n'est donc
  // jamais lancée lorsque le compte par défaut est actif.
  try{
    if(cdqPostToPwa({
      type:'CDQ_OPEN_SHEET_DEFAULT_ACCOUNT',
      id:String(id||''),
      email:email
    }))return true;
  }catch(e){}

  const url='https://docs.google.com/spreadsheets/d/'+encodeURIComponent(id)+
    '/edit?usp=drivesdk&authuser='+encodeURIComponent(email)+
    '&login_hint='+encodeURIComponent(email);

  if(/Android/i.test(navigator.userAgent||'')){
    window.location.href='intent://docs.google.com/spreadsheets/d/'+encodeURIComponent(id)+
      '/edit?usp=drivesdk&authuser='+encodeURIComponent(email)+
      '&login_hint='+encodeURIComponent(email)+
      '#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url='+
      encodeURIComponent(url)+';end';
  }else{
    const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';
    document.body.appendChild(a);a.click();a.remove();
  }
  return true;
}
