(function(){
'use strict';
const BUILD='2026.09.23-v25.22-copie-retours-visuels',ORIGIN='https://jprodrigue86.github.io',BASE=ORIGIN+'/Rapports--talonnages-CDQ/';
const jobs=new Map();let serial=0,indicator,update,checking=false,lastCheck=0,available='',deployed='';
function paint(){
 if(!document.documentElement.classList.contains('windows'))return;
 if(!indicator){indicator=document.createElement('div');indicator.id='cdqBusyV2522';indicator.setAttribute('role','status');indicator.setAttribute('aria-live','polite');indicator.innerHTML='<span class="cdq-spinner" aria-hidden="true"></span><span></span>';document.body.append(indicator);}
 indicator.hidden=!jobs.size;indicator.lastChild.textContent=[...jobs.values()].at(-1)||'';
 document.getElementById('cdqPcV16')?.setAttribute('aria-busy',String(!!jobs.size));
}
function begin(label='Chargement…'){
 const id=++serial;jobs.set(id,label);paint();let finished=false;
 return ()=>{if(finished)return;finished=true;jobs.delete(id);paint();};
}
async function during(label,task){const end=begin(label);try{return await task()}finally{end()}}
// The existing RPC runner remains responsible for authentication and session routing.
// Completion is tied to its callbacks, including failures, not a cosmetic timer.
function instrumentRpc(){
 const original=window.cdqApiRun;if(typeof original!=='function'||original.cdqFeedback)return;
 function wrapped(){let success=null,failure=null,user,hasUser=false,proxy;
  proxy=new Proxy({}, {get:(_,name)=>{
   if(name==='withSuccessHandler')return fn=>{success=fn;return proxy};
   if(name==='withFailureHandler')return fn=>{failure=fn;return proxy};
   if(name==='withUserObject')return value=>{user=value;hasUser=true;return proxy};
   if(typeof name!=='string'||name==='then')return undefined;
   return (...args)=>{
    const foreground=/^(ouvrirFichier|obtenirContenuDossier|copierElementCDQV2522|renommer|dupliquer|creerDossier|supprimer)/.test(name);
    const end=foreground?begin(name.startsWith('copier')?'Copie en cours…':name.startsWith('ouvrir')?'Ouverture du fichier…':'Chargement…'):()=>{};
    let runner=original().withSuccessHandler((...values)=>{end();success?.(...values)}).withFailureHandler((...values)=>{end();if(failure)failure(...values);else window.afficherErreur?.(values[0]);});
    if(hasUser)runner=runner.withUserObject(user);
    try{return runner[name](...args)}catch(e){end();throw e;}
   };
  }});return proxy;
 }
 wrapped.cdqFeedback=true;window.cdqApiRun=wrapped;
}
function version(value){const text=String(value||'');const m=text.match(/v(\d+)\.(\d+)(?:\.(\d+))?/i)||text.match(/^(\d+)\.(\d+)(?:\.(\d+))?$/);return m?[+m[1],+m[2],+(m[3]||0)]:[0,0,0]}
function newer(a,b=BUILD){const x=version(a),y=version(b);for(let i=0;i<3;i++){if(x[i]!==y[i])return x[i]>y[i]}return false}
function canLoad(){return !!deployed&&!newer(available,deployed)&&!newer(deployed,available)}
function drawUpdate(){
 const host=document.querySelector('#cdqPcV16 .pc16-side-status')||document.getElementById('appHeader')?.parentElement;if(!host)return;
 if(!update){update=document.createElement('button');update.type='button';update.id='cdqUpdateV2522';update.setAttribute('aria-live','polite');host.prepend(update);update.onclick=()=>{
   if(canLoad()&&window.cdqPcSettingsV2518?.apply){window.cdqPcSettingsV2518.apply();return;}
   window.open(BASE+'apps-script-manager/?bundle='+encodeURIComponent('/Rapports--talonnages-CDQ/bundles/balance-cdq/latest/manifest.json'),'_blank','noopener');
  };}
 update.hidden=!newer(available);const v=version(available);update.textContent='↑ Mise à jour V'+v[0]+'.'+String(v[1]).padStart(2,'0');
 update.title=canLoad()?'Charger la nouvelle version':'Installer la nouvelle version avec CDQ Script Manager';
}
async function check(force=false){
 if(checking||navigator.onLine===false||!force&&Date.now()-lastCheck<60000)return;
 checking=true;lastCheck=Date.now();
 try{window.cdqPcSettingsV2518?.check();const response=await fetch(BASE+'bundles/balance-cdq/latest/manifest.json?check='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error('Mise à jour indisponible');const manifest=await response.json();const published=manifest.build||manifest.version||'';available=newer(deployed,published)?deployed:published;drawUpdate();}
 catch(_){}finally{checking=false;}
}
window.addEventListener('message',event=>{
 if(event.origin!==ORIGIN)return;
 if(typeof cdqFromPwa==='function'?!cdqFromPwa(event):event.source!==window.parent)return;
 const d=event.data||{};if(d.type!=='CDQ_UPDATE_STATUS')return;
 if(d.available&&newer(d.latest)){deployed=d.latest;if(newer(d.latest,available))available=d.latest;drawUpdate();}
});
window.addEventListener('focus',()=>check());window.addEventListener('online',()=>check(true));
window.addEventListener('cdq:access-ready',()=>{instrumentRpc();drawUpdate();check(true)});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check()});
window.cdqFeedbackV2522={begin,during,check,mount:()=>{instrumentRpc();drawUpdate();check()}};
instrumentRpc();setTimeout(()=>{drawUpdate();check()},1500);setInterval(()=>check(),300000);
})();
