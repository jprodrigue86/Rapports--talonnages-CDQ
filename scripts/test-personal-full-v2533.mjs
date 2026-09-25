import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const source=fs.readFileSync('tests/embedded-v2528-browser.test.mjs','utf8');
const anchor='  // A returning native user can start biometric verification before the network';
assert.equal(source.split(anchor).length,2);
let test=source.replace(anchor,fs.readFileSync('tests/personal-sizing-full.fragment.txt','utf8')+'\n'+anchor);
const rpc="          if(name==='cdqRpc'){";assert.equal(test.split(rpc).length,2);test=test.replace(rpc,rpc+"window.recordRpc?.('rpc:'+args[0]);");
const generated='tests/.personal-full-generated.mjs';
try{fs.writeFileSync(generated,test);execFileSync(process.execPath,[generated],{stdio:'inherit'});}finally{fs.rmSync(generated,{force:true});}
