import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash, webcrypto} from 'node:crypto';

const routeSource=fs.readFileSync('bundles/balance-cdq/v25.10/document-open.js','utf8');
const manager=fs.readFileSync('apps-script-manager/app.js','utf8');
function routing(initial={},userAgent='BalanceCDQAndroid/25.11'){
  const store=new Map(Object.entries(initial)), launches=[],handlers={};
  const row={dataset:{fileName:'Rapport.pdf',fileType:'PDF'},classList:{contains:()=>false},querySelector:()=>({dataset:{fileId:'FILE_1234567890'}})};
  const context=vm.createContext({URLSearchParams,Date,localStorage:{getItem:k=>store.get(k)??null},navigator:{userAgent},
    document:{querySelector:()=>({closest:()=>row}),createElement:()=>({style:{},click(){launches.push(this.href)},remove(){}}),body:{appendChild(){},classList:{contains:()=>false}},addEventListener:(name,fn)=>{(handlers[name]??=[]).push(fn)}},
    utilisateurCourantRole:'technicien', modeSelectionFichiers:false});
  context.window=context;
  vm.runInContext(routeSource,context);
  return {context,api:context.cdqDocumentOpen,launches,handlers,row,store};
}
for(const email of ['', 'tech@example.com'])for(const reader of ['ask','acrobat']){
  test(`document preferences: account=${email||'ask'} reader=${reader}`,()=>{
    const r=routing({cdqDefaultGoogleAccountV2294:email,cdqPdfReaderPreferenceV1:reader});
    assert.equal(r.api.open('FILE_1234567890'),true);
    const url=r.launches[0], params=new URLSearchParams(url.slice(url.indexOf('?')+1,url.indexOf('#')));
    assert.equal(params.get('account'),email);
    assert.equal(params.get('accountMode'),email?'default':'ask');
    assert.equal(params.get('reader'),reader);
    assert.ok(url.includes('scheme=cdqpdf;'));
    assert.ok(!url.includes('browser_fallback_url'));
  });
}
test('clearing the visible default never resurrects a legacy or signed-in account',()=>{
  const r=routing({cdqDefaultGoogleAccountV2299:'old@example.com',cdqDefaultGoogleAccountV2298:'older@example.com'});
  r.context.utilisateurCourantEmail='signed-in@example.com';
  assert.equal(r.api.account(),'');
});
test('one pointer gesture launches once; swiping, long press and selection do not launch',()=>{
  const r=routing();let now=1000;r.context.Date={now:()=>now};
  const target={closest:selector=>selector==='.file-row'?r.row:null};
  let stopped=0;
  const emit=(name,extra={})=>(r.handlers[name]||[]).forEach(fn=>fn({target,pointerId:1,clientX:0,clientY:0,preventDefault(){},stopImmediatePropagation(){stopped++},...extra}));
  emit('pointerdown');emit('pointerup');emit('click');emit('click');
  assert.equal(r.launches.length,1);
  now+=1000;emit('pointerdown');emit('pointermove',{clientX:40});emit('pointerup');
  const beforeDragClick=stopped;emit('click');assert.equal(stopped,beforeDragClick+1,'drag must not reach a legacy click opener');
  assert.equal(r.launches.length,1);
  now+=1000;emit('pointerdown');now+=1200;emit('pointerup');emit('click');
  assert.equal(r.launches.length,1);
  now+=1000;r.context.modeSelectionFichiers=true;emit('click');assert.equal(r.launches.length,1);
});
test('Sheets and archived TXT notes use the same explicit account contract',()=>{
  for(const [type,name,scheme] of [['GOOGLE_SHEETS','Balance','sheet'],['AUTRE','Note.txt','note']]){
    const r=routing();r.row.dataset={fileType:type,fileName:name};r.api.open('FILE_1234567890');
    assert.ok(r.launches[0].includes('scheme=cdq'+scheme+';'));
    assert.ok(r.launches[0].includes('accountMode=ask'));
  }
});
test('read-only role is carried to Android; invalid ids never leave the page',()=>{
  const r=routing();r.context.utilisateurCourantRole='lecture';
  assert.equal(r.api.open('../invalid'),false);assert.equal(r.launches.length,0);
  r.api.open('FILE_1234567890');assert.ok(r.launches[0].includes('readOnly=1'));
});
test('PC and explicit internal reader retain their established entry point',()=>{
  assert.equal(routing({},'Windows').api.open('FILE_1234567890'),false);
  assert.equal(routing({cdqPdfReaderPreferenceV1:'cdq'}).api.open('FILE_1234567890'),false);
});

