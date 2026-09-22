import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
const manifest=JSON.parse(fs.readFileSync('bundles/balance-cdq/v25.11/manifest.json'));
const fastPatch=manifest.patches.find(p=>p.replacement?.includes('if(!skipFastBiometric'));
const fast=fastPatch.replacement.slice(0,fastPatch.replacement.indexOf('  cdqApiRun()'));
function start({token='registered-device',email='technician@example.com',native=true,skip=false,parent=true}={}){
 const calls=[];const context=vm.createContext({localStorage:{getItem:()=>email},cdqObtenirJetonAppareil:()=>token,
 navigator:{userAgent:native?'Android BalanceCDQAndroid/25.12':'Android Chrome'},cdqPwaAvailable:()=>parent,
 afficherDeverrouillageBiometrique:state=>calls.push(['biometric',state.email]),cdqFastUnlockV2511:false,skipFastBiometric:skip});
 vm.runInContext('function attempt(){'+fast+'return "normal";}result=attempt();',context);
 return {calls,result:context.result,fast:context.cdqFastUnlockV2511};
}
test('an enrolled native device asks for biometrics before the access-state request',()=>{
 const r=start();assert.deepEqual(r.calls,[['biometric','technician@example.com']]);assert.equal(r.fast,true);assert.equal(r.result,undefined);
});
for(const options of [{token:''},{email:''},{native:false},{skip:true},{parent:false}])test('normal authorization is retained for '+JSON.stringify(options),()=>{
 const r=start(options);assert.deepEqual(r.calls,[]);assert.equal(r.result,'normal');assert.equal(r.fast,false);
});
test('a failed fast server restore returns to normal authorization without another fast attempt',()=>{
 const patch=manifest.patches.find(p=>p.search?.includes('.restaurerSessionApresBiometrie(jeton);'));
 let failure,normalArgs=[],pin=0;
 const context=vm.createContext({actuel:()=>true,cdqFastUnlockV2511:true,cdqBiometricRequestId:'one',cdqBiometricPending:true,
 cdqArreterDelaiBiometrique:()=>{},verifierAccesApplication:v=>normalArgs.push(v),cdqAfficherPlanBNip:()=>pin++,jeton:'device',
 api:{withFailureHandler(fn){failure=fn;return this},restaurerSessionApresBiometrie(){}}});
 vm.runInContext('api'+patch.replacement,context);failure();assert.deepEqual(normalArgs,[true]);assert.equal(pin,0);assert.equal(context.cdqBiometricRequestId,'');assert.equal(context.cdqBiometricPending,false);
});
test('package exports remain identical and never remove model helpers',()=>{
 for(const path of ['bundles/balance-cdq/latest/manifest.json','bundles/balance-cdq/v25.11/Balance_CDQ_V25_11.cdq'])assert.deepEqual(JSON.parse(fs.readFileSync(path)),manifest);
 assert.deepEqual(manifest.removeFiles,[]);assert.ok(manifest.patches.length<=80);
});
