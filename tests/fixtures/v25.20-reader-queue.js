async function cdqV19QueueGet(){
  const r=await cdqV19GetRecord("queue","actions");
  return r&&Array.isArray(r.actions)?r.actions:[];
}
async function cdqV19QueueSet(actions){
  return cdqV19PutRecord("queue","actions",{actions:actions||[],updatedAt:Date.now()});
}
let cdqV19QueueMutation=Promise.resolve();
function cdqV19MutateQueue(modifier){
  const owner=utilisateurCourantEmail;
  const operation=cdqV19QueueMutation.then(async function(){
    if(owner!==utilisateurCourantEmail)throw new Error("Le compte a changé.");
    const q=await cdqV19QueueGet();
    if(owner!==utilisateurCourantEmail)throw new Error("Le compte a changé.");
    const prochaine=modifier(q);
    await cdqV19QueueSet(prochaine);
    return prochaine;
  });
  cdqV19QueueMutation=operation.catch(function(){});
  return operation;
}
async function cdqV19QueueAdd(action){
  action=Object.assign({id:"q"+Date.now()+Math.random().toString(36).slice(2),createdAt:Date.now(),tries:0},action||{});
  await cdqV19MutateQueue(function(q){return q.concat([action]);});
  cdqV19RefreshSyncPill();
  return action;
}


async function cdqSynchroniserEnAttente(){
  if(cdqV19SyncRunning || !navigator.onLine)return;
  cdqV19SyncRunning=true;
  let rest=[];
  try{
    await cdqV19RefreshSyncPill();
    const q=await cdqV19QueueGet(), termines=new Set(), echecs=new Map();
    for(const a of q){
      try{
        await cdqV19ProcessAction(a);
        termines.add(a.id);
      }catch(e){
        a.tries=Number(a.tries||0)+1;
        a.lastError=e&&e.message?e.message:String(e);
        echecs.set(a.id,a);
      }
    }
    rest=await cdqV19MutateQueue(function(actuelle){
      return actuelle.filter(a=>!termines.has(a.id)).map(a=>echecs.get(a.id)||a);
    });
    // Une photo ajoutée pendant l'envoi précédent est traitée au tour suivant.
    if(rest.some(a=>!echecs.has(a.id)))setTimeout(cdqSynchroniserEnAttente,0);
    if(q.length){
      afficherMessage(rest.length?rest.length+" élément(s) restent en attente de synchronisation.":"Synchronisation hors ligne terminée.",!rest.length);
    }
  }finally{
    cdqV19SyncRunning=false;
    await cdqV19RefreshSyncPill();
  }
  if(!rest.length){
    if(cdqV19Inventory)cdqV19LoadInventory(true).catch(function(){});
    await cdqV19MaybeDailyReset(true);
    cdqV19MaybeAutoUpdate();
  }
}
