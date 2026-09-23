import fs from 'node:fs';import crypto from 'node:crypto';
const read=p=>fs.readFileSync(p,'utf8'),folder='bundles/balance-cdq/v25.20';
const base=JSON.parse(read('bundles/balance-cdq/v25.19/manifest.json'));
const build='2026.09.23-v25.20-lecteurs-pdf';
const patches=['Code.gs','Selector.html'].map(file=>({file,op:'replace_build_any',from:[base.build],to:build}));
for(const p of JSON.parse(read(folder+'/integration-patches.json'))){
  if(p.search.startsWith('async function cdqLoadPdfRecord'))p.replacement=read(folder+'/selector-reader.js')+'\n\n';
  if(p.search.includes('// All document entry points'))p.replacement='\n'+read(folder+'/document-open.js')+'\n';
  if(p.search.includes("if (!document.documentElement.classList.contains('windows')) return;"))p.replacement=read(folder+'/desktop.js');
  patches.push(p);
}
const name='CDQPdfReader.gs';
const result={schema:base.schema,projectScriptId:base.projectScriptId,version:'V25.20',build,title:'Balance CDQ V25.20 — lecteurs PDF et suppression PC',requiresBuild:[base.build],patches,
  extraFiles:[{name,sha256:crypto.createHash('sha256').update(read(folder+'/files/'+name)).digest('hex'),url:'https://jprodrigue86.github.io/Rapports--talonnages-CDQ/'+folder+'/files/'+name}],removeFiles:[],
  audit:{scriptManagerRequired:'V40',androidAppRequired:'APK existante conservée',scope:'Supprimer dans le premier menu PC; lecteur embarqué commun; choix par défaut; confirmation à la fermeture; enregistrement du PDF client avec contrôle de révision et file hors ligne.',productionVerified:false,preservation:'Modèles originaux, champs, scripts de calcul et droits existants conservés. Aucun rapport client réel modifié pendant les tests.'}};
for(const name of ['manifest.json','Balance_CDQ_V25_20.cdq'])fs.writeFileSync(folder+'/'+name,JSON.stringify(result,null,2)+'\n');
console.log('Built V25.20: '+patches.length+' patches and one server helper');
