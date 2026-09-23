let cdqAdminOpenerV2521=null;
function cdqAdminApiV2521(){
 const owner=String(utilisateurCourantEmail||'');let ok=()=>{},fail=()=>{};
 const valid=()=>owner===String(utilisateurCourantEmail||'')&&utilisateurCourantRole==='admin'&&(typeof cdqAccessState==='undefined'||cdqAccessState==='ready');
 const proxy=new Proxy({},{get:(_,name)=>name==='withSuccessHandler'?fn=>{ok=fn;return proxy}:name==='withFailureHandler'?fn=>{fail=fn;return proxy}:(...args)=>{if(!valid())return;return cdqApiRun().withSuccessHandler(value=>{if(valid())ok(value)}).withFailureHandler(error=>{if(valid())fail(error)})[name](...args)}});return proxy;
}
function cdqAdminTabV2521(name){
 const modal=document.getElementById('adminModalOverlay');
 modal.querySelectorAll('[data-admin-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.adminTab===name)));
 modal.querySelectorAll('[data-admin-panel]').forEach(p=>p.hidden=p.dataset.adminPanel!==name);
 modal.querySelector('.cdq-admin-scroll').scrollTop=0;
}
function cdqAdminFilterV2521(){
 const q=document.getElementById('cdqAdminSearchV2521').value.toLocaleLowerCase('fr').trim();let count=0;
 document.querySelectorAll('#adminUserList .cdq-user-card').forEach(row=>{row.hidden=!row.dataset.search.includes(q);if(!row.hidden)count++;});
 document.getElementById('cdqAdminCountV2521').textContent=count+' utilisateur'+(count===1?'':'s');
}
function ouvrirGestionUtilisateurs(){
 if(utilisateurCourantRole!=='admin'){afficherErreur(new Error('Accès réservé aux administrateurs.'));return;}
 const modal=document.getElementById('adminModalOverlay');cdqAdminOpenerV2521=document.activeElement;modal.style.display='flex';
 modal.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();fermerGestionUtilisateurs();return;}if(e.key==='Tab'){const buttons=[...modal.querySelectorAll('button,input,select,textarea,summary')].filter(n=>!n.disabled&&n.getClientRects().length);const first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}};
 document.getElementById('adminCurrentUser').textContent='Compte administrateur : '+utilisateurCourantEmail;
 modal.querySelectorAll('[data-admin-tab]').forEach(b=>b.onclick=()=>cdqAdminTabV2521(b.dataset.adminTab));
 document.getElementById('cdqAdminSearchV2521').oninput=cdqAdminFilterV2521;document.getElementById('cdqAdminSearchV2521').value='';
 document.getElementById('adminCodesPanel').style.display='none';document.getElementById('adminCodesOutput').value='';
 cdqAdminTabV2521('users');chargerUtilisateursAdmin();modal.querySelector('.cdq-admin-close').focus();
}
function chargerUtilisateursAdmin(){
 const owner=utilisateurCourantEmail,liste=document.getElementById('adminUserList');
 const opened=new Set([...liste.querySelectorAll('details[open]')].map(d=>d.dataset.email));
 document.getElementById('cdqAdminCountV2521').textContent='Chargement…';
 cdqAdminApiV2521().withSuccessHandler(function(utilisateurs){
  if(owner!==utilisateurCourantEmail||utilisateurCourantRole!=='admin')return;liste.replaceChildren();
  function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;}
  (utilisateurs||[]).forEach(u=>{
   const row=el('details','cdq-user-card');row.dataset.email=u.email;row.dataset.search=(String(u.nomRapport||'')+' '+u.email).toLocaleLowerCase('fr');row.open=opened.has(u.email);
   const summary=el('summary','cdq-user-summary'),identity=el('span','cdq-user-identity');identity.append(el('strong','',u.nomRapport||u.email),el('small','',u.nomRapport?u.email:'Nom de technicien à renseigner'));
   const createur=!!u.accesCreateur,securise=!!u.nipDefini,activation=!!u.codeDefini,principal=String(u.email||'').toLowerCase()==='jp.rodrigue86@gmail.com';
   const status=el('span','cdq-user-state',createur?'Créateur':securise?'Activé':activation?'Activation en attente':'Code requis');summary.append(identity,status,el('span','cdq-user-expand','⌄'));row.append(summary);
   const body=el('div','cdq-user-edit'),roleLabel=el('label','','Rôle (appliqué au changement)'),role=el('select','admin-role');
   for(const [value,text] of [['technicien','Technicien'],['lecture','Lecture seule'],['admin','Administrateur']]){const o=el('option','',text);o.value=value;role.append(o)}role.value=['admin','technicien','lecture'].includes(String(u.role).toLowerCase())?String(u.role).toLowerCase():'technicien';role.disabled=principal;roleLabel.append(role);
   const nomLabel=el('label','','Nom affiché sur les rapports'),nom=el('input','admin-report-name');nom.type='text';nom.maxLength=80;nom.value=u.nomRapport||'';nomLabel.append(nom);
   const activeLabel=el('label','cdq-user-active'),active=el('input');active.type='checkbox';active.checked=u.actifRapports!==false&&role.value!=='lecture';active.disabled=role.value==='lecture';activeLabel.append(active,document.createTextNode('Disponible dans la liste Technicien des PDF'));
   const actions=el('div','cdq-user-actions'),save=el('button','admin-profile-save','Enregistrer le profil');save.type='button';save.onclick=()=>modifierProfilTechnicienDepuisInterface(u.email,nom.value,active.checked,save);
   const key=el('button','','Nouveau code d’activation');key.type='button';key.disabled=createur;key.onclick=()=>genererNouveauCodeDepuisInterface(u.email,activation||securise);
   const remove=el('button','cdq-user-remove','Retirer l’accès');remove.type='button';remove.disabled=principal;remove.onclick=()=>supprimerUtilisateurDepuisInterface(u.email);
   role.onchange=()=>{active.disabled=role.value==='lecture';if(active.disabled)active.checked=false;modifierRoleUtilisateurDepuisInterface(u.email,role.value);};
   actions.append(save,key,remove);body.append(roleLabel,nomLabel,activeLabel,actions);row.append(body);liste.append(row);
  });cdqAdminFilterV2521();
 }).withFailureHandler(e=>{if(owner!==utilisateurCourantEmail)return;document.getElementById('cdqAdminCountV2521').textContent=e.message||String(e);afficherErreur(e)}).obtenirListeUtilisateurs();
}

