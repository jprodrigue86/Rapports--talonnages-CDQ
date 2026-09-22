import fs from 'node:fs';
const folder = 'bundles/balance-cdq/v25.14';
const base = JSON.parse(fs.readFileSync('bundles/balance-cdq/v25.13/manifest.json','utf8'));
const build = '2026.09.22-v25.14-personal-icon-themes';
const read = path => fs.readFileSync(path,'utf8');
const css = read(`${folder}/icon-themes.css`);
const js = read(`${folder}/icon-themes.js`);
const server = read(`${folder}/icon-preferences-server.js`);
const art = fs.readFileSync(`${folder}/icons-reference.png`).toString('base64');
const manifest = {
  schema:base.schema, projectScriptId:base.projectScriptId, version:'V25.14', build,
  title:'Balance CDQ V25.14 — jeux d’icônes personnels', requiresBuild:[...base.requiresBuild,base.build],
  patches:[
    ...['Code.gs','Selector.html'].map(file => ({file,op:'replace_build_any',from:[...base.requiresBuild,base.build],to:build})),
    {file:'Code.gs',op:'insert_before_literal',before:'function obtenirPreferencesUtilisateurCDQV72() {',text:server+'\n'},
    ...base.patches.slice(2),
    {file:'Selector.html',op:'insert_before_literal',before:'</body>',text:
      `<style id="cdqIconThemesCssV2514">\n:root{--cdq-icon-art-v2514:url("data:image/png;base64,${art}")}\n${css}\n</style>\n<script id="cdqIconThemesJsV2514">\n${js}\n</script>\n`}
  ],
  removeFiles:[],
  audit:{
    scriptManagerRequired:'V40',androidAppRequired:'APK Android 25.15 conservée',
    scope:'Styles 4, 5, 6, 7 de navigation, choix personnel par compte et retour aux icônes actuelles. Dimensions V25.13 conservées.',
    artwork:'Référence fournie par l’utilisateur, réutilisée sans modification; cadrages CSS embarqués, disponibles hors ligne.',
    preferences:'Stockage local distinct par courriel et synchronisation par compte CDQ authentifié. Aucune modification des préférences existantes.'
  }
};
for(const name of ['manifest.json','Balance_CDQ_V25_14.cdq']) fs.writeFileSync(`${folder}/${name}`,JSON.stringify(manifest,null,2)+'\n');
console.log(`Built ${manifest.version}: ${manifest.patches.length} patches`);
