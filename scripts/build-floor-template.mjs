import fs from 'node:fs';
import crypto from 'node:crypto';
const read=p=>fs.readFileSync(p,'utf8'),folder='bundles/balance-cdq/v25.19';
const source=fs.readFileSync('assets/templates/balance-plancher-v2519.pdf');
const hash=crypto.createHash('sha256').update(source).digest('hex');
if(hash!=='d386179c7186debc0f7fc17ded80133f739c15ca6f8a44407b69b6f147f5ee92')throw Error('Le PDF approuvé a changé.');
const meta={modeleId:'plancher',templateId:'cdq-app-plancher-v2519-'+hash.slice(0,20),name:'Balance de plancher.pdf',sha256:hash,taille:source.length,modifieLe:Date.parse('2026-09-22T22:59:19.420Z')};
const factory=`const meta=Object.freeze(${JSON.stringify(meta)});\nconst encoded=${JSON.stringify(source.toString('base64'))};
let ready;
function floorTemplate(){
  if(!ready)ready=(async()=>{
    const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
    if(bytes.length!==meta.taille||hash!==meta.sha256)throw new Error('Le modèle intégré est incomplet.');
    return Object.freeze({...meta,blob:new Blob([bytes],{type:'application/pdf'})});
  })().catch(e=>{ready=null;throw e;});
  return ready;
}\n`;
fs.writeFileSync('floor-template-v2519.mjs','// PDF approuvé : octets inchangés, aucun accès Drive.\n'+factory+'export {floorTemplate,meta};\n');
const ui=`<script id="cdqV2519PlancherEmbeddedJs">\n(function(){\n'use strict';\n${factory}
window.cdqFloorTemplateV2519=floorTemplate;
window.cdqEnsureFloorV2519=async function(){
  const email=String(utilisateurCourantEmail||'');
  const valid=()=>{if(!email||email!==String(utilisateurCourantEmail||'')||cdqAccessState!=='ready')throw new Error('Déverrouillez votre compte pour utiliser le modèle.');};
  valid();const t=await floorTemplate();valid();
  const old=await cdqV2112GetCachedTemplate('plancher');valid();
  if(!old||old.templateId!==t.templateId||old.sha256!==t.sha256||!(old.blob instanceof Blob)||old.blob.size!==t.taille){
    await cdqV19PutRecord('template-pdf',cdqTemplateRecord('plancher'),{...t,templateType:'plancher',nom:t.name,revision:CDQ_TEMPLATE_REVISION,cachedAt:Date.now()});valid();
  }
  return true;
};
async function warm(){
  if(cdqAccessState!=='ready')return;
  const email=String(utilisateurCourantEmail||'');
  try{
    await window.cdqEnsureFloorV2519();const t=await floorTemplate();
    if(cdqAccessState!=='ready'||email!==String(utilisateurCourantEmail||''))return;
    cdqPublierSessionHorsLigne();
    cdqPostToPwa({...t,type:'CDQ_OFFLINE_TEMPLATE',email:email,revision:CDQ_TEMPLATE_REVISION});
  }catch(e){console.warn('Modèle intégré :',e.message||String(e));}
}
window.addEventListener('cdq:access-ready',warm);
window.addEventListener('message',e=>{if(cdqFromPwa(e)&&e.data?.type==='CDQ_OFFLINE_PREPARE')warm();});
if(document.readyState!=='loading')setTimeout(warm,300);
})();\n</script>`;
// Standalone Apps Script also carries the exact model; it does not depend on Drive.
const patches=JSON.parse(read(`${folder}/integration-patches.json`));
const warmup=read(`${folder}/old-warmup.txt`);
patches.push({file:'Selector.html',op:'replace_literal',search:warmup,replacement:ui});
const base=JSON.parse(read('bundles/balance-cdq/v25.18/manifest.json'));
const build='2026.09.23-v25.19-plancher-integre';
const model={nom:meta.name,id:meta.templateId,taille:meta.taille,sha256:meta.sha256,modifieLe:meta.modifieLe,chunkSize:645120,assets:['CDQ_Model_plancher_v2519_0']};
const gs=read('bundles/balance-cdq/v22.91/files/CDQTemplates.gs');
fs.writeFileSync(`${folder}/files/CDQTemplates.gs`,'// Dernier modèle Balance de plancher approuvé, intégré sans accès Drive.\nconst CDQ_MODELES_EMBARQUES_ = Object.freeze('+JSON.stringify({plancher:model},null,2)+');\n'+gs.slice(gs.indexOf('function cdqMetaEmbarquee_')));
fs.writeFileSync(`${folder}/files/CDQ_Model_plancher_v2519_0.html`,source.toString('base64')+'\n');
const result={schema:base.schema,projectScriptId:base.projectScriptId,version:'V25.19',build,title:'Balance CDQ V25.19 — dernier Balance de plancher intégré',requiresBuild:[base.build],patches:[...['Code.gs','Selector.html'].map(file=>({file,op:'replace_build_any',from:[base.build],to:build})),...patches],extraFiles:['CDQTemplates.gs','CDQ_Model_plancher_v2519_0.html'].map(name=>({name,sha256:crypto.createHash('sha256').update(fs.readFileSync(`${folder}/files/${name}`)).digest('hex'),url:`https://jprodrigue86.github.io/Rapports--talonnages-CDQ/${folder}/files/${name}`})),removeFiles:[],audit:{scriptManagerRequired:'V40',androidAppRequired:'APK existante conservée',embeddedPdf:meta,scope:'Balance intermédiaire → Balance de plancher : modèle intégré, copie locale immédiate, lecteur intégré et synchronisation différée.',preservation:'PDF approuvé inchangé : 139 champs et scripts de calcul conservés. Autres modèles, droits et dossiers clients préservés.'}};
for(const name of ['manifest.json','Balance_CDQ_V25_19.cdq'])fs.writeFileSync(`${folder}/${name}`,JSON.stringify(result,null,2)+'\n');
console.log(`Built ${result.version}, PDF ${source.length} bytes, SHA-256 ${hash}`);
