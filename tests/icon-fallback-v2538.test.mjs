import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code=fs.readFileSync('icon-fallback-v2538.js','utf8');

test('V25.38 icon fallback is syntax valid and uses only packaged artwork',()=>{
  new vm.Script(code);
  assert.match(code,/icons-transparent\.webp/);
  assert.match(code,/cdq-icon-art-ready-v2538/);
  assert.match(code,/visibility:visible!important/);
  assert.match(code,/display:none!important/);
  assert.doesNotMatch(code,/https:\/\//);
  assert.doesNotMatch(code,/fetch\s*\(|XMLHttpRequest|google\.script/);
});
