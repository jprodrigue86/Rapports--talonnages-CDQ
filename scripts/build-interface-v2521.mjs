import fs from 'node:fs';import crypto from 'node:crypto';
const folder='bundles/balance-cdq/v25.21',read=p=>fs.readFileSync(p,'utf8'),base=JSON.parse(read('bundles/balance-cdq/v25.20/manifest.json'));
const build='2026.09.23-v25.21-drive-favoris-interface';
const supported=[JSON.parse(read('bundles/balance-cdq/v25.19/manifest.json')).build,base.build];
const patches=['Code.gs','Selector.html'].map(file=>({file,op:'replace_build_any',from:supported,to:build}));
// Normalize the exact V25.20 changes in memory, then apply them once. This
// lets the same reviewed package upgrade either V25.19 or V25.20 safely.
const readerPatches=base.patches.filter(p=>p.op==='replace_literal');
for(const [index,p] of [...readerPatches].reverse().entries())patches.push({id:'reader-normalize-'+index,file:p.file,op:'replace_literal_if_present',search:p.replacement,replacement:p.search});
for(const [index,p] of readerPatches.entries())patches.push({...p,id:'reader-upgrade-'+index});
for(const p of JSON.parse(read(folder+'/integration-patches.json'))){
 if(p.id==='floor-private-bridge')p.replacement=read(folder+'/floor-bridge.js')+'\n'+p.search;
 if(p.id==='desktop')p.replacement=read(folder+'/desktop.js');
 if(p.id==='admin-markup')p.replacement=read(folder+'/admin.html')+'\n';
 if(p.id==='admin-functions')p.replacement=read(folder+'/admin-functions.js');
 if(p.id==='extra-icons')p.replacement='<script id="cdqExtraIconsV2521">\n'+read(folder+'/extra-icons.js')+'\n</script>\n'+p.search;
 if(p.id==='interface')p.replacement='<style id="cdqInterfaceV2521">\n'+read(folder+'/interface.css')+'\n</style>\n<script id="cdqDriveV2521">\n'+read(folder+'/drive-browser.js')+'\n</script>\n</body>';
 patches.push(p);
}
const name='CDQDriveBrowser.gs';const bundle={schema:base.schema,projectScriptId:base.projectScriptId,version:'V25.21',build,title:'Balance CDQ V25.21 — Drive, favoris et interface',requiresBuild:supported,patches,extraFiles:[{name,sha256:crypto.createHash('sha256').update(read(folder+'/files/'+name)).digest('hex'),url:'https://jprodrigue86.github.io/Rapports--talonnages-CDQ/'+folder+'/files/'+name}],removeFiles:[],audit:{scriptManagerRequired:'V40',androidAppRequired:'APK existante pour les fonctions web; nouveau fond natif en attente de la clé de signature',scope:'Copie plancher réparée, Drive général et favoris personnels, gestion des utilisateurs, icônes Clients/Réglages, NIP sombre et murs musicaux.',productionVerified:false,preservation:'Aucun rapport client ni compte réel modifié pendant les tests. Le lecteur V25.20 et les droits existants sont conservés.'}};
bundle.extraFiles.push(...base.extraFiles);
for(const file of ['manifest.json','Balance_CDQ_V25_21.cdq'])fs.writeFileSync(folder+'/'+file,JSON.stringify(bundle,null,2)+'\n');
console.log('Built V25.21:',patches.length,'patches, two checked server helpers');
