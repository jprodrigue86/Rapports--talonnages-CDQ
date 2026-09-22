import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8'),folder='bundles/balance-cdq/v25.17';
const base=JSON.parse(read('bundles/balance-cdq/v25.16/manifest.json'));
const build='2026.09.23-v25.17-desktop-workspace';
const patches=[...['Code.gs','Selector.html'].map(file=>({file,op:'replace_build_any',from:[base.build],to:build}))];
for(const id of ['cdqPcV2224CleanupJs','cdqPcV2226DirectJs','cdqPcV2240NoFlashJs','cdqPcV2245RobustFullscreenJs'])patches.push({file:'Selector.html',op:'remove_script_id',id});
patches.push(...JSON.parse(read(`${folder}/integration-patches.json`)));
patches.push({file:'Selector.html',op:'insert_before_literal',before:'<script id="cdqPcV16Js">',text:`<script id="cdqDesktopV2517Js">\n${read(`${folder}/desktop.js`)}\n</script>\n`});
// The login wall is available before first paint. Layout overrides follow all legacy styles.
patches.push({file:'Selector.html',op:'insert_before_literal',before:'</head>',text:`<style id="cdqDesktopBootV2517Css">html.windows.pc16-startup-lock,html.windows.pc16-startup-lock body,html.windows #accessOverlay{background:#080808 url("https://jprodrigue86.github.io/Rapports--talonnages-CDQ/assets/music-wall-panoramic-v2517.webp") center/cover no-repeat!important}</style>\n`});
patches.push({file:'Selector.html',op:'insert_before_literal',before:'</body>',text:`<style id="cdqDesktopV2517Css">\n${read(`${folder}/desktop.css`)}\n</style>\n`});
// Manager V40 uses String.replace for insert_before_literal; literal replacement preserves dollar sequences in JS.
for(let i=0;i<patches.length;i++){const p=patches[i];if(p.op==='insert_before_literal')patches[i]={file:p.file,op:'replace_literal',search:p.before,replacement:p.text+p.before};}
const result={schema:base.schema,projectScriptId:base.projectScriptId,version:'V25.17',build,title:'Balance CDQ V25.17 — espace de travail PC',requiresBuild:[base.build],patches,removeFiles:[],audit:{scriptManagerRequired:'V40',androidAppRequired:'APK Android 25.15 conservée',scope:'Interface PC responsive, clients et dossiers défilants, actions contextuelles, thèmes sombres et icônes personnelles, mur panoramique.',preservation:'Authentification, données, ouverture de documents et interface mobile conservées. Aucun document client modifié.',validation:'Parcours navigateur et intégration au Selector réel; données de démonstration pour les opérations de fichiers.'}};
for(const name of ['manifest.json','Balance_CDQ_V25_17.cdq'])fs.writeFileSync(`${folder}/${name}`,JSON.stringify(result,null,2)+'\n');
console.log(`Built ${result.version}, ${patches.length} patches`);
