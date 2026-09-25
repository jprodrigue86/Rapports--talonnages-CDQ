import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(p,'utf8');
const once=(s,a,b)=>{assert.equal(s.split(a).length,2,'Anchor changed: '+a);return s.replace(a,b);};
const previous='2026.09.25-v25.32-ecran-adaptatif',build='2026.09.25-v25.33-point50-personnel';
let p='scripts/build-embedded-android-v2528.mjs',s=read(p);
if(!s.includes("from './personal-sizing-v2533.mjs'")){
 s=once(s,"import fs from 'node:fs';","import fs from 'node:fs';\nimport {applyPersonalSizing2533} from './personal-sizing-v2533.mjs';");
 s=once(s,"selector=applySafeSelector2532(selector);","selector=applySafeSelector2532(selector);\nselector=applyPersonalSizing2533(selector);");
 s=once(s,"const local=base+'native/v25.32/';","const local=base+'native/v25.33/';");
 s=once(s,"const build='"+previous+"';","const build='"+build+"';");
 s=once(s,"const manifest={version:'25.32',build,files:{}};","const manifest={version:'25.33',build,files:{}};");
 fs.writeFileSync(p,s);
}
assert(s.includes(build));
p='balance-cdq-android/app/build.gradle.kts';s=read(p);
if(s.includes('versionCode = 2532')){s=once(s,'versionCode = 2532','versionCode = 2533');s=once(s,'versionName = "25.32"','versionName = "25.33"');fs.writeFileSync(p,s);}
assert(s.includes('versionCode = 2533'));
p='balance-cdq-android/app/src/main/java/ca/balancecdq/android/PackagedWebAssets.kt';s=read(p);assert(s.includes('native/v25.32/')||s.includes('native/v25.33/'));fs.writeFileSync(p,s.replaceAll('native/v25.32/','native/v25.33/'));
p='balance-cdq-android/app/src/main/java/ca/balancecdq/android/MainActivity.kt';s=read(p);fs.writeFileSync(p,s.replaceAll('BalanceCDQAndroid/25.32','BalanceCDQAndroid/25.33').replaceAll('"25.32"','"25.33"'));
for(p of ['tests/embedded-v2528.test.mjs','tests/embedded-v2528-browser.test.mjs','tests/embedded-startup-v2529.test.mjs','tests/home-underline-v2531.browser.mjs']){
 s=read(p);s=s.replaceAll('v25.32/','v25.33/').replaceAll('v25.32\\/','v25.33\\/').replaceAll(previous,build).replaceAll('BalanceCDQAndroid/25.32','BalanceCDQAndroid/25.33');fs.writeFileSync(p,s);
}
console.log('Prepared paired opt-in personal neutral point 25.33; no Google project, global default, image or PDF changed.');
