/* iPhone PWA only. Never installs APKs, touches account permissions or clears user data. */
(() => {
  'use strict';
  const base=new URL('./',document.currentScript.src), origin=location.origin;
  const current=document.documentElement.dataset.cdqIphoneRelease;
  const version=document.documentElement.dataset.cdqIphoneVersion;
  const inside=window.parent!==window;
  let state={available:false,checking:false,message:'Version iPhone '+version},scheduled=false;
  function text(node,value){if(node&&node.textContent!==value)node.textContent=value;}
  function render(){
    scheduled=false;
    const center=document.querySelector('.cdq-update-center');
    if(center){
      text(center.querySelector('.cdq-update-help'),'Application iPhone : les mises à jour se téléchargent ici. Enregistrez vos documents avant de relancer. Aucune APK ni ouverture de Script Manager.');
      const status=center.querySelector('#cdqUpdateStatus');text(status,state.message);
      const install=center.querySelector('#cdqInstallUpdateButton');
      if(install){install.disabled=!state.available||state.checking;text(install,state.available?'Mettre à jour et relancer':'Mise à jour iPhone');install.title='Mise à jour iPhone';}
      const check=center.querySelector('#cdqCheckUpdateButton');if(check){check.disabled=state.checking;text(check,'Vérifier la mise à jour iPhone');}
    }
    const banner=document.getElementById('cdqUpdateBanner');
    if(banner){banner.classList.toggle('show',!!state.available);text(banner.querySelector('span'),'Une mise à jour iPhone est prête.');}
    document.querySelectorAll('#cdqAndroidUpdaterBoxV2313,#cdqAndroidUpdaterButtonV2316').forEach(n=>{n.hidden=true;});
  }
  function schedule(){if(scheduled)return;scheduled=true;setTimeout(render,60);}
  function parentRequest(type){window.parent.postMessage({type},origin);}
  function mountFrame(){
    const style=document.createElement('style');style.textContent='#cdqAndroidUpdaterBoxV2313,#cdqAndroidUpdaterButtonV2316{display:none!important}';document.head.append(style);
    new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true});
    schedule();parentRequest('CDQ_IPHONE_CHECK');
    window.cdqMajApkV2502=()=>parentRequest('CDQ_IPHONE_CHECK');
    window.cdqReinstallerApkV2502=()=>window.open(new URL('../',base).href,'_blank','noopener');
  }
  if(inside){
    window.addEventListener('message',e=>{
      if(e.source!==parent||e.origin!==origin||e.data?.type!=='CDQ_IPHONE_STATUS')return;
      state=e.data.state;schedule();
    });
    document.addEventListener('click',e=>{
      const button=e.target.closest?.('button');if(!button)return;
      if(['cdqCheckUpdateButton','cdqAndroidUpdaterButtonV2313','cdqAndroidUpdaterButtonV2316'].includes(button.id)){
        e.preventDefault();e.stopImmediatePropagation();parentRequest('CDQ_IPHONE_CHECK');
      }else if(button.id==='cdqInstallUpdateButton'||button.closest('#cdqUpdateBanner')){
        e.preventDefault();e.stopImmediatePropagation();parentRequest('CDQ_IPHONE_APPLY');
      }
    },true);
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountFrame,{once:true});else mountFrame();
    return;
  }
  let reg=null,checking=null,applying=false,latest=null,lastCheck=0;
  function post(){
    const frame=document.getElementById('app');
    if(frame?.contentWindow)frame.contentWindow.postMessage({type:'CDQ_IPHONE_STATUS',state},origin);
  }
  function status(message,available=false,busy=false){state={message,available,checking:busy};post();}
  async function waiting(){
    if(reg?.waiting&&latest&&latest.release!==current){
      const expected=latest.release,worker=reg.waiting;
      const actual=await new Promise(resolve=>{const ports=new MessageChannel(),timer=setTimeout(()=>{ports.port1.close();resolve('');},4000);ports.port1.onmessage=e=>{clearTimeout(timer);ports.port1.close();resolve(e.data?.release);};worker.postMessage({type:'CDQ_IPHONE_VERSION'},[ports.port2]);});
      if(actual!==expected||worker!==reg.waiting)return false;
      status('Mise à jour iPhone '+latest.version+' prête. Enregistrez vos documents avant de relancer.',true);return true;}
    return false;
  }
  async function check(force=false){
    if(checking)return checking;
    if(!force&&Date.now()-lastCheck<30000){post();return;}
    if(navigator.onLine===false){status('Hors ligne : connectez-vous à Internet pour vérifier les mises à jour.');return;}
    lastCheck=Date.now();status('Vérification de la mise à jour iPhone…',false,true);
    checking=(async()=>{
      try{
        if(!('serviceWorker' in navigator))throw Error('Ce navigateur ne permet pas les mises à jour installables. Ouvrez CDQ dans Safari.');
        reg=reg||await navigator.serviceWorker.register(new URL('sw.js',base),{scope:base.href,updateViaCache:'none'});
        if(!reg.__cdqListening){
          reg.__cdqListening=true;
          reg.addEventListener('updatefound',()=>{
            const worker=reg.installing;if(!worker)return;
            worker.addEventListener('statechange',async()=>{
              if(worker.state==='installed'){if(!(await waiting())&&latest?.release===current)status('Version iPhone '+version+' à jour.');}
              if(worker.state==='redundant')status('La préparation de la mise à jour a échoué. Votre version actuelle reste disponible. Réessayez.');
            });
          });
        }
        const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
        try{
          const response=await fetch(new URL('release.json',base),{cache:'no-store',signal:controller.signal});
          if(!response.ok)throw Error('Le serveur de mise à jour ne répond pas. Réessayez.');
          latest=await response.json();
          if(!/^[a-f0-9]{64}$/.test(latest.release)||typeof latest.version!=='string')throw Error('Informations de mise à jour invalides.');
        }finally{clearTimeout(timer);}
        await reg.update();
        if(await waiting())return;
        if(latest.release===current)status('Version iPhone '+version+' à jour.');
        else status('Préparation de la mise à jour iPhone… Vous pouvez continuer à travailler.');
      }catch(error){status(error?.message||'Vérification impossible. Réessayez.');}
      finally{checking=null;}
    })();
    return checking;
  }
  async function apply(){
    if(applying)return;
    await check(true);
    if(!reg?.waiting||!latest||latest.release===current){await waiting();return;}
    if(!(await waiting()))return;
    if(!confirm('Enregistrez et fermez vos documents avant la mise à jour.\n\nRedémarrer CDQ maintenant ?'))return;
    applying=true;status('Installation de la mise à jour iPhone…',false,true);
    reg.waiting.postMessage({type:'CDQ_IPHONE_ACTIVATE',release:latest.release});
  }
  // Registered before the legacy updater, only for the real same-origin Selector.
  window.addEventListener('message',e=>{
    const frame=document.getElementById('app');
    if(e.origin!==origin||!frame||e.source!==frame.contentWindow)return;
    const type=e.data?.type;
    if(['CDQ_IPHONE_CHECK','CDQ_CHECK_UPDATE'].includes(type)){e.stopImmediatePropagation();void check(true);}
    else if(['CDQ_IPHONE_APPLY','CDQ_FORCE_UPDATE','CDQ_OPEN_SCRIPT_MANAGER'].includes(type)){e.stopImmediatePropagation();void apply();}
    else if(type==='CDQ_SELECTOR_READY'){post();void check();}
  },true);
  if('serviceWorker' in navigator)navigator.serviceWorker.addEventListener('controllerchange',()=>{if(applying)location.reload();});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void check();});
  window.addEventListener('online',()=>{void check(true);});
  window.addEventListener('load',()=>{void check();},{once:true});
  window.cdqIphoneUpdates={check:()=>check(true),apply,status:()=>({...state})};
})();
