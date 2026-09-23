// Node doubles exercise the real controller. These are not browser or live Google tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createOfflineTemplates} from '../offline-templates-v2526.mjs';
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
const request=h=>({type:'CDQ_OFFLINE_DOCUMENT_STORE',email:'tech@example.invalid',requestId:'request_one',fileId:'pdf_one',clientId:'client_one',clientName:'Compagnie Un',name:'Un.pdf',revision:'revision_one',blob:h.blank});
test('prepared documents are committed before acknowledgement, isolated by account, removable without deleting Drive',async t=>{
 const h=setup(t);await h.session();await h.ctl.handle(request(h));assert.equal(h.sent.at(-1).ok,true);assert.equal(h.tables.get('copies').size,1);
 await h.session('other@example.invalid');await h.openPanel();assert.equal(h.nodes().some(n=>n.textContent?.includes('Un.pdf')),false);
 await h.ctl.handle({...request(h),requestId:'wrong-account'});assert.equal(h.tables.get('copies').size,1);
 await h.session();await h.ctl.handle({type:'CDQ_OFFLINE_DOCUMENT_REMOVE',requestId:'remove',fileId:'pdf_one'});assert.equal(h.sent.at(-1).ok,true);
 const doc=[...h.tables.get('copies').values()][0];assert.equal(doc.removed,true);assert.equal(doc.blob,null);
 await h.ctl.handle({type:'CDQ_OFFLINE_DOCUMENT_LIST',requestId:'list'});assert.deepEqual(h.sent.at(-1).removed,['pdf_one']);assert.equal(h.sent.some(x=>x.type==='CDQ_OFFLINE_SAVE'),false);
});
test('prepared edits keep original revision, reject refresh/removal until sync, reject saves after lock',async t=>{
 const h=setup(t);await h.session();await h.ctl.handle(request(h));await h.openPanel();await h.nodes().find(n=>n.textContent==='Ouvrir').onclick();
 const reader=h.opened.at(-1);await reader.onSave(new Blob(['%PDF-1.7\nmodified'],{type:'application/pdf'}),'edit-request');
 await h.ctl.handle({...request(h),requestId:'refresh'});assert.equal(h.sent.at(-1).ok,false);
 await h.ctl.handle({type:'CDQ_OFFLINE_DOCUMENT_REMOVE',requestId:'remove',fileId:'pdf_one'});assert.equal(h.sent.at(-1).ok,false);
 navigator.onLine=true;await h.session();const message=h.sent.find(m=>m.type==='CDQ_OFFLINE_SAVE');assert.equal(message.revision,'revision_one');assert.equal(message.driveId,'pdf_one');
 await h.ctl.handle({type:'CDQ_OFFLINE_SAVE_RESULT',requestId:message.requestId,uploadId:message.uploadId,ok:false,message:'Conflit de révision'});
 assert.equal([...h.tables.get('copies').values()][0].status,'pending');
 h.ctl.lock();await assert.rejects(()=>reader.onSave(h.blank,'after-lock'),/Déverrouillez/);
});
test('locking during PDF verification prevents a late write or acknowledgement',async t=>{
 const h=setup(t);await h.session();let release,started;
 const gate=new Promise(r=>started=r);class Delayed extends Blob{slice(){return {text:()=>new Promise(r=>{release=()=>r('%PDF-');started();})};}}
 const operation=h.ctl.handle({...request(h),blob:new Delayed(['%PDF-1.7 test'],{type:'application/pdf'})});await gate;h.ctl.lock();release();await operation;
 assert.equal(h.tables.get('copies').size,0);assert.equal(h.sent.some(m=>m.requestId==='request_one'),false);
});

