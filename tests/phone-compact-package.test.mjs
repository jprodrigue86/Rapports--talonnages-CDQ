import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {applyPatch} from './helpers/settings-fixture.mjs';
const read=p=>fs.readFileSync(p,'utf8');
const base=JSON.parse(read('bundles/balance-cdq/v25.12/manifest.json'));
const next=JSON.parse(read('bundles/balance-cdq/v25.13/manifest.json'));
const apply=source=>next.patches.filter(p=>p.file==='Selector.html').reduce((s,p)=>applyPatch(s,p),source);
const strip=s=>s.replace(/<style id="cdqMobileLayoutCss">[\s\S]*?<\/style>\s*/,'').replace(/<script id="cdqMobileLayoutJs">[\s\S]*?<\/script>\s*/,'').replaceAll(next.build,base.build);
test('package preserves every byte outside the layout module and build',()=>{
 const source=base.build+'\n<script>function openPdf(){return "unchanged"}function authorizeGoogle(){return "unchanged"}</script>\n'+base.patches.at(-1).text+'</body>';
 assert.equal(strip(apply(source)),strip(source));
 if(process.env.CDQ_SELECTOR_SOURCE){const actual=read(process.env.CDQ_SELECTOR_SOURCE);assert.equal(strip(apply(actual)),strip(actual));}
 new vm.Script(read('bundles/balance-cdq/v25.13/mobile-layout.js'));
});
test('only V25.12 is accepted and the package is complete',()=>{
 assert.deepEqual(next.requiresBuild,[base.build]);
 assert.throws(()=>apply(base.build+'\n</body>'),/introuvable/);
 assert.deepEqual(JSON.parse(read('bundles/balance-cdq/v25.13/Balance_CDQ_V25_13.cdq')),next);
 assert.ok(next.patches.at(-1).text.includes(read('bundles/balance-cdq/v25.13/mobile-layout.js')));
 assert.ok(next.patches.at(-1).text.includes(read('bundles/balance-cdq/v25.13/mobile-layout.css')));
});
