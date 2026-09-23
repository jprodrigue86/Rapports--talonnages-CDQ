(function(){
'use strict';
const ROOT='1F7rgU20Hc1PmjxQHY7ALTqkqArN6RSsf';
let dialog,owner='',sequence=0,items=[],crumbs=[],folder=ROOT,mode='drive',pageToken='',busy=false,opener;
function account(){if(typeof cdqAccessState!=='undefined'&&cdqAccessState!=='ready')throw Error('Déverrouillez votre compte CDQ.');const email=String(utilisateurCourantEmail||'').toLowerCase();if(!email)throw Error('Connectez votre compte CDQ.');return email;}
function rpc(name,args){const email=account();return new Promise((resolve,reject)=>{cdqApiRun().withSuccessHandler(value=>{try{if(email!==account())throw Error('Le compte a changé.');resolve(value)}catch(e){reject(e)}}).withFailureHandler(reject)[name](...args);});}
function node(tag,className,text){const e=document.createElement(tag);if(className)e.className=className;if(text!=null)e.textContent=text;return e;}
function fileSymbol(folder){const e=node('span',folder?'cdq-drive-folder':'cdq-drive-file');e.setAttribute('aria-hidden','true');e.innerHTML=folder?'<svg viewBox="0 0 24 24"><path fill="#efb52d" d="M2 5a2 2 0 0 1 2-2h5l3 3h8a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2Z"/><path fill="#ffd35a" d="M2 9h20v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2Z"/></svg>':'<svg viewBox="0 0 24 24" fill="none" stroke="#cbd3df" stroke-width="1.5"><path d="M5 2h9l5 5v15H5ZM14 2v6h5M8 12h8M8 16h8"/></svg>';return e;}
function button(label,action,className=''){const b=node('button',className,label);b.type='button';b.onclick=action;return b;}
function status(message,error=false){const e=dialog.querySelector('[data-drive-status]');e.textContent=message;e.classList.toggle('error',error);}
function viewport(){if(dialog?.open)dialog.style.setProperty('--drive-height',Math.max(220,(window.visualViewport?.height||innerHeight)-24)+'px');}
function ensure(){
 if(dialog)return;dialog=node('dialog');dialog.id='cdqDriveDialogV2521';dialog.setAttribute('aria-labelledby','cdqDriveTitleV2521');
 const header=node('header'),title=node('h2','','Drive général');title.id='cdqDriveTitleV2521';title.tabIndex=-1;header.append(title,button('×',()=>dialog.close(),'cdq-drive-close'));header.lastChild.setAttribute('aria-label','Fermer');
 const toolbar=node('div','cdq-drive-toolbar');const search=node('input');search.type='search';search.placeholder='Rechercher dans cette liste…';search.setAttribute('aria-label','Rechercher des dossiers et fichiers');search.oninput=render;
 toolbar.append(search,button('Drive général',()=>load('drive',ROOT)),button('★ Favoris',()=>load('favorites')),button('↻',()=>load(mode,folder),'cdq-drive-refresh'));toolbar.lastChild.setAttribute('aria-label','Actualiser');
 toolbar.querySelector('button').prepend(fileSymbol(true));
 const path=node('nav','cdq-drive-crumbs');path.setAttribute('aria-label','Emplacement');
 const message=node('p','cdq-drive-status');message.dataset.driveStatus='';message.setAttribute('role','status');
 const list=node('div','cdq-drive-list');list.setAttribute('role','list');
 const footer=node('footer'),more=button('Charger la suite',()=>load(mode,folder,true));more.dataset.more='';footer.append(button('Afficher ce dossier dans la liste principale',()=>window.cdqDriveMain23.show({id:folder,kind:'folder'}).catch(afficherErreur)),more);
 dialog.append(header,toolbar,path,message,list,footer);document.body.append(dialog);
 dialog.addEventListener('close',()=>{sequence++;items=[];dialog.querySelector('.cdq-drive-list').replaceChildren();opener?.focus?.();});
 window.visualViewport?.addEventListener('resize',viewport);window.addEventListener('resize',viewport);
}
function render(){
 if(!dialog?.open)return;
 try{if(owner!==account()){dialog.close();return;}}catch(_){dialog.close();return;}
 const list=dialog.querySelector('.cdq-drive-list'),query=dialog.querySelector('input').value.trim().toLocaleLowerCase('fr');list.replaceChildren();
 const visible=items.filter(x=>String(x.nom||'').toLocaleLowerCase('fr').includes(query));
 visible.sort((a,b)=>(a.kind==='folder'?0:1)-(b.kind==='folder'?0:1)||a.nom.localeCompare(b.nom,'fr',{numeric:true}));
 for(const item of visible){
  const row=node('div','cdq-drive-row');row.setAttribute('role','listitem');row.dataset.driveId=item.id;
  const open=button('',()=>item.kind==='folder'?load('drive',item.id):window.cdqDriveMain23.show(item).catch(afficherErreur),'cdq-drive-open');
  const symbol=fileSymbol(item.kind==='folder');
  const text=node('span','cdq-drive-name'),name=node('strong','',item.nom),description=node('small','',item.kind==='folder'?(item.path||'Dossier'):'Ouvrir dans Google Drive');text.append(name,description);open.append(symbol,text);
  const star=button(item.favori?'★':'☆',async()=>{
    star.disabled=true;try{const result=await rpc('definirFavoriGeneralCDQV2521',[item.id,!item.favori]);if(!dialog.open||owner!==account())return;Object.assign(item,result);if(mode==='favorites'&&!item.favori)items=items.filter(x=>x.id!==item.id);render();status(result.favori?'Ajouté aux favoris.':'Retiré des favoris.');}catch(e){status(e.message||String(e),true);star.disabled=false;}
  },'cdq-drive-star');star.setAttribute('aria-label',(item.favori?'Retirer des favoris : ':'Ajouter aux favoris : ')+item.nom);star.setAttribute('aria-pressed',String(!!item.favori));const here=button('Afficher ici',()=>window.cdqDriveMain23.show(item).catch(afficherErreur),'cdq-drive-here');row.append(open,here,star);list.append(row);
 }
 if(!visible.length&&!busy)list.append(node('p','cdq-drive-empty',query?'Aucun résultat.':mode==='favorites'?'Ajoute des dossiers ou des fichiers avec l’étoile ☆.':'Ce dossier est vide.'));
 const path=dialog.querySelector('.cdq-drive-crumbs');path.replaceChildren();if(mode==='drive')for(const [index,c] of crumbs.entries()){if(index)path.append(node('span','','›'));path.append(button(c.nom,()=>load('drive',c.id)));}
 dialog.querySelector('[data-more]').hidden=!pageToken;dialog.querySelector('[data-more]').disabled=busy;
}
async function load(nextMode,id=ROOT,append=false){
 ensure();const email=account();owner=email;const token=++sequence;
 if(!dialog.open){opener=document.activeElement;dialog.showModal();viewport();dialog.querySelector('h2').focus();}
 mode=nextMode;folder=id;busy=true;if(!append){items=[];crumbs=[];pageToken='';dialog.querySelector('input').value='';}
 dialog.querySelector('h2').textContent=mode==='favorites'?'★ Favoris':'Drive général';status('Chargement…');render();
 try{
  const result=await rpc(mode==='favorites'?'obtenirFavorisGenerauxCDQV2521':'obtenirDossierGeneralCDQV2521',mode==='favorites'?[append?pageToken:'']:[id,append?pageToken:'']);
  if(token!==sequence||!dialog.open||email!==account())return;
  const all=append?items.concat(result.items||[]):result.items||[];items=[...new Map(all.map(x=>[x.id,x])).values()];crumbs=result.crumbs||[];pageToken=result.nextPageToken||'';busy=false;
  status(items.length+' élément'+(items.length===1?'':'s'));render();
 }catch(e){if(token!==sequence)return;busy=false;status(navigator.onLine===false?'Internet est nécessaire pour parcourir le Drive.':e.message||String(e),true);render();}
}
window.cdqDriveV2521={open:()=>load('drive',ROOT).catch(afficherErreur),openFavorites:()=>load('favorites').catch(afficherErreur),favorite:async f=>{try{const result=await rpc('definirFavoriGeneralCDQV2521',[String(f.id),!f.favori]);f.favori=result.favori;afficherMessage(result.favori?'Ajouté aux favoris.':'Retiré des favoris.',true);}catch(e){afficherErreur(e)}}};
function guard(){try{if(dialog?.open&&owner!==account())dialog.close();if(typeof cdqAccessState!=='undefined'&&cdqAccessState!=='ready')document.getElementById('adminModalOverlay').style.display='none';}catch(_){dialog?.close();}}
const access=document.getElementById('accessOverlay');if(access)new MutationObserver(guard).observe(access,{attributes:true,attributeFilter:['data-state','style']});
window.addEventListener('cdq:access-ready',guard);
})();
