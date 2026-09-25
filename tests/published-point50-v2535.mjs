import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const base='https://jprodrigue86.github.io/Rapports--talonnages-CDQ/';
const read=p=>fs.readFileSync(p);
const expected=JSON.parse(read('downloads/android-release-update.json'));
const iphone=JSON.parse(read('iphone/app/release.json'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');

assert.match(expected.versionName,/^\d+\.\d+$/);
assert(Number.isInteger(expected.versionCode)&&expected.versionCode>0);
assert.equal(expected.channel,'stable');
assert.equal(iphone.version,expected.versionName);
assert.equal(expected.apkUrl,base+'downloads/Balance-CDQ-Android-'+expected.versionName+'.apk');

async function get(path){
  const r=await fetch(base+path+'?cdq_verify='+Date.now(),{signal:AbortSignal.timeout(25000)});
  assert(r.ok,path+' HTTP '+r.status);
  return Buffer.from(await r.arrayBuffer());
}

let ready=false;
const deadline=Date.now()+300000;
while(Date.now()<deadline){
  try{
    const android=JSON.parse(await get('downloads/android-release-update.json'));
    const ios=JSON.parse(await get('iphone/app/release.json'));
    if(android.sha256===expected.sha256 && android.versionCode===expected.versionCode && ios.release===iphone.release){
      ready=true;
      break;
    }
  }catch{}
  await new Promise(r=>setTimeout(r,10000));
}
assert(ready,'GitHub Pages is not yet serving the certified release');

const version=expected.versionName;
const paths=[
  'downloads/Balance-CDQ-Android-'+version+'.apk',
  'downloads/Balance-CDQ-Android-'+version+'.zip',
  'downloads/android-release-update.json',
  'installer.html',
  'iphone/index.html',
  'iphone/app/release.json',
  'iphone/app/Selector.html',
  'iphone/app/index.html',
  'iphone/app/sw.js',
  'iphone/app/embedded-rpc.js',
  'iphone/app/iphone-update.js',
  'iphone/app/manifest.webmanifest'
];

for(const path of paths){
  assert.equal(sha(await get(path)),sha(read(path)),path+' published exact bytes');
}

const publicApk=await get('downloads/Balance-CDQ-Android-'+version+'.apk');
assert.equal(sha(publicApk),expected.sha256,'public APK SHA-256');

for(const path of ['installer.html','iphone/index.html']){
  const page=(await get(path)).toString();
  assert(page.includes('Balance-CDQ-Android-'+version+'.apk'));
  assert(page.includes('Balance-CDQ-Android-'+version+'.zip'));
  assert(page.includes('Android · V'+version));
  assert(page.includes('Copier le lien iPhone'));
  assert(page.includes('connection-repair.html'));
}

assert((await get('installer.html')).toString().includes('base V'+version));
console.log(JSON.stringify({
  version,
  versionCode:expected.versionCode,
  androidSha256:expected.sha256,
  iphoneRelease:iphone.release,
  publicChecksums:'verified'
}));
