import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {applyPatch} from './helpers/settings-fixture.mjs';
const read=p=>fs.readFileSync(p,'utf8');
const manifest=JSON.parse(read('bundles/balance-cdq/v25.15/manifest.json'));
const previous=JSON.parse(read('bundles/balance-cdq/v25.14/manifest.json'));
const p13=JSON.parse(read('bundles/balance-cdq/v25.13/manifest.json'));
const patch=(source,file,m=manifest)=>m.patches.filter(p=>p.file===file).reduce((s,p)=>applyPatch(s,p),source);
const strip=s=>s.replace(/<(style|script) id="(?:cdqMobileLayout(?:Css|Js)|cdqIconThemes(?:Css|Js)V2514)">[\s\S]*?<\/\1>\s*/g,'').trim();
test('actual Manager patch engine accepts 12/13/14 without duplicate modules or preference backend',()=>{
  const code=process.env.CDQ_CODE_SOURCE?read(process.env.CDQ_CODE_SOURCE):`const BUILD='${p13.build}';\nfunction obtenirPreferencesUtilisateurCDQV72() { return 'unchanged'; }`;
  const html=process.env.CDQ_SELECTOR_SOURCE?read(process.env.CDQ_SELECTOR_SOURCE):`${p13.requiresBuild[0]}\n<style id="cdqMobileLayoutCss">old</style>\n<script id="cdqMobileLayoutJs">old</script>\n<script>function openPdf(){return 'unchanged'}</script>\n</body>`;
  for(const version of manifest.requiresBuild){
    let input=html,backend=code;
    if(version===p13.build)input=patch(input,'Selector.html',p13);
    if(version===previous.build){input=patch(input,'Selector.html',previous);backend=patch(backend,'Code.gs',previous);}
    else backend=backend.replaceAll(p13.build,version);
    const output=patch(input,'Selector.html');
    assert.equal(strip(output).replaceAll(manifest.build,version),strip(input));
    for(const id of ['cdqMobileLayoutCss','cdqMobileLayoutJs','cdqIconThemesCssV2514','cdqIconThemesJsV2514'])assert.equal(output.split(`id="${id}"`).length-1,1);
    const updatedCode=patch(backend,'Code.gs');
    assert.equal(updatedCode.split('function obtenirStyleIconesCDQV2514(').length-1,1);
    const server=manifest.patches.find(p=>p.file==='Code.gs'&&p.op==='insert_before_literal').text;
    assert.equal(updatedCode.replace(server,'').replaceAll(manifest.build,version),backend.replace(server,''));
    new vm.Script(updatedCode);
    for(const [index,match] of [...output.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].entries())
      if(!/type=["'](?:application\/json|importmap)["']/.test(match[0].split('>')[0]))new vm.Script(match[1],{filename:'selector-'+index});
  }
  assert.equal(manifest.removeFiles.length,0);
  assert.deepEqual(JSON.parse(read('bundles/balance-cdq/v25.15/Balance_CDQ_V25_15.cdq')),manifest);
  assert.throws(()=>patch('unknown</body>','Selector.html'),/aucune version source compatible/);
});
