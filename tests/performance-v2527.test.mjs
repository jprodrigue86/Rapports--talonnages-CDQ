import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import crypto from 'node:crypto';
const dir='bundles/balance-cdq/v25.27/', read=p=>fs.readFileSync(p,'utf8');
const tick=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function folders(){
  const state={owner:'a',client:'client-a',allowed:true,hidden:false,offline:false,time:1000000};
  state.root={id:state.client,dossiers:Array.from({length:12},(_,i)=>({id:'folder-'+i,nom:'Dossier '+i,charge:false,dossiers:[],fichiers:[]}))};
  const requests=[],loaded=[];
  const ctx=vm.createContext({console,Map,Promise,Date});vm.runInContext(read(dir+'folder-loader.js'),ctx);
  const api=ctx.cdqCreateFolderLoaderV2527({root:()=>state.root,owner:()=>state.owner,client:()=>state.client,allowed:()=>state.allowed,
    hidden:()=>state.hidden,offline:()=>state.offline,now:()=>state.time,loaded:r=>loaded.push(r),
    request:(id,client)=>{const d=deferred();requests.push({id,client,...d});return d.promise;}});
  function finish(index=0){const req=requests[index];req.resolve({contenu:{id:req.id,nom:req.id,charge:true,dossiers:[],fichiers:[{id:'sheet-'+req.id,type:'GOOGLE_SHEETS'}]}});}
  return {state,api,requests,loaded,finish};
}
test('preload is limited to eight next-level folders, one background request at a time',async()=>{
  const h=folders();h.api.plan(h.state.root);await tick();assert.equal(h.requests.length,1);
  for(let i=0;i<8;i++){assert.equal(h.requests.length,i+1);h.finish(i);await tick();}
  assert.equal(h.requests.length,8);assert.equal(h.loaded.length,8);
  assert.equal(h.state.root.dossiers[8].charge,false);
});
test('opening a folder already loading shares the request and receives the Sheets',async()=>{
  const h=folders(),node=h.state.root.dossiers[0];h.api.plan(h.state.root);await tick();
  const opened=h.api.load(node);assert.equal(h.requests.length,1);h.finish();const result=await opened;
  assert.equal(result.fichiers[0].type,'GOOGLE_SHEETS');assert.equal(h.requests.filter(r=>r.id===node.id).length,1);
  assert.equal(await h.api.load(node),node);
});
test('a user-selected folder starts before the remaining background queue',async()=>{
  const h=folders();h.api.plan(h.state.root);await tick();
  const node=h.state.root.dossiers[6],opened=h.api.load(node);await tick();
  assert.deepEqual(h.requests.map(x=>x.id),['folder-0','folder-6']);h.finish(1);await opened;
  h.finish(0);await tick();assert.equal(h.requests[2].id,'folder-1');
});
for(const field of ['allowed','hidden','offline'])test('no speculative reads when '+field+' prevents them',async()=>{
  const h=folders();h.state[field]=field==='allowed'?false:true;h.api.plan(h.state.root);await tick();assert.equal(h.requests.length,0);
});
test('switching client discards late reads without saving them into the new client',async()=>{
  const h=folders(),old=h.state.root.dossiers[0];const opened=h.api.load(old);await tick();
  h.state.client='client-b';h.state.root={id:'client-b',dossiers:[]};h.api.plan(h.state.root);h.finish();
  await assert.rejects(opened,/changé/);assert.equal(old.charge,false);assert.equal(h.loaded.length,0);
});
test('switching account before the microtask starts prevents the request entirely',async()=>{
  const h=folders();const opened=h.api.load(h.state.root.dossiers[0]);h.state.owner='b';
  await assert.rejects(opened,/changé/);assert.equal(h.requests.length,0);
});
test('locking and unlocking the same account still invalidates its previous pending response',async()=>{
  const h=folders(),node=h.state.root.dossiers[0];const opened=h.api.load(node);await tick();
  h.api.invalidate();h.finish();await assert.rejects(opened,/changé/);assert.equal(node.charge,false);assert.equal(h.loaded.length,0);
});
test('parent refresh retains recently preloaded children; deleted/expired folders are dropped',async()=>{
  const h=folders(),node=h.state.root.dossiers[0],opened=h.api.load(node);await tick();h.finish();await opened;
  h.api.merge(h.state.root,{id:h.state.client,dossiers:[{id:node.id,nom:'Nom actuel',charge:false,fichiers:[],dossiers:[]}],fichiers:[]});
  assert.equal(h.state.root.dossiers[0],node);assert.equal(node.nom,'Nom actuel');assert.equal(node.fichiers.length,1);
  h.state.time+=120001;h.api.merge(h.state.root,{id:h.state.client,dossiers:[{id:node.id,charge:false}],fichiers:[]});
  assert.equal(h.state.root.dossiers[0].charge,false);assert.notEqual(h.state.root.dossiers[0],node);
});
test('an already loaded folder opens offline even after its refresh deadline',async()=>{
  const h=folders(),node=h.state.root.dossiers[0],opened=h.api.load(node);await tick();h.finish();await opened;
  h.state.time+=120001;h.state.offline=true;
  assert.equal(await h.api.load(node),node);assert.equal(h.requests.length,1);
  await assert.rejects(h.api.load(h.state.root.dossiers[1]),/pas encore/);
});
test('deleting a folder during its request prevents a detached response from being saved',async()=>{
  const h=folders(),node=h.state.root.dossiers[0],opened=h.api.load(node);await tick();h.state.root.dossiers.shift();h.finish();
  await assert.rejects(opened,/changé/);assert.equal(h.loaded.length,0);
});
test('a quiet client-root refresh preserves prepared children and the root reference',async()=>{
  const h=folders(),node=h.state.root.dossiers[0],opened=h.api.load(node);await tick();h.finish();await opened;
  let success;const root=h.state.root,cache={client:root};
  const ctx=vm.createContext({Date,console,cdqAccessState:'ready',utilisateurCourantEmail:'a',compagnieSelectionnee:'client',rafraichissementsEnCours:{},
    cacheContenuCompagnies:cache,cacheDerniereVerificationCompagnies:{},sauvegarderCachePersistantClient(){},afficherContenu(){},
    signatureContenuCache:JSON.stringify,window:{cdqMergeClientV2527:(old,next)=>h.api.merge(old,next)},
    cdqApiRun:()=>({withSuccessHandler(fn){success=fn;return this;},withFailureHandler(){return this;},actualiserContenuClient(){}})});
  vm.runInContext(read(dir+'client-refresh.js'),ctx);ctx.actualiserCompagnieEnArrierePlan('client');
  success({contenu:{id:root.id,charge:true,fichiers:[],dossiers:[{id:node.id,charge:false,fichiers:[],dossiers:[]}]},genereLe:2});
  assert.equal(cache.client,root);assert.equal(root.dossiers[0],node);assert.equal(node.fichiers.length,1);
});

