import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
const read=n=>fs.readFileSync('bundles/balance-cdq/v25.25/files/'+n,'utf8');
function sample(){const rows=Array.from({length:75},()=>Array(100).fill(''));const set=(r,c,v)=>rows[r-1][c-1]=v;for(const [r,c,v] of [[14,4,'Client :'],[14,5,'Client test'],[14,40,'Ville :'],[14,41,'Ville test'],[23,1,'Type :'],[23,5,'Balance de plancher'],[29,47,'2268Kg x 0.5Kg'],[35,19,'TRUE'],[37,82,'Charge:'],[37,89,'200'],[48,1,'Étendue de la balance utilisée :'],[48,19,'200 kg'],[50,6,'Poids'],[50,25,'Charge utilisée'],[50,44,'Avant correction'],[50,63,'Tolérance'],[50,82,'Après correction'],[51,6,'200'],[51,25,'9999'],[51,44,'201'],[51,63,'9999'],[51,82,'200'],[57,67,"Poids étalons utilisés pour l'étalonnage :"],[57,68,'Kit test'],[69,10,'Technicien test'],[69,47,"Date d'étalonnage :"],[69,58,'25'],[69,61,'8'],[69,64,'26'],[69,79,'Date due :'],[69,88,'8'],[69,91,'27']])set(r,c,v);for(let i=0;i<4;i++){set(43,57+11*i,String(i+1));set(44,57+11*i,String(200+i*.5));set(45,57+11*i,'200');}return rows;}

