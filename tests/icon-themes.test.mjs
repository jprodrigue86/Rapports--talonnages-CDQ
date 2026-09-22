import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {applyPatch} from './helpers/settings-fixture.mjs';
const read = path => fs.readFileSync(path,'utf8');
const folder = 'bundles/balance-cdq/v25.14';
const manifest = JSON.parse(read(`${folder}/manifest.json`));
const previous = JSON.parse(read('bundles/balance-cdq/v25.13/manifest.json'));
const patch = (source,file) => manifest.patches.filter(p => p.file === file).reduce((s,p) => applyPatch(s,p),source);
test('personal preferences use authenticated account, reject invalid writes, preserve other settings and newer choices',() => {
  let email = 'alice@example.test';
  const records = new Map([['CDQ_V72_PREF_alice@example.test','{"theme":"dark","uiScale":50}']]);
  let locked = false;
  const context = vm.createContext({
    cdqV72Email_:() => email, cdqV72Hash_:value => value,
    PropertiesService:{getScriptProperties:() => ({getProperty:key => records.get(key),setProperty:(key,value) => records.set(key,value)})},
    LockService:{getScriptLock:() => ({waitLock:() => {assert.equal(locked,false);locked=true;},releaseLock:() => {locked=false;}})}
  });
  vm.runInContext(read(`${folder}/icon-preferences-server.js`),context);
  const get = context.obtenirStyleIconesCDQV2514;
  const set = context.enregistrerStyleIconesCDQV2514;
  assert.equal(get(email).style,'current');
  assert.equal(set(email,{style:'metal-music',revision:100}).style,'metal-music');
  assert.equal(set(email,{style:'minimal',revision:99}).style,'metal-music');
  assert.throws(() => set('bob@example.test',{style:'minimal',revision:101}),/compte/);
  for(const value of [{style:'unknown',revision:101},{style:'minimal',revision:-1},{style:'minimal',revision:Infinity}])
    assert.throws(() => set(email,value),/invalide/);
  email = 'bob@example.test';
  assert.equal(get(email).style,'current');
  set(email,{style:'dark-pro',revision:105});
  email = 'alice@example.test';
  assert.equal(get(email).style,'metal-music');
  set(email,{style:'current',revision:110});
  assert.equal(get(email).style,'current');
  assert.equal(records.get('CDQ_V72_PREF_alice@example.test'),'{"theme":"dark","uiScale":50}');
  assert.equal(locked,false);
});
test('package accepts V25.12/13, contains the exact offline artwork and preserves unrelated source',() => {
  assert.deepEqual(manifest.requiresBuild,[...previous.requiresBuild,previous.build]);
  assert.deepEqual(JSON.parse(read(`${folder}/Balance_CDQ_V25_14.cdq`)),manifest);
  const art = fs.readFileSync(`${folder}/icons-reference.png`).toString('base64');
  assert.ok(manifest.patches.at(-1).text.includes(art));
  assert.equal(manifest.removeFiles.length,0);
  new vm.Script(read(`${folder}/icon-themes.js`));
  new vm.Script(read(`${folder}/icon-preferences-server.js`));
  const input = `${previous.build}\n<script>function openPdf(){return 'unchanged'}</script>\n${previous.patches.at(-1).text}</body>`;
  const output = patch(input,'Selector.html');
  const stripNew = source => source.replace(manifest.patches.at(-1).text,'').replaceAll(manifest.build,previous.build);
  assert.equal(stripNew(output),input);
  assert.throws(() => patch('unknown</body>','Selector.html'),/aucune version source compatible/);
  if(process.env.CDQ_SELECTOR_SOURCE){
    const actual = read(process.env.CDQ_SELECTOR_SOURCE);
    const build = manifest.requiresBuild.find(build => actual.includes(build));
    assert.ok(build);
    const to13 = build === previous.build ? actual : previous.patches.filter(p => p.file === 'Selector.html').reduce((s,p) => applyPatch(s,p),actual);
    assert.equal(stripNew(patch(actual,'Selector.html')),to13);
    const scripts = [...patch(actual,'Selector.html').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
    scripts.forEach((match,index) => {if(!/type=["'](?:application\/json|importmap)["']/.test(match[0].split('>')[0]))new vm.Script(match[1],{filename:'Selector-script-'+index});});
  }
  if(process.env.CDQ_CODE_SOURCE){
    const actual=read(process.env.CDQ_CODE_SOURCE);
    const sourceBuild=manifest.requiresBuild.find(build => actual.includes(build));
    assert.ok(sourceBuild);
    const output=patch(actual,'Code.gs');
    assert.equal(output.replace(manifest.patches.find(p => p.file==='Code.gs'&&p.op==='insert_before_literal').text,'').replaceAll(manifest.build,sourceBuild),actual);
    new vm.Script(output);
  }
});