test('Drive metadata uses pages of up to 1000 without a per-file lookup and preserves badges',()=>{
  const calls=[],folder={getId:()=> 'root'};
  const ctx=vm.createContext({console,Date,CONFIG:{MASTER_FOLDER_ID:'root'},MimeType:{GOOGLE_SHEETS:'sheet',PDF:'pdf'},CDQ_PROTECTION_MARKER_:'[CDQ_PROTECTED]',
    extraireNoteCDQ_:x=>x.includes('note'),photoPresenteDansIndexCDQ_:(i,t,id)=>!!i[t+':'+id],construireIndexPhotosCDQ_:()=>({'fichier:s':true}),
    metaDossierLegere_:()=>({id:'root',nom:'Root',charge:false,fichiers:[],dossiers:[]}),
    Drive:{Files:{list(options){calls.push(options);return calls.length===1?{nextPageToken:'p2',files:[{id:'s',name:'Feuille',mimeType:'sheet',modifiedTime:'2026-01-01',starred:true,description:'note'}]}:{files:[{id:'d',name:'Dossier',mimeType:'application/vnd.google-apps.folder',description:'[CDQ_PROTECTED]'},{id:'x',name:'Archive.xlsx',mimeType:'other'},{id:'ignored',name:'image.png',mimeType:'image/png'}]};}}}});
  vm.runInContext(read(dir+'files/CDQPerformance.gs'),ctx);const result=ctx.cdqReadSurfaceV2527_(folder);
  assert.equal(calls.length,2);assert.equal(calls[0].pageSize,1000);assert.equal(calls[1].pageToken,'p2');
  assert.equal(result.fichiers.length,2);assert.equal(result.fichiers[0].type,'GOOGLE_SHEETS');
  assert.equal(result.fichiers[0].favori,true);assert.equal(result.fichiers[0].notePresente,true);assert.equal(result.fichiers[0].photoPresente,true);
  assert.equal(result.dossiers[0].protege,true);assert.equal(result.dossiers[0].charge,false);
});
test('startup data only accompanies server-authorized sessions, and never triggers Drive work',()=>{
  let reads=0;const ctx=vm.createContext({CacheService:{getScriptCache:()=>({get:()=>{reads++;return '[{"id":"client"}]';}})}});
  vm.runInContext(read(dir+'files/CDQPerformance.gs'),ctx);
  assert.equal(ctx.cdqStartupCachedV2527_({autorise:false}).compagniesInitiales,undefined);assert.equal(reads,0);
  assert.equal(ctx.cdqStartupCachedV2527_({autorise:true}).compagniesInitiales[0].id,'client');assert.equal(reads,1);
});
test('unlock renders cached clients immediately and checks freshness after the first screen',()=>{
  let rendered=0,requested=false;const timers=[];const ctx=vm.createContext({cdqAccessState:'ready',utilisateurCourantEmail:'a',toutesLesCompagnies:[],setTimeout:(fn,ms)=>timers.push({fn,ms}),
    remplirListeCompagnies:()=>rendered++,sauvegarderCachePersistantCompagnies:()=>{},
    lireCachePersistantCompagnies:()=>assert.fail('database must not delay an available list'),cdqApiRun:()=>({withSuccessHandler(){return this;},withFailureHandler(){return this;},obtenirDossiersClients(force){assert.equal(force,true);requested=true;}})});
  vm.runInContext(read(dir+'clients.js'),ctx);ctx.chargerClients(false,[{id:'client',nom:'Client'}]);assert.equal(rendered,1);
  assert.equal(requested,false);assert.equal(timers[0].ms,3000);timers[0].fn();assert.equal(requested,true);
});
test('a client-list response from a previous account is ignored',async()=>{
  const db=deferred();let rendered=0;
  const ctx=vm.createContext({cdqAccessState:'ready',utilisateurCourantEmail:'a',Date,toutesLesCompagnies:[],remplirListeCompagnies:()=>rendered++,lireCachePersistantCompagnies:()=>db.promise});
  vm.runInContext(read(dir+'clients.js'),ctx);ctx.chargerClients(false);ctx.utilisateurCourantEmail='b';db.resolve({compagnies:[{id:'old'}],verifiedAt:Date.now()});await tick();assert.equal(rendered,0);
});

