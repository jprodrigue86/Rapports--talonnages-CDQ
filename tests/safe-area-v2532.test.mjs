import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {applySafeShell2532,applySafeSelector2532} from '../scripts/safe-area-v2532.mjs';
const read=p=>fs.readFileSync(p,'utf8'),dir='balance-cdq-android/app/build/generated/cdq-web-assets/cdq-web/';
test('native host owns system bars and insets, not model-name guesses',()=>{
 const main=read('balance-cdq-android/app/src/main/java/ca/balancecdq/android/MainActivity.kt');
 const safe=read('balance-cdq-android/app/src/main/java/ca/balancecdq/android/SafeContentInsets.kt');
 assert.match(main,/setContentView\(SafeContentInsets.host\(this, webView\)\)/);assert.match(main,/CDQSafeArea\/1/);
 assert.match(safe,/Type.systemBars\(\) or WindowInsetsCompat.Type.displayCutout\(\)/);assert.match(safe,/Type.ime/);assert.match(safe,/WindowInsetsCompat.CONSUMED/);
 assert.doesNotMatch(safe,/Build.MODEL|S25|S711|34px|24px/);
});
test('shared safe viewport is packaged and preserves manual settings',()=>{
 const s=read(dir+'Selector.html'),shell=read(dir+'index.html'),safe=read(dir+'safe-viewport-v2532.js');
 assert.equal(applySafeSelector2532(s),s);assert.equal(applySafeShell2532(shell),shell);
 assert.match(s,/document.documentElement.clientWidth \|\| window.innerWidth/);
 assert.match(s,/var\(--cdq-content-safe-top,env\(safe-area-inset-top/);
 assert.match(safe,/data-cdq-iphone-version/);assert.match(safe,/visualViewport/);
 assert.doesNotMatch(safe,/localStorage|sessionStorage|setItem|location.reload/);
 const meta=JSON.parse(read(dir+'asset-manifest.json'));
 const version=read('balance-cdq-android/app/build.gradle.kts').match(/versionName\s*=\s*"([^"]+)"/)[1];
 assert.equal(meta.version,version);
 assert.equal(meta.files['safe-viewport-v2532.js'].sha256,crypto.createHash('sha256').update(safe).digest('hex'));
 assert.match(s,/id="cdqHomeUnderlineV2531"/);
});
