import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code=fs.readFileSync('balance-cdq-android/web-source/startup-unlock-v2529.js','utf8');
const ticketSource=fs.readFileSync('balance-cdq-android/app/src/main/java/ca/balancecdq/android/StartupTicketStore.kt','utf8');
const mainSource=fs.readFileSync('balance-cdq-android/app/src/main/java/ca/balancecdq/android/MainActivity.kt','utf8');

function startup(options={}){
  const values=new Map([
    ['cdq_auth_device_token_v2','device-token-12345'],
    ['cdqLastUnlockEmailV2511','person@example.invalid']
  ]);
  if(options.noToken)values.delete('cdq_auth_device_token_v2');
  let now=1000,resolve,reject;
  const calls=[],prompts=[],cancelled=[],listeners={},timers=[];
  const localReads=[],confirmed=[],cleared=[],events=[];

  const c={
    localStorage:{getItem:key=>values.get(key)},
    sessionStorage:{getItem:()=>options.activation?JSON.stringify({expiresAt:100000}):null},
    navigator:{onLine:!options.offline},
    crypto:{randomUUID:()=> 'test'},
    Date:{now:()=>now},
    Promise,queueMicrotask,Event,
    setTimeout:fn=>{timers.push(fn);return timers.length;},
    clearTimeout(){},
    addEventListener:(name,fn)=>listeners[name]=fn,
    dispatchEvent:event=>{events.push(event.type);listeners[event.type]?.(event);},
    BalanceCDQNative:{
      biometric:id=>prompts.push(id),
      cancelBiometric:id=>cancelled.push(id),
      startupBiometricState(email,token){
        return JSON.stringify(options.nativeStartup||{state:'none'});
      },
      localStartupTicket(id,grant,email,token){
        localReads.push({id,grant,email,token});
        return JSON.stringify(options.localTicket
          ? {ok:true,email:'person@example.invalid',expiresAt:now+3600000}
          : {ok:false});
      },
      confirmStartupTicket(id,grant,email,token){
        confirmed.push({id,grant,email,token});return true;
      },
      clearStartupTicket(id,grant){cleared.push({id,grant});}
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
    c,values,calls,prompts,cancelled,listeners,timers,events,localReads,confirmed,cleared,
    clock:n=>now=n,resolve:x=>resolve(x),reject:e=>reject(e)
  };
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const grant='grant-secret-01234567890123456789';

test('V25.39 ticket is a work-shift ticket, not the former 30 minute ticket',()=>{
  assert.match(ticketSource,/12L \* 60L \* 60L \* 1000L/);
  assert.doesNotMatch(ticketSource,/30L \* 60L \* 1000L/);
  assert.match(ticketSource,/AndroidKeyStore/);
  assert.match(ticketSource,/tokenHash/);
});

test('Android starts biometrics before WebView only when a valid ticket exists',()=>{
  assert.match(mainSource,/maybeStartEarlyBiometric\(\)/);
  assert.match(mainSource,/startupTicketStore\.peek\(\)/);
  assert.match(mainSource,/webView\.loadUrl\(APP_URL\)/);
  assert.doesNotMatch(mainSource,/webView\.restoreState\(/);
  assert.doesNotMatch(mainSource,/webView\.saveState\(/);
});

test('first trusted launch keeps the normal server-authoritative path and creates future ticket',async()=>{
  const a=startup(),u=a.c.cdqStartupUnlockV2529,received=[];
  assert.deepEqual(a.prompts,['startup-test']);
  u.receive('startup-test',true,'',grant);
  assert.deepEqual(a.calls,['device-token-12345']);
  u.attach('person@example.invalid','normal',()=>{});
  await tick();
  assert.equal(u.takeSession('device-token-12345',x=>received.push(x),()=>{}),true);
  await tick();assert.deepEqual(received,[]);
  const server={autorise:true,email:'person@example.invalid',role:'technicien',jetonSession:'server'};
  a.resolve(server);await tick();
  assert.deepEqual(received,[server]);
  assert.equal(a.confirmed.length,1);
  assert.equal(u.isProvisional(),false);
});

test('valid ticket reveals unchanged technician UI before server response, with no duplicate prompt',async()=>{
  const nativeId='native-startup-0123456789abcdef0123456789';
  const a=startup({
    localTicket:true,
    nativeStartup:{
      state:'pending',
      requestId:nativeId,
      email:'person@example.invalid',
      expiresAt:999999,
      message:'',
      grant:''
    }
  });
  const u=a.c.cdqStartupUnlockV2529,received=[];
  assert.deepEqual(a.prompts,[]);
  u.attach('person@example.invalid','normal',()=>{});
  a.c.cdqNativeStartupBiometricResultV2539(nativeId,true,'',grant);
  assert.equal(u.takeSession('device-token-12345',x=>received.push(x),()=>{}),true);
  await tick();
  assert.equal(received.length,1);
  assert.equal(received[0].autorise,true);
  assert.equal(received[0].role,'technicien');
  assert.equal(received[0].jetonSession,'');
  assert.equal(received[0].cdqReadOnlyStartupV2539,true);
  assert.equal(u.isProvisional(),true);
  assert.equal(a.confirmed.length,0);

  const server={autorise:true,email:'person@example.invalid',role:'admin',jetonSession:'server'};
  a.resolve(server);await tick();
  assert.equal(received.length,2);
  assert.equal(received[1].role,'admin');
  assert.equal(a.confirmed.length,1);
  assert.equal(u.isProvisional(),false);
  assert.ok(a.events.includes('cdq:startup-confirmed-v2539'));
});

test('server denial clears ticket; temporary network failure keeps local UI read-only',async()=>{
  {
    const a=startup({localTicket:true}),u=a.c.cdqStartupUnlockV2529,received=[];
    u.receive('startup-test',true,'',grant);u.attach('person@example.invalid','normal',()=>{});
    u.takeSession('device-token-12345',x=>received.push(x),()=>{});
    await tick();assert.equal(u.isProvisional(),true);
    a.resolve({autorise:false});await tick();
    assert.equal(received.at(-1).autorise,false);
    assert.equal(a.cleared.length,1);
    assert.equal(u.isProvisional(),false);
  }
  {
    const a=startup({localTicket:true}),u=a.c.cdqStartupUnlockV2529,received=[],failures=[];
    u.receive('startup-test',true,'',grant);u.attach('person@example.invalid','normal',()=>{});
    u.takeSession('device-token-12345',x=>received.push(x),e=>failures.push(e.message));
    await tick();a.reject(Error('offline'));await tick();
    assert.equal(received.length,1);
    assert.deepEqual(failures,[]);
    assert.equal(u.isProvisional(),true);
    assert.ok(a.events.includes('cdq:startup-offline-v2539'));
  }
});

test('cancelled biometric, activation and explicit offline startup never grant local access',async()=>{
  {
    const a=startup({localTicket:true}),u=a.c.cdqStartupUnlockV2529,received=[];
    u.attach('person@example.invalid','normal',ok=>received.push(ok));
    u.receive('startup-test',false,'Annulée','');
    await tick();
    assert.deepEqual(received,[false]);
    assert.equal(a.localReads.length,0);
    assert.equal(a.calls.length,0);
  }
  for(const options of [{noToken:true},{activation:true},{offline:true}]){
    const a=startup(options);
    assert.equal(a.prompts.length,0);
    assert.equal(a.c.cdqStartupUnlockV2529,undefined);
  }
});
