(function(){
let current=null,request=0,account='',mobileSaved=null;
function allowed(){if(cdqAccessState!=='ready')throw Error('Déverrouillez CDQ.');return String(utilisateurCourantEmail||'');}
async function rpc(name,args){const owner=allowed(),v=await window.cdqAppelServeur(name,args);if(owner!==allowed())throw Error('Le compte a changé.');return v;}
function el(tag,text,cls){const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;}
function button(text,fn,label){const b=el('button',text);b.type='button';if(label)b.setAttribute('aria-label',label);b.onclick=()=>Promise.resolve(fn()).catch(afficherErreur);return b;}
function target(){return document.documentElement.classList.contains('windows')?document.getElementById('pc16Main'):document.getElementById('filesContainer');}
function render(container=target()){
 if(!container||!current)return;container.replaceChildren();const panel=el('section',null,'cdq23-drive-main');panel.id='cdqDriveMain23';
 const header=el('header');header.append(el('h2',current.nom||'Drive général'),button('Retour aux clients',back));panel.append(header);
 const nav=el('nav',null,'cdq-drive-crumbs');nav.setAttribute('aria-label','Emplacement');for(const c of current.crumbs||[])nav.append(button(c.nom,()=>open(c.id)));panel.append(nav);
 const status=el('p',current.loading?'Chargement…':current.items.length+' éléments','cdq23-drive-status');status.setAttribute('role','status');panel.append(status);
 const list=el('div',null,'cdq23-drive-list pc17-scroll');
 for(const item of current.items){const row=el('div',null,'cdq23-drive-row');row.dataset.fileId=item.id;row.dataset.fileName=item.nom;row.dataset.fileType=item.mimeType==='application/pdf'?'PDF':'';
 const openButton=button('',()=>item.kind==='folder'?open(item.id):openFile(item),'Ouvrir '+item.nom);openButton.className='cdq23-drive-item';openButton.append(el('span',item.kind==='folder'?'📁':item.mimeType==='application/pdf'?'PDF':'▤','cdq23-file-icon'),el('span',item.nom));row.append(openButton);
 row.append(button(item.favori?'★':'☆',async()=>{const r=await rpc('definirFavoriGeneralCDQV2521',[item.id,!item.favori]);item.favori=r.favori;render();},'Favori : '+item.nom));
 if(window.cdqCopyV2522?.authorized())row.append(button('⧉',()=>window.cdqCopyV2522.open(item),'Copier '+item.nom));list.append(row);}
 if(!current.items.length&&!current.loading)list.append(el('p','Ce dossier est vide.'));panel.append(list);
 if(current.nextPageToken)panel.append(button('Charger la suite',()=>open(current.id,'',true)));
 container.append(panel);if(current.highlight){const row=panel.querySelector('[data-file-id="'+CSS.escape(current.highlight)+'"]');row?.classList.add('cdq23-highlight');row?.scrollIntoView({block:'nearest'});}
}
function back(){request++;current=null;if(document.documentElement.classList.contains('windows'))document.querySelector('#cdqPcV16 [data-view="clients"]')?.click();else{const t=target();if(t&&mobileSaved){t.replaceChildren(...mobileSaved);mobileSaved=null;}}}
async function open(id,highlight='',append=false){
 account=allowed();const seq=++request;
 if(!document.documentElement.classList.contains('windows')&&!mobileSaved)mobileSaved=Array.from(target()?.childNodes||[]);
 current=append?current:{id,nom:'Drive général',items:[],crumbs:[],nextPageToken:''};current.loading=true;current.highlight=highlight;
 if(document.documentElement.classList.contains('windows'))window.cdqDesktopV2517?.showDrive?.();else render();
 try{const result=await rpc('obtenirDossierGeneralCDQV2521',[id,append?current.nextPageToken:'']);if(seq!==request)return;current={...result,items:append?[...current.items,...result.items]:result.items,loading:false,highlight};render();}catch(e){if(seq===request){current.loading=false;render();target()?.querySelector('[role="status"]')?.replaceChildren(document.createTextNode(e.message||String(e)));}throw e;}
}
async function openFile(item){if(item.mimeType==='application/pdf')return window.cdqOpenPdfV2520(item.id,{nom:item.nom});const url=item.mimeType==='application/vnd.google-apps.spreadsheet'?'https://docs.google.com/spreadsheets/d/'+item.id+'/edit':'https://drive.google.com/file/d/'+item.id+'/view';window.open(url,'_blank','noopener');}
async function show(item){document.getElementById('cdqDriveDialogV2521')?.close();if(item.kind==='folder')return open(item.id);const location=await rpc('obtenirEmplacementGeneralCDQV2523',[item.id]);await open(location.parentId,item.id);}
window.cdqDriveMain23={show,open,render,active:()=>!!current};
const afficher=window.afficherContenu;if(typeof afficher==='function')window.afficherContenu=function(...args){if(!current)return afficher.apply(this,args);};
document.addEventListener('click',e=>{const selector=document.documentElement.classList.contains('windows')?'#cdqPcV16 .pc16-nav button':'#companyMenu .company-item,.bottom-nav button';if(current&&e.target.closest(selector)){request++;current=null;mobileSaved=null;}},true);
window.addEventListener('cdq:access-ready',()=>{if(current&&account!==allowed()){request++;current=null;mobileSaved=null;target()?.querySelector('#cdqDriveMain23')?.remove();}});
})();
