import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {read,manifest,patch,currentSource} from './helpers/desktop-workspace-fixture.mjs';
test('Manager transports desktop JavaScript literally and preserves server operations',()=>{
 const runtime=manifest.patches.find(p=>p.replacement?.includes('<script id="cdqDesktopV2517Js">'));
 const applied=patch(runtime.search,'Selector.html',{patches:[runtime]});
 const js=applied.match(/<script id="cdqDesktopV2517Js">\s*([\s\S]*?)<\/script>/)[1].trim();
 assert.equal(js,read('bundles/balance-cdq/v25.17/desktop.js').trim());new vm.Script(js);
 const base=manifest.requiresBuild[0],server=`const BUILD='${base}'; function authorizationAndPdf(){return 'unchanged'}`;
 assert.equal(patch(server,'Code.gs').replaceAll(manifest.build,base),server);
 assert.deepEqual(manifest.removeFiles,[]);
 assert.deepEqual(JSON.parse(read('bundles/balance-cdq/v25.17/Balance_CDQ_V25_17.cdq')),manifest);
 assert.throws(()=>patch('unknown','Selector.html'),/aucune version source compatible/);
});
test('real Selector keeps mobile, PDF, authorization and templates intact',{skip:!process.env.CDQ_SELECTOR_SOURCE},()=>{
 const before=currentSource(),after=patch(before,'Selector.html');
 const changed=new Set(['cdqPcV16Js','cdqIconThemesJsV2514','cdqPcV2224CleanupJs','cdqPcV2226DirectJs','cdqPcV2240NoFlashJs','cdqPcV2245RobustFullscreenJs','cdqPcV2244UpdateBannerJs']);
 const blocks=s=>[...s.matchAll(/<(script|style)\b([^>]*)>([\s\S]*?)<\/\1>/gi)];
 for(const block of blocks(before)){const id=block[2].match(/id="([^"]+)"/)?.[1];if(changed.has(id))continue;assert.ok(after.includes(block[0].replaceAll(manifest.requiresBuild[0],manifest.build)),id||'untagged block preserved')}
 const oldPc=before.match(/<script id="cdqPcV16Js">([\s\S]*?)<\/script>/)[1];const auth=oldPc.slice(oldPc.indexOf('function wait()'),oldPc.indexOf("document.addEventListener('visibilitychange'",oldPc.indexOf('function wait()')));assert.ok(after.includes(auth));
 for(const block of blocks(after))if(block[1]==='script'&&!block[2].includes('application/json'))new vm.Script(block[3]);
 assert.equal((after.match(/id="cdqPcV2244UpdateBannerJs"/g)||[]).length,1);
 assert.ok(after.lastIndexOf('id="cdqDesktopV2517Css"')>after.lastIndexOf('id="cdqPcV2245RobustFullscreenCss"'));
});
