import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {applyPatch} from './helpers/settings-fixture.mjs';
const read=p=>fs.readFileSync(p,'utf8');
const base=JSON.parse(read('bundles/balance-cdq/v25.11/manifest.json'));
const next=JSON.parse(read('bundles/balance-cdq/v25.12/manifest.json'));
const apply=source=>next.patches.filter(p=>p.file==='Selector.html').reduce((s,p)=>applyPatch(s,p),source);
test('upgrade replaces only the display module and build, retaining PDF/account code',()=>{
 const unrelated='<!-- keep technician note -->\n<script>function openPdf(){return "unchanged"}function authorizeGoogle(){return "unchanged"}</script>';
 const source=base.build+'\n'+unrelated+'\n'+base.patches.at(-1).text+'\n</body>';
 const out=apply(source);
 assert.ok(out.includes(unrelated));assert.ok(out.includes(next.build));
 assert.equal((out.match(/id="cdqMobileLayoutJs"/g)||[]).length,1);
 assert.equal((out.match(/id="cdqMobileLayoutCss"/g)||[]).length,1);
 assert.ok(out.includes(read('bundles/balance-cdq/v25.12/mobile-layout.js')));
 assert.ok(out.includes(read('bundles/balance-cdq/v25.12/mobile-layout.css')));
 new vm.Script(read('bundles/balance-cdq/v25.12/mobile-layout.js'));
});
test('missing source modules block the package instead of silently applying a partial fix',()=>{
 assert.throws(()=>apply(base.build+'\n</body>'),/introuvable/);
});
test('package identity is scoped to V25.11 and exports agree',()=>{
 assert.deepEqual(next.requiresBuild,[base.build]);assert.deepEqual(next.removeFiles,[]);
 assert.deepEqual(JSON.parse(read('bundles/balance-cdq/v25.12/Balance_CDQ_V25_12.cdq')),next);
 assert.ok(next.patches.filter(p=>p.file==='Code.gs').every(p=>p.op==='replace_build'));
});
