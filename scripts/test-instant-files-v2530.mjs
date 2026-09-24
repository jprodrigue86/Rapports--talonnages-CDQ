import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {gunzipSync} from 'node:zlib';
import {installInstantFiles2530,applyInstantFiles2530} from './instant-files-v2530.mjs';
const supplied=process.argv[2];
const input=supplied?fs.readFileSync(supplied):gunzipSync(fs.readFileSync('balance-cdq-android/web-source/Selector.html.gz'));
const source=input.toString('utf8'),patched=applyInstantFiles2530(source);
let scripts=0,checks=0;
for(const m of patched.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!m[1].includes('application/json')&&!m[1].includes('type="module"')){new vm.Script(m[2]);scripts++;}
assert.throws(()=>applyInstantFiles2530(patched));checks++;
const extract=(a,b)=>patched.slice(patched.indexOf(a),patched.indexOf(b,patched.indexOf(a)+a.length));
const initial=Date.parse('2026-09-24T10:00:00Z');
const old=()=>({id:'a',nom:'Ancien.pdf',dateModification:new Date(initial-10000).toISOString(),type:'PDF'});
const tree=()=>({id:'client',fichiers:[old()],dossiers:[{id:'sub',charge:true,fichiers:[],dossiers:[]}]});
function harness(){
 let clock=initial;const requests=[],renders=[],saved=[],timers=[],events={};const storage=new Map();
 const find=(root,id)=>{if(!root)return null;const i=(root.fichiers||[]).findIndex(f=>String(f.id)===String(id));if(i>=0)return{noeud:root,index:i,fichier:root.fichiers[i]};for(const child of root.dossiers||[]){const r=find(child,id);if(r)return r;}return null;};
 const ctx={console,Date:class extends Date{static now(){return clock;}},Map,JSON,navigator:{onLine:true},document:{hidden:false,getElementById:()=>null,addEventListener:(n,f)=>events[n]=f},utilisateurCourantEmail:'owner',cdqAccessState:'ready',compagnieSelectionnee:'client',cacheContenuCompagnies:{client:tree()},cacheDerniereVerificationCompagnies:{client:1},actualisationEnCours:false,fichierOuvertPourModification:null,
  sauvegarderCachePersistantClient:(...a)=>saved.push(a),afficherContenu:x=>renders.push(x),trouverFichierDansArbre:find,
  recupererFichierModification:()=>storage.get('fichierEnModification')||null,
  sessionStorage:{getItem:k=>storage.get(k)||null,removeItem:k=>storage.delete(k)},
  mettreAJourFichierDansCache:(client,m)=>{const f=find(ctx.cacheContenuCompagnies[client],m.id);Object.assign(f.fichier,m);ctx.cdqInstantFiles2530.keep(client,m,f.noeud.id);ctx.afficherContenu(ctx.cacheContenuCompagnies[client]);},
  setTimeout:(fn,delay)=>timers.push({fn,delay}),clearTimeout:()=>{},
  addEventListener:(n,f)=>events[n]=f,
  cdqApiRun:()=>{const r={withSuccessHandler(fn){this.success=fn;return this;},withFailureHandler(fn){this.failure=fn;return this;},obtenirMetaFichier(id){this.id=id;requests.push(this);}};return r;}
 };ctx.window=ctx;vm.createContext(ctx);vm.runInContext('('+installInstantFiles2530.toString()+')()',ctx);
 vm.runInContext(extract('function actualiserApresModification(){','function trierContenuRecursif('),ctx);
 vm.runInContext(extract('function trierContenuRecursif(','function afficherContenu('),ctx);
 return{ctx,requests,renders,saved,timers,events,storage,advance:ms=>clock+=ms};
}
function test(name,fn){fn();checks++;console.log('PASS',name);}
test('copy is inserted synchronously in its exact subfolder',()=>{const h=harness();assert.equal(h.ctx.cdqInstantFiles2530.confirm({ok:true,id:'b',nom:'Copie.pdf'},'client','sub',{type:'PDF'}),true);assert.equal(h.renders.length,1);assert.equal(h.ctx.cacheContenuCompagnies.client.dossiers[0].fichiers[0].id,'b');assert.equal(h.requests[0].id,'b');assert.equal(h.saved[0][2],1);});
test('copy is idempotent; existing sibling and new metadata preserved',()=>{const h=harness(),m={ok:true,id:'b',nom:'Copie.pdf'};h.ctx.cdqInstantFiles2530.confirm(m,'client','client');h.ctx.cdqInstantFiles2530.confirm(m,'client','client');const root=h.ctx.cacheContenuCompagnies.client;assert.equal(root.fichiers.length,2);assert.equal(root.fichiers[1].id,'a');h.requests[1].success({id:'b',nom:'Copie.pdf',dateModification:new Date(initial+200).toISOString()});assert.equal(root.fichiers[0]._cdqConfirmedAt2530,undefined);});
test('failed copy never creates a fake row',()=>{const h=harness();assert.equal(h.ctx.cdqInstantFiles2530.confirm({ok:false,id:'b',nom:'No'},'client','client'),false);assert.equal(h.renders.length,0);});
test('late metadata is ignored after account change',()=>{const h=harness();h.ctx.cdqInstantFiles2530.confirm({id:'b',nom:'B'},'client','client');h.ctx.utilisateurCourantEmail='other';h.requests[0].success({id:'b',nom:'Leaked'});assert.equal(h.renders.length,1);assert.notEqual(h.ctx.cacheContenuCompagnies.client.fichiers[0].nom,'Leaked');});
test('stale listing cannot erase a newly confirmed copy',()=>{const h=harness();h.ctx.cdqInstantFiles2530.confirm({id:'b',nom:'B'},'client','sub');const stale=tree();h.ctx.cdqInstantFiles2530.overlay('client',stale);assert.equal(stale.dossiers[0].fichiers[0].id,'b');});
test('newer Drive timestamp wins over receipt',()=>{const h=harness();h.ctx.cdqInstantFiles2530.keep('client',{id:'a',nom:'local',dateModification:new Date(initial).toISOString()},'client');const newer=tree();Object.assign(newer.fichiers[0],{nom:'server',dateModification:new Date(initial+1).toISOString()});h.ctx.cdqInstantFiles2530.overlay('client',newer);assert.equal(newer.fichiers[0].nom,'server');});
test('folder receipts never wipe already loaded folder contents',()=>{const h=harness();h.ctx.cdqInstantFiles2530.confirm({id:'b',nom:'Folder',kind:'folder'},'client','client');const next=tree();next.dossiers.push({id:'b',nom:'Folder',charge:true,fichiers:[old()],dossiers:[]});h.ctx.cdqInstantFiles2530.overlay('client',next);assert.equal(next.dossiers[1].charge,true);assert.equal(next.dossiers[1].fichiers.length,1);});
test('deleted receipts and expired receipts cannot resurrect a file',()=>{const h=harness();h.ctx.cdqInstantFiles2530.confirm({id:'b',nom:'B'},'client','client');h.ctx.cdqInstantFiles2530.forget('client',['b']);assert.equal(h.ctx.cdqInstantFiles2530.overlay('client',tree()).fichiers.length,1);h.ctx.cdqInstantFiles2530.confirm({id:'c',nom:'C'},'client','client');h.advance(30001);assert.equal(h.ctx.cdqInstantFiles2530.overlay('client',tree()).fichiers.length,1);});
test('new confirmed row sorts first without inventing a Drive timestamp',()=>{const h=harness();h.ctx.cdqInstantFiles2530.confirm({id:'b',nom:'B'},'client','client');const root=h.ctx.cacheContenuCompagnies.client;h.ctx.trierContenuRecursif(root);assert.equal(root.fichiers[0].id,'b');assert.equal(root.fichiers[0].dateModification,undefined);});
test('return begins metadata read immediately and does not clear unchanged edit',()=>{const h=harness();h.storage.set('fichierEnModification','a');h.storage.set('ancienneDateModification',old().dateModification);h.ctx.actualiserApresModification();assert.equal(h.requests.length,1);assert.equal(h.timers.length,0);for(let i=0;i<8;i++){h.requests[i].success(old());if(i<7)h.timers.shift().fn();}assert.equal(h.storage.get('fichierEnModification'),'a');assert.equal(h.ctx.actualisationEnCours,false);});
test('changed file is updated and re-sorted without client reload',()=>{const h=harness();h.storage.set('fichierEnModification','a');h.storage.set('ancienneDateModification',old().dateModification);h.ctx.actualiserApresModification();h.requests[0].success({...old(),dateModification:new Date(initial).toISOString()});assert.equal(h.renders.length,1);assert.equal(h.storage.has('fichierEnModification'),false);});
test('late return result does not mutate the next client or account',()=>{const h=harness();h.storage.set('fichierEnModification','a');h.ctx.actualiserApresModification();h.ctx.compagnieSelectionnee='other';h.requests[0].success({...old(),dateModification:new Date(initial).toISOString()});assert.equal(h.renders.length,0);assert.equal(h.storage.get('fichierEnModification'),'a');});
test('hidden and offline views perform no unnecessary metadata request',()=>{const h=harness();h.storage.set('fichierEnModification','a');h.ctx.document.hidden=true;h.ctx.actualiserApresModification();assert.equal(h.requests.length,0);h.ctx.document.hidden=false;h.ctx.navigator.onLine=false;h.ctx.actualiserApresModification();assert.equal(h.requests.length,0);});
test('an old return request cannot release a newer active job',()=>{const h=harness();h.storage.set('fichierEnModification','a');h.ctx.actualiserApresModification();h.storage.set('fichierEnModification','b');h.ctx.actualiserApresModification();h.requests[0].success(old());assert.equal(h.ctx.actualisationEnCours,true);});
console.log(JSON.stringify({checks,scripts,sourceBytes:input.length,patchedBytes:Buffer.byteLength(patched)},null,2));
