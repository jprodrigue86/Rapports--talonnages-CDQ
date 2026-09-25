import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {applyPatch} from './helpers/settings-fixture.mjs';
const read=p=>fs.readFileSync(p,'utf8');
const generated='balance-cdq-android/app/build/generated/cdq-web-assets/cdq-web/';
const source='balance-cdq-android/web-source/';
const manifest=JSON.parse(read('bundles/balance-cdq/v25.28/manifest.json'));

test('every packaged asset matches its manifest and includes interface, artwork and PDF engine',()=>{
  const assets=JSON.parse(read(generated+'asset-manifest.json'));
  for(const name of ['index.html','Selector.html','embedded-rpc.js','vendor/pdf-lib-1.17.1.min.js','vendor/pdfjs-6.3.289/build/pdf.worker.mjs','assets/templates/balance-plancher-v2519.pdf','bundles/balance-cdq/v25.17/banner-original.webp'])assert.ok(assets.files[name],name);
  for(const [name,entry] of Object.entries(assets.files)){
    const bytes=fs.readFileSync(generated+name);
    assert.equal(bytes.length,entry.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),entry.sha256);
    assert.doesNotMatch(name,/\.p12$|\.keystore$|mot-de-passe|\.gs$|^downloads\//);
  }
  assert.equal(assets.files['version.json'],undefined);
  assert.equal(assets.files['bundles/balance-cdq/latest/manifest.json'],undefined);
});

