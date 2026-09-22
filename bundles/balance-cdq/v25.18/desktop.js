(function () {
  'use strict';
  if (!document.documentElement.classList.contains('windows')) return;
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const paths={home:'M3 10 12 3l9 7v11h-6v-7H9v7H3Z',clients:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M15 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',reports:'M3 6h7l2 3h9v12H3Z',models:'M4 3h16v18H4ZM8 7h8M8 11h8M8 15h5',invoices:'M5 3h14v18l-3-2-4 2-4-2-3 2ZM8 7h8M8 11h8M8 15h4',inventory:'m12 3 9 5v9l-9 5-9-5V8ZM3 8l9 5 9-5M12 13v9',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2',refresh:'M20 7v5h-5M4 17v-5h5M5 7a8 8 0 0 1 13-3l2 3M4 17l2 3a8 8 0 0 0 13-3',plus:'M12 5v14M5 12h14',search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',arrow:'M5 12h14M14 7l5 5-5 5',upload:'M12 16V3M7 8l5-5 5 5M4 16v5h16v-5'};
  const icon=n=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[n]||paths.models}"/></svg>`;
  let state,api,root,preferences={theme:'metal',text:50,density:50,icons:50},searchTimer,activeFile=null;
  const themes=[['metal','Black métallique'],['dark','Bleu nuit'],['steel','Acier'],['electric','Bleu électrique'],['violet','Violet']];
  function preferenceKey(){let email='';try{email=String(utilisateurCourantEmail||'').toLowerCase()}catch(_){}return 'cdqPcAppearanceV2517:'+email}
  function preferencesApply(){
    if(!root)return;
    root.dataset.theme=themes.some(t=>t[0]===preferences.theme)?preferences.theme:'metal';
    root.style.setProperty('--pc-font',String(16+Math.max(0,Math.min(100,+preferences.text||0))*.16)+'px');
    root.style.setProperty('--pc-file-icon',String(24+Math.max(0,Math.min(100,+preferences.icons||0))*.2)+'px');
    root.style.setProperty('--pc-row',String(44+Math.max(0,Math.min(100,+preferences.density||0))*.24)+'px');
  }
  function savePreferences(){try{localStorage.setItem(preferenceKey(),JSON.stringify(preferences))}catch(_){}preferencesApply()}
  function countText(n,noun){return `${n} ${noun}${n===1?'':'s'}`}
  function header(title,description,actions=''){return `<header class="pc17-view-head"><div><h1>${esc(title)}</h1><p>${esc(description)}</p></div><div class="pc17-head-actions">${actions}</div></header>`}
  function button(id,label,name='',cls=''){return `<button type="button" id="${id}" class="pc17-button ${cls}">${name?icon(name):''}<span>${label}</span></button>`}
  function search(id,value,placeholder){return `<label class="pc17-search">${icon('search')}<input id="${id}" value="${esc(value)}" aria-label="${placeholder}" placeholder="${placeholder}" autocomplete="off"><kbd>⌕</kbd></label>`}
  function bindSearch(id,key){const input=$('#'+id);if(!input)return;input.oninput=()=>{state[key]=input.value;clearTimeout(searchTimer);searchTimer=setTimeout(()=>render(state,api),100)}}
  function action(id,fn){const node=$('#'+id);if(node)node.onclick=fn}
  function mount(st,bridge){
    state=st;api=bridge;root=$('#cdqPcV16');root.classList.add('pc17-workspace');root.dataset.build='V25.18';
    try{preferences={...preferences,...JSON.parse(localStorage.getItem(preferenceKey())||'{}')}}catch(_){}
    preferencesApply();
    const nav=$('.pc16-nav',root);
    $$('button',nav).forEach(b=>{const type=b.dataset.view||b.dataset.pcAction;const name=type==='settings'?'Réglages':b.textContent.trim().replace(/^[^\p{L}]+/u,'');b.innerHTML=`<span class="ico">${icon(type)}</span><span>${esc(name)}</span>`;if(type==='tools'||type==='models')b.remove()});
    $('.pc16-rail',root)?.remove();
    $('.pc16-header',root).innerHTML='<div class="pc17-banner" role="img" aria-label="Balance CDQ, bannière de concert"></div>';
    const shortcuts=$('.pc16-shortcuts',root);
    shortcuts.innerHTML='<h4>Actions rapides</h4>'+[['client','plus','Ajouter un client'],['refresh','refresh','Actualiser Drive']].map(([key,ico,label])=>`<button type="button" data-quick="${key}">${icon(ico)}<span>${label}</span></button>`).join('');
    $$('[data-quick]',shortcuts).forEach(b=>b.onclick=()=>api.quick(b.dataset.quick));
    $$('#pc16Date,#pc16Time',root).forEach(node=>node.removeAttribute('id'));
    const clock=document.createElement('div');clock.className='pc17-clock';clock.innerHTML='<span id="pc16Date"></span><b id="pc16Time"></b>';shortcuts.prepend(clock);
    $('.pc16-side-meta span',root).textContent='V25.18';
    paintNavIcons();document.addEventListener('cdq:icons-changed',paintNavIcons);
  }
  function paintNavIcons(){
    if(!root)return;
    const theme=window.cdqIconThemesV2514?.getStyle?.()||'current',indices={home:0,reports:2,inventory:3,invoices:4};
    $$('.pc16-nav button',root).forEach(b=>{const name=b.dataset.view||b.dataset.pcAction,host=$('.ico',b);if(!host)return;
      host.replaceChildren();host.classList.remove('pc17-art');
      if(theme!=='current'&&indices[name]!=null){host.classList.add('pc17-art');window.cdqIconThemesV2514.sprite(host,theme,indices[name])}
      else host.innerHTML=icon(name);
    });
  }
  function scale(){
    const r=$('#cdqPcV16'),stage=$('.pc16-stage',r||document);if(!r||!stage)return;
    for(const el of [r,stage]) for(const [key,value] of Object.entries({left:'0',top:'0',width:'100%',height:'100%',transform:'none',zoom:'1',margin:'0'}))el.style.setProperty(key,value,'important');
  }
  function render(st,bridge){
    state=st;api=bridge;root=$('#cdqPcV16');if(!root)return;
    root.dataset.view=st.view;
    const m=$('#pc16Main'),active=document.activeElement;
    const focus=active?.id&&m.contains(active)?{id:active.id,start:active.selectionStart,end:active.selectionEnd}:null;
    const scroller=$('.pc17-scroll',m),previousScroll=scroller?.scrollTop||0,oldView=m.dataset.pc17View;
    const scrollKey=st.view==='explorer'?st.explorer.folderId:st.view,oldKey=m.dataset.pc17ScrollKey;
    m.dataset.pc17View=st.view;m.dataset.pc17ScrollKey=scrollKey;
    if(oldView!==st.view&&['clients','explorer'].includes(st.view))st.search='';
    $$('.pc16-nav [data-view]',root).forEach(b=>{const selected=b.dataset.view===st.view||(b.dataset.view==='reports'&&st.view==='explorer');b.classList.toggle('active',selected);if(selected)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
    const renderer={home,clients,explorer,settings}[st.view];
    if(renderer)renderer(m);else api.legacy(st.view,m);
    if(oldView===st.view&&oldKey===scrollKey&&$('.pc17-scroll',m))$('.pc17-scroll',m).scrollTop=previousScroll;
    if(focus){const node=$('#'+focus.id,m);node?.focus({preventScroll:true});if(node&&focus.start!==null&&node.setSelectionRange)node.setSelectionRange(focus.start,focus.end)}
    preferencesApply();
  }
  function kpis(){
    if(!root)return;
    const st=state,s=api.stats(),t=st.tracking.summary||{},total=s.ok+s.nc+s.unk,pct=total?Math.round(s.ok/total*100):null;
    $('#pc16Kpis').innerHTML=[
      ['green','✓','Conformité globale',pct===null?'—':pct+'%',`${s.ok} conformes`,''],
      ['red','!','Non-conformités actives',Number(t.nonConformitesActives||0),'Consulter les rapports','nonconformities'],
      ['yellow','◉','Clients à surveiller',Number(t.clientsSurveilles||0),'Observations et suivis','watchlist'],
      ['cyan','⌂','Clients chargés',st.clients.length,'Parcourir les dossiers','clients']
    ].map(([c,i,title,value,note,view])=>`<${view?'button':'div'} class="pc16-kpi ${c}" ${view?'type="button" data-follow="'+view+'"':''}><div class="pc17-kpi-top"><span>${title}</span><span class="pc17-kpi-mark">${i}</span></div><strong>${value}</strong><small>${note}${view?' →':''}</small></${view?'button':'div'}>`).join('');
    $$('[data-follow]',$('#pc16Kpis')).forEach(b=>b.onclick=()=>api.show(b.dataset.follow));
  }
  function home(m){
    m.innerHTML=header('Accueil','Un aperçu de ton activité et de ce qui demande ton attention.')+
      `<div class="pc17-scroll"><div class="pc17-section-head"><h2>Derniers fichiers</h2><span>${countText(Math.min(20,state.recent.length),'document')}</span>${button('pc17AllClients','Voir les clients','arrow')}</div>${filesTable(state.recent.slice(0,20),'recent')}<div class="pc17-home-foot">Ouvre un client pour retrouver l’ensemble de ses dossiers et rapports.</div></div>`;
    action('pc17AllClients',()=>api.show('clients'));bindFileRows(m,state.recent,false);
  }
  function clients(m){
    const q=String(state.search||'').toLocaleLowerCase('fr').trim();
    const list=state.clients.filter(c=>!q||String(c.nom).toLocaleLowerCase('fr').includes(q)).sort((a,b)=>a.nom.localeCompare(b.nom,'fr',{sensitivity:'base'}));
    m.innerHTML=header('Clients','Toute ta liste, sans pages à changer.',button('pc17NewClient','Ajouter un client','plus','primary'))+
      `<div class="pc17-list-toolbar">${search('pc17ClientSearch',state.search,'Rechercher un client…')}<span>${countText(list.length,'client')}</span>${button('pc17RefreshClients','Actualiser','refresh')}</div><div class="pc17-scroll" tabindex="0" aria-label="Liste des clients"><table class="pc17-table pc17-clients"><thead><tr><th>Compagnie</th><th>Fichiers</th><th>PDF</th><th>Non-conformités</th><th></th></tr></thead><tbody>${list.map(c=>{const s=state.summaries[String(c.id)];return `<tr data-client="${esc(c.id)}" tabindex="0"><td><span class="pc17-client-symbol">${icon('clients')}</span><b>${esc(c.nom)}</b></td><td>${s?Number(s.totalFichiers||0):'—'}</td><td>${s?Number(s.totalPdf||0):'—'}</td><td>${s?`<span class="pc17-pill ${s.nonConformes?'bad':''}">${Number(s.nonConformes||0)}</span>`:'—'}</td><td><button type="button" class="pc17-open-client">Ouvrir ${icon('arrow')}</button></td></tr>`}).join('')}</tbody></table>${list.length?'':'<div class="pc17-empty">Aucun client ne correspond à la recherche.</div>'}</div><div class="pc17-list-foot">${countText(list.length,'client')} · Défile vers le bas pour continuer</div>`;
    bindSearch('pc17ClientSearch','search');action('pc17NewClient',()=>api.createClient());action('pc17RefreshClients',()=>api.loadClients(true));
    $$('[data-client]',m).forEach(row=>{const open=()=>{activeFile=null;api.openExplorerClient(row.dataset.client)};row.ondblclick=e=>{if(!e.target.closest('button'))open()};row.onkeydown=e=>{if(e.key==='Enter'&&e.target===row)open()};$('.pc17-open-client',row).onclick=open;row.onclick=e=>{if(e.target.closest('button'))return;const c=state.clients.find(x=>String(x.id)===row.dataset.client);if(c)state.client=c;$$('[data-client]',m).forEach(r=>r.classList.toggle('selected',r===row))}});
  }
  function filesTable(items,kind){
    if(!items.length)return '<div class="pc17-empty">Aucun document à afficher.</div>';
    return `<table class="pc17-table pc17-files"><thead><tr><th>Nom du document</th><th>${kind==='recent'?'Client':'Type'}</th><th>Modifié</th><th></th></tr></thead><tbody>${items.map(f=>{const folder=f.kind==='folder',selected=state.pcSelectedFiles.has(String(f.id));return `<tr data-file="${esc(f.id)}" tabindex="0" class="${selected?'selected ':''}${activeFile?.id===f.id?'focused':''}"><td><div class="pc17-file-title">${api.nativeExplorerIcon({...f,kind:folder?'folder':'file'})}<div><b>${esc(f.nom)}</b>${kind==='recent'?api.statusHtml(f).replace(/<span[^>]*>⚠ À vérifier<\/span>/g,''):''}</div>${selected?'<span class="pc17-selected-check">✓</span>':''}</div></td><td>${esc(kind==='recent'?f.clientNom||'—':folder?'Dossier':f.mimeLabel||f.type||'Document')}</td><td>${folder?'—':esc(api.fmt(f.dateModification))}</td><td><div class="pc17-row-actions"><button type="button" data-open>${folder?'Ouvrir le dossier':'Ouvrir'}</button>${folder?'':'<button type="button" data-more aria-label="Actions du fichier">⋯</button>'}</div></td></tr>`}).join('')}</tbody></table>`;
  }
  function bindFileRows(m,items,exploring){
    $$('[data-file]',m).forEach(row=>{const original=items.find(f=>String(f.id)===row.dataset.file);if(!original)return;const folder=original.kind==='folder',f=exploring&&!folder?api.explorerFileObject(original):original;
      const open=()=>{if(folder){state.search='';state.pcSelectedFiles.clear();state.pcSelectionMode=false;activeFile=null;api.explorerOpenFolder(original)}else api.openFile(f)};
      row.ondblclick=e=>{if(!e.target.closest('button')&&!state.pcSelectionMode)open()};
      row.onkeydown=e=>{if(e.key==='Enter'&&e.target===row)open()};
      row.onclick=e=>{if(row.dataset.suppressClick==='1'){delete row.dataset.suppressClick;e.preventDefault();return}if(e.target.closest('button'))return;activeFile=folder?null:f;
        if(exploring&&state.pcSelectionMode&&!folder){if(state.pcSelectedFiles.has(String(f.id)))state.pcSelectedFiles.delete(String(f.id));else state.pcSelectedFiles.set(String(f.id),f)}
        $$('.pc17-files tr',m).forEach(x=>x.classList.toggle('focused',x===row));if(exploring){if(state.pcSelectionMode)render(state,api);else updateContextBar(m)};
      };
      $('[data-open]',row).onclick=open;
      const more=$('[data-more]',row);if(more)more.onclick=()=>showFileMenu(f,more);
      if(exploring&&!folder)armSelection(row,f,m);
    });
  }
  function armSelection(row,f,m){
    let timer=null,x=0,y=0;
    const clear=()=>{clearTimeout(timer);timer=null};
    row.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('button'))return;clear();x=e.clientX;y=e.clientY;delete row.dataset.suppressClick;
      timer=setTimeout(()=>{if(!row.isConnected)return;state.pcSelectionMode=true;state.pcSelectedFiles.set(String(f.id),f);row.dataset.suppressClick='1';row.classList.add('selected');activeFile=f;updateContextBar(m);timer=null},700);
    });
    row.addEventListener('pointermove',e=>{if(Math.abs(e.clientX-x)>8||Math.abs(e.clientY-y)>8)clear()});
    for(const name of ['pointerup','pointercancel','pointerleave'])row.addEventListener(name,clear);
    row.addEventListener('dragstart',clear);
  }
  function newReport(){
    const dialog=document.createElement('dialog');dialog.className='pc18-report-dialog';
    dialog.innerHTML='<h2>Nouveau rapport</h2><p>Choisis le type de balance pour ce client.</p><div class="pc18-models">'+[['camion','Balance à camion'],['precision','Balance de précision'],['plancher','Balance de plancher'],['intermediaire','Autres balances intermédiaires'],['multitete','Balance multi-tête']].map(([id,name])=>`<button type="button" data-model="${id}">${esc(name)}</button>`).join('')+'</div><button type="button" class="pc18-cancel">Annuler</button>';
    document.body.append(dialog);dialog.showModal();$('.pc18-cancel',dialog).onclick=()=>dialog.close();dialog.onclose=()=>dialog.remove();
    $$('[data-model]',dialog).forEach(b=>b.onclick=()=>{dialog.close();api.startModel(b.dataset.model)});
  }
  function showFileMenu(f,anchor){
    $('.pc17-menu')?.remove();const menu=document.createElement('div');menu.className='pc17-menu';menu.setAttribute('role','menu');
    const actions=[['Renommer',()=>api.rename(f)],['Dupliquer',()=>api.duplicate(f)],['Copier vers un client',()=>api.copy(f)],['Télécharger',()=>api.download(f)],['Note, favori ou suppression…',()=>api.fileMenu(f,anchor)]];
    actions.forEach(([name,fn])=>{const b=document.createElement('button');b.type='button';b.setAttribute('role','menuitem');b.textContent=name;b.onclick=()=>{menu.remove();fn()};menu.append(b)});document.body.append(menu);
    const box=anchor.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(innerWidth-250,box.right-240))+'px';menu.style.top=Math.max(8,Math.min(innerHeight-menu.offsetHeight-8,box.bottom+5))+'px';
    const close=e=>{if(!menu.contains(e.target)&&!anchor.contains(e.target)){menu.remove();document.removeEventListener('pointerdown',close,true)}};document.addEventListener('pointerdown',close,true);
    menu.onkeydown=e=>{if(e.key==='Escape'){menu.remove();anchor.focus()}};menu.firstChild.focus();
  }
  function explorer(m){
    const exp=state.explorer,c=exp.client;
    if(!c){m.innerHTML=header('Rapports','Choisis une compagnie pour ouvrir ses dossiers.',button('pc17PickClient','Choisir un client','clients','primary'))+'<div class="pc17-empty"><div>'+icon('reports')+'<h2>Les rapports sont rangés par client</h2><p>La liste des clients te donne accès à tous les dossiers.</p></div></div>';action('pc17PickClient',()=>api.show('clients'));return}
    const q=String(state.search||'').toLocaleLowerCase('fr').trim(),items=exp.items.filter(f=>!q||String(f.nom).toLocaleLowerCase('fr').includes(q)).sort((a,b)=>(a.kind==='folder'?0:1)-(b.kind==='folder'?0:1)||a.nom.localeCompare(b.nom,'fr',{numeric:true}));
    const selected=state.pcSelectedFiles.size;
    if(activeFile&&!exp.items.some(f=>f.id===activeFile.id))activeFile=null;
    m.innerHTML=header(c.nom,'')+
      `<nav class="pc17-breadcrumbs" aria-label="Emplacement">${(exp.crumbs.length>1?exp.crumbs:[]).map((f,i)=>`<span>›</span><button data-crumb="${i}">${esc(f.nom)}</button>`).join('')}</nav><div class="pc17-list-toolbar">${search('pc17FileSearch',state.search,'Rechercher dans ce dossier…')}<span>${countText(items.length,'élément')}</span>${button('pc17RefreshFolder','Actualiser','refresh')}</div>`+
      '<div class="pc17-context-bar"></div>'+
      `<div class="pc17-scroll" tabindex="0" aria-label="Dossiers et rapports">${exp.loading&&!items.length?'<div class="pc17-empty">Chargement du dossier…</div>':filesTable(items,'explorer')}</div>`;
    action('pc17PickClient',()=>api.show('clients'));
    action('pc17RefreshFolder',()=>api.loadFolder(exp.folderId,c.id,true));bindSearch('pc17FileSearch','search');
    $$('[data-crumb]',m).forEach(b=>b.onclick=()=>{activeFile=null;state.pcSelectedFiles.clear();state.pcSelectionMode=false;state.search='';api.loadFolder(exp.crumbs[+b.dataset.crumb].id,c.id,false)});
    updateContextBar(m);bindFileRows(m,items,true);
  }
  function updateContextBar(m){
    const bar=$('.pc17-context-bar',m);if(!bar)return;const selected=state.pcSelectedFiles.size;
    bar.innerHTML=`<span>${selected?selected+' fichier(s) sélectionné(s)':activeFile?esc(activeFile.nom):'Maintiens le clic 0,7 s pour sélectionner plusieurs fichiers'}</span>${activeFile&&!state.pcSelectionMode?button('pc17Rename','Renommer')+button('pc17Duplicate','Dupliquer')+button('pc17Copy','Copier'):''}${state.pcSelectionMode?button('pc17Multi','Terminer la sélection'):button('pc18NewReport','Nouveau rapport','plus','primary')}${selected?button('pc17Send','Convertir et envoyer','arrow','primary'):''}`;
    action('pc18NewReport',newReport);
    action('pc17Multi',()=>{state.pcSelectionMode=!state.pcSelectionMode;if(!state.pcSelectionMode)state.pcSelectedFiles.clear();render(state,api)});action('pc17Send',()=>api.send());
    action('pc17Rename',()=>api.rename(activeFile));action('pc17Duplicate',()=>api.duplicate(activeFile));action('pc17Copy',()=>api.copy(activeFile));
  }
  function settings(m){
    let account='';try{account=window.cdqGoogleDefaultAccountV2294?.()||''}catch(_){}
    const reader=localStorage.getItem('cdqPdfReaderPreferenceV1')||'ask';
    m.innerHTML=header('Réglages','Ton affichage, tes fichiers et ton compte, au même endroit.')+`<div class="pc17-scroll pc17-settings"><section><h2>Thème</h2><div class="pc17-theme-choices">${themes.map(([id,name])=>`<button type="button" data-pc-theme="${id}" aria-pressed="${preferences.theme===id}"><i class="pc17-swatch ${id}"></i>${name}</button>`).join('')}</div></section><section><h2>Lisibilité sur ce PC</h2>${[['text','Taille des noms de fichiers et clients'],['icons','Taille des icônes de fichiers'],['density','Espacement des lignes']].map(([key,label])=>`<label class="pc17-range">${label}<output id="pc17Value-${key}">${preferences[key]} / 100</output><input type="range" min="0" max="100" value="${preferences[key]}" data-pc-range="${key}" aria-label="${label}"></label>`).join('')}<p>La sélection multiple s’active en maintenant le clic de la souris pendant 0,7 seconde.</p></section><section class="cdq-display-group"><div class="cdq-display-label">Thème</div></section><section><h2>Compte Google pour les documents</h2><p>Choisis le compte proposé à Google pour ouvrir les fichiers sur ce PC.</p><label class="pc18-account-label">Adresse Google<input id="pc18GoogleEmail" type="email" autocomplete="email" placeholder="nom@gmail.com" value="${esc(account)}"></label><div class="pc17-setting-buttons">${button('pc18SaveAccount','Enregistrer')}${button('pc18CurrentAccount','Utiliser mon compte CDQ')}${button('pc18ResetAccount','Demander le compte à chaque ouverture')}</div><p id="pc18AccountStatus" role="status">${account?'Compte enregistré : '+esc(account):'Aucun compte par défaut'}</p></section><section><h2>Lecteur PDF</h2><div class="pc17-setting-buttons">${[['ask','Demander'],['cdq','Lecteur CDQ'],['ilovepdf','iLovePDF'],['acrobat','Acrobat']].map(([id,label])=>`<button type="button" class="pc17-button" data-pc-reader="${id}" aria-pressed="${reader===id}">${label}</button>`).join('')}</div><p>Le lecteur externe doit être disponible sur ce PC. Les préférences d’ouverture existantes sont conservées.</p></section><section><h2>Application et mises à jour</h2><p>Version installée : <strong>V25.18</strong></p><div class="pc17-setting-buttons">${button('pc18CheckUpdate','Vérifier les mises à jour','refresh')}${button('pc18Manager','Ouvrir Script Manager')}${button('pc17Sync','Synchroniser les préférences','refresh')}</div><p id="pc18UpdateStatus" role="status"></p></section>${typeof utilisateurCourantRole!=='undefined'&&utilisateurCourantRole==='admin'?`<section><h2>Administration</h2><div class="pc17-setting-buttons">${button('pc18Users','Gestion des utilisateurs')}${button('pc18Diagnostic','Diagnostic de l’application')}</div></section>`:''}</div>`;
    window.cdqIconThemesV2514?.mount(m);
    const note=$('.cdq-icon-picker-v2514 > p',m);if(note)note.textContent='Le même jeu d’icônes personnel sur PC et Android.';
    $$('[data-pc-theme]',m).forEach(b=>b.onclick=()=>{preferences.theme=b.dataset.pcTheme;savePreferences();$$('[data-pc-theme]',m).forEach(x=>x.setAttribute('aria-pressed',String(x===b)))});
    $$('[data-pc-range]',m).forEach(input=>input.oninput=()=>{preferences[input.dataset.pcRange]=+input.value;$('#pc17Value-'+input.dataset.pcRange).textContent=input.value+' / 100';savePreferences()});
    const saveAccount=value=>{try{window.cdqSetGoogleDefaultAccountV2294(value);$('#pc18GoogleEmail').value=value;$('#pc18AccountStatus').textContent=value?'Compte enregistré : '+value:'Google demandera le compte.'}catch(e){$('#pc18AccountStatus').textContent=e.message||String(e)}};
    action('pc18SaveAccount',()=>saveAccount($('#pc18GoogleEmail').value.trim()));action('pc18ResetAccount',()=>saveAccount(''));action('pc18CurrentAccount',()=>saveAccount(typeof utilisateurCourantEmail==='undefined'?'':utilisateurCourantEmail));
    $$('[data-pc-reader]',m).forEach(b=>b.onclick=()=>{localStorage.setItem('cdqPdfReaderPreferenceV1',b.dataset.pcReader);window.cdqPcSettingsV2518?.save();$$('[data-pc-reader]',m).forEach(x=>x.setAttribute('aria-pressed',String(x===b)))});
    action('pc18CheckUpdate',()=>{window.cdqPcSettingsV2518?.check();$('#pc18UpdateStatus').textContent='Vérification demandée. Les mises à jour disponibles seront signalées dans l’application.'});
    action('pc18Manager',()=>window.open('https://jprodrigue86.github.io/Rapports--talonnages-CDQ/apps-script-manager/','_blank','noopener'));
    action('pc17Sync',()=>{window.cdqIconThemesV2514?.synchronize();api.sync()});
    action('pc18Users',()=>{if(typeof ouvrirGestionUtilisateurs==='function')ouvrirGestionUtilisateurs()});action('pc18Diagnostic',()=>{window.cdqPcSettingsV2518?.diagnostic()});
  }
  window.addEventListener('message',()=>{setTimeout(()=>{const label=$('#pc18UpdateStatus');if(!label)return;const status=window.cdqPcSettingsV2518?.status();if(status?.checked)label.textContent=status.latest&&status.latest!==status.current?'Version disponible : '+status.latest:'Application à jour.'},0)});
  window.cdqDesktopV2517={mount,render,kpis,scale};
})();
