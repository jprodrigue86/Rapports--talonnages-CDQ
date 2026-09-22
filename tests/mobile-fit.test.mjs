import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {applyPatch} from './helpers/settings-fixture.mjs';
const read=p=>fs.readFileSync(p,'utf8');
const manifest=JSON.parse(read('bundles/balance-cdq/v25.16/manifest.json'));
const previous=JSON.parse(read('bundles/balance-cdq/v25.15/manifest.json'));
const patch=(s,file,m=manifest)=>m.patches.filter(p=>p.file===file).reduce((s,p)=>applyPatch(s,p),s);
const strip=s=>s.replace(/<(style|script) id="cdqMobileLayout(?:Css|Js)">[\s\S]*?<\/\1>\s*/g,'').replace(/>\s+</g,'><').trim();
test('Manager applies V25.16 once and preserves icons, data, PDF and authorization code',()=>{
 let input=process.env.CDQ_SELECTOR_SOURCE?read(process.env.CDQ_SELECTOR_SOURCE):`${previous.build}<body>${previous.patches.at(-1).text}</body>`;
 if(process.env.CDQ_SELECTOR_SOURCE)input=patch(input,'Selector.html',previous);
 const output=patch(input,'Selector.html');
 assert.equal(strip(output).replaceAll(manifest.build,previous.build),strip(input));
 assert.equal(output.split('id="cdqMobileLayoutJs"').length-1,1);
 for(const [index,match] of [...output.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].entries())
  if(!/type=["'](?:application\/json|importmap)["']/.test(match[0].split('>')[0]))new vm.Script(match[1],{filename:'selector-'+index});
 const code=`const BUILD='${previous.build}'; function openPdf(){return 'unchanged';}`;
 assert.equal(patch(code,'Code.gs').replaceAll(manifest.build,previous.build),code);
 assert.equal(patch(output,'Selector.html').split('id="cdqMobileLayoutJs"').length-1,1);
 assert.throws(()=>patch('unknown</body>','Selector.html'),/aucune version source compatible/);
 assert.deepEqual(JSON.parse(read('bundles/balance-cdq/v25.16/Balance_CDQ_V25_16.cdq')),manifest);
 assert.deepEqual(manifest.removeFiles,[]);
});