function harness(){
 const props=new Map(),journals=new Map(),files=new Map(),triggers=[];let activeOwner=true,revision='r1',collide=false,lost=false,creates=0;
 const destination='1XWvvenKIbZxqWUAhDyVQIM0gIPzzJ1IP',client='client_abcdefgh',sheet='sheet_abcdefgh';
 const state={version:2,id:'job-id',owner:'owner@example.invalid',clientId:client,clientName:'Client test',status:'running',phase:'convert',folders:[],scan:0,queue:[{id:sheet,name:'Balance A',clientId:client,clientName:'Client test',status:'pending'}]};
 const file={isTrashed:()=>false,getId:()=> 'journal_test',getBlob:()=>({getDataAsString:()=>journals.get(client)}),setContent:s=>{if(lost){lost=false;throw Error('Checkpoint perdu');}journals.set(client,s)}};
 journals.set(client,JSON.stringify(state));props.set('CDQ_FLOOR_ACTIVE_V2525',client);props.set('CDQ_FLOOR_CLIENT_V2525_'+client,'journal_test');
 const lock={tryLock:()=>true,releaseLock(){}};
 const c=vm.createContext({Date,JSON,console,Uint8Array,CONFIG:{MASTER_FOLDER_ID:'root_original'},
  verifierProprietairePrincipal_:()=>{if(!activeOwner)throw Error('PROPRIETAIRE');return {email:'owner@example.invalid'}},
  obtenirAdministrateurPrincipal_:()=> 'owner@example.invalid',Session:{getEffectiveUser:()=>({getEmail:()=> 'owner@example.invalid'})},
  LockService:{getScriptLock:()=>lock},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)||null,setProperty:(k,v)=>props.set(k,v)})},
  Utilities:{getUuid:()=>crypto.randomUUID(),newBlob:b=>b},
  ScriptApp:{getProjectTriggers:()=>triggers,newTrigger:name=>({timeBased:()=>({everyMinutes:n=>({create:()=>triggers.push({getHandlerFunction:()=>name,interval:n})})})}),deleteTrigger:t=>triggers.splice(triggers.indexOf(t),1)},
  DriveApp:{getFileById:()=>file,getFolderById:()=>({createFile:(n,s)=>{journals.set(client,s);return file}})},
  SpreadsheetApp:{openById:()=>({getSheets:()=>[{getName:()=> 'Feuil1',getLastRow:()=>75,getLastColumn:()=>100,getRange:()=>({getDisplayValues:sample})}]})},
  Drive:{Files:{generateIds:()=>({ids:['reserved_pdf']}),get:id=>{if(!files.has(id))throw Error('404');return files.get(id)},create:m=>{creates++;files.set(m.id,{...m,trashed:false});return {id:m.id}}}},
  cdqDriveIdV2521_:id=>id,
  cdqDriveScopeV2521_:id=>id===client?{meta:{id:client,name:'Client test',mimeType:'application/vnd.google-apps.folder'},path:[{id:'root_original'},{id:client}]}:id==='reports_test'?{meta:{id,name:'Rapports d’étalonnages',mimeType:'application/vnd.google-apps.folder'},path:[{id:destination},{id:'dest_client',nom:'Client test'},{id}]}:{meta:{id,name:'Balance A',modifiedTime:revision,mimeType:'application/vnd.google-apps.spreadsheet'},path:[{id:'root_original'},{id:client},{id}]}
 });
 vm.runInContext(read('CDQFloorMapping.gs')+'\n'+read('CDQFloorMigration.gs'),c);
 c.cdq23Folder_=()=> 'dest_client';c.cdq23Reports_=()=> 'reports_test';c.cdq23List_=(parent,q)=>({files:collide&&q.startsWith('name=')?[{id:'unrelated',name:'Balance A.pdf'}]:[]});c.cdq25FillPdf_=async values=>{assert.equal(values.charge_point_1_charge_contrainte,'9999');return new Uint8Array([37,80,68,70,45,49])};
 return {c,client,props,journals,files,triggers,setOwner:v=>activeOwner=v,setCollision:()=>collide=true,get creates(){return creates},get state(){return JSON.parse(journals.get(client))},write:s=>journals.set(client,JSON.stringify(s)),changeSource:()=>revision='r2',loseCheckpoint:()=>lost=true};
}
test('Charge utilisée maps to charge de contrainte while Poids stays the test load',()=>{const h=harness(),v=h.c.cdq23ParseSheet_(sample()).values;assert.equal(v.charge_point_1_charge_contrainte,'9999');assert.equal(v.charge_point_1_charge_utilisee,'200');assert.equal(v.charge_point_1_tolerance,undefined);});
test('New job scopes the scan to the selected client and registers a server trigger',()=>{const h=harness();h.props.delete('CDQ_FLOOR_CLIENT_V2525_'+h.client);h.props.delete('CDQ_FLOOR_ACTIVE_V2525');h.c.demarrerConversionPlancherCDQV2525(h.client,false);assert.equal(h.state.folders[0].id,h.client);assert.equal(h.state.folders.length,1);assert.equal(h.triggers[0].interval,1);h.setOwner(false);assert.throws(()=>h.c.demarrerConversionPlancherCDQV2525(h.client),/PROPRIETAIRE/);});
test('Background worker runs without browser/RPC session and creates exactly the original title',async()=>{const h=harness();h.setOwner(false);await h.c.cdq25FloorWorker_();assert.equal(h.creates,1);assert.equal(h.files.get('reserved_pdf').name,'Balance A.pdf');assert.equal(h.files.get('reserved_pdf').parents[0],'reports_test');assert.equal(h.state.queue[0].status,'done');await h.c.cdq25FloorWorker_();assert.equal(h.state.status,'completed');assert.equal(h.creates,1);});
test('A title collision never invents a suffix or overwrites an unrelated PDF',async()=>{const h=harness();h.setCollision();await h.c.cdq25FloorWorker_();assert.equal(h.creates,0);assert.match(h.state.queue[0].error,/Aucun suffixe/);});
test('Recovery of a reserved uploaded PDF is idempotent after a lost checkpoint',async()=>{const h=harness();await h.c.cdq25FloorWorker_();const s=h.state;s.queue[0].status='processing';h.write(s);await h.c.cdq25FloorWorker_();assert.equal(h.creates,1);assert.equal(h.state.queue[0].status,'done');});
test('Source revision is checked again after rendering',async()=>{const h=harness();h.c.cdq25FillPdf_=async()=>{h.changeSource();return new Uint8Array([37,80,68,70,45])};await h.c.cdq25FloorWorker_();assert.equal(h.creates,0);assert.match(h.state.queue[0].error,/changé/);});
test('Real PDF renderer works with no DOM or timers and preserves editable calculations and artwork',async()=>{
 const bytes=fs.readFileSync('assets/templates/balance-plancher-v2519.pdf'),c=vm.createContext({Uint8Array,cdqBlobEmbarque_:()=>({getBytes:()=>Array.from(bytes)})});
 vm.runInContext(read('CDQPdfLib.gs')+'\n'+read('CDQFloorPdf.gs'),c);
 const values={client_nom:'Client fictif — QA',client_technicien:'Historique',capacite_maximale:'2268',echelon:'0.5',unite_mesure:'kg',charge_point_1_charge_utilisee:'200',charge_point_1_charge_contrainte:'250',charge_point_1_avant_correction:'201',charge_point_1_apres_correction:'200'};
 const output=await c.cdq25FillPdf_(values),lib=c.cdq25PdfLib_(),doc=await lib.PDFDocument.load(output,{parseSpeed:Infinity}),form=doc.getForm();
 for(const [k,v] of Object.entries(values)){const f=form.getField(k);assert.equal(f.getText?.()||f.getSelected?.()[0],v,k);}
 assert.equal(form.getTextField('charge_point_1_erreur_avant').getText(),'2');assert.equal(form.getTextField('charge_point_1_tolerance').getText(),'1');assert.equal(doc.getPageCount(),1);assert.ok(form.getField('charge_point_1_erreur_avant').acroField.dict.has(lib.PDFName.of('AA')));
 fs.writeFileSync('/tmp/cdq-v2525-server.pdf',output);
});
