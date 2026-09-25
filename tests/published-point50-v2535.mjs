import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const base='https://jprodrigue86.github.io/Rapports--talonnages-CDQ/';
const read=p=>fs.readFileSync(p);
const expected=JSON.parse(read('downloads/android-release-update.json'));
const iphone=JSON.parse(read('iphone/app/release.json'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.equal(expected.versionCode,2535);
assert.equal(expected.versionName,'25.35');
assert.equal(iphone.version,'25.35');
assert.equal(iphone.androidSourceBuild,'2026.09.25-v25.35-point50-standard');
async function get(path){
 const r=await fetch(base+path+'?cdq_verify='+Date.now(),{signal:AbortSignal.timeout(25000)});
 assert(r.ok,path+' HTTP '+r.status);
 return Buffer.from(await r.arrayBuffer());
}
let ready=false;const deadline=Date.now()+300000;
while(Date.now()<deadline){
 try{
  const android=JSON.parse(await get('downloads/android-release-update.json'));
  const ios=JSON.parse(await get('iphone/app/release.json'));
  if(android.sha256===expected.sha256 && ios.release===iphone.release){ready=true;break;}
 }catch{}
 await new Promise(r=>setTimeout(r,10000));
}
assert(ready,'Public release is not yet the tested 25.35 release');
for(const path of [
 'downloads/Balance-CDQ-Android-25.35.apk',
 'downloads/Balance-CDQ-Android-25.35.zip',
 'installer.html','iphone/index.html','iphone/app/Selector.html',
 'iphone/app/index.html','iphone/app/sw.js','iphone/app/embedded-rpc.js',
 'iphone/app/iphone-update.js'
]){
 assert.equal(sha(await get(path)),sha(read(path)),path+' published exact bytes');
}
for(const path of ['installer.html','iphone/index.html']){
 const page=(await get(path)).toString();
 assert(page.includes('25.35'));
 assert(page.includes('Copier le lien iPhone'));
 assert(page.includes('connection-repair.html'));
}
console.log(JSON.stringify({version:'25.35',androidSha256:expected.sha256,iphoneRelease:iphone.release,publicChecksums:'verified'}));
