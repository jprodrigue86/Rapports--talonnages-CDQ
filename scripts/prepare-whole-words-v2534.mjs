import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(p,'utf8');
const once=(s,a,b)=>{assert.equal(s.split(a).length,2,'Anchor changed: '+a);return s.replace(a,b);};
const previous='2026.09.25-v25.33-point50-personnel',build='2026.09.25-v25.34-mots-complets';
let p='scripts/build-embedded-android-v2528.mjs',s=read(p);
if(!s.includes("from './whole-words-v2534.mjs'")){
 s=once(s,"import fs from 'node:fs';","import fs from 'node:fs';\nimport {applyWholeWords2534} from './whole-words-v2534.mjs';");
 s=once(s,'selector=applyPersonalSizing2533(selector);','selector=applyPersonalSizing2533(selector);\nselector=applyWholeWords2534(selector);');
 s=once(s,"const local=base+'native/v25.33/';","const local=base+'native/v25.34/';");
 s=once(s,"const build='"+previous+"';","const build='"+build+"';");
 s=once(s,"const manifest={version:'25.33',build,files:{}};","const manifest={version:'25.34',build,files:{}};");fs.writeFileSync(p,s);
}
assert(s.includes(build));
p='balance-cdq-android/app/build.gradle.kts';s=read(p);
if(s.includes('versionCode = 2533')){s=once(s,'versionCode = 2533','versionCode = 2534');s=once(s,'versionName = "25.33"','versionName = "25.34"');fs.writeFileSync(p,s);}assert(s.includes('versionCode = 2534'));
p='balance-cdq-android/app/src/main/java/ca/balancecdq/android/PackagedWebAssets.kt';s=read(p);assert(s.includes('native/v25.33/')||s.includes('native/v25.34/'));fs.writeFileSync(p,s.replaceAll('native/v25.33/','native/v25.34/'));
p='balance-cdq-android/app/src/main/java/ca/balancecdq/android/MainActivity.kt';s=read(p);fs.writeFileSync(p,s.replaceAll('BalanceCDQAndroid/25.33','BalanceCDQAndroid/25.34').replaceAll('"25.33"','"25.34"'));
for(p of ['tests/embedded-v2528.test.mjs','tests/embedded-v2528-browser.test.mjs','tests/embedded-startup-v2529.test.mjs','tests/home-underline-v2531.browser.mjs']){
 s=read(p);s=s.replaceAll('v25.33/','v25.34/').replaceAll('v25.33\\/','v25.34\\/').replaceAll(previous,build).replaceAll('BalanceCDQAndroid/25.33','BalanceCDQAndroid/25.34');fs.writeFileSync(p,s);
}
// The calibration test must compare the same new word-safe layout on BOTH
// sides; it still requires exact before/after geometry and zero remote writes.
p='tests/personal-sizing-v2533.browser.mjs';s=read(p);
if(!s.includes('whole-words-v2534.js')){
 s=once(s,'const old=execFileSync','let old=execFileSync');
 s=once(s,"const html=fs.readFileSync", "old=old.replace('    applyPalette();','    window.cdqFitButtonWordsV2534({unit,topLabel,label});\\n    applyPalette();');\nconst html=fs.readFileSync");
 s=once(s,'const init=`window.utilisateurCourantEmail',"const init=fs.readFileSync('whole-words-v2534.js','utf8')+'\\n'+`window.utilisateurCourantEmail");fs.writeFileSync(p,s);
}
console.log('Prepared paired 25.34 whole-word layout. Personal calibration runtime and saved values untouched.');
