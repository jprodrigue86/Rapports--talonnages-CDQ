import fs from 'node:fs';
const folder='bundles/balance-cdq/v25.16';
const read=p=>fs.readFileSync(p,'utf8');
const base=JSON.parse(read('bundles/balance-cdq/v25.15/manifest.json'));
const build='2026.09.22-v25.16-keyboard-safe-nav-themes';
const module=`<style id="cdqMobileLayoutCss">\n${read(`${folder}/mobile-layout.css`)}\n</style>\n<script id="cdqMobileLayoutJs">\n${read(`${folder}/mobile-layout.js`)}\n</script>\n`;
const manifest={schema:base.schema,projectScriptId:base.projectScriptId,version:'V25.16',build,
 title:'Balance CDQ V25.16 — recherche, navigation et thèmes adaptés au téléphone',requiresBuild:[base.build],
 patches:[...['Code.gs','Selector.html'].map(file=>({file,op:'replace_build_any',from:[base.build],to:build})),
 {file:'Selector.html',op:'remove_style_id',id:'cdqMobileLayoutCss'},
 {file:'Selector.html',op:'remove_script_id',id:'cdqMobileLayoutJs'},
 {file:'Selector.html',op:'insert_before_literal',before:'<style id="cdqIconThemesCssV2514">',text:module}],removeFiles:[],
 audit:{scriptManagerRequired:'V40',androidAppRequired:'APK Android 25.15 conservée',
 scope:'Recherche au-dessus du clavier; navigation à hauteur automatique sans cadre; résumé compact; pleine largeur; six palettes cohérentes.',
 preferences:'Valeurs des curseurs, icônes personnelles et préférences conservées.',
 compatibility:'Mise à jour depuis V25.15. Aucun changement aux PDF, à OAuth, aux fichiers ou aux fonctions serveur.',
 deviceValidation:'Vérification en navigateur mobile, y compris réduction du viewport par le clavier et curseurs au maximum. Téléphone physique à confirmer.'}};
for(const name of ['manifest.json','Balance_CDQ_V25_16.cdq']) fs.writeFileSync(`${folder}/${name}`,JSON.stringify(manifest,null,2)+'\n');
console.log(`Built ${manifest.version}, ${manifest.patches.length} patches`);
