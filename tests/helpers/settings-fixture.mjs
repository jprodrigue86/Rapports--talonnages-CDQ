import fs from 'node:fs';
import vm from 'node:vm';

const manager = fs.readFileSync('apps-script-manager/app.js', 'utf8');
const context = vm.createContext({});
vm.runInContext(manager.slice(manager.indexOf('function countLiteralV25('), manager.indexOf('function buildEntriesFromPatchesV25(')), context);
export const applyPatch = (source, patch) => context.applyPatchV25(source, patch, 'Selector.html');
export const settingsInput = fs.readFileSync('tests/fixtures/v25.10-display-settings.js', 'utf8');
export function buildDisplayControls(source = settingsInput) {
  const manifest = JSON.parse(fs.readFileSync('bundles/balance-cdq/v25.11/manifest.json'));
  for (const patch of manifest.patches.filter(p => p.id?.startsWith('settings-'))) source = applyPatch(source, patch);
  return source;
}
