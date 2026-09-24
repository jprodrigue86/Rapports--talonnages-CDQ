/* Confirmed file mutations update the existing client tree; no speculative Drive writes. */
export function installInstantFiles2530(){
  const receipts=new Map(),ttl=30000;
  const account=()=>String(utilisateurCourantEmail||'');
  const allowed=()=>cdqAccessState==='ready'&&!!account();
  const key=(client,id)=>JSON.stringify([account(),String(client),String(id)]);
  const folder=(root,id)=>!root?null:String(root.id)===String(id)?root:(root.dossiers||[]).map(n=>folder(n,id)).find(Boolean)||null;
  const file=(root,id)=>!root?null:(root.fichiers||[]).find(f=>String(f.id)===String(id))||(root.dossiers||[]).map(n=>file(n,id)).find(Boolean)||null;
  function keep(client,meta,parentId){
    if(!allowed()||!client||!meta?.id)return;
    receipts.set(key(client,meta.id),{owner:account(),client:String(client),parentId:String(parentId||''),meta:{...meta},expires:Date.now()+ttl});
  }
  function forget(client,ids){for(const id of ids||[])receipts.delete(key(client,id));}
  function overlay(client,root){
    if(!allowed()||!root)return root;
    for(const [k,r] of receipts){
      if(r.owner!==account()||r.expires<=Date.now()){receipts.delete(k);continue;}
      if(r.client!==String(client))continue;
      const parent=folder(root,r.parentId);if(!parent)continue;
      const isFolder=r.meta.kind==='folder',list=isFolder?(parent.dossiers||=[]):(parent.fichiers||=[]);
      const old=list.find(m=>String(m.id)===String(r.meta.id));
      if(!old){list.unshift({...r.meta});continue;}
      // Never regress a newer server timestamp; retain only the recently confirmed mutation.
      const newer=Date.parse(old.dateModification||'')>Date.parse(r.meta.dateModification||'');
      if(!newer){
        if(isFolder){const {fichiers,dossiers,charge,...metadata}=r.meta;Object.assign(old,metadata);}
        else Object.assign(old,r.meta);
      }
    }
    return root;
  }
  function render(client,root){
    if(!allowed()||!root)return;
    cacheContenuCompagnies[String(client)]=root;
    // Updating one row does not imply that the entire client listing was verified.
    sauvegarderCachePersistantClient(String(client),root,cacheDerniereVerificationCompagnies[String(client)]||0);
    if(String(compagnieSelectionnee)===String(client))afficherContenu(root);
  }
  function confirm(result,client,parentId,fallback={}){
    if(!allowed()||!result?.id||result.ok===false||!client)return false;
    const root=cacheContenuCompagnies[String(client)];if(!root)return false;
    const located=trouverFichierDansArbre(root,result.id);
    const parent=located?.noeud||folder(root,parentId||result.destinationId||result.parentId||result.dossierDestinationId||client);
    if(!parent)return false;
    const old=located?.fichier||file(root,result.id)||{};
    const supplied=result.meta||result.fichier||result;
    const meta={...fallback,...old,...supplied,id:String(result.id),nom:String(supplied.nom||result.nom||old.nom||fallback.nom||'')};
    if(!meta.nom)return false;
    if(meta.mimeType==='application/pdf')meta.type='PDF';
    if(meta.mimeType==='application/vnd.google-apps.spreadsheet')meta.type='GOOGLE_SHEETS';
    if(meta.kind==='folder'){Object.assign(meta,{charge:false,fichiers:[],dossiers:[]});}
    // This is a local ordering hint, never a fabricated Drive modification date.
    meta._cdqConfirmedAt2530=Date.now();
    keep(client,meta,parent.id);overlay(client,root);render(client,root);
    if(meta.kind!=='folder'&&navigator.onLine!==false){
      const owner=account();
      cdqApiRun().withSuccessHandler(fresh=>{
        if(!allowed()||owner!==account()||String(fresh?.id)!==meta.id)return;
        const current=cacheContenuCompagnies[String(client)];
        const found=trouverFichierDansArbre(current,meta.id);if(!found)return;
        if(Date.parse(fresh.dateModification||'')<Date.parse(found.fichier.dateModification||''))return;
        const merged={...found.fichier,...fresh};
        const before=Date.parse(found.fichier.dateModification||'')||0,after=Date.parse(fresh.dateModification||'')||0;
        if(after>before||!before)delete merged._cdqConfirmedAt2530;
        found.noeud.fichiers[found.index]=merged;keep(client,merged,found.noeud.id);render(client,current);
      }).withFailureHandler(()=>{/* Keep the confirmed row; normal refresh can reconcile metadata. */}).obtenirMetaFichier(meta.id);
    }
    return true;
  }
  window.cdqInstantFiles2530={confirm,keep,overlay,forget};
  window.addEventListener('cdq:access-state-v2527',event=>{if(event.detail!=='ready')receipts.clear();});
}

