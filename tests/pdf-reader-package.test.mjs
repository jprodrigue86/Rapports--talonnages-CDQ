import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import crypto from 'node:crypto';import {applyPatch} from './helpers/settings-fixture.mjs';
const read=p=>fs.readFileSync(p,'utf8'),folder='bundles/balance-cdq/v25.20',manifest=JSON.parse(read(folder+'/manifest.json'));
test('Installable package uses exact V25.19 baseline, actual reader modules and checked helper bytes',()=>{
 assert.deepEqual(manifest,JSON.parse(read(folder+'/Balance_CDQ_V25_20.cdq')));assert.deepEqual(manifest.requiresBuild,[JSON.parse(read('bundles/balance-cdq/v25.19/manifest.json')).build]);
 for(const file of ['selector-reader.js','document-open.js','desktop.js']){const source=read(folder+'/'+file);new vm.Script(source);assert.ok(manifest.patches.some(p=>p.replacement?.includes(source)),file);}
 const extra=manifest.extraFiles[0];assert.equal(crypto.createHash('sha256').update(read(folder+'/files/'+extra.name)).digest('hex'),extra.sha256);new vm.Script(read(folder+'/files/'+extra.name));
 for(const p of ['index.html','pc/index.html'])for(const match of read(p).matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!/type="(?:module|application\/json|importmap)"/.test(match[1]))new vm.Script(match[2]);
 if(process.env.CDQ_V2519_SOURCE){for(const file of ['Selector.html','Code.gs']){let source=read(process.env.CDQ_V2519_SOURCE+'/'+(file==='Selector.html'?'Selector-V25.19-preview.html':'Code-V25.19-preview.gs'));for(const p of manifest.patches.filter(p=>p.file===file))source=applyPatch(source,p);fs.writeFileSync('/tmp/cdq-v2520-'+file,source);if(file==='Code.gs')new vm.Script(source);else for(const match of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!match[1].includes('application/json'))new vm.Script(match[2]);}}
});
test('Both service workers cache versioned reader assets before the network and never return the app as missing reader HTML',async()=>{
 for(const file of ['sw.js','pc/sw.js']){
  const listeners={},scope='https://jprodrigue86.github.io/Rapports--talonnages-CDQ/'+(file.startsWith('pc')?'pc/':''),root='https://jprodrigue86.github.io/Rapports--talonnages-CDQ/';let cached=new Response('reader'),fetches=0;
  const context=vm.createContext({URL,Response,console,importScripts:()=>{},self:{registration:{scope},addEventListener:(t,fn)=>listeners[t]=fn},caches:{open:async()=>({match:async()=>cached,put:async()=>{}})},fetch:async()=>{fetches++;throw Error('offline')}});vm.runInContext(read(file),context);
  async function request(path){let result;listeners.fetch({request:{method:'GET',mode:'navigate',url:root+path},respondWith:p=>result=p,waitUntil:()=>{}});return await result;}
  assert.equal(await (await request('reader-v2520.html')).text(),'reader');assert.equal(fetches,0);
  cached=null;const missing=await request('reader-v2520.html').catch(()=>null);assert.ok(!missing||missing.status===503);
 }
});
test('A delayed PDF read is rejected when the signed-in account changes',async()=>{
 let resolve;const context=vm.createContext({Blob,Uint8Array,window:{},navigator:{onLine:true},localStorage:{getItem:()=>null},utilisateurCourantEmail:'a@example.invalid',cdqAccessState:'ready',CDQ_DOCUMENT_MAX_BYTES:32*1024*1024,cdqV19QueueGet:async()=>[],cdqV19GetRecord:async()=>null,cdqV19Gs:()=>new Promise(r=>resolve=r)});vm.runInContext(read(folder+'/selector-reader.js'),context);
 const pending=context.cdqLoadPdfRecord('PDF_CLIENT_123456');await new Promise(r=>setImmediate(r));context.utilisateurCourantEmail='b@example.invalid';resolve({});await assert.rejects(pending,/compte a changé/);
});
