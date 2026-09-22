import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import {read,patch,currentSource,manifest} from './helpers/desktop-ergonomics-fixture.mjs';
const change=needle=>manifest.patches.find(p=>p.replacement?.includes(needle)).replacement;
test('package exact build, JavaScript syntax and mobile/authentication preservation',()=>{
 assert.deepEqual(JSON.parse(read('bundles/balance-cdq/v25.18/Balance_CDQ_V25_18.cdq')),manifest);new vm.Script(read('bundles/balance-cdq/v25.18/desktop.js'));
 assert.throws(()=>patch('unknown','Selector.html'),/aucune version source compatible/);
 if(!process.env.CDQ_SELECTOR_SOURCE)return;
 const before=currentSource(),after=patch(before,'Selector.html');
 for(const block of after.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!block[1].includes('application/json'))new vm.Script(block[2]);
 for(const block of before.matchAll(/<(script|style)\b([^>]*)>([\s\S]*?)<\/\1>/gi)){
  if(/id="cdq(?:DesktopV2517(?:Js|Css)|PcV16Js)"/.test(block[2]))continue;
  let unchanged=block[0].replaceAll(manifest.requiresBuild[0],manifest.build);
  // Only expose existing settings functions, with no change to mobile behavior.
  for(const p of manifest.patches.filter(p=>p.search==='function cdqCheckUpdate(){'))unchanged=unchanged.replace(p.search,p.replacement);
  assert.ok(after.includes(unchanged),block[2]||'anonymous block');
 }
 const pc=before.match(/<script id="cdqPcV16Js">([\s\S]*?)<\/script>/)[1];const gate=pc.slice(pc.indexOf('function wait()'),pc.indexOf("document.addEventListener('visibilitychange'",pc.indexOf('function wait()')));assert.ok(after.includes(gate));
});
test('400 conformity summaries use one property-service read after authorization',()=>{
 let reads=0,auth=0;const records=Object.fromEntries(Array.from({length:400},(_,i)=>['key'+i,JSON.stringify({totalFichiers:i})]));const c=vm.createContext({verifierDroit_:()=>auth++,PropertiesService:{getScriptProperties:()=>({getProperties:()=>{reads++;return records}})},cleResumeClientPC_:id=>'key'+id});
 vm.runInContext(change('function obtenirResumesConformiteClientsCDQ('),c);const result=c.obtenirResumesConformiteClientsCDQ(Array.from({length:400},(_,i)=>String(i)));assert.equal(Object.keys(result).length,400);assert.equal(auth,1);assert.equal(reads,1);
});
test('folder batching reads all pages, excludes system folders, and rejects unauthorized ancestors before Drive list/cache',()=>{
 let pages=[],cacheGets=0,allowed=true;const folder=id=>({getId:()=>id,getName:()=>id});
 const c=vm.createContext({verifierDroit_:()=>{},DriveApp:{getFolderById:folder},dossierEstSousAncetreCDQ_:()=>allowed,CONFIG:{MASTER_FOLDER_ID:'master'},CacheService:{getScriptCache:()=>({get:()=>{cacheGets++;return null},put:()=>{}})},empreinteCDQ_:x=>x,
 Drive:{Files:{list:options=>{pages.push(options);return options.pageToken?{files:[{id:'b',name:'B.pdf',mimeType:'application/pdf',size:'42'}]}:{nextPageToken:'next',files:[{id:'s',name:'_CDQ_System',mimeType:'application/vnd.google-apps.folder'},{id:'a',name:'A.pdf',mimeType:'application/pdf'}]}}}},estDossierSystemeCDQ_:f=>f.getName().startsWith('_CDQ_'),cdqV72Compatible_:f=>f.getMimeType()==='application/pdf',cdqV72MimeLabel_:()=> 'PDF',cdqV72Crumbs_:()=>[]});
 vm.runInContext(change('function obtenirContenuDossierPCRapideV79('),c);const r=c.obtenirContenuDossierPCRapideV79('folder','client',false);assert.deepEqual(Array.from(r.items,f=>f.id),['a','b']);assert.equal(pages.length,2);assert.equal(pages[0].pageSize,1000);assert.equal(pages[1].pageToken,'next');assert.equal(r.items[1].taille,42);
 allowed=false;assert.throws(()=>c.obtenirContenuDossierPCRapideV79('outside','client',false),/ne fait pas partie/);assert.equal(pages.length,2);assert.equal(cacheGets,1);
});
test('direct downloads authorize the target and never read a blob',()=>{
 let allow=true,checked=[];const c=vm.createContext({verifierDroit_:()=>{},verifierCibleDansMasterCDQ_:(kind,id)=>{checked.push([kind,id]);if(!allow)throw Error('Denied')},DriveApp:{getFileById:id=>({getMimeType:()=>id==='sheet'?'application/vnd.google-apps.spreadsheet':'application/pdf',getName:()=>id,getBlob:()=>{throw Error('must not transfer bytes')}})}});
 vm.runInContext(change('function obtenirLienTelechargementPCV2518(').split('function telechargerFichierPC')[0],c);assert.equal(c.obtenirLienTelechargementPCV2518('sheet').url,'https://docs.google.com/spreadsheets/d/sheet/export?format=xlsx');assert.match(c.obtenirLienTelechargementPCV2518('pdf').url,/export=download&id=pdf/);allow=false;assert.throws(()=>c.obtenirLienTelechargementPCV2518('private'),/Denied/);assert.equal(checked.length,3);
});
test('folder cache deduplicates, isolates accounts and ignores late responses',async()=>{
 const jobs=[];let owner='a@example.test';const st={explorer:{request:0,folderId:'',items:[],crumbs:[],client:{nom:'A'}},pcSelectedFiles:new Map()};
 const c=vm.createContext({st,Date,pc18Owner:()=>owner,renderMain:()=>{},toast:()=>{},gs:(name,args)=>new Promise((resolve,reject)=>jobs.push({name,args,resolve,reject}))});vm.runInContext(change('const pc18Folders='),c);
 const first=c.loadExplorerFolder('a','client',false),same=c.loadExplorerFolder('a','client',false);assert.equal(jobs.length,1);
 const newer=c.loadExplorerFolder('b','client',false);jobs[1].resolve({items:[{id:'new'}]});await newer;jobs[0].resolve({items:[{id:'old'}]});await Promise.all([first,same]);assert.equal(st.explorer.items[0].id,'new');
 await c.loadExplorerFolder('a','client',false);assert.equal(jobs.length,2);assert.equal(st.explorer.items[0].id,'old');
 const refresh=c.loadExplorerFolder('a','client',true);assert.equal(jobs.length,3);jobs[2].resolve({items:[{id:'refreshed'}]});await refresh;
 owner='b@example.test';const other=c.loadExplorerFolder('a','client',false);assert.equal(jobs.length,4);assert.equal(st.explorer.items.length,0);jobs[3].reject(Error('Denied'));await other;assert.equal(st.explorer.items.length,0);
});
test('PC startup removes the fixed 4.2 second delay but retains ready/access/load gate',()=>{
 const s=read('pc/index.html');assert.match(s,/PC_STABLE_REVEAL_MS = 150/);assert.match(s,/if\(!selectorReady \|\| selectorAwaitingAccess \|\| !iframeLoaded\)return/);assert.match(s,/if\(!pcStartupGate&&selectorReady&&!selectorAwaitingAccess&&iframeLoaded\)return true/);
});
