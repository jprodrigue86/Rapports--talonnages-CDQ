import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {applyPatch} from './helpers/settings-fixture.mjs';
const read=p=>fs.readFileSync(p,'utf8');
const manifest=JSON.parse(read('bundles/balance-cdq/v25.27/manifest.json'));
const functions=manifest.patches.filter(p=>p.ignoreLineTrailingSpaces);
const variant=s=>s.split('\n').map((line,i)=>line.trimEnd()+(i%3===0?'\t ':'')).join('\r\n');

for(const patch of functions)test(patch.id+': CRLF and saved line-end spaces yield exactly the audited replacement',()=>{
  const prefix='// preserved\nconst escaped="\\r\\n";\n';
  const suffix='  function unrelated(){return "keep";}\n';
  const source=prefix+variant(patch.search)+suffix;
  assert.equal(source.includes(patch.search),false,'V41 literal comparison reproduces the reported missing passage');
  assert.equal(applyPatch(source,patch),prefix+patch.replacement+suffix);
  assert.equal(applyPatch(prefix+patch.search+suffix,patch),prefix+patch.replacement+suffix);
});
test('real code changes are refused with the exact patch name',()=>{
  const p=functions.find(p=>p.id==='company-list');
  assert.throws(()=>applyPatch(variant(p.search.replace('forcer = !!forceRefresh','forcer = false')),p),/Selector.html \[company-list\].*trouvé 0/);
});
test('one exact occurrence plus a differently spaced duplicate is still ambiguous',()=>{
  const p=functions[0];
  assert.throws(()=>applyPatch(p.search+'\n'+variant(p.search),p),/attendu 1, trouvé 2/);
});
test('compatibility never relaxes indentation, missing lines, string values or multiline strings',()=>{
  const p=functions[0];
  for(const source of [p.search.replace('  const','    const'),p.search.replace('"fr"','"en"'),p.search.replace('\n\n','\n')])
    assert.throws(()=>applyPatch(source,p),/trouvé 0/);
  assert.throws(()=>applyPatch('const text=`a\n `;',{op:'replace_literal',search:'const text=`a\n `;',replacement:'',ignoreLineTrailingSpaces:true}),/bloc incompatible/);
});
test('multiline literal patches accept CRLF without changing escaped string characters',()=>{
  const p=manifest.patches.find(p=>p.id==='startup-priority');
  assert.equal(applyPatch(p.search.replaceAll('\n','\r\n'),p),p.replacement);
});
test('a later patch failure leaves every source and staging entry untouched',()=>{
  const source=read('apps-script-manager/app.js');
  const files=[{name:'Code',type:'SERVER_JS',source:'old'},{name:'Selector',type:'HTML',source:'different private source'}];
  const original=structuredClone(files),staged=new Map();
  const ctx=vm.createContext({S:{files,pkg:staged},detectBuildLabel:()=>manifest.requiresBuild[0],compareBuildLabels:(a,b)=>a===b?0:1,
    findProjectFileForBundleV25:name=>files.find(f=>name.startsWith(f.name)),displayNameForFile:f=>f.name});
  vm.runInContext(source.slice(source.indexOf('function countLiteralV25('),source.indexOf('async function importLocalBundleV40(')),ctx);
  assert.throws(()=>ctx.buildEntriesFromPatchesV25({requiresBuild:manifest.requiresBuild,patches:[
    {id:'code-first',file:'Code.gs',op:'replace_literal',search:'old',replacement:'new'},
    functions[0]
  ]}),/\[company-list\].*trouvé 0/);
  assert.deepEqual(files,original);assert.equal(staged.size,0);
});
