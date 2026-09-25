import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {applyFullNames2536} from '../scripts/full-names-v2536.mjs';

const runtime = fs.readFileSync('full-names-v2536.js','utf8');

test('V25.36 full-name runtime is syntax-valid and touches only presentation surfaces', () => {
  new vm.Script(runtime);
  for (const selector of [
    '.file-name','.file-name-text','.folder-name','.folder-name-text',
    '#companyList .cdq-company-name','.company-button','.client-info-name',
    '.file-info','.file-row,.folder-header','.client-info-name-wrap'
  ]) assert.ok(runtime.includes(selector), selector);
  for (const rule of [
    "'white-space':'normal'","'overflow-wrap':'anywhere'",
    "'overflow':'visible'","'text-overflow':'clip'",
    "'max-height':'none'","'-webkit-line-clamp':'unset'"
  ]) assert.ok(runtime.includes(rule), rule);
  assert.doesNotMatch(runtime,/\bfetch\s*\(|XMLHttpRequest|google\.script|localStorage|sessionStorage|indexedDB|BalanceCDQNative|renommer|supprimer/i);
});

test('V25.36 patch runs after legacy mobile company ellipsis is applied', () => {
  const source = '<html><head></head><body><script>function apply(){\n' +
    '    window.cdqFitButtonWordsV2534({unit,topLabel,label});\n' +
    '    applyPalette();\n' +
    '    layoutCompanyMenu(unit, textScale);\n' +
    '}</script></body></html>';
  const result = applyFullNames2536(source);
  assert.match(result,/id="cdqFullNamesV2536"/);
  const old = result.indexOf('layoutCompanyMenu(unit, textScale);');
  const fix = result.indexOf('window.cdqFitFullNamesV2536();');
  assert.ok(old >= 0 && fix > old);
});

test('generated Android interface contains the V25.36 full-name override', () => {
  const path='balance-cdq-android/app/build/generated/cdq-web-assets/cdq-web/Selector.html';
  assert.ok(fs.existsSync(path),'build embedded interface first');
  const html=fs.readFileSync(path,'utf8');
  assert.match(html,/id="cdqFullNamesV2536"/);
  assert.match(html,/layoutCompanyMenu\(unit, textScale\);\n    window\.cdqFitFullNamesV2536\(\);/);
  assert.match(html,/#companyList \.cdq-company-name/);
  assert.match(html,/\.file-name-text/);
});