for(const path of ['sw.js','pc/sw.js'])test(path+': cached startup responds while the network is still pending; version checks stay fresh',async()=>{
  const handlers={},requests=[],pending=[],network=deferred(),scope='https://example.test/Rapports--talonnages-CDQ/'+(path.startsWith('pc/')?'pc/':'');
  const cache={match:async()=>new Response('cached shell'),put:async()=>{}};
  const ctx=vm.createContext({URL,Response,console,caches:{open:async()=>cache},fetch:req=>{requests.push(req);return network.promise;},
    self:{registration:{scope},addEventListener:(name,fn)=>handlers[name]=fn},importScripts(){}});
  vm.runInContext(read(path),ctx);
  let response;
  handlers.fetch({request:{method:'GET',mode:'navigate',url:scope+'?source=balance-cdq-android&native=25.26'},respondWith:p=>response=p,waitUntil:p=>pending.push(p)});
  assert.equal(await (await response).text(),'cached shell');assert.equal(requests.length,1);
  let finished=false;
  handlers.fetch({request:{method:'GET',mode:'cors',url:scope+'version.json'},respondWith:p=>{response=p.then(r=>{finished=true;return r;});},waitUntil:p=>pending.push(p)});
  await tick();assert.equal(finished,false);network.resolve(new Response('{"version":"new"}'));await response;
  assert.equal(finished,true);await Promise.all(pending);
});
test('release is reproducible, keeps the PDF embedded, and uses exactly the existing artwork files',()=>{
  const manifest=JSON.parse(read(dir+'manifest.json'));
  assert.equal(manifest.version,'V25.27');assert.deepEqual(manifest.requiresBuild,['2026.09.23-v25.26-sheets-retour']);assert.deepEqual(manifest.removeFiles,[]);
  assert.equal(read(dir+'manifest.json'),read(dir+'Balance_CDQ_V25_27.cdq'));
  for(const f of manifest.extraFiles)assert.equal(crypto.createHash('sha256').update(read(dir+'files/'+f.name)).digest('hex'),f.sha256);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync('bundles/balance-cdq/v25.14/icons-reference.png')).digest('hex'),'61ab2fbff8729ada833bb16c17123d4f71abc9a80da1c8081d8c41fd392cabba');
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync('bundles/balance-cdq/v25.15/icons-transparent.webp')).digest('hex'),'e47994f32f27cf6fb6ebbfd30da7f63dd685fda80801b6ec17d7b1acb8ff20db');
  assert.ok(!manifest.patches.some(p=>p.id==='cdqV2519PlancherEmbeddedJs'));
});
