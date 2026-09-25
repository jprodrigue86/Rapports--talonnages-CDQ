import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code=fs.readFileSync('balance-cdq-android/web-source/startup-unlock-v2529.js','utf8');

function startup(options={}){
  const values=new Map([
    ['cdq_auth_device_token_v2','device-token-12345'],
    ['cdqLastUnlockEmailV2511','person@example.invalid']
  ]);
  if(options.noToken)values.delete('cdq_auth_device_token_v2');

  let now=1000,resolve,reject;
  const calls=[],prompts=[],cancelled=[],listeners={},timers=[];
  const localReads=[],confirmed=[],cleared=[];
  const c={
    localStorage:{getItem:key=>values.get(key)},
    sessionStorage:{getItem:()=>options.activation?JSON.stringify({expiresAt:100000}):null},
    navigator:{onLine:!options.offline},
    crypto:{randomUUID:()=> 'test'},
    Date:{now:()=>now},Promise,queueMicrotask,
    setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},
    addEventListener:(name,fn)=>listeners[name]=fn,
    BalanceCDQNative:{
      biometric:id=>prompts.push(id),
      cancelBiometric:id=>cancelled.push(id),
      localSessionAfterBiometric(id,grant,email,token){
        localReads.push({id,grant,email,token});
        return options.localTicket
          ? JSON.stringify({ok:true,email:'person@example.invalid',expiresAt:now+120000})
          : JSON.stringify({ok:false});
      },
      confirmLocalSession(id,grant,email,token){
        confirmed.push({id,grant,email,token});return true;
      },
      clearLocalSession(id,grant){cleared.push({id,grant});}
    },
    cdqEmbeddedRpcV2529:{
      prepareSession(token){
        calls.push(token);
        return new Promise((ok,fail)=>{resolve=ok;reject=fail;});
      }
    }
  };
  c.window=c;c.top=c;vm.runInNewContext(code,c);
  return {
    c,values,calls,prompts,cancelled,listeners,timers,localReads,confirmed,cleared,
    clock:n=>now=n,resolve:x=>resolve(x),reject:e=>reject(e)
  };
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const grant='grant-secret-01234567890123456789';

test('native prompt still starts before DOM, Selector and server response',()=>{
  const a=startup();
  assert.deepEqual(a.prompts,['startup-test']);
  assert.deepEqual(a.calls,[]);
  assert.equal(a.c.cdqStartupUnlockV2529.activeFor('device-token-12345'),true);
});

test('without a local ticket the existing secure server unlock stays unchanged',async()=>{
  const a=startup(),u=a.c.cdqStartupUnlockV2529,biometric=[],received=[],user={ui:true};
  u.receive('startup-test',true,'',grant);
  assert.equal(a.localReads.length,1);
  assert.deepEqual(a.calls,['device-token-12345']);
  assert.equal(u.attach('person@example.invalid','normal',ok=>biometric.push(ok)),true);
  await tick();assert.deepEqual(biometric,[true]);
  assert.equal(u.takeSession('device-token-12345',(value,obj)=>received.push([value,obj]),()=>{},user),true);
  await tick();assert.deepEqual(received,[]);
  const server={autorise:true,email:'person@example.invalid',role:'technicien',jetonSession:'server'};
  a.resolve(server);await tick();
  assert.deepEqual(received,[[server,user]]);
  assert.equal(a.confirmed.length,1);
  assert.equal(u.provisional(),false);
});

test('valid local ticket reveals read-only UI before the server is allowed to answer',async()=>{
  const a=startup({localTicket:true}),u=a.c.cdqStartupUnlockV2529,received=[],failures=[];
  u.receive('startup-test',true,'',grant);
  u.attach('person@example.invalid','normal',()=>{});
  assert.equal(u.takeSession('device-token-12345',x=>received.push(x),e=>failures.push(e.message)),true);
  await tick();
  assert.equal(received.length,1);
  assert.equal(received[0].autorise,true);
  assert.equal(received[0].role,'lecture');
  assert.equal(received[0].jetonSession,'');
  assert.equal(received[0].cdqLocalProvisionalV2537,true);
  assert.equal(u.provisional(),true);
  assert.equal(a.confirmed.length,0);

  const server={autorise:true,email:'person@example.invalid',role:'technicien',jetonSession:'server'};
  a.resolve(server);await tick();
  assert.deepEqual(received,[received[0],server]);
  assert.deepEqual(failures,[]);
  assert.equal(a.confirmed.length,1);
  assert.equal(u.provisional(),false);
});

test('explicit server denial clears the local ticket and reaches the existing relock path',async()=>{
  const a=startup({localTicket:true}),u=a.c.cdqStartupUnlockV2529,received=[];
  u.receive('startup-test',true,'',grant);
  u.attach('person@example.invalid','normal',()=>{});
  u.takeSession('device-token-12345',x=>received.push(x),()=>{});
  await tick();assert.equal(received[0].cdqLocalProvisionalV2537,true);
  a.resolve({autorise:false});await tick();
  assert.equal(received.at(-1).autorise,false);
  assert.equal(a.cleared.length,1);
  assert.equal(u.provisional(),false);
});

test('network failure after local reveal keeps the valid local ticket available',async()=>{
  const a=startup({localTicket:true}),u=a.c.cdqStartupUnlockV2529,received=[],failures=[];
  u.receive('startup-test',true,'',grant);
  u.attach('person@example.invalid','normal',()=>{});
  u.takeSession('device-token-12345',x=>received.push(x),e=>failures.push(e.message));
  await tick();assert.equal(received.length,1);assert.equal(u.provisional(),true);
  a.reject(Error('offline'));await tick();
  assert.deepEqual(failures,['offline']);
  assert.equal(a.cleared.length,0);
  assert.equal(u.provisional(),true);
});

test('cancellation and account changes discard pending server results',async()=>{
  for(const changeAccount of [false,true]){
    const a=startup({localTicket:true}),u=a.c.cdqStartupUnlockV2529,received=[];
    u.receive('startup-test',true,'',grant);
    u.attach('person@example.invalid','normal',()=>{});
    u.takeSession('device-token-12345',x=>received.push(x),x=>received.push(x));
    await tick();assert.equal(received.length,1);
    if(changeAccount){a.values.set('cdq_auth_device_token_v2','other');a.listeners.storage();}
    else u.cancel('normal');
    a.resolve({autorise:true,email:'person@example.invalid'});await tick();
    assert.equal(received.length,1);
    assert.equal(u.activeFor('device-token-12345'),false);
    assert.deepEqual(a.cancelled,['startup-test']);
  }
});

test('failed biometric never reads local ticket or primes server authentication',async()=>{
  const a=startup({localTicket:true}),u=a.c.cdqStartupUnlockV2529,received=[];
  u.attach('person@example.invalid','normal',ok=>received.push(ok));
  u.receive('startup-test',false,'Annulée','');
  await tick();
  assert.deepEqual(received,[false]);
  assert.equal(a.localReads.length,0);
  assert.equal(a.calls.length,0);
});

test('expired/wrong account and first activation/offline keep existing secure screens',()=>{
  const a=startup(),u=a.c.cdqStartupUnlockV2529;
  assert.equal(u.attach('other@example.invalid','x',()=>{}),false);
  const b=startup();b.clock(70000);b.c.cdqStartupUnlockV2529.receive('startup-test',true,'',grant);
  assert.equal(b.calls.length,0);
  for(const options of [{noToken:true},{activation:true},{offline:true}]){
    const x=startup(options);
    assert.equal(x.prompts.length,0);
    assert.equal(x.c.cdqStartupUnlockV2529,undefined);
  }
});
