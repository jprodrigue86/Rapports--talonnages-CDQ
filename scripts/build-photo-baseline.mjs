import fs from 'node:fs';
const folder='bundles/balance-cdq/v25.15';
const read=p=>fs.readFileSync(p,'utf8');
const base=JSON.parse(read('bundles/balance-cdq/v25.14/manifest.json'));
const build='2026.09.22-v25.15-photo-midpoint-clean-icons';
const server=read('bundles/balance-cdq/v25.14/icon-preferences-server.js')+'\n';
const original=fs.readFileSync('bundles/balance-cdq/v25.14/icons-reference.png').toString('base64');
const transparent=fs.readFileSync(`${folder}/icons-transparent.webp`).toString('base64');
const module=`<style id="cdqMobileLayoutCss">\n${read(`${folder}/mobile-layout.css`)}\n</style>\n<script id="cdqMobileLayoutJs">\n${read(`${folder}/mobile-layout.js`)}\n</script>\n`
  +`<style id="cdqIconThemesCssV2514">\n:root{--cdq-icon-original-v2515:url("data:image/png;base64,${original}")}\n${read(`${folder}/icon-themes.css`)}\n.cdq-icon-sample-v2514,.bottom-nav > .bottom-nav-item > .cdq-icon-host-v2514::after{background-image:url("data:image/webp;base64,${transparent}")}\n.cdq-icon-sample-v2514[data-art-source=original]{background-image:var(--cdq-icon-original-v2515)}\n</style>\n<script id="cdqIconThemesJsV2514">\n${read(`${folder}/icon-themes.js`)}\n</script>\n`;
const from=[...base.requiresBuild,base.build];
const manifest={schema:base.schema,projectScriptId:base.projectScriptId,version:'V25.15',build,
  title:'Balance CDQ V25.15 — format photo à 50 et icônes sans halo',requiresBuild:from,
  patches:[
    ...['Code.gs','Selector.html'].map(file=>({file,op:'replace_build_any',from,to:build})),
    // V25.12/13 lack this backend. V25.14 already has it: replace exactly once, unchanged.
    {file:'Code.gs',op:'replace_literal_if_present',search:server,replacement:''},
    {file:'Code.gs',op:'insert_before_literal',before:'function obtenirPreferencesUtilisateurCDQV72() {',text:server},
    {file:'Selector.html',op:'remove_style_id',id:'cdqMobileLayoutCss'},
    {file:'Selector.html',op:'remove_script_id',id:'cdqMobileLayoutJs'},
    {file:'Selector.html',op:'remove_style_id_if_present',id:'cdqIconThemesCssV2514'},
    {file:'Selector.html',op:'remove_script_id_if_present',id:'cdqIconThemesJsV2514'},
    {file:'Selector.html',op:'insert_before_literal',before:'</body>',text:module}
  ],removeFiles:[],audit:{scriptManagerRequired:'V40',androidAppRequired:'APK Android 25.15 conservée',
    scope:'Présentation mobile à 50/50/50 selon la photo et suppression du fond/halo des quatre jeux d’icônes.',
    midpoint:'Proportions de la photo 709×1536 normalisées à 384 CSS px; tailles modulées par les trois curseurs.',
    preferences:'Valeurs et choix personnels conservés. Backend des préférences V25.14 inchangé.',
    artwork:'Détourage de la référence par imagegen intégré avec alpha; couleurs propres conservées, aucun filtre coloré ajouté.',
    deviceValidation:'Vérification en navigateur mobile; rendu sur téléphone physique à confirmer.'}};
for(const name of ['manifest.json','Balance_CDQ_V25_15.cdq'])fs.writeFileSync(`${folder}/${name}`,JSON.stringify(manifest,null,2)+'\n');
console.log(`Built ${manifest.version}, ${manifest.patches.length} patches`);
