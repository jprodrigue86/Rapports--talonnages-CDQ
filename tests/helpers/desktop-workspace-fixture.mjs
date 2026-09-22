import fs from 'node:fs';
import {applyPatch} from './settings-fixture.mjs';
export const read=p=>fs.readFileSync(p,'utf8');
export const manifest=JSON.parse(read('bundles/balance-cdq/v25.17/manifest.json'));
export function patch(source,file,m=manifest){return m.patches.filter(p=>p.file===file).reduce((s,p)=>applyPatch(s,p),source)}
export function currentSource(){let source=read(process.env.CDQ_SELECTOR_SOURCE);for(const v of ['25.15','25.16'])source=patch(source,'Selector.html',JSON.parse(read(`bundles/balance-cdq/v${v}/manifest.json`)));return source}
const setup=String.raw`
window.utilisateurCourantEmail='';window.utilisateurCourantRole='technicien';window.compagnieSelectionnee='';window.nomCompagnieSelectionnee='';
window.calls=[];window.opened=[];window.cdqRafraichirTechniciensRapports=()=>{};window.modifierFichier=id=>opened.push(id);
window.cdqLoadSharedPreferencesV72=()=>{};window.ouvrirInventaireCDQ=()=>calls.push({name:'inventory'});
window.cdqOpenSettingsV2294=()=>calls.push({name:'account-settings'});window.cdqOuvrirPartageApplication=()=>calls.push({name:'share'});
window.demoClients=Array.from({length:280},(_,i)=>({id:'c'+i,nom:i===0?'Anhydra':i===1?'(Kersia Canada) Laboratoire chois y'.replace('chois y','choisy'):'Compagnie '+String(i).padStart(3,'0')}));
window.demoFiles=Array.from({length:96},(_,i)=>({id:'f'+i,kind:'file',nom:i===0?'Balance de plancher.pdf':'Rapport d’étalonnage '+String(i).padStart(3,'0')+'.pdf',mimeType:'application/pdf',type:'PDF',mimeLabel:'PDF',clientId:'c0',clientNom:'Anhydra',dateModification:'2026-09-21T14:30:00Z',statut:i%7===0?'non_conforme':'conforme'}));
window.rpcIcons={};
window.rpcResult=(name,args)=>{
 if(name==='obtenirDossiersClientsPCLeger'||name==='obtenirDossiersClients')return demoClients;
 if(name==='obtenirResumesConformiteClientsCDQ')return Object.fromEntries(demoClients.map((c,i)=>[c.id,{totalFichiers:96,totalPdf:96,conformes:89,nonConformes:7,inconnus:0}]));
 if(name==='obtenirRapportsRecentsPC')return demoFiles.slice(0,15);
 if(name==='obtenirResumeSuiviTechniqueCDQV72')return {nonConformitesActives:7,clientsSurveilles:3,surveillancesActives:5};
 if(name==='obtenirContenuDossierPCRapideV79'||name==='obtenirContenuDossierPCRapideV72')return {dossierId:args[0],items:args[0]==='archive'?demoFiles.slice(70):[{kind:'folder',id:'archive',nom:'Archives des rapports'},...demoFiles],crumbs:[{id:args[1],nom:demoClients.find(c=>c.id===args[1])?.nom||'Client'},...(args[0]==='archive'?[{id:'archive',nom:'Archives des rapports'}]:[])]};
 if(name==='obtenirStyleIconesCDQV2514')return {email:args[0],style:'current',revision:0,...rpcIcons[args[0]]};
 if(name==='enregistrerStyleIconesCDQV2514'){rpcIcons[args[0]]=args[1];return {email:args[0],...args[1]}}
 if(name==='renommerFichier'){demoFiles.find(f=>f.id===args[0]).nom=args[1];return true}
 if(name==='dupliquerFichier'){const f=demoFiles.find(f=>f.id===args[0]);demoFiles.push({...f,id:'copy-'+f.id,nom:'Copie '+f.nom});return {id:'copy-'+f.id}}
 if(name==='creerDossierClient'){demoClients.push({id:'new-client',nom:args[0]});return {id:'new-client'}}
 return [];
};
window.cdqApiRun=()=>{let ok=()=>{},fail=()=>{};const proxy=new Proxy({},{get:(_,name)=>name==='withSuccessHandler'?f=>{ok=f;return proxy}:name==='withFailureHandler'?f=>{fail=f;return proxy}:(...args)=>{calls.push({name,args});setTimeout(()=>{try{ok(rpcResult(name,args))}catch(e){fail(e)}},12)}});return proxy};
window.login=()=>{window.utilisateurCourantEmail='demo@example.test';document.getElementById('accessOverlay').style.display='none';window.cdqIconThemesV2514?.synchronize();window.startDemo?.()};
`;
const mockCore=String.raw`
const demoState={view:'home',clients:demoClients,summaries:rpcResult('obtenirResumesConformiteClientsCDQ',[]),recent:demoFiles.slice(0,15),tracking:{summary:rpcResult('obtenirResumeSuiviTechniqueCDQV72',[])},search:'',pcSelectedFiles:new Map(),pcSelectionMode:false,explorer:{client:null,items:[],crumbs:[],folderId:''}};
const bridge={stats:()=>({ok:89,nc:7,unk:0}),fmt:v=>new Date(v).toLocaleDateString('fr-CA'),nativeExplorerIcon:f=>'<span class="pc16-native-icon">'+(f.kind==='folder'?'📁':'📄')+'</span>',statusHtml:()=>'',show:v=>{demoState.view=v==='reports'?'explorer':v;cdqDesktopV2517.kpis();cdqDesktopV2517.render(demoState,bridge)},quick:a=>bridge.show(a==='report'?'models':'clients'),createClient:()=>{},loadClients:()=>{},openExplorerClient:id=>{const c=demoClients.find(c=>c.id===id);demoState.client=c;demoState.explorer.client=c;demoState.search='';demoState.pcSelectedFiles.clear();demoState.pcSelectionMode=false;bridge.loadFolder(id,id)},explorerFileObject:f=>({...f,clientId:demoState.client.id}),explorerOpenFolder:f=>bridge.loadFolder(f.id,demoState.client.id),loadFolder:(id,cid)=>{Object.assign(demoState.explorer,rpcResult('obtenirContenuDossierPCRapideV79',[id,cid]),{folderId:id});bridge.show('explorer')},openFile:f=>modifierFichier(f.id),rename:f=>{const name=prompt('Nom',f.nom);if(name){calls.push({name:'renommerFichier',args:[f.id,name,f.clientId]});rpcResult('renommerFichier',[f.id,name]);bridge.show(demoState.view)}},duplicate:f=>{calls.push({name:'dupliquerFichier',args:[f.id,f.clientId]});rpcResult('dupliquerFichier',[f.id]);bridge.loadFolder(demoState.explorer.folderId,demoState.client.id)},copy:()=>{},download:()=>{},fileMenu:()=>{},armSelection:()=>{},send:()=>{},legacy:(v,m)=>m.innerHTML='<h1>'+v+'</h1>',openSharedSettings:cdqOpenSettingsV2294,sync:()=>{}};
window.startDemo=()=>{if(document.getElementById('cdqPcV16'))return;const root=document.createElement('div');root.id='cdqPcV16';root.innerHTML='<div class="pc16-stage"><header class="pc16-header"></header><div class="pc16-body"><aside class="pc16-sidebar"><nav class="pc16-nav">'+['home','clients','reports','invoices','models','settings'].map((v,i)=>'<button data-view="'+v+'">'+['Accueil','Clients','Rapports','Factures','Modèles','Paramètres'][i]+'</button>').join('')+'</nav><div class="pc16-shortcuts"></div><div class="pc16-side-status"><div class="pc16-side-meta">Balance CDQ<span></span></div></div></aside><section class="pc16-center"><div class="pc16-kpis" id="pc16Kpis"></div><section class="pc16-main" id="pc16Main"></section></section></div></div>';document.body.append(root);cdqDesktopV2517.mount(demoState,bridge);root.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>bridge.show(b.dataset.view));bridge.show('home');cdqDesktopV2517.scale();document.documentElement.classList.remove('pc16-startup-lock')};
`;
export function fixture(){
 let styles='',scripts='';
 if(process.env.CDQ_SELECTOR_SOURCE){
  const source=patch(currentSource(),'Selector.html');
  styles=[...source.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map(m=>m[0]).join('\n');
  scripts=['cdqDesktopV2517Js','cdqPcV16Js','cdqPcV2244UpdateBannerJs','cdqIconThemesJsV2514'].map(id=>{const match=source.match(new RegExp('<script id="'+id+'">([\\s\\S]*?)<\\/script>'));if(!match)throw Error('Missing '+id);return match[0]}).join('\n');
 }else{
  const iconPatch=manifest.patches.filter(p=>p.search?.startsWith('window.cdqIconThemes')||p.search?.includes('function accept('));
  let icons=read('bundles/balance-cdq/v25.15/icon-themes.js');for(const p of iconPatch)icons=applyPatch(icons,p);
  styles='<style>'+read('bundles/balance-cdq/v25.15/icon-themes.css')+'</style><style>'+read('bundles/balance-cdq/v25.17/desktop.css')+'</style>';
  scripts='<script>'+read('bundles/balance-cdq/v25.17/desktop.js')+'</script><script>'+icons+'</script><script>'+mockCore+'</script>';
 }
 return '<!doctype html><html class="windows pc16-startup-lock"><head><meta charset="utf-8">'+styles+'</head><body><div id="accessOverlay" style="position:fixed;inset:0;z-index:1000000"><button id="demoLogin" onclick="login()" style="position:absolute;left:44%;top:43%;padding:22px;border-radius:12px;border:1px solid #667;background:#12161ced;color:white;font:18px system-ui">Connexion · aperçu PC</button></div><script>'+setup+'</script>'+scripts+'</body></html>';
}
