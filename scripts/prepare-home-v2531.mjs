import fs from 'node:fs';
import assert from 'node:assert/strict';
function change(path, fn) { const s=fs.readFileSync(path,'utf8'), out=fn(s); if(out!==s)fs.writeFileSync(path,out); }
function once(s,a,b) { if(s.includes(b)&&!s.includes(a))return s; assert.equal(s.split(a).length,2,'Anchor changed: '+a); return s.replace(a,b); }
const oldBuild='2026.09.24-v25.30-fichiers-immediats',build='2026.09.24-v25.31-accueil-sans-trait';
change('scripts/build-embedded-android-v2528.mjs',s=>{
 s=once(s,"import fs from 'node:fs';","import fs from 'node:fs';\nimport {applyHomeUnderline2531} from './home-underline-v2531.mjs';");
 s=once(s,"const local=base+'native/v25.30/';","const local=base+'native/v25.31/';");
 s=once(s,"const build='"+oldBuild+"';","const build='"+build+"';");
 s=once(s,"const manifest={version:'25.30',build,files:{}};","const manifest={version:'25.31',build,files:{}};");
 s=once(s,"selector=applyInstantFiles2530(selector);","selector=applyInstantFiles2530(selector);\nselector=applyHomeUnderline2531(selector);");
 return s;
});
change('balance-cdq-android/app/build.gradle.kts',s=>once(once(s,'versionCode = 2530','versionCode = 2531'),'versionName = "25.30"','versionName = "25.31"'));
change('balance-cdq-android/app/src/main/java/ca/balancecdq/android/PackagedWebAssets.kt',s=>once(s,'native/v25.30/','native/v25.31/'));
change('.github/workflows/build-balance-cdq-android.yml',s=>{
 s=s.replaceAll('25.30','25.31').replaceAll("versionCode='2530'","versionCode='2531'");
 if(!s.includes("'scripts/home-underline-v2531.mjs'"))s=s.replaceAll("      - 'scripts/build-embedded-android-v2528.mjs'","      - 'scripts/build-embedded-android-v2528.mjs'\n      - 'scripts/home-underline-v2531.mjs'");
 return s;
});
for(const p of ['tests/embedded-v2528.test.mjs','tests/embedded-v2528-browser.test.mjs','tests/embedded-startup-v2529.test.mjs'])if(fs.existsSync(p))change(p,s=>s.replaceAll(oldBuild,build).replaceAll('25.30','25.31'));
console.log('Android/iPhone common source: only the active Home decoration removed; release metadata advanced. Google services unchanged.');
