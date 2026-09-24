import fs from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
const dir='bundles/balance-cdq/v25.28',read=p=>fs.readFileSync(p,'utf8');
const base=JSON.parse(read('bundles/balance-cdq/v25.27/manifest.json'));
const build='2026.09.23-v25.28-apk-embarquee';
const bridge=read('balance-cdq-android/web-source/server-bridge.js');
new vm.Script(bridge);
const server=`// Public bootstrap only. Authentication remains in the existing CDQ functions.\nfunction cdqEmbeddedBridgeV2528_(params) {\n  const channel=String(params.channel||'');\n  if(!/^[A-Za-z0-9-]{20,100}$/.test(channel))throw new Error('Connexion CDQ invalide.');\n  const html='<!doctype html><html><head><meta charset="utf-8"><title>Connexion CDQ</title></head><body><script>const CDQ_EMBEDDED_CHANNEL='+JSON.stringify(channel)+';'+${JSON.stringify(bridge)}+'<\\/script></body></html>';\n  return HtmlService.createHtmlOutput(html).setTitle('Connexion CDQ').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);\n}\n`;
new vm.Script(server);fs.mkdirSync(dir+'/files',{recursive:true});fs.writeFileSync(dir+'/files/CDQEmbedded.gs',server);
const patches=['Code.gs','Selector.html'].map(file=>({file,op:'replace_build_any',from:[...base.requiresBuild,base.build],to:build}));
patches.push({id:'native-data-bridge',file:'Code.gs',op:'replace_literal',search:'function doGet(e) {\n  const params = e && e.parameter ? e.parameter : {};',replacement:'function doGet(e) {\n  const params = e && e.parameter ? e.parameter : {};\n  if(String(params.cdq_native_bridge||\'\')===\'1\')return cdqEmbeddedBridgeV2528_(params);'});
// Upgrade server performance when starting at V25.26; leave the already-upgraded
// V25.27 functions intact. Optional replacements remain limited to known blocks.
for(const p of base.patches.filter(p=>p.file==='Code.gs'&&p.op==='replace_literal'))patches.push({...p,op:'replace_literal_if_present'});
const names=['CDQEmbedded.gs','CDQPerformance.gs','CDQSessionResume.gs'];
for(const name of names.slice(1))fs.copyFileSync('bundles/balance-cdq/v25.27/files/'+name,dir+'/files/'+name);
const extraFiles=names.map(name=>({name,sha256:crypto.createHash('sha256').update(read(dir+'/files/'+name)).digest('hex'),url:'https://jprodrigue86.github.io/Rapports--talonnages-CDQ/'+dir+'/files/'+name}));
const manifest={schema:base.schema,projectScriptId:base.projectScriptId,version:'V25.28',build,title:'Balance CDQ V25.28 — interface embarquée dans l’APK',requiresBuild:[...base.requiresBuild,base.build],patches,extraFiles,removeFiles:[],audit:{scriptManagerRequired:'V42',androidAppRequired:'Installer aussi l’APK 25.28 pour utiliser l’interface embarquée. Les APK existantes restent compatibles avec ce serveur.',productionVerified:false,scope:'Interface Android, images, menus et outils PDF embarqués. Liaison Apps Script réduite aux appels de données et de connexion. Le PC conserve son interface.',security:'Origine, ascendance des cadres, nonce et fonctions autorisées contrôlés. Sessions et autorisations serveur conservées. Aucune clé privée ni donnée client dans l’APK.'}};
for(const name of ['manifest.json','Balance_CDQ_V25_28.cdq'])fs.writeFileSync(dir+'/'+name,JSON.stringify(manifest,null,2)+'\n');
console.log('Embedded server package:',patches.length,'patches;',extraFiles.length,'server files; compatible V25.26 and V25.27.');
