import test from 'node:test';
import assert from 'node:assert/strict';
import {MODELS,validPdf,validTemplate,validDestination,makeCopy,syncRequest,nextSync,applyResult} from '../offline-templates-v2519.mjs';
const blank=new Blob(['%PDF-1.7\nmaster\n%%EOF'],{type:'application/pdf'});
const filled=new Blob(['%PDF-1.7\nfilled answers\n%%EOF'],{type:'application/pdf'});
const destination={clientId:'client_1',folderId:'folder_1',name:'Client / Atelier'};
const make=(key='cuve4')=>makeCopy({modeleId:key,templateId:'master_'+key,modifieLe:123,blob:blank},destination,'tech@example.invalid','local_test_1234');
for(const key of Object.keys(MODELS))test('Modèle distinct et PDF préservé : '+key,async()=>{
 const c=make(key);assert.equal(c.modeleId,key);assert.match(c.name,/\.pdf$/);assert(c.name.startsWith(MODELS[key]));
 assert.equal(await c.blob.text(),await blank.text());assert.equal(c.destination.folderId,'folder_1');
 assert.equal(nextSync(c,38).modeleId,key);assert.equal(syncRequest(c).requestId,c.id);
});
test('Modèles inconnus, destination vide et ID injecté refusés',()=>{
 assert.equal(validTemplate({modeleId:'__proto__',blob:blank,templateId:'a'}),false);
 assert.equal(validDestination({...destination,folderId:'../system'}),false);
 assert.equal(validDestination({...destination,name:''}),false);
 assert.throws(()=>makeCopy({modeleId:'cuve4',templateId:'a',blob:blank},destination,'a','bad!'));
});
test('Faux MIME, PDF vide et PDF trop gros refusés',()=>{
 assert.equal(validPdf(new Blob(['%PDF-x'],{type:'text/plain'})),false);
 assert.equal(validPdf(new Blob([],{type:'application/pdf'})),false);
 assert.equal(validPdf(new Blob([new Uint8Array(32*1024*1024+1)],{type:'application/pdf'})),false);
});
test('Copies vierges multi-modèles compatibles avec le serveur publié en parallèle',()=>{
 for(const key of Object.keys(MODELS))assert.equal(nextSync(make(key),0).modeleId,key);
});
test('Réponse de copie vierge ne marque jamais le PDF rempli comme synchronisé',async()=>{
 const c={...make(),blob:filled,uploadId:'edit_1',editVersion:1};
 const result=applyResult(c,{type:'CDQ_OFFLINE_COPY_RESULT',requestId:c.id,ok:true,id:'drive_blank'});
 assert.equal(result.status,'pending');assert.equal(result.driveId,'drive_blank');assert.equal(result.uploadId,'edit_1');
 assert.equal(await result.blob.text(),await filled.text());assert.equal(nextSync(result,38).type,'CDQ_OFFLINE_SAVE');
 assert.equal(nextSync(result,0),null);
});
test('Seul le bon accusé d’enregistrement acquitte le bon contenu',()=>{
 const c={...make(),blob:filled,driveId:'drive_blank',uploadId:'edit_2'};
 const stale=applyResult(c,{type:'CDQ_OFFLINE_SAVE_RESULT',requestId:c.id,uploadId:'edit_1',ok:true,id:'filled_old'});
 assert.notEqual(stale.status,'synced');
 const ok=applyResult(c,{type:'CDQ_OFFLINE_SAVE_RESULT',requestId:c.id,uploadId:'edit_2',ok:true,id:'filled_new'});
 assert.equal(ok.status,'synced');assert.equal(ok.syncedUploadId,'edit_2');assert.equal(ok.filledDriveId,'filled_new');
 assert.equal(ok.driveId,'drive_blank');assert.equal(nextSync(ok,38),null);
});
test('Échec réseau ou réponse invalide conserve les données et une requête identique',()=>{
 const c=make();const fail=applyResult(c,{type:'CDQ_OFFLINE_COPY_RESULT',requestId:c.id,ok:false,message:'Réseau indisponible'});
 assert.deepEqual(nextSync(fail,38),nextSync(c,38));assert.equal(fail.blob,c.blob);
 const invalid=applyResult(c,{type:'CDQ_OFFLINE_COPY_RESULT',requestId:c.id,ok:true,id:'../bad'});assert.equal(invalid,c);
 const unrelated=applyResult(c,{type:'CDQ_OFFLINE_COPY_RESULT',requestId:'another',ok:true,id:'remote'});assert.equal(unrelated,c);
});
test('Copie vierge acquittée et ancien format V21.37 préservés',()=>{
 const c=make();delete c.editVersion;delete c.uploadId;delete c.syncedUploadId;
 const done=applyResult(c,{type:'CDQ_OFFLINE_COPY_RESULT',requestId:c.id,ok:true,id:'drive_1'});
 assert.equal(done.status,'synced');assert.equal(done.blob,c.blob);assert.equal(nextSync(done,0),null);
});
