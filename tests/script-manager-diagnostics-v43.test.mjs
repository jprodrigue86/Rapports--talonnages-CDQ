import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
const diagnostic=readFileSync('apps-script-manager/diagnostics.js','utf8');
const api=readFileSync('apps-script-manager/api.js','utf8');
const pid='production-script',dep='production-deployment';
const files=[{name:'Code',type:'SERVER_JS',source:'const CDQ_BUILD="2026.09.23-v25.28-apk-embarquee";\nconst SECRET="DO_NOT_EXPORT_SOURCE";'},
  {name:'Selector',type:'HTML',source:'<div>Interface without announced version</div>'},{name:'appsscript',type:'JSON',source:'{"secret":"DO_NOT_EXPORT_MANIFEST"}'}];
function env(overrides={}){
  const writes=[],requests=[],storage=new Map();
  const ctx=vm.createContext({console,crypto:webcrypto,TextEncoder,URL,URLSearchParams,Headers,Response,AbortController,Date,setTimeout,clearTimeout,setInterval,clearInterval,
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
    CDQ:{token:'NEVER_EXPORT_TOKEN',grantedScopes:'https://www.googleapis.com/auth/drive.file',expiresAt:Date.now()+100000},
    S:{id:pid,meta:{title:'Rapport étalonnage'},projectReadGeneration:1,deployBusy:false,pkg:new Map(),bundleAlreadyApplied:false},
    APP_VERSION:'V43',CDQ_PRODUCTION_SCRIPT_ID:pid,CDQ_PRODUCTION_DEPLOYMENT_ID:dep,
    deployment:{value:dep},hasLiveToken:()=>true,cid:()=> 'NEVER_EXPORT_CLIENT_ID',updateQuickUi(){},setQuickResult(){},
    scriptApiUrl:p=>'https://script.googleapis.com/v1'+p,
    getProjectContent:async(_id,_client,v)=>{assert.equal(v,505);return {files:structuredClone(files)};},
    googleFetch:async(url)=>{requests.push(url);return {deploymentId:dep,deploymentConfig:{versionNumber:505}};},
    cdqFetchOnceV39:async(url,opts,headers)=>{
      requests.push(url);
      if(url.includes('googleapis.com/')){
        assert.equal(headers.get('Authorization'),'Bearer NEVER_EXPORT_TOKEN');
        if(opts.method){writes.push({url,...opts});return {response:{ok:true},text:JSON.stringify({id:'private-report',shared:false})};}
        return {response:{ok:true},text:JSON.stringify({files:[]})};
      }
      assert.equal(headers.get('Authorization'),null);
      let data={};
      if(url.includes('android-release'))data={versionName:'25.30',versionCode:2530};
      else if(url.includes('iphone/app/release'))data={version:'25.30',androidSourceBuild:'2026.09.24-v25.30-fichiers-immediats'};
      else if(url.includes('latest/manifest'))data={version:'V25.27',build:'2026.09.23-v25.27-demarrage-dossiers'};
      else if(url.includes('v25.28/manifest'))data={version:'V25.28',build:'2026.09.23-v25.28-apk-embarquee'};
      else if(url.includes('apps-script-manager/version'))data={version:'V43'};
      else if(url.includes('commits/main'))data={sha:'a'.repeat(40),commit:{committer:{date:'2026-09-24T15:00:00Z'}}};
      else if(url.includes('contents/bundles'))data=[{type:'dir',name:'v25.27'},{type:'dir',name:'v25.28'}];
      else data={version:'2026.09.23-v25.27-demarrage-dossiers'};
      return {response:{ok:true},text:JSON.stringify(data)};
    },...overrides});
  vm.runInContext(diagnostic,ctx);
  ctx.input={id:pid,files:structuredClone(files),deployments:[{deploymentId:dep,deploymentConfig:{versionNumber:505},updateTime:'2026-09-24T00:46:00Z'}],deploymentsReadOk:true,readGeneration:1};
  return {ctx,writes,requests,storage,run:code=>vm.runInContext(code,ctx),start:()=>vm.runInContext('startVersionDiagnosticV43(input)',ctx),report:()=>vm.runInContext('CDQ_DIAGNOSTIC_V43.report',ctx)};
}

