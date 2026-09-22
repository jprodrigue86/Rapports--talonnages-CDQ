import fs from 'node:fs';
const folder = 'bundles/balance-cdq/v25.13';
const base = JSON.parse(fs.readFileSync('bundles/balance-cdq/v25.12/manifest.json', 'utf8'));
const build = '2026.09.22-v25.13-compact-swipe-return';
const css = fs.readFileSync(`${folder}/mobile-layout.css`, 'utf8');
const js = fs.readFileSync(`${folder}/mobile-layout.js`, 'utf8');
const manifest = {
  schema: base.schema, projectScriptId: base.projectScriptId,
  version: 'V25.13', build, title: 'Balance CDQ V25.13 — affichage compact et retour par glissement',
  requiresBuild: [base.build],
  patches: [
    ...['Code.gs', 'Selector.html'].map(file => ({file, op:'replace_build', from:base.build, to:build})),
    {file:'Selector.html', op:'remove_style_id', id:'cdqMobileLayoutCss'},
    {file:'Selector.html', op:'remove_script_id', id:'cdqMobileLayoutJs'},
    {file:'Selector.html', op:'insert_before_literal', before:'</body>',
      text:`<style id="cdqMobileLayoutCss">\n${css}\n</style>\n<script id="cdqMobileLayoutJs">\n${js}\n</script>\n`}
  ],
  removeFiles: [],
  audit: {
    scriptManagerRequired: 'V40', androidAppRequired: 'APK Android 25.15 conservée',
    scope: 'Présentation mobile et fermeture des actions par glissement inverse. PDF, OAuth, modèles et données inchangés.',
    midpoint: '50 / 50 / 50; préférences existantes conservées.',
    deviceValidation: 'Validation tactile et dimensions dans Chromium; confirmation sur téléphone réel à faire.'
  }
};
for (const name of ['manifest.json','Balance_CDQ_V25_13.cdq'])
  fs.writeFileSync(`${folder}/${name}`, JSON.stringify(manifest,null,2)+'\n');
console.log(`Built ${manifest.version}`);
