import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync('apps-script-manager/api.js','utf8');
const files=[{name:'Code',type:'SERVER_JS',source:'new code'}, {name:'appsscript',type:'JSON',source:'{}'}];
const ok=data=>new Response(JSON.stringify(data),{status:200});
function api(fetch){
  const ctx=vm.createContext({fetch,Headers,Response,URL,AbortController,console,
    setTimeout:(fn,ms)=>setTimeout(fn,Math.min(ms,25)),clearTimeout,setInterval,clearInterval,
    window:{dispatchEvent(){}},CustomEvent:class {constructor(type,options){Object.assign(this,{type,...options});}}});
  vm.runInContext(source,ctx);
  vm.runInContext("CDQ.token='test-token';CDQ.expiresAt=Date.now()+100000;",ctx);
  return {ctx,run:code=>vm.runInContext(code,ctx)};
}

test('deadline includes a stalled response body and cancels the transport',async()=>{
  let signal;
  const a=api(async(_url,opts)=>{signal=opts.signal;return {status:200,ok:true,text:()=>new Promise(()=>{})};});
  await assert.rejects(a.run("googleFetch(scriptApiUrl('/projects/p/content'),'client')"),/délai réseau dépassé/);
  assert.equal(signal.aborted,true);
});

test('a GET falls back once and subsequent writes use the working official endpoint',async()=>{
  const calls=[];
  const a=api(async(url,opts)=>{
    calls.push({url,method:opts.method||'GET'});
    if(url.includes('scriptmanagement'))throw new TypeError('Failed to fetch');
    return ok({scriptId:'p',files});
  });
  await a.run("getProjectContent('p','client')");
  a.ctx.files=files;
  await a.run("updateProjectContent('p',files,'client')");
  assert.equal(calls.length,3);
  assert.equal(calls[2].method,'PUT');
  assert.match(calls[2].url,/^https:\/\/script.googleapis.com\/v1\/projects\/p\/content\?fields=scriptId$/);
});

test('write received by Google but response stalled is reconciled without a duplicate PUT',async()=>{
  let writes=0,reads=0;
  const a=api(async(_url,opts)=>{
    if(opts.method==='PUT'){
      writes++;
      assert.deepEqual(JSON.parse(opts.body).files,files);
      return {ok:true,status:200,text:()=>new Promise(()=>{})};
    }
    reads++;return ok({scriptId:'p',files});
  });
  a.ctx.files=files;
  const actual=await a.run("updateProjectContent('p',files,'client')");
  assert.equal(JSON.stringify(actual.files),JSON.stringify(files));
  assert.equal(writes,1);assert.equal(reads,1);
});

test('unconfirmed write stops instead of overwriting a changed project',async()=>{
  let writes=0;
  const a=api(async(_url,opts)=>{
    if(opts.method==='PUT'){writes++;throw new TypeError('Failed to fetch');}
    return ok({files:[...files,{name:'OtherEditor',type:'SERVER_JS',source:'keep this'}]});
  });
  a.ctx.files=files;
  await assert.rejects(a.run("updateProjectContent('p',files,'client')"),/aucun déploiement n’a été lancé/);
  assert.equal(writes,1);
});

test('reconciliation refuses duplicate file names even if the file count matches',async()=>{
  const a=api(async(_url,opts)=>{
    if(opts.method==='PUT')throw new TypeError('Failed to fetch');
    return ok({files:[files[0],files[0]]});
  });
  a.ctx.files=files;
  await assert.rejects(a.run("updateProjectContent('p',files,'client')"),/aucun déploiement/);
});

test('permission errors are immediate and never followed by another write or read',async()=>{
  let requests=0;
  const a=api(async()=>{requests++;return new Response(JSON.stringify({error:{message:'Permission denied'}}),{status:403});});
  a.ctx.files=files;
  await assert.rejects(a.run("updateProjectContent('p',files,'client')"),/permission/);
  assert.equal(requests,1);
});

test('version creation is not retried after a lost response',async()=>{
  let requests=0;
  const a=api(async()=>{requests++;throw new TypeError('Failed to fetch');});
  await assert.rejects(a.run("createProjectVersion('p','v26','client')"),/Réponse Google non reçue/);
  assert.equal(requests,1);
});

test('OAuth which never calls back times out; a late token is ignored',async()=>{
  const a=api(async()=>ok({}));
  a.run("CDQ.token='';CDQ.expiresAt=0;CDQ.tokenClient={__clientId:'client',requestAccessToken(){}};");
  await assert.rejects(a.run("requestGoogleToken('client')"),/connexion Google n’a pas répondu/);
  a.run("CDQ.tokenClient.callback({access_token:'late-token',expires_in:3600})");
  assert.equal(a.run('CDQ.token'),'');
});
