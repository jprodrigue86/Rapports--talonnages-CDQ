// Node doubles exercise the real controller. These are not browser or live Google tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createOfflineTemplates} from '../offline-templates-v2519.mjs';
class Element {
  constructor(tag){this.tag=tag;this.children=[];this.style={};this.hidden=false;}
  setAttribute(){} append(...children){this.children.push(...children);} replaceChildren(...children){this.children=children;}
}
function setup(t){
  const body=new Element('body'),sent=[],opened=[],tables=new Map(['state','destinations','copies'].map(k=>[k,new Map()]));
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:false}});
  globalThis.document={body,createElement:tag=>new Element(tag)};
  globalThis.window={addEventListener(){},confirm:()=>true};
  const storage={get:async(s,id)=>structuredClone(tables.get(s).get(id)),put:async(s,v)=>tables.get(s).set(v.id,structuredClone(v)),all:async s=>[...tables.get(s).values()].map(v=>structuredClone(v))};
  const ctl=createOfflineTemplates({send:m=>sent.push(m),unlock:async()=>{},openPdf:m=>opened.push(m),storage});t.after(()=>ctl.lock());
  const session=(email='tech@example.invalid',canWrite=true)=>ctl.handle({type:'CDQ_OFFLINE_SESSION',email,canWrite,protocol:38});
  const blank=new Blob(['%PDF-1.7\noriginal\n%%EOF'],{type:'application/pdf'});
  const template=()=>ctl.handle({type:'CDQ_OFFLINE_TEMPLATE',modeleId:'camion',blob:blank,templateId:'master_camion',modifieLe:100});
  const request={type:'CDQ_OFFLINE_CREATE_LOCAL',requestId:'local_request_123',modeleId:'camion',clientId:'client_1',folderId:'folder_1',destinationName:'Client / Atelier'};
  const nodes=()=>{const flat=e=>[e,...e.children.flatMap(flat)];return flat(body);};
  const openPanel=async()=>{nodes().find(n=>n.id==='cdq-offline-launch').onclick();await ctl.refresh();};
  return {ctl,storage,sent,opened,tables,session,template,blank,request,nodes,openPanel};
}
test('Copie issue du bouton camion : écriture durable avant accusé et réessai sans doublon',async t=>{
 const h=setup(t);await h.session();await h.template();await h.ctl.handle(h.request);await h.ctl.handle(h.request);
 assert.equal(h.tables.get('copies').size,1);const c=await h.storage.get('copies',h.request.requestId);
 assert.equal(c.destination.folderId,'folder_1');assert.equal(await c.blob.text(),await h.blank.text());
 assert.equal(h.sent.filter(m=>m.type==='CDQ_OFFLINE_CREATE_LOCAL_RESULT'&&m.ok).length,2);
});
test('Lecture seule et collision avec un autre compte : aucune copie supplémentaire',async t=>{
 const h=setup(t);await h.session();await h.template();await h.ctl.handle(h.request);
 await h.session('other@example.invalid');await h.template();await h.ctl.handle(h.request);assert.equal(h.sent.at(-1).ok,false);
 await h.session('viewer@example.invalid',false);await h.template();await h.ctl.handle({...h.request,requestId:'local_request_456'});
 assert.equal(h.sent.at(-1).ok,false);assert.equal(h.tables.get('copies').size,1);
});
test('PDF incomplet rejeté avant de remplacer le modèle approuvé',async t=>{
 const h=setup(t);await h.session();await h.template();
 await h.ctl.handle({type:'CDQ_OFFLINE_TEMPLATE',modeleId:'camion',templateId:'bad',blob:new Blob(['NOT A PDF FILE'],{type:'application/pdf'})});
 const c=await h.storage.get('state','template:tech@example.invalid:camion');assert.equal(c.templateId,'master_camion');
});
test('Enregistrement rempli conservé, identifiant stable et consultation du maître en lecture seule',async t=>{
 const h=setup(t);await h.session();await h.template();await h.ctl.handle(h.request);await h.openPanel();
 await h.nodes().find(n=>n.textContent==='Consulter le modèle').onclick();assert.equal(h.opened.at(-1).readOnly,true);
 await h.nodes().find(n=>n.textContent==='Ouvrir la copie').onclick();const reader=h.opened.at(-1);
 const blob=new Blob(['%PDF-1.7\nanswers\n%%EOF'],{type:'application/pdf'});await reader.onSave(blob,'save-request123');await reader.onSave(blob,'save-request123');
 const copy=await h.storage.get('copies',h.request.requestId);assert.equal(await copy.blob.text(),await blob.text());assert.equal(copy.editVersion,1);assert.equal(copy.status,'pending');
 h.ctl.lock();await assert.rejects(()=>reader.onSave(blob,'save-request456'),/Déverrouillez/);
});
test('Reconnexion protocole 38 : le PDF rempli est acquitté séparément de la copie vierge',async t=>{
 const h=setup(t);await h.session();await h.template();await h.ctl.handle(h.request);await h.openPanel();
 await h.nodes().find(n=>n.textContent==='Ouvrir la copie').onclick();await h.opened.at(-1).onSave(new Blob(['%PDF-1.7\nanswers\n%%EOF'],{type:'application/pdf'}),'save-answers123');
 navigator.onLine=true;await h.session();assert.equal(h.sent.at(-1).type,'CDQ_OFFLINE_COPY');
 await h.ctl.handle({type:'CDQ_OFFLINE_COPY_RESULT',requestId:h.request.requestId,ok:true,id:'blank_drive'});
 const save=h.sent.at(-1);assert.equal(save.type,'CDQ_OFFLINE_SAVE');assert.equal((await h.storage.get('copies',h.request.requestId)).status,'pending');
 await h.ctl.handle({type:'CDQ_OFFLINE_SAVE_RESULT',requestId:h.request.requestId,uploadId:save.uploadId,ok:true,id:'filled_drive'});
 assert.equal((await h.storage.get('copies',h.request.requestId)).status,'synced');
});
test('Plancher : première copie hors ligne sans préparation, ancien maître ignoré, lecteur après stockage',async t=>{
 const h=setup(t);await h.session();
 const {floorTemplate,meta}=await import('../floor-template-v2519.mjs');const master=await floorTemplate();
 await h.storage.put('state',{id:'template:tech@example.invalid:plancher',modeleId:'plancher',templateId:'old_floor',blob:h.blank});
 const request={...h.request,modeleId:'plancher',open:true};await h.ctl.handle(request);
 const c=await h.storage.get('copies',request.requestId);assert.equal(c.templateId,meta.templateId);
 assert.deepEqual(Buffer.from(await c.blob.arrayBuffer()),Buffer.from(await master.blob.arrayBuffer()));
 assert.equal(h.opened.length,1);assert.equal(h.opened[0].fileId,c.id);assert.equal(h.opened[0].readOnly,false);
 assert.equal(h.sent.filter(m=>m.type==='CDQ_OFFLINE_COPY'||m.type==='CDQ_OFFLINE_PREPARE').length,0);
 assert.equal(h.nodes().find(n=>n.id==='cdq-offline-launch').hidden,false);
 await h.ctl.handle(request);assert.equal(h.tables.get('copies').size,1);
 const filled=new Blob(['%PDF-1.7\nfilled-floor\n%%EOF'],{type:'application/pdf'});await h.opened[0].onSave(filled,'save-floor123');
 navigator.onLine=true;await h.session();const copy=h.sent.at(-1);assert.equal(copy.type,'CDQ_OFFLINE_COPY');assert.equal(copy.templateId,meta.templateId);
 await h.ctl.handle({type:'CDQ_OFFLINE_COPY_RESULT',requestId:c.id,ok:true,id:'floor_drive'});
 const save=h.sent.at(-1);assert.equal(save.type,'CDQ_OFFLINE_SAVE');assert.equal(await save.blob.text(),await filled.text());
 await h.ctl.handle({type:'CDQ_OFFLINE_SAVE_RESULT',requestId:c.id,uploadId:save.uploadId,ok:true,id:'floor_filled'});
 assert.equal((await h.storage.get('copies',c.id)).status,'synced');
 assert.equal((await floorTemplate()).blob.size,628837);
});
test('Plancher : écriture refusée au lecteur et isolation entre comptes',async t=>{
 const h=setup(t),req={...h.request,modeleId:'plancher',open:true};await h.session('viewer@example.invalid',false);await h.ctl.handle(req);
 assert.equal(h.sent.at(-1).ok,false);assert.equal(h.tables.get('copies').size,0);assert.equal(h.opened.length,0);
 await h.session();await h.ctl.handle(req);const reader=h.opened.at(-1);
 await h.session('other@example.invalid');await h.ctl.handle(req);assert.equal(h.sent.at(-1).ok,false);
 await assert.rejects(()=>reader.onSave(h.blank,'save-other123'),/Déverrouillez/);
 assert.equal(h.tables.get('copies').size,1);
});