test('unknown labels are not treated as versions; explicit declarations beat comments',()=>{
  const a=env();assert.equal(a.run("diagnosticVersionLabelV43('version Selector non annoncée')"),'');
  assert.equal(a.run("diagnosticDeclaredBuildV43('// future v99.99\\nconst CDQ_BUILD = \\\"v25.28\\\";')"),'v25.28');
  assert.equal(a.run("diagnosticDeclaredBuildV43('const CDQ_BUILD=\\\"v25.28\\\";\\nconst CDQ_BUILD=\\\"v99.99\\\";')"),'');
});
test('fingerprints ignore file order/CRLF, not code changes under the same label',async()=>{
  const a=env();a.ctx.a=files;a.ctx.b=structuredClone(files).reverse();
  a.ctx.b[2].source=a.ctx.b[2].source.replaceAll('\n','\r\n');
  const x=await a.run('diagnosticSummarizeFilesV43(a)'),y=await a.run('diagnosticSummarizeFilesV43(b)');assert.equal(x.fingerprintSha256,y.fingerprintSha256);
  a.ctx.b[2].source+=' changed';const z=await a.run('diagnosticSummarizeFilesV43(b)');assert.notEqual(x.fingerprintSha256,z.fingerprintSha256);
});
test('missing Selector version with identical deployed content is not a redeploy warning',async()=>{
  const a=env();await a.start();assert.equal(a.report().production.matchesSource,true);assert.equal(a.ctx.S.redeploySource,false);
  assert.equal(a.report().production.content.selectorBuild,null);assert.equal(a.report().production.versionNumber,505);
});
test('automatic private report exports neither source, manifest secrets, token nor OAuth client ID',async()=>{
  const a=env();await a.start();assert.equal(a.writes.length,1);assert.equal(a.writes[0].method,'POST');
  const body=a.writes[0].body;
  for(const forbidden of ['DO_NOT_EXPORT_SOURCE','DO_NOT_EXPORT_MANIFEST','NEVER_EXPORT_TOKEN','NEVER_EXPORT_CLIENT_ID','access_token','permissions'])assert.equal(body.includes(forbidden),false,forbidden);
  assert.match(body,/"parents":\["root"\]/);assert.match(body,/"mimeType":"text\/plain"/);
  assert.match(body,/CDQ_Diagnostic_Versions.txt/);
  assert.ok(a.requests.filter(x=>x.includes('script.googleapis')).every(x=>x.includes('/deployments/')));
});
test('a missing Drive grant preserves the diagnostic and does not attempt a write',async()=>{
  const a=env();a.ctx.CDQ.grantedScopes='';await a.start();assert.ok(a.report());assert.equal(a.writes.length,0);
});
test('auto-upload opt-out is honored',async()=>{
  const a=env();a.storage.set('cdqsm_private_diagnostic_v43','0');await a.start();assert.ok(a.report());assert.equal(a.writes.length,0);
});
test('different source contents are reported even when version declarations match',async()=>{
  const a=env({getProjectContent:async()=>({files:files.map(f=>({...f,source:f.source+'\n// deployed different'}))})});await a.start();
  assert.equal(a.report().production.matchesSource,false);assert.equal(a.ctx.S.redeploySource,true);assert.ok(a.report().issues.includes('SOURCE_DIFFERS_FROM_DEPLOYMENT'));
});
test('a denied immutable version read is unknown, never proof of outdated production',async()=>{
  const a=env({getProjectContent:async()=>{throw new Error('PRIVATE_RAW_ERROR_SECRET');}});await a.start();
  assert.equal(a.report().production.matchesSource,null);assert.equal(a.ctx.S.redeploySource,false);
  assert.equal(JSON.stringify(a.report()).includes('PRIVATE_RAW_ERROR_SECRET'),false);
});
test('a deployment which changes while reading is not declared equal or different',async()=>{
  const a=env({googleFetch:async()=>({deploymentId:dep,deploymentConfig:{versionNumber:506}})});await a.start();
  assert.equal(a.report().production.matchesSource,null);assert.ok(a.report().issues.includes('DEPLOYMENT_CHANGED_DURING_READ'));
});
test('failed deployment listing does not imply an absent or outdated deployment',async()=>{
  const a=env();a.ctx.input.deploymentsReadOk=false;await a.start();assert.equal(a.report().production.matchesSource,null);assert.ok(a.report().issues.includes('DEPLOYMENTS_UNAVAILABLE'));
});
test('outdated latest pointer is reported, not silently modified',async()=>{
  const a=env();await a.start();assert.ok(a.report().issues.includes('AUTOMATIC_PACKAGE_BEHIND_NEWEST_SERVER_PACKAGE'));assert.equal(a.report().published.newestServerPackage.version,'V25.28');
  assert.equal(a.report().published.android.version,'V25.30');assert.equal(a.report().devices.installedVersions,'not_measured');
});
test('public request failures do not discard a useful Google audit',async()=>{
  const a=env();a.ctx.cdqFetchOnceV39=async()=>{throw new Error('OFFLINE');};await a.start();assert.equal(a.report().production.matchesSource,true);assert.ok(a.report().issues.includes('SOME_PUBLIC_VERSIONS_UNAVAILABLE'));
});
test('a stale project read cannot publish a report after project/account changes',async()=>{
  let release;const barrier=new Promise(r=>{release=r;});
  const a=env({getProjectContent:async()=>{await barrier;return {files};}});
  const pending=a.start();await new Promise(r=>setTimeout(r,10));a.run('invalidateVersionDiagnosticV43()');a.ctx.S.projectReadGeneration++;release();await pending;
  assert.equal(a.report(),null);assert.equal(a.writes.length,0);
});
test('duplicate file entries cannot produce a trusted fingerprint',async()=>{
  const a=env();a.ctx.bad=[files[0],files[0]];await assert.rejects(a.run('diagnosticSummarizeFilesV43(bad)'),/INVALID_CONTENT/);
});
test('a shared or unrelated matching filename is never overwritten',async()=>{
  const a=env();const original=a.ctx.cdqFetchOnceV39;
  a.ctx.cdqFetchOnceV39=async(url,o,h)=>{
    if(url.includes('www.googleapis.com/drive/v3/files?'))return {response:{ok:true},text:JSON.stringify({files:[{id:'shared',shared:true,ownedByMe:true,mimeType:'text/plain',appProperties:{cdqDiagnostic:'versions-v43',cdqScriptId:pid}},{id:'unrelated',shared:false,ownedByMe:true,mimeType:'text/plain',name:'CDQ_Diagnostic_Versions.txt'}]})};
    return original(url,o,h);
  };await a.start();assert.equal(a.writes.length,1);assert.equal(a.writes[0].method,'POST');
});
test('same-project app-owned private report can be updated without creating another file',async()=>{
  const a=env();const original=a.ctx.cdqFetchOnceV39;
  const privateFile={id:'private-existing',shared:false,ownedByMe:true,mimeType:'text/plain',appProperties:{cdqDiagnostic:'versions-v43',cdqScriptId:pid}};
  a.ctx.cdqFetchOnceV39=async(url,o,h)=>{
    if(url.includes('www.googleapis.com/drive/v3/files?'))return {response:{ok:true},text:JSON.stringify({files:[privateFile]})};
    if(url.includes('www.googleapis.com/drive/v3/files/private-existing?'))return {response:{ok:true},text:JSON.stringify(privateFile)};
    return original(url,o,h);
  };await a.start();assert.equal(a.writes.length,1);assert.equal(a.writes[0].method,'PATCH');assert.match(a.writes[0].url,/private-existing/);
});
test('401 or 403 cannot be mistaken for a successfully saved report',async()=>{
  const a=env();const original=a.ctx.cdqFetchOnceV39;
  a.ctx.cdqFetchOnceV39=async(url,o,h)=>url.includes('googleapis.com/')?{response:{ok:false,status:403},text:'SECRET_GOOGLE_ERROR'}:original(url,o,h);
  await a.start();assert.ok(a.report());assert.equal(a.writes.length,0);assert.equal(a.run('CDQ_DIAGNOSTIC_V43.saving'),false);
});
test('API immutable reads keep CDQ.content pointing to editable HEAD; deployments paginate',async()=>{
  const calls=[];
  const c=vm.createContext({console,Headers,Response,URL,AbortController,setTimeout,clearTimeout,setInterval,clearInterval,
    window:{dispatchEvent(){}},CustomEvent:class{},fetch:async(url)=>{
      calls.push(url);
      const d=url.includes('/deployments')?(url.includes('pageToken=')?{deployments:[{deploymentId:'second'}]}:{deployments:[{deploymentId:'first'}],nextPageToken:'page2'}):{files:[{name:url.includes('versionNumber=')?'deployed':'head'}]};
      return new Response(JSON.stringify(d),{status:200});}});
  vm.runInContext(api,c);vm.runInContext("CDQ.token='test';CDQ.expiresAt=Date.now()+100000",c);
  await vm.runInContext("getProjectContent('p','client')",c);await vm.runInContext("getProjectContent('p','client',505)",c);
  assert.equal(vm.runInContext('CDQ.content.files[0].name',c),'head');assert.ok(calls.some(x=>x.endsWith('?versionNumber=505')));
  const deps=await vm.runInContext("listDeployments('p','client')",c);assert.equal(deps.length,2);
  await assert.rejects(vm.runInContext("getProjectContent('p','client',0)",c),/invalide/);
});
test('V43 assets, integration, limited scope and cache are consistent',()=>{
  const html=readFileSync('apps-script-manager/index.html','utf8'),app=readFileSync('apps-script-manager/app.js','utf8'),sw=readFileSync('apps-script-manager/sw.js','utf8');
  assert.match(app,/const APP_VERSION = 'V43'/);assert.match(app,/void startVersionDiagnosticV43/);assert.match(app,/sw.js\?v=43/);
  assert.ok(html.indexOf('diagnostics.js?v=43')<html.indexOf('app.js?v=43'));
  assert.match(sw,/diagnostics.js\?v=43/);assert.match(sw,/v43-private-version-diagnostic/);
  assert.match(api,/auth\/drive.file/);assert.equal(api.includes("'https://www.googleapis.com/auth/drive',"),false);
  assert.equal(app.includes('production différente ('),false);
});

test('version ordering extracts the CDQ version rather than the build date',()=>{
  const a=env();assert.ok(a.run("diagnosticVersionOrderV43('2026.09.23-v25.27-old','2026.09.23-v25.28-new')")<0);
  assert.ok(a.run("diagnosticVersionOrderV43('2026.09.24-v25.27-old','2026.09.23-v25.28-new')")<0);
});