test('main-list edits use a durable shared version, reject stale editors and generate server-valid upload IDs',async t=>{
 const h=setup(t);await h.session();await h.ctl.handle(request(h));
 await h.ctl.handle({type:'CDQ_OFFLINE_DOCUMENT_GET',requestId:'get-main',fileId:'pdf_one'});const d=h.sent.at(-1).document;assert.equal(d.editVersion,0);
 const edit={type:'CDQ_OFFLINE_DOCUMENT_EDIT',requestId:'edit-main',fileId:'pdf_one',saveId:'save-test-123456789',editVersion:0,blob:new Blob(['%PDF-1.7 modified'],{type:'application/pdf'})};await h.ctl.handle(edit);assert.equal(h.sent.at(-1).ok,true);
 const c=[...h.tables.get('copies').values()][0];assert.match(c.uploadId,/^[a-zA-Z0-9_-]{8,100}$/);assert.equal(c.editVersion,1);
 await h.ctl.handle({...edit,saveId:'save-stale-123456789'});assert.equal(h.sent.at(-1).ok,false);assert.match(h.sent.at(-1).message,/autre fenêtre/);
 await h.ctl.handle({type:'CDQ_OFFLINE_DOCUMENT_REMOVE',requestId:'remove',fileId:'pdf_one'});assert.equal(h.sent.at(-1).ok,false);
});
test('a save made during an upload retains its bytes and chains against the acknowledged Drive revision',async t=>{
 const h=setup(t);await h.session();await h.ctl.handle(request(h));navigator.onLine=true;
 const edit={type:'CDQ_OFFLINE_DOCUMENT_EDIT',requestId:'edit-1',fileId:'pdf_one',saveId:'save-first-123456789',editVersion:0,blob:new Blob(['%PDF-1.7 first'],{type:'application/pdf'})};await h.ctl.handle(edit);const first=h.sent.find(m=>m.type==='CDQ_OFFLINE_SAVE');assert.ok(first);
 await h.ctl.handle({...edit,requestId:'edit-2',saveId:'save-second-123456789',editVersion:1,blob:new Blob(['%PDF-1.7 second'],{type:'application/pdf'})});
 await h.ctl.handle({type:'CDQ_OFFLINE_SAVE_RESULT',requestId:first.requestId,uploadId:first.uploadId,ok:true,id:first.driveId,revision:'revision_two'});
 const next=h.sent.filter(m=>m.type==='CDQ_OFFLINE_SAVE').at(-1);assert.notEqual(next.uploadId,first.uploadId);assert.equal(next.revision,'revision_two');assert.equal(await next.blob.text(),'%PDF-1.7 second');
});

test('Sheets stay distinct from PDF uploads, require explicit confirmation and never delete Google content',async t=>{
 const h=setup(t);await h.session();const add={type:'CDQ_OFFLINE_SHEET_STORE',requestId:'sheet-add',fileId:'sheet_one',clientId:'client_one',clientName:'Compagnie Un',name:'Balance plancher',account:'google@example.invalid'};
 await h.ctl.handle(add);assert.equal(h.sent.at(-1).ok,true);
 await h.ctl.handle({type:'CDQ_OFFLINE_SHEET_LIST',requestId:'sheet-list'});assert.equal(h.sent.at(-1).sheets[0].confirmed,false);
 await h.ctl.handle({...add,confirmed:true});await h.session('other@example.invalid');
 await h.ctl.handle({type:'CDQ_OFFLINE_SHEET_LIST',requestId:'other-list'});assert.deepEqual(h.sent.at(-1).sheets,[]);
 await h.session();navigator.onLine=true;await h.session();assert.equal(h.sent.some(x=>x.type==='CDQ_OFFLINE_SAVE'||x.type==='CDQ_OFFLINE_COPY'),false);
 await h.ctl.handle({type:'CDQ_OFFLINE_SHEET_LIST',requestId:'own-list'});assert.equal(h.sent.at(-1).sheets[0].confirmed,true);
 await h.ctl.handle({type:'CDQ_OFFLINE_SHEET_REMOVE',requestId:'sheet-remove',fileId:'sheet_one'});
 assert.equal([...h.tables.get('copies').values()][0].removed,true);assert.equal(h.sent.some(x=>/DELETE|SAVE|COPY/.test(x.type)),false);
});