function fermerGestionUtilisateurs(){document.getElementById("adminModalOverlay").style.display="none";document.getElementById("adminCodesOutput").value="";cdqAdminOpenerV2521?.focus?.();}
function afficherCodesAdmin(codes){
  codes=Array.isArray(codes)?codes:[];
  if(!codes.length){alert("Aucun utilisateur n’a besoin d’un nouveau code : les comptes avec NIP restent activés.");return;}
  const panel=document.getElementById("adminCodesPanel");
  const out=document.getElementById("adminCodesOutput");
  const texte=codes.map(function(x){return x.email+"  —  "+(x.codeTemporaire||x.code||"");}).join("\n");
  if(out)out.value=texte;
  if(panel)panel.style.display="block";cdqAdminTabV2521("codes");
}
function copierCodesAdmin(){
  const out=document.getElementById("adminCodesOutput");
  if(!out||!out.value)return;
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(out.value).then(function(){alert("Codes copiés.");}).catch(function(){out.select();document.execCommand("copy");alert("Codes copiés.");});}
  else{out.select();document.execCommand("copy");alert("Codes copiés.");}
}
function modifierProfilTechnicienDepuisInterface(email,nom,actif,bouton){nom=String(nom||"").replace(/\s+/g," ").trim();if(actif&&!nom){alert("Entrez le nom à afficher dans les rapports.");return;}if(bouton){bouton.disabled=true;bouton.textContent="Enregistrement…";}cdqAdminApiV2521().withSuccessHandler(function(){if(bouton){bouton.disabled=false;bouton.textContent="Enregistré ✓";setTimeout(()=>bouton.textContent="Enregistrer",1200);}cdqSynchroniserTechniciensEtModeles().then(chargerUtilisateursAdmin);}).withFailureHandler(function(erreur){if(bouton){bouton.disabled=false;bouton.textContent="Enregistrer";}afficherErreur(erreur);}).modifierProfilTechnicien(email,nom,!!actif);}
function ajouterUtilisateurDepuisInterface(){const input=document.getElementById("adminEmailInput"),nomInput=document.getElementById("adminNomInput"),role=document.getElementById("adminRoleInput").value,email=input.value.trim(),nom=String(nomInput&&nomInput.value||"").replace(/\s+/g," ").trim();if(!email){alert("Entrez une adresse courriel.");return;}if((role==="technicien"||role==="admin")&&!nom){alert("Entrez le nom à afficher dans les rapports.");return;}cdqAdminApiV2521().withSuccessHandler(function(rep){input.value="";if(nomInput)nomInput.value="";cdqSynchroniserTechniciensEtModeles().then(chargerUtilisateursAdmin);if(rep&&rep.codeTemporaire)afficherCodesAdmin([{email:rep.email,codeTemporaire:rep.codeTemporaire}]);}).withFailureHandler(afficherErreur).ajouterUtilisateur(email,role,nom);}
function genererNouveauCodeDepuisInterface(email,dejaDefini){const question=dejaDefini?("Créer un NOUVEAU code d’activation à usage unique pour "+email+" ?\n\nSon NIP actuel et ses appareils connectés seront réinitialisés."):("Créer le code d’activation à usage unique de "+email+" ?");if(!confirm(question))return;cdqAdminApiV2521().withSuccessHandler(function(rep){chargerUtilisateursAdmin();if(rep&&rep.codeTemporaire)afficherCodesAdmin([{email:rep.email,codeTemporaire:rep.codeTemporaire}]);}).withFailureHandler(afficherErreur).genererNouveauCodeUtilisateur(email);}
function genererCodesManquantsDepuisInterface(){if(!confirm("Générer un code seulement pour les utilisateurs qui n’ont NI NIP configuré NI code d’activation en attente ?\n\nLes techniciens déjà activés ne seront pas modifiés."))return;cdqAdminApiV2521().withSuccessHandler(function(rep){chargerUtilisateursAdmin();afficherCodesAdmin(rep&&rep.codes?rep.codes:[]);}).withFailureHandler(afficherErreur).genererCodesManquants();}
function supprimerUtilisateurDepuisInterface(email){if(!confirm("Retirer l’accès à "+email+" ?"))return;cdqAdminApiV2521().withSuccessHandler(function(){cdqSynchroniserTechniciensEtModeles().then(chargerUtilisateursAdmin);}).withFailureHandler(afficherErreur).supprimerUtilisateur(email);}
function modifierRoleUtilisateurDepuisInterface(email,role){cdqAdminApiV2521().withSuccessHandler(function(){cdqSynchroniserTechniciensEtModeles().then(chargerUtilisateursAdmin);}).withFailureHandler(function(erreur){afficherErreur(erreur);chargerUtilisateursAdmin();}).modifierRoleUtilisateur(email,role);}
