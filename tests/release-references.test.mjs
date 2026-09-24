import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const text = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const json = path => JSON.parse(text(path));
const base = 'bundles/balance-cdq/';
const dirs = readdirSync(new URL('../' + base, import.meta.url), {withFileTypes:true})
  .filter(x => x.isDirectory() && /^v\d+\.\d+$/.test(x.name))
  .map(x => x.name).sort((a,b) => {
    const [am,an] = a.slice(1).split('.').map(Number);
    const [bm,bn] = b.slice(1).split('.').map(Number);
    return bm-am || bn-an;
  });
const newest = json(base + dirs[0] + '/manifest.json');
const automatic = json(base + 'latest/manifest.json');
const web = json('version.json');

test('automatic package is an exact alias of the newest versioned server package', () => {
  assert.equal(text(base+'latest/manifest.json'), text(base+dirs[0]+'/manifest.json'));
  for (const entry of automatic.extraFiles || []) {
    const url = new URL(entry.url);
    assert.equal(url.origin, 'https://jprodrigue86.github.io');
    assert.ok(url.pathname.startsWith('/Rapports--talonnages-CDQ/'));
    const bytes = readFileSync(new URL('../' + url.pathname.slice('/Rapports--talonnages-CDQ/'.length), import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
  }
});

test('Web shell version describes its real launcher, not the Android version', () => {
  const index = text('index.html'), sw = text('sw.js');
  assert.equal(index.match(/const CDQ_PWA_BUILD\s*=\s*['"]([^'"]+)/)[1], web.version);
  assert.equal(sw.match(/const FORCE_BUILD\s*=\s*['"]([^'"]+)/)[1], web.version);
  assert.equal(web.version_scope, 'web-shell');
  assert.equal(web.selector_version_scope, 'google-apps-script-interface');
  assert.equal(web.selector_version, newest.build);
  assert.equal(web.server_package_version, newest.version);
  assert.equal(web.server_package_build, newest.build);
  assert.equal(web.backend_version, null, 'Do not invent a separately declared backend build');
  assert.equal(web.backend_version_status, 'not_detected_in_version_diagnostic');
  assert.ok(web.features.length > 0);
});

test('V43 diagnostic reads a null backend reference without inventing its version', () => {
  const source = text('apps-script-manager/diagnostics.js');
  function extract(name) {
    const match = source.match(new RegExp('function '+name+'\\([^\\n]*\\)\\{[\\s\\S]*?\\n\\}'));
    assert.ok(match, 'Function found: '+name); return match[0];
  }
  const ctx = vm.createContext({value:web.backend_version, selector:web.selector_version});
  vm.runInContext(extract('diagnosticVersionLabelV43') + '\nresult = diagnosticVersionLabelV43(value) || null; selectorResult = diagnosticVersionLabelV43(selector) || null;', ctx);
  assert.equal(ctx.result, null);
  assert.equal(ctx.selectorResult, newest.build);
});

test('automatic preparation neither redeploys nor stages an already installed/newer package', async () => {
  const source = text('apps-script-manager/app.js');
  function extract(name) {
    const match = source.match(new RegExp('(?:async )?function '+name+'\\([^\\n]*\\)\\s*\\{[\\s\\S]*?\\n\\}'));
    assert.ok(match, 'Function found: '+name); return match[0];
  }
  const code = ['parseBuildVersion','compareBuildLabels','prepareLatestBundleV41'].map(extract).join('\n');
  for (const [build, expected] of [[newest.requiresBuild.at(-1),true],[newest.build,false],['2099.01.01-v999.0-future',false]]) {
    let staged=0, remembered=0;
    const id=automatic.projectScriptId;
    const ctx=vm.createContext({
      S:{autoBundleChecked:false,id,bundleUrl:'',pkg:new Map(),draft:new Map(),files:[]},
      isProductionProject:()=>true,normalizeScriptId:x=>x,
      bundleUrlFromValueV24:x=>x,fetchBundleTextV24:async()=>JSON.stringify(automatic),
      detectBuildLabel:()=>build,rememberPendingBundleV41:()=>remembered++,
      importBundleManifestV24:async()=>staged++,
      writePendingAndDeploy:()=>{throw Error('Version lookup must never deploy');}
    });
    vm.runInContext(code,ctx);
    assert.equal(await ctx.prepareLatestBundleV41(),expected,build);
    assert.equal(staged,expected?1:0,build);
    assert.equal(remembered,expected?1:0,build);
    assert.equal(await ctx.prepareLatestBundleV41(),false,'Only one lookup per loaded project');
  }
});
