import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync('icon-artwork-baseline-v2540.css','utf8');

test('V25.40 icon artwork uses the packaged V25.15 sprite and original reference',()=>{
  assert.match(css,/--cdq-icon-art-v2514:url\("\.\/bundles\/balance-cdq\/v25\.15\/icons-transparent\.webp"\)/);
  assert.match(css,/--cdq-icon-original-v2515:url\("\.\/bundles\/balance-cdq\/v25\.14\/icons-reference\.png"\)/);
  assert.match(css,/background-image:var\(--cdq-icon-art-v2514\)!important/);
  assert.doesNotMatch(css,/https?:\/\//);
  assert.ok(fs.statSync('bundles/balance-cdq/v25.15/icons-transparent.webp').size>500000);
  assert.ok(fs.statSync('bundles/balance-cdq/v25.14/icons-reference.png').size>100000);
});
