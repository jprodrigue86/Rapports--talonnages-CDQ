// Sheets owns its offline cache and sync. CDQ never navigates away from its shell.
export function sheetWebUrl({id,email='',readOnly=false}) {
  if(!/^[A-Za-z0-9_-]{1,200}$/.test(String(id||'')))throw Error('Identifiant Google Sheets invalide.');
  const url=new URL('https://docs.google.com/spreadsheets/d/'+encodeURIComponent(id)+(readOnly?'/preview':'/edit'));
  url.searchParams.set('usp','drivesdk');
  if(email){url.searchParams.set('authuser',email);url.searchParams.set('login_hint',email);}
  return url.href;
}
export function openSheet(data,{host=window,doc=document,ua=navigator.userAgent}={}) {
  const web=sheetWebUrl(data);
  if(/BalanceCDQAndroid\//i.test(ua)&&typeof host.BalanceCDQNative?.openSheet==='function'){
    host.BalanceCDQNative.openSheet(String(data.id),String(data.email||''),!!data.readOnly);return;
  }
  let href=web;
  if(/Android/i.test(ua)){
    if(/BalanceCDQAndroid\//i.test(ua)){
      const q=new URLSearchParams({fileId:data.id,account:data.email||'',accountMode:data.email?'default':'auto',readOnly:data.readOnly?'1':'0'});
      href='intent://open?'+q+'#Intent;scheme=cdqsheet;package=ca.balancecdq.android;end';
    }else{
      href=web.replace('https://','intent://')+'#Intent;scheme=https;package=com.google.android.apps.docs.editors.sheets;S.browser_fallback_url='+encodeURIComponent(web)+';end';
    }
  }
  const a=doc.createElement('a');a.href=href;a.target='_blank';a.rel='noopener';a.style.display='none';
  doc.body.append(a);a.click();a.remove();
}
