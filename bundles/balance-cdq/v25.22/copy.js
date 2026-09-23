(function(){
'use strict';
let dialog,sequence=0,owner='',source=null,context=null,destination='',destinationName='',client='',crumbs=[],choices=[],busy=false,requestId='',mode='same';
const account=()=>String(typeof utilisateurCourantEmail==='undefined'?'':utilisateurCourantEmail).toLowerCase();
function authorized(){return account()&&['admin','technicien'].includes(typeof utilisateurCourantRole==='undefined'?'':utilisateurCourantRole)}
function rpc(name,args){const email=account();return new Promise((resolve,reject)=>{cdqApiRun().withSuccessHandler(value=>{if(email!==account())reject(Error('Le compte a changé.'));else resolve(value)}).withFailureHandler(reject)[name](...args)});}
function node(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;}
function button(text,fn,cls=''){const b=node('button',cls,text);b.type='button';b.onclick=fn;return b;}
function status(text,error=false){const s=dialog.querySelector('.copy-status');s.textContent=text;s.classList.toggle('error',error);}
function valid(token){return token===sequence&&dialog.open&&owner===account();}
function render(){
 const list=dialog.querySelector('.copy-list'),search=dialog.querySelector('input'),q=search.value.trim().toLocaleLowerCase('fr');list.replaceChildren();
 dialog.querySelector('.copy-destination').textContent=destination?'Destination : '+destinationName:mode==='clients'?'Choisis un client.':'Choisis un dossier.';
 for(const item of choices.filter(x=>String(x.nom).toLocaleLowerCase('fr').includes(q))){list.append(button('📁 '+item.nom,()=>browse(item.id,item.clientId||item.id,item.nom)));}
 for(const b of dialog.querySelectorAll('button'))b.disabled=busy;
 for(const b of dialog.querySelectorAll('.copy-options button'))b.disabled=busy||!context;
 dialog.querySelector('.copy-confirm').disabled=busy||!destination||!context;
 dialog.querySelector('[data-up]').hidden=mode!=='folders';
 search.hidden=mode==='same';list.hidden=mode==='same';
}
async function same(){mode='same';choices=[];destination=context.parentId;destinationName=context.parentName;client=context.clientId||'';render();}
async function clients(){
 const token=++sequence;mode='clients';busy=true;destination='';choices=[];render();status('Chargement des clients…');
 try{const result=await rpc('obtenirDossiersClientsPCLeger',[]);if(!valid(token))return;choices=result;status('Choisis le client, puis le dossier de destination.');}
 catch(e){if(valid(token))status(e.message||String(e),true)}finally{if(valid(token)){busy=false;render()}}
}
async function browse(id,clientId,name){
 const token=++sequence;mode='folders';busy=true;destination='';choices=[];render();status('Chargement du dossier…');
 try{const result=await rpc('obtenirDossiersCopieCDQV2522',[id,source.id]);if(!valid(token))return;client=clientId;destination=id;crumbs=result.crumbs||[];destinationName=crumbs.map(x=>x.nom).join(' / ')||name;choices=(result.items||[]).map(x=>({...x,clientId}));status('La copie sera créée dans le dossier indiqué.');}
 catch(e){if(valid(token))status(e.message||String(e),true)}finally{if(valid(token)){busy=false;render()}}
}
async function copy(){
 if(busy||!authorized()||!destination)return;
 const token=++sequence;busy=true;render();status(source.kind==='folder'?'Copie du dossier et de son contenu…':'Copie du fichier…');
 try{
  const result=await rpc('copierElementCDQV2522',[source.id,destination,requestId]);if(!valid(token))return;
  if(!result?.ok)throw Error('La copie n’a pas été confirmée.');
  window.dispatchEvent(new CustomEvent('cdq:copied',{detail:result}));
  if(typeof cacheContenuCompagnies!=='undefined'&&result.clientId)delete cacheContenuCompagnies[result.clientId];
  if(typeof cacheDerniereVerificationCompagnies!=='undefined'&&result.clientId)delete cacheDerniereVerificationCompagnies[result.clientId];
  if(result.clientId&&typeof actualiserCompagnieEnArrierePlan==='function')actualiserCompagnieEnArrierePlan(result.clientId);
  busy=false;dialog.close();window.afficherMessage?.('Copie créée : '+result.nom,true);
 }catch(e){if(valid(token)){status(e.message||String(e),true);busy=false;render();}}
}
async function open(item){
 if(!authorized()){window.afficherErreur?.(Error('Accès en lecture seule.'));return;}
 if(dialog?.open)return;
 dialog?.remove();dialog=node('dialog');dialog.id='cdqCopyV2522';dialog.setAttribute('aria-labelledby','cdqCopyTitleV2522');
 const title=node('h2','','Créer une copie');title.id='cdqCopyTitleV2522';
 const name=node('p','',item.nom||'Élément'),options=node('div','copy-options');
 options.append(button('Dans ce dossier',()=>same()),button('Autre dossier client',()=>clients()));
 const path=node('p','copy-destination'),search=node('input');search.type='search';search.placeholder='Rechercher un client ou un dossier…';search.setAttribute('aria-label',search.placeholder);search.oninput=render;
 const list=node('div','copy-list'),message=node('p','copy-status');message.setAttribute('role','status');
 const up=button('↑ Retour',()=>{search.value='';if(crumbs.length>2){const p=crumbs.at(-2);browse(p.id,client,p.nom)}else clients()});up.dataset.up='';
 const footer=node('footer');footer.append(button('Annuler',()=>dialog.close()),button('Créer la copie',copy,'copy-confirm'));
 dialog.append(title,name,options,path,up,search,list,message,footer);document.body.append(dialog);
 dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault()});dialog.addEventListener('close',()=>{sequence++;source=null;context=null;});
 source={...item};owner=account();context=null;destination='';choices=[];mode='same';busy=true;requestId='copy-'+crypto.randomUUID();const token=++sequence;dialog.showModal();render();status('Préparation…');
 try{context=await rpc('obtenirContexteCopieCDQV2522',[source.id]);if(!valid(token))return;busy=false;await same();status('L’original sera conservé.');}
 catch(e){if(valid(token)){busy=false;status(e.message||String(e),true);render()}}
}
function swipeButton(item){const b=button('⧉ Copier',e=>{e.stopPropagation();window.cdqCloseSwipes?.();document.querySelectorAll('.cdq-swiped-right,.cdq-swiped-left').forEach(r=>r.classList.remove('cdq-swiped-right','cdq-swiped-left'));open(item)},'cdq-swipe-action copy');b.setAttribute('aria-label','Créer une copie de '+(item.nom||'cet élément'));return b;}
window.cdqCopyV2522={open,swipeButton,authorized};
window.addEventListener('cdq:access-ready',()=>{if(dialog?.open&&owner!==account())dialog.close()});
})();
