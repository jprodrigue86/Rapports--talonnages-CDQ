import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code=fs.readFileSync('balance-cdq-android/web-source/warm-unlock-v2540.js','utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));

function harness(){
  const values=new Map([
    ['cdq_auth_device_token_v2','device-token-12345'],
    ['cdqLastUnlockEmailV2511','person@example.invalid']
  ]);
  const confirms=[],clears=[],events=[];
  const c={
    localStorage:{getItem:key=>values.get(key)||''},
    Date,JSON,Promise,Event,queueMicrotask,
    dispatchEvent:e=>events.push(e.type),
    BalanceCDQNative:{
      localStartupTicket(id,grant,email,token){
        return JSON.stringify({
          ok:grant.startsWith('grant-')&&email==='person@example.invalid'&&token==='device-token-12345',
          email,
          expiresAt:Date.now()+3600000
        });
      },
      confirmStartupTicket(...args){confirms.push(args);return true;},
      clearStartupTicket(...args){clears.push(args);}
    }
  };
  c.window=c;vm.runInNewContext(code,c);
  return {c,values,confirms,clears,events};
}

test('a warm biometric grant yields local UI before the server response',async()=>{
  const h=harness(),u=h.c.cdqWarmUnlockV2540,received=[];
  assert.equal(u.observe('warm-1',true,'','grant-012345678901234567890'),true);
  let resolve;
  const server=new Promise(r=>{resolve=r;});
  assert.equal(u.takeSession(
    'device-token-12345',
    x=>received.push(x),
    ()=>{},
    {ui:true},
    ()=>server
  ),true);
  await tick();
  assert.equal(received.length,1);
  assert.equal(received[0].cdqWarmReadOnlyV2540,true);
  assert.equal(received[0].role,'technicien');
  assert.equal(u.isProvisional(),true);
  resolve({autorise:true,email:'person@example.invalid',role:'technicien',jetonSession:'server'});
  await tick();
  assert.equal(received.length,2);
  assert.equal(h.confirms.length,1);
  assert.ok(h.events.includes('cdq:warm-confirmed-v2540'));
  assert.equal(u.isProvisional(),false);
});

test('the same loaded page can fast-unlock repeatedly, not only once',async()=>{
  const h=harness(),u=h.c.cdqWarmUnlockV2540;
  for(let n=1;n<=3;n++){
    const received=[];
    assert.equal(u.observe('warm-'+n,true,'','grant-'+String(n).padEnd(24,'0')),true);
    let resolve;
    const server=new Promise(r=>{resolve=r;});
    assert.equal(u.takeSession(
      'device-token-12345',
      x=>received.push(x),
      ()=>{},
      null,
      ()=>server
    ),true);
    await tick();
    assert.equal(received.length,1,'cycle '+n+' local result');
    assert.equal(received[0].cdqWarmReadOnlyV2540,true);
    resolve({autorise:true,email:'person@example.invalid',role:'technicien',jetonSession:'server-'+n});
    await tick();
    assert.equal(received.length,2,'cycle '+n+' server result');
  }
  assert.equal(h.confirms.length,3);
});

test('failed biometrics and invalid grants never create a local session',()=>{
  const h=harness(),u=h.c.cdqWarmUnlockV2540;
  assert.equal(u.observe('x',false,'Annulée',''),false);
  assert.equal(u.observe('x',true,'','short'),false);
  assert.equal(u.takeSession('device-token-12345',()=>{},()=>{},null,()=>Promise.resolve({})),false);
});
