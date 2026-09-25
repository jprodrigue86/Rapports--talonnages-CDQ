import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(p,'utf8');
const once=(s,a,b)=>{assert.equal(s.split(a).length,2,'Anchor changed: '+a);return s.replace(a,b);};
const build='2026.09.25-v25.32-ecran-adaptatif';
let p='scripts/build-embedded-android-v2528.mjs',s=read(p);
if(!s.includes("from './safe-area-v2532.mjs'")){
 s=once(s,"import fs from 'node:fs';","import fs from 'node:fs';\nimport {applySafeShell2532,applySafeSelector2532} from './safe-area-v2532.mjs';");
 s=once(s,"files.set('index.html',Buffer.from(shell));","shell=applySafeShell2532(shell);\nfiles.set('index.html',Buffer.from(shell));");
 s=once(s,"files.set('Selector.html',Buffer.from(selector));","selector=applySafeSelector2532(selector);\nfiles.set('Selector.html',Buffer.from(selector));\nfiles.set('safe-viewport-v2532.js',fs.readFileSync('safe-viewport-v2532.js'));");
 s=s.replaceAll('native/v25.31/','native/v25.32/').replaceAll('2026.09.24-v25.31-accueil-sans-trait',build).replace("version:'25.31'","version:'25.32'");
 fs.writeFileSync(p,s);
}
p='balance-cdq-android/app/src/main/java/ca/balancecdq/android/MainActivity.kt';s=read(p);
if(!s.includes('setContentView(SafeContentInsets.host(this, webView))')){
 s=once(s,'setContentView(webView)','setContentView(SafeContentInsets.host(this, webView))');
 s=once(s,'" BalanceCDQAndroid/25.29"','" BalanceCDQAndroid/25.32 CDQSafeArea/1"');
 s=s.replaceAll('"25.29"','"25.32"');
 fs.writeFileSync(p,s);
}
p='balance-cdq-android/app/build.gradle.kts';s=read(p);
if(s.includes('versionCode = 2531')){s=once(s,'versionCode = 2531','versionCode = 2532');s=once(s,'versionName = "25.31"','versionName = "25.32"');fs.writeFileSync(p,s);}
p='balance-cdq-android/app/src/main/java/ca/balancecdq/android/PackagedWebAssets.kt';s=read(p);fs.writeFileSync(p,s.replaceAll('native/v25.31/','native/v25.32/'));
for(p of ['tests/embedded-v2528.test.mjs','tests/embedded-v2528-browser.test.mjs','tests/embedded-startup-v2529.test.mjs','tests/home-underline-v2531.browser.mjs']){
 s=read(p);s=s.replaceAll('v25.31/','v25.32/').replaceAll('v25.31\\/','v25.32\\/').replaceAll('2026.09.24-v25.31-accueil-sans-trait',build).replaceAll('BalanceCDQAndroid/25.31','BalanceCDQAndroid/25.32 CDQSafeArea/1');fs.writeFileSync(p,s);
}
p='.github/workflows/build-balance-cdq-android.yml';s=read(p).replaceAll('25.31','25.32').replaceAll("versionCode='2531'","versionCode='2532'");
if(!s.includes("'scripts/safe-area-v2532.mjs'"))s=s.replaceAll("      - 'scripts/home-underline-v2531.mjs'","      - 'scripts/home-underline-v2531.mjs'\n      - 'scripts/safe-area-v2532.mjs'\n      - 'safe-viewport-v2532.js'");
fs.writeFileSync(p,s);
console.log('Prepared shared mobile safe viewport 25.32; no Google project or saved preferences changed.');