function cleanupContext(files,entries=[]){
  const state={files,pkg:new Map(entries.map(f=>[f.type+':'+f.name.toLowerCase(),f])),draft:new Map()};
  const context=vm.createContext({S:state,crypto:webcrypto,TextEncoder,
    key:f=>f.type+':'+f.name.toLowerCase(),clone:x=>JSON.parse(JSON.stringify(x)),
    changes:()=>state.pkg,importedFileSpec:name=>({name:name.replace(/\.(gs|html)$/,''),type:name.endsWith('.gs')?'SERVER_JS':'HTML'}),
    sha256HexV24:async s=>createHash('sha256').update(s).digest('hex')});
  vm.runInContext(manager.slice(manager.indexOf('async function prepareEmbeddedModelRemovals('),manager.indexOf('async function writeProjectChanges(')),context);
  return {context,state};
}
const digest=s=>createHash('sha256').update(s).digest('hex');
test('cleanup removes only exact archived model chunks and preserves unrelated files',async()=>{
  const files=[{name:'appsscript',type:'JSON',source:'{}'},{name:'Code',type:'SERVER_JS',source:'function app() {}'},
    {name:'CDQ_Model_plancher_v2291_0',type:'HTML',source:'model bytes'},{name:'Other',type:'HTML',source:'keep'}];
  const {context,state}=cleanupContext(files);
  const entries=await context.prepareEmbeddedModelRemovals([{name:'CDQ_Model_plancher_v2291_0.html',sha256:[digest('model bytes')]}],[],files);
  entries.forEach(e=>state.pkg.set(e.type+':'+e.name.toLowerCase(),e));
  const result=context.buildUpdatedFileSet(files);
  assert.deepEqual(Array.from(result,f=>f.name),['appsscript','Code','Other']);
});
test('cleanup refuses altered resources, outside filenames and remaining references',async()=>{
  const files=[{name:'CDQTemplates',type:'SERVER_JS',source:'original'},{name:'Code',type:'SERVER_JS',source:'cdqTemplateEmbarque_("plancher")'}];
  const {context}=cleanupContext(files);
  await assert.rejects(context.prepareEmbeddedModelRemovals([{name:'Code.gs',sha256:[digest('original')]}],[],files),/non autorisée/);
  await assert.rejects(context.prepareEmbeddedModelRemovals([{name:'CDQTemplates.gs',sha256:[digest('modified')]}],[],files),/modifié/);
  await assert.rejects(context.prepareEmbeddedModelRemovals([{name:'CDQTemplates.gs',sha256:[digest('original')]}],[],files),/encore utilisé/);
});
test('writing refuses source drift instead of overwriting newer user edits',()=>{
  const files=[{name:'appsscript',type:'JSON',source:'{}'},{name:'Code',type:'SERVER_JS',source:'before'}];
  const {context}=cleanupContext(files,[{name:'Code',type:'SERVER_JS',source:'patch'}]);
  assert.throws(()=>context.buildUpdatedFileSet([files[0],{...files[1],source:'user edited'}]),/changé depuis/);
  assert.equal(context.buildUpdatedFileSet(files)[1].source,'patch');
});
test('cleanup refuses a caller added to the fresh project after preparation',()=>{
  const files=[{name:'appsscript',type:'JSON',source:'{}'},{name:'CDQTemplates',type:'SERVER_JS',source:'helper'}];
  const {context}=cleanupContext(files,[{...files[1],source:'',remove:true}]);
  assert.throws(()=>context.buildUpdatedFileSet([...files,{name:'NewCaller',type:'SERVER_JS',source:'cdqTemplateEmbarque_("plancher")'}]),/encore utilisé/);
});
for(const healthy of [false,true])test(`production confirmation reflects the actual health check (${healthy})`,async()=>{
  const deployed={deploymentId:'production',deploymentConfig:{versionNumber:99}};
  const previous={deploymentId:'production',deploymentConfig:{versionNumber:98}};
  const statuses=[],results=[],ends=[];
  const state={id:'project',lastWrittenBuild:'next-build',productionBuild:'old-build',pkg:new Map()};
  const context=vm.createContext({S:state,CDQ:{deployments:[previous]},CDQ_PRODUCTION_DEPLOYMENT_ID:'production',
    description:{value:'test'},deployment:{value:'production'},isProductionProject:()=>true,productionDeployment:()=>previous,
    cid:()=>'',createProjectVersion:async()=>({versionNumber:99}),updateDeployment:async()=>deployed,
    waitForDeploymentVersionV26:async()=>({all:[deployed],deployment:deployed}),listDeployments:async()=>[deployed],
    verifyProductionWebAppReadyV23:async()=>{if(!healthy)throw Error('live endpoint still old');return {build:'next-build'}},
    setQuickDeployProgress(){},setQuickResult:(...x)=>results.push(x),stat:(...x)=>statuses.push(x),setKnownGoodV23(){},
    renderDeployments(){},updateDeploymentUi(){},saveSettings(){},renderDiff(){},updateQuickUi(){},
    beginQuickDeployProgress:()=>true,endQuickDeployProgress:(...x)=>ends.push(x)});
  vm.runInContext(manager.slice(manager.indexOf('async function deployNewVersion('),manager.indexOf('async function writePendingAndDeploy(')),context);
  context.writePendingAndDeploy=()=>context.deployNewVersion();
  vm.runInContext(manager.slice(manager.indexOf('async function runQuickDeployAction('),manager.indexOf('function updateQuickUi(')),context);
  await context.runQuickDeployAction();
  assert.equal(state.lastDeploymentResult.healthChecked,healthy);
  assert.equal(state.lastDeploymentResult.verificationPending,!healthy);
  assert.equal(state.productionBuild,healthy?'next-build':'old-build');
  assert.equal(statuses.at(-1)[1],healthy?'ok':'warn');
  assert.equal(results.at(-1)[1],healthy?'ok':'warn');
  assert.equal(ends.at(-1)[2],healthy,'quick action must not overwrite a pending verification with success');
});
