import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {applyPatch, settingsInput, buildDisplayControls} from './helpers/settings-fixture.mjs';

const manifest = JSON.parse(fs.readFileSync('bundles/balance-cdq/v25.11/manifest.json'));
const sizingInput = fs.readFileSync('tests/fixtures/v25.10-sizing.js', 'utf8');
// These fixtures contain no URLs or regex literals with comment delimiters.
const withoutComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

for (const comments of [true, false]) {
  test(`sizing hooks apply with comments=${comments} without replacing existing function bodies`, () => {
    const before = comments ? sizingInput : withoutComments(sizingInput);
    const marker = '/* technician sizing note */';
    let output = before.replace('function cdqApplyGeneralScaleV89', marker+'\nfunction cdqApplyGeneralScaleV89');
    for (const patch of manifest.patches.slice(2, 7)) output = applyPatch(output, patch);
    assert.ok(output.includes(marker));
    assert.equal((output.match(/if\(window\.cdqMobileLayout\)window\.cdqMobileLayout\.apply\(\);/g) || []).length, 5);
    assert.equal(output.replaceAll('  if(window.cdqMobileLayout)window.cdqMobileLayout.apply();\n','').replace(marker+'\n',''), before);
    new vm.Script(output);
  });

  test(`settings controls apply with comments=${comments} and retain unrelated labels`, () => {
    const before = (comments ? settingsInput : withoutComments(settingsInput)).replace('Interface générale', 'Interface personnalisée');
    const after = buildDisplayControls(before);
    new vm.Script(after);
    assert.ok(after.includes('Interface personnalisée'));
    assert.ok(after.includes('controls().querySelectorAll("[data-pdf-reader]")'));
    assert.equal(after.includes('body.querySelectorAll("[data-pdf-reader]")'), false);
    assert.ok(after.includes("const controls=function(){"));
    assert.ok(after.includes('cdqSaveDisplayPreferencesNowV2212'));
  });
}

test('missing and ambiguous targets still block preparation', () => {
  const patch = manifest.patches[2];
  assert.throws(() => applyPatch('unrecognized function', patch), /attendu 1, trouvé 0/);
  assert.throws(() => applyPatch(sizingInput+sizingInput, patch), /attendu 1, trouvé 2/);
  assert.throws(() => buildDisplayControls(settingsInput.replaceAll('body.querySelectorAll("[data-pdf-reader]")', 'custom.querySelectorAll("[data-pdf-reader]")')), /attendu 2, trouvé 0/);
});

test('every standard R2 export is identical; cumulative exports preserve the V25.10 R2 upgrade', () => {
  for (const name of ['manifest.json','Balance_CDQ_V25_11.cdq','Balance_CDQ_V25_11_R2.cdq']) {
    assert.deepEqual(JSON.parse(fs.readFileSync('bundles/balance-cdq/v25.11/'+name)), manifest);
  }
  assert.deepEqual(JSON.parse(fs.readFileSync('bundles/balance-cdq/latest/manifest.json')), manifest);
  const base = JSON.parse(fs.readFileSync('bundles/balance-cdq/v25.10/manifest.json'));
  for (const name of ['Balance_CDQ_V25_11_depuis_V25_09.cdq','Balance_CDQ_V25_11_R2_depuis_V25_09.cdq']) {
    const combined = JSON.parse(fs.readFileSync('bundles/balance-cdq/v25.11/'+name));
    assert.deepEqual(combined.patches, [...base.patches, ...manifest.patches]);
    assert.deepEqual(combined.requiresBuild, base.requiresBuild);
    assert.equal(combined.projectScriptId, manifest.projectScriptId);
    assert.deepEqual(combined.removeFiles, []);
    assert.ok(combined.patches.length <= 80);
  }
  assert.deepEqual(manifest.requiresBuild, ['2026.09.21-v25.10-display-document-cleanup']);
  assert.equal(manifest.revision, 2);
  assert.deepEqual(manifest.removeFiles, []);
});
