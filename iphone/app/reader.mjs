// Mozilla PDF.js 6.3.289 : rendu du PDF original et scripts dans QuickJS isolé.
import {installTouchNavigation, installFormNavigation} from './reader-interactions.mjs?v=21.33';
const CDN='https://jprodrigue86.github.io/Rapports--talonnages-CDQ/iphone/app/vendor/pdfjs-6.3.289/';
const $=id=>document.getElementById(id),hosted=window.parent!==window;
let parentOrigin='';
try{const origin=new URL(document.referrer).origin;if(origin===location.origin||/^https:\/\/[a-z0-9-]+-script\.googleusercontent\.com$/.test(origin))parentOrigin=origin;}catch(e){}

let api,viewer,scripting,doc=null,name='Rapport.pdf',dirty=false,editVersion=0,hostId='',requestId='',saving=false,saveTimer=null;
let touchNavigation,formNavigation;
const status=t=>{$('status').textContent=t;};
const tell=d=>{if(hosted&&parentOrigin)window.parent.postMessage(d,parentOrigin);};
function error(e){status(e&&e.message?e.message:String(e));$('save').disabled=!doc;saving=false;}
function menu(close){$('more').hidden=close===true?!0:!$('more').hidden;$('menu').setAttribute('aria-expanded',String(!$('more').hidden));}
function download(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
async function bytes(){document.activeElement?.blur();await new Promise(r=>setTimeout(r,150));await scripting.dispatchWillSave();return await doc.saveDocument();}
async function save(external=false){
 if(!doc||saving)return;saving=true;$('save').disabled=true;const version=editVersion;status('Enregistrement…');
 try{
  const data=await bytes(),blob=new Blob([data],{type:'application/pdf'});
  if(hosted&&hostId&&!external){
   requestId='save-'+crypto.randomUUID();tell({type:'CDQ_READER_SAVE',blob,name,requestId});
   saveTimer=setTimeout(()=>{saving=false;$('save').disabled=false;status('Réponse non reçue. Téléchargez le PDF pour conserver vos réponses.');},30000);
   $('save').dataset.editVersion=String(version);
  }else{
   download(blob,name);dirty=editVersion!==version;await scripting.dispatchDidSave();status(external?'PDF téléchargé — ouvrez-le avec votre lecteur.':'PDF rempli téléchargé.');saving=false;$('save').disabled=false;
  }
 }catch(e){error(e);}
}
async function open(blob,filename,id=''){
 if(!(blob instanceof Blob)||blob.size>32*1024*1024||(await blob.slice(0,5).text())!=='%PDF-')throw Error('PDF invalide ou supérieur à 32 Mo.');
 touchNavigation?.reset();formNavigation?.reset();
 if(doc){viewer.setDocument(null);await doc.destroy();}
 name=String(filename||'Rapport.pdf');hostId=id;$('name').textContent=name;$('empty').style.display='none';status('Ouverture…');dirty=false;editVersion=0;
 const loading=api.getDocument({data:new Uint8Array(await blob.arrayBuffer()),cMapUrl:CDN+'cmaps/',cMapPacked:true,standardFontDataUrl:CDN+'standard_fonts/',wasmUrl:CDN+'wasm/',isEvalSupported:false,enableXfa:false});
 doc=await loading.promise;viewer.setDocument(doc);viewer.linkService.setDocument(doc);
 doc.annotationStorage.onSetModified=()=>{dirty=true;status('Modifications à enregistrer');};
 $('save').disabled=false;status('');
}
$('menu').onclick=()=>menu();$('fit').onclick=()=>{if(viewer)viewer.currentScaleValue='page-width';menu(true);};
$('plus').onclick=()=>{if(viewer)viewer.currentScale=Math.min(4,viewer.currentScale*1.2);};
$('minus').onclick=()=>{if(viewer)viewer.currentScale=Math.max(.35,viewer.currentScale/1.2);};
$('save').onclick=()=>save();$('download').onclick=()=>{menu(true);save(true);};$('external').onclick=()=>{menu(true);save(true);};
$('back').onclick=()=>{if((dirty||saving)&&!confirm('Des réponses ne sont pas encore enregistrées. Quitter ce PDF ?'))return;if(hosted)tell({type:'CDQ_READER_CLOSE'});else history.back();};
$('file').onchange=async()=>{const f=$('file').files[0];if(!f)return;if(dirty&&!confirm('Quitter les réponses non enregistrées ?'))return;try{await open(f,f.name);}catch(e){error(e);}};
$('viewer').addEventListener('input',()=>{dirty=true;editVersion++;});$('viewer').addEventListener('change',()=>{dirty=true;editVersion++;});
window.addEventListener('beforeunload',e=>{if(dirty||saving){e.preventDefault();e.returnValue='';}});
try{
 api=await import(CDN+'build/pdf.mjs');api.GlobalWorkerOptions.workerSrc=CDN+'build/pdf.worker.mjs';
 const ui=await import(CDN+'web/pdf_viewer.mjs'),eventBus=new ui.EventBus(),linkService=new ui.PDFLinkService({eventBus,externalLinkTarget:2});
 scripting=new ui.PDFScriptingManager({eventBus,sandboxBundleSrc:CDN+'build/pdf.sandbox.mjs',wasmUrl:CDN+'wasm/'});
 viewer=new ui.PDFViewer({container:$('container'),viewer:$('viewer'),eventBus,linkService,scriptingManager:scripting,removePageBorders:true,annotationMode:api.AnnotationMode.ENABLE_FORMS});
 linkService.setViewer(viewer);scripting.setViewer(viewer);
 touchNavigation=installTouchNavigation({container:$('container'),surface:$('viewer'),getViewer:()=>viewer});
 formNavigation=installFormNavigation({surface:$('viewer'),toolbar:$('formNav'),previous:$('previousField'),next:$('nextField'),done:$('doneFields')});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)touchNavigation.reset();});
 eventBus.on('pagesinit',()=>{viewer.currentScaleValue='page-width';});
 eventBus.on('scalechanging',e=>{$('zoom').textContent=Math.round(e.scale*100)+' %';});
 eventBus.on('pagerendered',e=>{if(e.error)error(e.error);});
 eventBus.on('annotationlayerrendered',()=>formNavigation.refresh());
 eventBus.on('textlayerrendered',()=>formNavigation.refresh());
 window.addEventListener('message',async e=>{
  if(!hosted||!parentOrigin||e.source!==window.parent||e.origin!==parentOrigin)return;
  const d=e.data||{};
  if(d.type==='CDQ_READER_OPEN'){try{await open(d.blob,d.name,d.fileId);$('save').hidden=!!d.readOnly;}catch(err){error(err);}}
  if(d.type==='CDQ_READER_SAVED'&&d.requestId===requestId){
   clearTimeout(saveTimer);saving=false;$('save').disabled=false;
   if(d.ok){dirty=editVersion!==Number($('save').dataset.editVersion);await scripting.dispatchDidSave();status(d.queued?'Conservé sur cet appareil — synchronisation en attente.':'Copie remplie enregistrée dans CDQ.');}
   else status(d.error||'Enregistrement impossible. Téléchargez vos réponses.');
  }
 });
 if(hosted){$('empty').style.display='none';status('Ouverture…');}else status('');
 tell({type:'CDQ_READER_READY'});
}catch(e){error(e);$('empty').textContent='Lecteur indisponible. Reconnectez Internet puis réessayez.';}
