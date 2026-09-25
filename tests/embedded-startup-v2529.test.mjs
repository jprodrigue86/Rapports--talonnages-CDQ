import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync('balance-cdq-android/web-source/startup-unlock-v2529.js','utf8');
function startup(options={}){
  const values=new Map([['cdq_auth_device_token_v2','device'],['cdqLastUnlockEmailV2511','person@example.invalid']]);
  if(options.noToken)values.delete('cdq_auth_device_token_v2');
  let now=1000,resolve,reject;const calls=[],prompts=[],cancelled=[],listeners={},timers=[];
  const c={localStorage:{getItem:key=>values.get(key)},sessionStorage:{getItem:()=>options.activation?JSON.stringify({expiresAt:100000}):null},navigator:{onLine:!options.offline},crypto:{randomUUID:()=> 'test'},Date:{now:()=>now},performance:{now:()=>now},console,Promise,queueMicrotask,
    setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},
    addEventListener:(name,fn)=>listeners[name]=fn,
    BalanceCDQNative:{
      biometric:id=>prompts.push(id),
      cancelBiometric:id=>cancelled.push(id),
      consumeLocalSession:(email,token)=>options.localTicket?JSON.stringify({schema:1,email,role:'technicien',issuedAt:now-100,expiresAt:now+10000}):''
    },
    cdqEmbeddedRpcV2529:{prepareSession(token){calls.push(token);return new Promise((ok,fail)=>{resolve=ok;reject=fail;});}}};
  c.window=c;c.top=c;vm.runInNewContext(code,c);
  return {c,values,calls,prompts,cancelled,listeners,timers,clock:n=>now=n,resolve:x=>resolve(x),reject:e=>reject(e)};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('native prompt starts without a DOM, network response or full application',()=>{
  const a=startup();assert.deepEqual(a.prompts,['startup-test']);assert.deepEqual(a.calls,[]);
  assert.equal(a.c.cdqStartupUnlockV2529.activeFor('device'),true);
});
test('success primes one server session and safely delivers an early result to the later UI',async()=>{
  const a=startup(),u=a.c.cdqStartupUnlockV2529,biometric=[],received=[],user={local:true};
  assert.equal(u.receive('wrong',true,''),false);assert.equal(a.calls.length,0);
  u.receive('startup-test',true,'');u.receive('startup-test',true,'');assert.deepEqual(a.calls,['device']);
  assert.equal(u.takeSession('device',()=>{},()=>{}),false);
  a.resolve({autorise:true});
  assert.equal(u.attach('person@example.invalid','normal',(ok)=>biometric.push(ok)),true);
  await tick();assert.deepEqual(biometric,[true]);
  assert.equal(u.takeSession('device',(value,obj)=>received.push([value,obj]),()=>{},user),true);
  assert.equal(u.takeSession('device',()=>{},()=>{}),false);
  await tick();assert.deepEqual(received,[[{autorise:true},user]]);assert.equal(a.prompts.length,1);
});
test('late success reaches its waiting request, and failure never primes authentication',async()=>{
  for(const success of [true,false]){
    const a=startup(),u=a.c.cdqStartupUnlockV2529,received=[];
    u.attach('person@example.invalid','normal',(ok)=>received.push(ok));
    assert.deepEqual(received,[]);u.receive('startup-test',success,'');await tick();
    assert.deepEqual(received,[success]);assert.equal(a.calls.length,success?1:0);
  }
});
test('cancellation and account changes discard pending server results',async()=>{
  for(const changeAccount of [false,true]){
    const a=startup(),u=a.c.cdqStartupUnlockV2529,received=[];
    u.receive('startup-test',true,'');u.attach('person@example.invalid','normal',()=>{});await tick();
    u.takeSession('device',x=>received.push(x),x=>received.push(x));
    if(changeAccount){a.values.set('cdq_auth_device_token_v2','other');a.listeners.storage();}else u.cancel('normal');
    a.resolve({autorise:true});await tick();assert.deepEqual(received,[]);
    assert.equal(u.activeFor('device'),false);assert.deepEqual(a.cancelled,['startup-test']);
  }
});
test('expired and wrong-account results cannot be consumed',async()=>{
  const a=startup(),u=a.c.cdqStartupUnlockV2529;
  assert.equal(u.attach('other@example.invalid','x',()=>{}),false);
  u.receive('startup-test',true,'');assert.equal(a.calls.length,0);
  const b=startup();b.clock(70000);b.c.cdqStartupUnlockV2529.receive('startup-test',true,'');
  assert.equal(b.calls.length,0);assert.equal(b.c.cdqStartupUnlockV2529.activeFor('device'),false);
});
test('server denial and network error stay unchanged for existing access checks',async()=>{
  for(const fails of [false,true]){
    const a=startup(),u=a.c.cdqStartupUnlockV2529,received=[];
    u.receive('startup-test',true,'');u.attach('person@example.invalid','x',()=>{});await tick();
    u.takeSession('device',x=>received.push(x),x=>received.push(x.message));
    fails?a.reject(Error('offline')):a.resolve({autorise:false});await tick();
    assert.deepEqual(received,[fails?'offline':{autorise:false}]);assert.equal(a.calls.length,1);
  }
});
test('missing token and first activation retain their existing unlock screens',()=>{
  for(const options of [{noToken:true},{activation:true}]){
    const a=startup(options);assert.equal(a.prompts.length,0);assert.equal(a.c.cdqStartupUnlockV2529,undefined);
  }
});
test('offline startup still permits biometric local-cache unlock but never primes server authentication',()=>{
  const a=startup({offline:true,localTicket:true}),u=a.c.cdqStartupUnlockV2529;
  assert.deepEqual(a.prompts,['startup-test']);
  u.receive('startup-test',true,'');
  assert.deepEqual(a.calls,[]);
  const ticket=u.takeLocalTicket('device');
  assert.equal(ticket.email,'person@example.invalid');
  assert.equal(ticket.role,'technicien');
  assert.equal(u.takeSession('device',()=>{},()=>{}),false);
});
