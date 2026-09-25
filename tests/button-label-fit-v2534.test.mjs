import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const runtime=fs.readFileSync('button-label-fit-v2534.js','utf8');
test('runtime is local-only and never persists or transports settings',()=>{
  new vm.Script(runtime);
  assert.doesNotMatch(runtime,/\bfetch\s*\(|XMLHttpRequest|postMessage\s*\(|localStorage|sessionStorage|indexedDB/);
  assert.match(runtime,/overflow-wrap','normal/);
  assert.match(runtime,/hyphens','none/);
  assert.match(runtime,/\.quick-name/);
  assert.match(runtime,/cdqTopActionsV2204/);
});
test('generated paired interfaces contain the complete-word fitter after build',()=>{
  for(const path of ['balance-cdq-android/app/build/generated/cdq-web-assets/cdq-web/Selector.html','iphone/app/Selector.html']){
    const html=fs.readFileSync(path,'utf8');
    assert.equal(html.split('id="cdqButtonLabelFitV2534"').length,2,path);
    assert.match(html,/window\.cdqButtonLabelFitV2534\?\.fit\(\)/,path);
    assert.doesNotMatch(html,/\.quick-name[^\n]*[\s\S]{0,280}'overflow-wrap':'anywhere'/,path);
  }
});
