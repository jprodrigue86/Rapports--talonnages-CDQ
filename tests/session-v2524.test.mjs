import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';import crypto from 'node:crypto';
const dir='bundles/balance-cdq/v25.24',read=p=>fs.readFileSync(p,'utf8');
test('resume requires recent unexpired RPC session AND a registered device of the same authorized user',()=>{
 const now=Date.now(),record={email:'a@example.invalid',lastSeen:now,expiresAt:now+3600000};let rpc=0,device={email:record.email},user={email:record.email,role:'technicien'};
 const c=vm.createContext({Date,PropertiesService:{getScriptProperties:()=>({getProperty:()=>JSON.stringify(record)})},cleProprieteSessionRpcCDQ_:x=>x,normaliserEmailCDQ_:x=>String(x).toLowerCase(),lireUtilisateurDepuisJetonAppareilCDQ_:()=>device,lireUtilisateurDepuisSessionRpcCDQ_:()=>{rpc++;return user;}});
 vm.runInContext(read(dir+'/files/CDQSessionResume.gs'),c);
 const resume=()=>c.reprendreSessionCourteCDQV2524('rpc','device');
 assert.equal(resume().autorise,true);assert.equal(rpc,1);
 record.lastSeen=now-31*60000;assert.equal(resume().autorise,false);assert.equal(rpc,1);
 record.lastSeen=now;record.expiresAt=now-1;assert.equal(resume().autorise,false);
 record.expiresAt=now+3600000;device={email:'b@example.invalid'};assert.equal(resume().autorise,false);assert.equal(rpc,1);
 device=null;assert.equal(resume().autorise,false);device={email:record.email};user=null;assert.equal(resume().autorise,false);
});
test('phone resume survives reload but never trusts the local token without server validation; desktop and logout stay locked',()=>{
 const store=new Map(),events={};let saved,success,failed,allowed=0,fallback=0;
 const c=vm.createContext({Date,navigator:{userAgent:'Android BalanceCDQAndroid/25.21'},localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},window:{addEventListener:(k,f)=>events[k]=f},document:{hidden:false,addEventListener:(k,f)=>events[k]=f},cdqAccessState:'ready',cdqSessionRpcV58:'rpc',utilisateurCourantEmail:'a@example.invalid',cdqObtenirJetonAppareil:()=> 'device',cdqSetAccessState:()=>{},appliquerAccesAutorise:()=>allowed++,cdqApiRun:()=>({withSuccessHandler(f){success=f;return this},withFailureHandler(f){failed=f;return this},reprendreSessionCourteCDQV2524(token){saved=token;}})});
 vm.runInContext(read(dir+'/session.js')+'\nglobalThis.api=cdqSession24;',c);c.api.remember();assert.equal(store.size,1);
 c.document.hidden=true;events.visibilitychange();assert.equal(store.size,1);
 assert.equal(c.api.resume(()=>fallback++),true);assert.equal(saved,'rpc');assert.equal(allowed,0);
 success({autorise:true,email:'a@example.invalid'});assert.equal(allowed,1);
 c.api.resume(()=>fallback++);success({autorise:false});assert.equal(fallback,1);assert.equal(store.size,0);
 c.api.remember();c.api.resume(()=>fallback++);failed();assert.equal(fallback,2);
 c.api.remember();c.api.clear();assert.equal(c.api.resume(()=>fallback++),false);
 c.navigator.userAgent='Windows';c.api.remember();assert.equal(store.size,0);
});
test('bundle has reproducible hashes, exact base, no destructive removals and valid scripts',()=>{
 const b=JSON.parse(read(dir+'/manifest.json'));assert.equal(b.version,'V25.24');assert.deepEqual(b.requiresBuild,['2026.09.23-v25.23-lecteur-conversion']);assert.deepEqual(b.removeFiles,[]);
 assert.equal(read(dir+'/manifest.json'),read(dir+'/Balance_CDQ_V25_24.cdq'));assert.ok(JSON.parse(read('bundles/balance-cdq/latest/manifest.json')).build);
 for(const f of b.extraFiles)assert.equal(crypto.createHash('sha256').update(read(dir+'/files/'+f.name)).digest('hex'),f.sha256);
 for(const f of ['offline','session','company'])new vm.Script(read(dir+'/'+f+'.js'));
});