test('installed shell selects the local interface and does not load Google Identity or install a web worker at boot',()=>{
  const html=read(generated+'index.html'),selector=read(generated+'Selector.html');
  assert.match(html,/return new URL\('\.\/Selector.html',location.href\).href/);
  assert.match(html,/if \(false && 'serviceWorker' in navigator\)/);
  assert.doesNotMatch(html,/<script src="https:\/\/accounts.google.com/);
  assert.doesNotMatch(selector,/cdn.jsdelivr.net\/npm\/pdf-lib/);
  assert.match(selector,/native\/v25.36\/vendor\/pdf-lib/);
  assert.match(selector,/cdqFoldersV2527/);
  assert.match(selector,/id="cdqFullNamesV2536"/);
  assert.doesNotMatch(selector,/cdqLocalProvisionalV2537|icon-fallback-v2538|cdq-icon-art-ready-v2538/);
});

test('server package accepts both delivered bases without the previous company-list patch mismatch',()=>{
  assert.equal(manifest.requiresBuild.length,2);
  for(const build of manifest.requiresBuild){
    let code='const CDQ_BACKEND_BUILD_='+JSON.stringify(build)+';\nfunction doGet(e) {\n  const params = e && e.parameter ? e.parameter : {};\nreturn "normal";\n}';
    for(const patch of manifest.patches.filter(p=>p.file==='Code.gs'))code=applyPatch(code,patch);
    new vm.Script(code);assert.match(code,/cdqEmbeddedBridgeV2528_\(params\)/);
  }
  assert.ok(!manifest.patches.some(p=>p.id==='company-list'));
  for(const f of manifest.extraFiles){const s=read('bundles/balance-cdq/v25.28/files/'+f.name);assert.equal(crypto.createHash('sha256').update(s).digest('hex'),f.sha256);new vm.Script(s);}
});

test('server bootstrap emits a small page with no application UI or account data',()=>{
  const c=vm.createContext({HtmlService:{XFrameOptionsMode:{ALLOWALL:'allow'},createHtmlOutput(html){return {html,setTitle(){return this;},setXFrameOptionsMode(){return this;}};}}});
  vm.runInContext(read('bundles/balance-cdq/v25.28/files/CDQEmbedded.gs'),c);
  const html=c.cdqEmbeddedBridgeV2528_({channel:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'}).html;
  assert.ok(Buffer.byteLength(html)<6000);assert.doesNotMatch(html,/Selector.html|data:image|jetonSession:/);
  for(const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
  assert.throws(()=>c.cdqEmbeddedBridgeV2528_({channel:'</script>'}));
});

function client(options={}){
  const listeners={},timers=new Map(),sent=[],parent={},iframe={contentWindow:parent,setAttribute(){}};
  const provisional=options.provisional||{value:false};
  parent.parent=parent;
  const peer={parent,postMessage(data,origin){sent.push({data,origin});}};
  const document={readyState:'complete',body:{append(){}},createElement(){return iframe;}};
  const c={crypto:{randomUUID:()=> 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'},Map,Set,URL,Error,Proxy,Object,String,Array,navigator:{onLine:true},document,
    setTimeout(fn){const id=timers.size+1;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);},addEventListener(name,fn){listeners[name]=fn;},
    cdqStartupUnlockV2529:{isProvisional:()=>provisional.value}};
  c.window=c;vm.runInNewContext(read(source+'embedded-rpc.js'),c);
  const channel=new URL(iframe.src).searchParams.get('channel');
  function message(data,options={}){listeners.message({origin:'https://test-script.googleusercontent.com',source:peer,data:{protocol:1,channel,...data},...options});}
  return {c,peer,iframe,listeners,timers,sent,message};
}

test('RPC waits for its own authenticated-origin frame, preserves callbacks and sends each call once',()=>{
  const a=client(),received=[],user={domNode:'local-only'};
  a.c.google.script.run.withSuccessHandler((...args)=>received.push(args)).withUserObject(user).cdqRpc('obtenirDossiersClients',[], 'session');
  assert.equal(a.sent.length,0);
  a.message({type:'CDQ_EMBEDDED_READY'},{origin:'https://evil.invalid'});assert.equal(a.sent.length,0);
  a.message({type:'CDQ_EMBEDDED_READY'},{source:{parent:null}});assert.equal(a.sent.length,0);
  a.message({type:'CDQ_EMBEDDED_READY',channel:'wrong'});assert.equal(a.sent.length,0);
  a.message({type:'CDQ_EMBEDDED_READY'});assert.equal(a.sent.length,1);
  a.message({type:'CDQ_EMBEDDED_READY'});assert.equal(a.sent.length,1);
  assert.equal(a.sent[0].data.userObject,undefined);
  a.message({type:'CDQ_EMBEDDED_RESULT',id:'1',ok:true,value:['client']});
  assert.deepEqual(received,[[['client'],user]]);
});

test('clean startup holds every remote call locally until authoritative confirmation',()=>{
  const provisional={value:true},a=client({provisional}),received=[],errors=[];
  a.message({type:'CDQ_EMBEDDED_READY'});
  a.c.google.script.run.withSuccessHandler(x=>received.push(x)).withFailureHandler(e=>errors.push(e.message))
    .cdqRpc('obtenirDossiersClients',[],'session');
  assert.equal(a.sent.length,0,'No RPC may leave the device while local startup is provisional');
  provisional.value=false;
  a.listeners['cdq:startup-confirmed-v2539']();
  assert.equal(a.sent.length,1);
  a.message({type:'CDQ_EMBEDDED_RESULT',id:'1',ok:true,value:['client']});
  assert.deepEqual(received,[['client']]);
  assert.deepEqual(errors,[]);
});

test('server revocation drops held remote calls without sending them',()=>{
  const provisional={value:true},a=client({provisional}),errors=[];
  a.message({type:'CDQ_EMBEDDED_READY'});
  a.c.google.script.run.withFailureHandler(e=>errors.push(e.message))
    .cdqRpc('renommerFichier',['id','new'],'session');
  assert.equal(a.sent.length,0);
  a.listeners['cdq:startup-revoked-v2539']();
  assert.equal(a.sent.length,0);
  assert.match(errors[0],/révoquée/);
});

test('disconnected or expired requests fail without replaying a possibly completed write',()=>{
  const a=client(),errors=[];a.message({type:'CDQ_EMBEDDED_READY'});
  a.c.google.script.run.withFailureHandler(e=>errors.push(e.message)).cdqRpc('renommerFichier',['id','new'],'session');
  a.listeners.offline();assert.match(errors[0],/Vérifiez le résultat/);
  a.message({type:'CDQ_EMBEDDED_READY'});assert.equal(a.sent.length,1);
  a.c.navigator.onLine=false;a.c.google.script.run.withFailureHandler(e=>errors.push(e.message)).obtenirEtatAcces();
  assert.equal(a.sent.length,1);assert.match(errors[1],/hors ligne/);
});

test('bridge does not expose private or arbitrary unauthenticated server functions',()=>{
  const a=client(),errors=[];a.message({type:'CDQ_EMBEDDED_READY'});
  a.c.google.script.run.withFailureHandler(e=>errors.push(e.message)).initialiserSecuriteDepuisEditeur_();
  a.c.google.script.run.withFailureHandler(e=>errors.push(e.message)).supprimerFichier('id');
  assert.equal(errors.length,2);assert.equal(a.sent.length,0);
});

test('server iframe rejects unrelated windows, altered channels, private methods and duplicate calls',()=>{
  const listeners={},sent=[],calls=[],ancestor={postMessage(data){sent.push(data);}};ancestor.parent=ancestor;
  const runner={withSuccessHandler(fn){this.success=fn;return this;},withFailureHandler(){return this;},cdqRpc(...args){calls.push(args);this.success({ok:true});}};
  const c={window:{parent:ancestor,addEventListener(name,fn){listeners[name]=fn;}},google:{script:{run:runner}},CDQ_EMBEDDED_CHANNEL:'channel',setTimeout(){},Set};
  vm.runInNewContext(read(source+'server-bridge.js'),c);
  const data={type:'CDQ_EMBEDDED_CALL',protocol:1,channel:'channel',id:'1',name:'cdqRpc',args:['list',[],'session']};
  const send=(updates={},event={})=>listeners.message({origin:'https://jprodrigue86.github.io',source:ancestor,data:{...data,...updates},...event});
  send({}, {origin:'https://evil.invalid'});send({channel:'wrong'});send({name:'private_'});send({}, {source:{}});assert.equal(calls.length,0);
  send();send();assert.equal(calls.length,1);assert.equal(sent.at(-1).ok,true);
});