function once(text,search,replacement){
  if(text.split(search).length!==2)throw Error('V25.30 source anchor must be unique: '+search.slice(0,100));
  return text.replace(search,replacement);
}
function section(text,start,end,change){
  const a=text.indexOf(start),b=text.indexOf(end,a+start.length);
  if(a<0||b<a)throw Error('V25.30 missing section: '+start);
  return text.slice(0,a)+change(text.slice(a,b))+text.slice(b);
}
export function applyInstantFiles2530(html){
  if(html.includes('id="cdq-instant-files-2530"'))throw Error('V25.30 already applied.');
  html=once(html,'<head>','<head>\n<script id="cdq-instant-files-2530">('+installInstantFiles2530.toString()+')();</script>');
  html=once(html,'  const trouve = trouverFichierDansArbre(contenu,meta.id);\n  if(!trouve) return false;',
    '  const trouve = trouverFichierDansArbre(contenu,meta.id);\n  if(!trouve) return false;\n  window.cdqInstantFiles2530.keep(idCompagnie,meta,trouve.noeud.id);');
  html=once(html,'  const set = new Set((ids||[]).map(String));',
    '  window.cdqInstantFiles2530.forget(idCompagnie,ids);\n  const set = new Set((ids||[]).map(String));');
  html=once(html,'  function merge(node, loaded){','  function merge(node, loaded){\n    loaded=window.cdqInstantFiles2530.overlay(client,loaded);');
  html=once(html,'      if(!contenu) return;\n\n      const ancien = cacheContenuCompagnies[idCompagnie];',
    '      if(!contenu) return;\n      contenu=window.cdqInstantFiles2530.overlay(idCompagnie,contenu);\n\n      const ancien = cacheContenuCompagnies[idCompagnie];');
  html=section(html,'function chargerContenuServeurRapide(idCompagnie){','function planifierActualisationCompagnie(',s=>{
    s=once(s,'  cdqApiRun()','  const owner=String(utilisateurCourantEmail||\'\');\n  cdqApiRun()');
    s=once(s,'      const contenu =','      if(cdqAccessState!==\'ready\'||owner!==String(utilisateurCourantEmail||\'\'))return;\n      let contenu =');
    return once(s,'      if(!contenu) return;','      if(!contenu) return;\n      contenu=window.cdqInstantFiles2530.overlay(idCompagnie,contenu);');
  });
  html=section(html,'async function confirmerCopie(){','function chargerFichiers(){',s=>{
    s=once(s,'  const idClient = String(compagnieSelectionnee || "");','  const idClient = String(compagnieSelectionnee || "");\n  const copyOwner=String(utilisateurCourantEmail||\'\');');
    s=once(s,'    if(resultat?.ok===true&&resultat.id)await window.cdqCreationV2523.created(resultat,idClient,cdqCopieRequestId);',
      '    if(copyOwner!==String(utilisateurCourantEmail||\'\')||cdqAccessState!==\'ready\')throw Error(\'Le compte a changé.\');\n    if(resultat?.ok===true&&resultat.id){\n      window.cdqInstantFiles2530.confirm(resultat,idClient,String(destinationId),{type:\'PDF\'});\n      await window.cdqCreationV2523.created(resultat,idClient,cdqCopieRequestId);\n    }');
    const begin=s.indexOf('    try{\n      delete cacheContenuCompagnies[idClient];');
    const end=s.indexOf('\n  }catch(erreur){',begin);
    if(begin<0||end<0)throw Error('V25.30 copy refresh anchor absent');
    s=s.slice(0,begin)+'    fermerCopie();\n'+s.slice(end);
    return s.replace('setTimeout(function(){ fermerCopie(); },700);','fermerCopie();');
  });
  html=once(html,"        try{await cdqV2130PreparerCopiePdfImmediatement(r,data.clientId);}catch(e){}\n        delete cacheContenuCompagnies[data.clientId];\n        try{actualiserCompagnieEnArrierePlan(data.clientId);}catch(e){}",
    "        if(utilisateurCourantEmail!==email||cdqAccessState!=='ready')throw Error('Le compte a changé.');\n        window.cdqInstantFiles2530.confirm(r,data.clientId,data.folderId,{type:'PDF'});");
  html=once(html,"  if(r.clientId){delete cacheContenuCompagnies[r.clientId];delete cacheDerniereVerificationCompagnies[r.clientId];try{actualiserCompagnieEnArrierePlan(r.clientId)}catch(_){}}",
    "  if(r.clientId)window.cdqInstantFiles2530.confirm(r,r.clientId,'',{type:'PDF'});");
  html=once(html,"  if(typeof cacheContenuCompagnies!=='undefined'&&result.clientId)delete cacheContenuCompagnies[result.clientId];\n  if(typeof cacheDerniereVerificationCompagnies!=='undefined'&&result.clientId)delete cacheDerniereVerificationCompagnies[result.clientId];\n  if(result.clientId&&typeof actualiserCompagnieEnArrierePlan==='function')actualiserCompagnieEnArrierePlan(result.clientId);",
    "  if(result.clientId)window.cdqInstantFiles2530.confirm(result,result.clientId,result.destinationId||destination,source);");
  html=section(html,'function trierContenuRecursif(','function afficherContenu(',s=>once(s,
    '        return new Date(\n          b.dateModification\n        ) -\n        new Date(\n          a.dateModification\n        );',
    '        const now=Date.now();\n        const rank=f=>(now-Number(f._cdqConfirmedAt2530||0)<30000?Number(f._cdqConfirmedAt2530):0)||(Date.parse(f.dateModification||\'\')||0);\n        return rank(b)-rank(a);'));
  html=section(html,'function actualiserApresModification(){','function trierContenuRecursif(',s=>{
    const end=s.indexOf('\n\n\n\ndocument.addEventListener(');
    if(end<0)throw Error('V25.30 return section boundary missing');
    const fn=`function actualiserApresModification(){
  if(document.hidden||cdqAccessState!=='ready'||navigator.onLine===false)return;
  const id=String(recupererFichierModification()||''),client=String(compagnieSelectionnee||''),owner=String(utilisateurCourantEmail||'');
  if(!id||!client||!owner)return;
  const key=JSON.stringify([owner,client,id]),previous=actualiserApresModification.active;
  if(previous?.key===key&&!previous.done)return;
  const job={key,done:false};actualiserApresModification.active=job;actualisationEnCours=true;
  const baseline=Date.parse(sessionStorage.getItem('ancienneDateModification')||'')||0;
  let attempts=0;
  const current=()=>actualiserApresModification.active===job&&cdqAccessState==='ready'&&owner===String(utilisateurCourantEmail||'')&&client===String(compagnieSelectionnee||'')&&id===String(recupererFichierModification()||'');
  function stop(){job.done=true;if(actualiserApresModification.active===job)actualisationEnCours=false;}
  function finish(meta,changed){
    if(!current()){stop();return;}
    if(meta&&String(meta.id)===id)mettreAJourFichierDansCache(client,meta);
    stop();
    // An unchanged first response may precede the editor's eventual save.
    if(!changed)return;
    fichierOuvertPourModification=null;
    for(const name of ['fichierEnModification','ancienneDateModification','momentModification'])sessionStorage.removeItem(name);
    const message=document.getElementById('message');if(message)message.textContent='';
  }
  function retry(){if(attempts<8)setTimeout(check,attempts===1?300:650);else finish(null,false);}
  function check(){
    if(!current()||document.hidden||navigator.onLine===false){stop();return;}
    attempts++;
    cdqApiRun().withSuccessHandler(meta=>{
      if(!current()){stop();return;}
      const date=Date.parse(meta?.dateModification||'')||0;
      if(String(meta?.id)===id&&date>baseline){finish(meta,true);return;}
      retry();
    }).withFailureHandler(()=>{if(current())retry();else stop();}).obtenirMetaFichier(id);
  }
  check();
}
`;
    return fn+s.slice(end).replace(/setTimeout\(\s*actualiserApresModification,\s*(?:500|700)\s*\);/g,'actualiserApresModification();');
  });
  return html;
}
