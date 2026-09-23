function chargerClients(forceRefresh, initialCompanies){
  const force=!!forceRefresh, email=String(utilisateurCourantEmail||'');
  const sequence=chargerClients.sequence=(chargerClients.sequence||0)+1;
  let shown=false;
  const current=()=>sequence===chargerClients.sequence&&cdqAccessState==='ready'&&email===String(utilisateurCourantEmail||'');
  function apply(companies){
    if(!current())return;
    toutesLesCompagnies=(companies||[]).slice().sort((a,b)=>String(a.nom||'').localeCompare(String(b.nom||''),'fr',{sensitivity:'base'}));
    remplirListeCompagnies();shown=true;
  }
  function server(forceServer=force){
    if(!current())return;
    cdqApiRun().withSuccessHandler(companies=>{
      if(!current())return;
      apply(companies);sauvegarderCachePersistantCompagnies(toutesLesCompagnies);
    }).withFailureHandler(error=>{if(current()&&!shown)afficherErreur(error);}).obtenirDossiersClients(forceServer);
  }
  // Show cached clients first, then check Drive without holding up the first screen.
  function refreshLater(){setTimeout(()=>{if(typeof navigator==='undefined'||navigator.onLine!==false)server(true);},3000);}
  if(!force&&Array.isArray(initialCompanies)){
    apply(initialCompanies);sauvegarderCachePersistantCompagnies(toutesLesCompagnies);refreshLater();return;
  }
  lireCachePersistantCompagnies().then(record=>{
    if(!current())return;
    if(!force&&Array.isArray(record?.compagnies)){
      apply(record.compagnies);
      if(Date.now()-Number(record.verifiedAt||0)>120000)refreshLater();
    }else server();
  }).catch(()=>server());
}
