import fs from 'node:fs';
function change(path,fn){const old=fs.readFileSync(path,'utf8'),next=fn(old);if(old!==next)fs.writeFileSync(path,next);}
function once(s,a,b){if(s.includes(b)&&!s.includes(a))return s;if(s.split(a).length!==2)throw Error('Expected one anchor: '+a);return s.replace(a,b);}
const oldBuild='2026.09.24-v25.29-demarrage-parallele',build='2026.09.24-v25.30-fichiers-immediats';
change('scripts/build-embedded-android-v2528.mjs',s=>{
 s=once(s,"import fs from 'node:fs';","import fs from 'node:fs';\nimport {applyInstantFiles2530} from './instant-files-v2530.mjs';");
 s=once(s,"const local=base+'native/v25.29/';","const local=base+'native/v25.30/';");
 s=once(s,"const build='"+oldBuild+"';","const build='"+build+"';");
 s=once(s,"const manifest={version:'25.29',build,files:{}};","const manifest={version:'25.30',build,files:{}};");
 s=once(s,"files.set('Selector.html',Buffer.from(selector));","selector=applyInstantFiles2530(selector);\nfiles.set('Selector.html',Buffer.from(selector));");
 return s;
});
change('balance-cdq-android/app/build.gradle.kts',s=>once(once(s,'versionCode = 2529','versionCode = 2530'),'versionName = "25.29"','versionName = "25.30"'));
change('balance-cdq-android/app/src/main/java/ca/balancecdq/android/PackagedWebAssets.kt',s=>once(s,'native/v25.29/','native/v25.30/'));
change('.github/workflows/build-balance-cdq-android.yml',s=>s.replaceAll('25.29','25.30').replaceAll("versionCode='2529'","versionCode='2530'"));
for(const path of ['tests/embedded-v2528.test.mjs','tests/embedded-v2528-browser.test.mjs','tests/embedded-startup-v2529.test.mjs']){
 if(fs.existsSync(path))change(path,s=>s.replaceAll(oldBuild,build).replaceAll('25.29','25.30'));
}
console.log('Android V25.30 sources prepared. No PDF templates, artwork, credentials or server scripts changed.');
