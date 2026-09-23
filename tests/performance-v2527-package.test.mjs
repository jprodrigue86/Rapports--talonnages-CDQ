import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {applyPatch} from './helpers/settings-fixture.mjs';
const read=p=>fs.readFileSync(p,'utf8');
const manifest=JSON.parse(read('bundles/balance-cdq/v25.27/manifest.json'));
const company=manifest.patches.find(p=>p.id==='company-list');
const normalize=manifest.patches.filter(p=>p.id?.startsWith('legacy-company-'));
const archived=read('tests/fixtures/v25.26-companies-with-comments.js');
const applyCompany=source=>[...normalize,company].reduce((s,p)=>applyPatch(s,p),source);

test('the archived comments reproduce the company-list failure from the V42 screenshot',()=>{
  assert.throws(()=>applyPatch(archived,{...company,search:read('bundles/balance-cdq/v25.27/clients-previous.js')}),/\[company-list\].*attendu 1, trouvé 0/);
  assert.ok(archived.includes("// Si le cache local est déjà affiché"));
  assert.ok(archived.includes('// La liste locale apparaît tout de suite'));
});
for(const [name,format] of [['original',s=>s],['CRLF',s=>s.replaceAll('\n','\r\n')],['trimmed lines',s=>s.split('\n').map(l=>l.trimEnd()).join('\n')]])
  test('revision 3 applies to the archived company function: '+name,()=>{
    const result=applyCompany(format(archived));
    assert.equal(result.trimEnd(),read('bundles/balance-cdq/v25.27/clients.js').trimEnd());
    new vm.Script(result);
  });
test('the already stripped production HTML remains compatible',()=>{
  assert.equal(applyCompany(read('bundles/balance-cdq/v25.27/clients-previous.js')).trimEnd(),read('bundles/balance-cdq/v25.27/clients.js').trimEnd());
});
test('the comment following the client refresh function is preserved exactly',()=>{
  const source=read('tests/fixtures/v25.26-client-refresh-with-comment.js');
  const patch=manifest.patches.find(p=>p.id==='client-refresh-keeps-preloads');
  const tail=source.slice(patch.search.length);
  assert.ok(tail.includes('RECUPERER FICHIER MODIFICATION'));
  assert.equal(applyPatch(source,patch),patch.replacement+tail);
  assert.equal(applyPatch(source.replaceAll('\n','\r\n'),patch),patch.replacement+tail);
});
test('comment compatibility never accepts modified instructions or other unreviewed changes',()=>{
  for(const bad of [archived.replace('cacheAffiche = true','cacheAffiche = false'),archived.replace('const forcer = !!forceRefresh;','const forcer = !!forceRefresh; // unknown edit')])
    assert.throws(()=>applyCompany(bad),/\[company-list\].*trouvé 0/);
  assert.throws(()=>applyCompany(archived+archived),/attendu 1, trouvé 2/);
});
test('revision 3 retains project and build requirements and needs no newer manager',()=>{
  assert.equal(manifest.audit.packageRevision,3);
  assert.equal(manifest.audit.scriptManagerRequired,'V42');
  assert.equal(manifest.projectScriptId,'1udMG-jQcBAwBAwk6kSEZ660JWo5n7nVvnq24lp2T4RDV5pfXe8QDlPdf');
  assert.deepEqual(manifest.requiresBuild,['2026.09.23-v25.26-sheets-retour']);
  assert.deepEqual(manifest.removeFiles,[]);
  assert.equal(read('bundles/balance-cdq/v25.27/manifest-r3.json'),read('bundles/balance-cdq/v25.27/manifest.json'));
});
