// One background read at a time; a folder opened by the user has priority.
function cdqCreateFolderLoaderV2527(options) {
  const now=options.now||Date.now, ttl=120000, pending=new Map();
  let root=null, owner='', client='', epoch=0, active=0, backgroundActive=0, queue=[];
  function permitted(){return options.allowed()&&options.owner()===owner&&String(options.client())===client&&options.root()===root;}
  function context(){
    const next=options.root(), email=options.owner(), id=String(options.client()||'');
    if(next!==root||email!==owner||id!==client){
      epoch++;root=next;owner=email;client=id;
      for(const task of queue)task.reject(new Error('Le dossier actif a changé.'));
      queue=[];pending.clear();
    }
    return !!root&&!!owner&&!!client&&permitted();
  }
  function fresh(node){return node.charge!==false&&now()-Number(node._cdqLoadedAtV2527||0)<ttl;}
  function attached(node,current=root){return !!current&&(current===node||(current.dossiers||[]).some(child=>attached(node,child)));}
  function merge(node, loaded){
    const previous=new Map((node.dossiers||[]).map(d=>[String(d.id),d]));
    const children=(loaded.dossiers||[]).map(meta=>{
      const old=previous.get(String(meta.id));
      if(!old||!fresh(old))return meta;
      // Refresh this folder's metadata, while retaining its recent child listing.
      const {fichiers,dossiers,charge,...metadata}=meta;
      Object.assign(old,metadata);return old;
    });
    Object.assign(node,loaded,{dossiers:children,charge:true,_cdqLoadedAtV2527:now()});
    return node;
  }
  function pump(){
    if(!permitted()||options.hidden()||options.offline())return;
    while(active<2){
      const index=queue.findIndex(t=>!t.background||backgroundActive===0);
      if(index<0)return;
      const task=queue.splice(index,1)[0];
      if(task.epoch!==epoch){task.reject(new Error('Le dossier actif a changé.'));continue;}
      active++;if(task.background)backgroundActive++;
      const current=task.epoch;
      Promise.resolve().then(()=>{
        if(current!==epoch||!permitted()||!attached(task.node))throw new Error('Le dossier actif a changé.');
        return options.request(task.node.id,task.client);
      }).then(result=>{
        if(current!==epoch||!permitted()||!attached(task.node))throw new Error('Le dossier actif a changé.');
        const loaded=result&&result.contenu;
        if(!loaded||String(loaded.id)!==String(task.node.id))throw new Error('Contenu du dossier introuvable.');
        merge(task.node,loaded);options.loaded(root);task.resolve(task.node);
      },task.reject).catch(task.reject).finally(()=>{
        active--;if(task.background)backgroundActive--;
        if(pending.get(task.key)===task)pending.delete(task.key);
        pump();
      });
    }
  }
  function load(node, background=false){
    if(!context()||!node||!attached(node))return Promise.reject(new Error('Déverrouillez le dossier client.'));
    if(fresh(node)||(!background&&node.charge!==false))return Promise.resolve(node);
    if(!background&&options.offline())return Promise.reject(new Error('Ce dossier n’a pas encore été chargé sur cet appareil.'));
    const key=String(node.id), existing=pending.get(key);
    if(existing){
      const index=queue.indexOf(existing);
      if(!background&&index>=0){existing.background=false;queue.splice(index,1);queue.unshift(existing);pump();}
      return existing.promise;
    }
    const task={key,node,background,epoch,client};
    task.promise=new Promise((resolve,reject)=>Object.assign(task,{resolve,reject}));
    pending.set(key,task);background?queue.push(task):queue.unshift(task);pump();return task.promise;
  }
  function plan(node){
    if(!context()||options.hidden()||options.offline())return;
    // Only the next level of the selected client; never scan all clients.
    const candidates=(node?.dossiers||[]).slice().sort((a,b)=>Number(/rapport|balance/i.test(b.nom||''))-Number(/rapport|balance/i.test(a.nom||'')));
    for(const child of candidates.slice(0,8))load(child,true).catch(()=>{});
  }
  function invalidate(){epoch++;for(const task of queue)task.reject(new Error('Actualisation du dossier.'));queue=[];pending.clear();}
  return {load,plan,merge,invalidate};
}
