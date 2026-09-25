import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const source=fs.readFileSync('tests/embedded-v2528-browser.test.mjs','utf8');
const anchor='  // V25.40 returning startup: Android already owns the biometric prompt and'
assert.equal(source.split(anchor).length,2);
let test=source.replace(anchor,fs.readFileSync('tests/personal-sizing-full.fragment.txt','utf8')+'\n'+anchor);
// Start with the real administrator fixture response: changing roles after boot
// lets the delayed navigation initializer add Factures during the measurement.
const role="role:'technicien',jetonSession:'fixture-session'";
assert.equal(test.split(role).length,2);test=test.replace(role,"role:'admin',jetonSession:'fixture-session'");
const measured='  const originalSize=await selector.evaluate(measured);';assert.equal(test.split(measured).length,2);
test=test.replace(measured,"  await selector.waitForFunction(()=>document.querySelectorAll('.bottom-nav > .bottom-nav-item').length===6);\n  await new Promise(r=>setTimeout(r,300));\n"+measured);
const rpc="          if(name==='cdqRpc'){";assert.equal(test.split(rpc).length,2);test=test.replace(rpc,rpc+"window.recordRpc?.('rpc:'+args[0]);");
const restart='  // Disable all nonpackaged requests at the interception boundary.';assert.equal(test.split(restart).length,2);
test=test.replace(restart,"  assert.equal(await selector.evaluate(()=>cdqPersonalSizing.current()?.anchor.Text),71,'Personal reference survives the real UI restart');\n"+restart);
const generated='tests/.personal-full-generated.mjs';
try{fs.writeFileSync(generated,test);execFileSync(process.execPath,[generated],{stdio:'inherit'});}finally{fs.rmSync(generated,{force:true});}
