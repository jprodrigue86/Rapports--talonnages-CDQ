import fs from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';import crypto from 'node:crypto';import vm from 'node:vm';
import {floorTemplate,meta} from '../floor-template-v2519.mjs';
const root='bundles/balance-cdq/v25.19',read=p=>fs.readFileSync(p,'utf8');
const m=JSON.parse(read(root+'/manifest.json'));
test('PDF approuvé : même contenu dans le navigateur, le package et Apps Script',async()=>{
 const expected=fs.readFileSync('assets/templates/balance-plancher-v2519.pdf');
 assert.equal(crypto.createHash('sha256').update(expected).digest('hex'),meta.sha256);
 assert.equal(expected.length,628837);assert.deepEqual(Buffer.from(await(await floorTemplate()).blob.arrayBuffer()),expected);
 assert.equal(read(root+'/manifest.json'),read(root+'/Balance_CDQ_V25_19.cdq'));assert.ok(read(root+'/manifest.json').length<3000000);
 const context=vm.createContext({HtmlService:{createHtmlOutputFromFile:name=>({getContent:()=>read(root+'/files/'+name+'.html')})},Utilities:{base64Decode:s=>Array.from(Buffer.from(s,'base64')),DigestAlgorithm:{SHA_256:'SHA-256'},computeDigest:(_,b)=>Array.from(crypto.createHash('sha256').update(Buffer.from(b)).digest()),newBlob:(b,type,name)=>({bytes:Buffer.from(b),type,name})}});
 vm.runInContext(read(root+'/files/CDQTemplates.gs'),context);
 const file=context.cdqTemplateEmbarque_('plancher');assert.equal(file.getId(),meta.templateId);assert.equal(file.getLastUpdated().getTime(),meta.modifieLe);assert.deepEqual(file.getBlob().bytes,expected);
 let driveCalls=0;context.obtenirModeleIntermediaireCDQ_=()=>({cle:'plancher'});context.obtenirDossierSystemeCDQ_=()=>{driveCalls++;throw Error('Drive interdit')};
 const p=m.patches.find(p=>p.search?.includes('const systeme = obtenirDossierSystemeCDQ_();'));
 vm.runInContext('function floorGetter(modeleId){'+p.replacement+'}',context);assert.equal(context.floorGetter('plancher').getId(),meta.templateId);assert.equal(driveCalls,0);
});
test('Installation complète et cache hors ligne du moteur et du modèle pour PC et téléphone',()=>{
 for(const [path,relative] of [['index.html','./'],['pc/index.html','../']])assert.ok(read(path).includes("import('"+relative+"offline-templates-v2526.mjs')"));
 for(const path of ['sw.js','pc/sw.js'])for(const file of ['offline-templates-v2526.mjs','floor-template-v2519.mjs'])assert.ok(read(path).includes(file));
 assert.equal(m.requiresBuild[0],'2026.09.23-v25.18-pc-ergonomie-performance');assert.equal(m.extraFiles.length,2);
});
