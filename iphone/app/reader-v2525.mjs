import {installTouchNavigation,installFormNavigation,installNativeTextInput} from './reader-interactions-v2525.mjs';
const assets=new URL('./vendor/pdfjs-6.3.289/',import.meta.url).href;
const $=id=>document.getElementById(id),hosted=parent!==window;
let parentOrigin='';
try{const o=new URL(document.referrer).origin;if(o===location.origin||/^https:\/\/[a-z0-9-]+-script\.googleusercontent\.com$/.test(o))parentOrigin=o;}catch(_){}
const tell=data=>{if(hosted&&parentOrigin)parent.postMessage(data,parentOrigin)};
let api,viewer,scripting,doc,touch,form,readOnly=false,dirty=false,version=0,savedVersion=0,saving=false;
let lastAttempt=null,fieldDefinitions=null,nativeInput;
function commitActive(){if($('viewer').contains(document.activeElement)){const sink=$('status');sink.tabIndex=-1;sink.focus({preventScroll:true});}}
function cdqTextEntryFieldV2550(el){return !!el&&el.matches?.('.textWidgetAnnotation input,.textWidgetAnnotation textarea')&&!el.disabled&&!el.readOnly&&el.dataset.cdqAutoField!=='true';}
let cdqViewportFieldTimerV2550=0;
function cdqRevealFieldV2550(field){
  if(!field||!field.isConnected)return;
  const container=$('container'),rect=field.getBoundingClientRect(),host=container.getBoundingClientRect();
  if(!rect.width||!rect.height||!host.height)return;
  const safeTop=host.top+10,safeBottom=host.bottom-10;
  if(rect.top>=safeTop&&rect.bottom<=safeBottom)return;
  const targetY=safeTop+(safeBottom-safeTop)*.42;
  const centerY=rect.top+rect.height/2;
  container.scrollTop+=centerY-targetY;
}
function cdqKeyboardFieldV2550(active,field){
  document.body.classList.toggle('cdq-keyboard-field',!!active);
  clearTimeout(cdqViewportFieldTimerV2550);
  if(!active||!field)return;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(document.activeElement===field)cdqRevealFieldV2550(field);
  }));
}
function cdqScheduleViewportFieldV2550(){
  clearTimeout(cdqViewportFieldTimerV2550);
  cdqViewportFieldTimerV2550=setTimeout(()=>{
    const active=document.activeElement;
    if(cdqTextEntryFieldV2550(active))cdqRevealFieldV2550(active);
  },140);
}
let name='Rapport.pdf',fileId='',pending=null,opening=false,closeAfterSave=false,closed=false;
const status=value=>{$('status').textContent=value;};
function busy(value){saving=value;$('viewer').inert=value;$('savingMask').hidden=!value;for(const id of ['save','saveClose','discard','file'])$(id).disabled=value||!doc||readOnly;}
function fail(error){busy(false);status(error.message||String(error));$('closeError').textContent=error.message||String(error);closeAfterSave=false;}
function modified(){if(!readOnly&&!opening){dirty=true;version++;status('Modifications à enregistrer');}}
function close(){if(closed)return;closed=true;dirty=false;try{$('closeDialog').close()}catch(_){};tell({type:'CDQ_READER_CLOSE'});if(!hosted)history.back();}
async function requestClose(){
  if(saving){status('Enregistrement en cours…');return;}
  commitActive();await new Promise(r=>setTimeout(r,120));
  if(!dirty||readOnly){close();return;}
  $('closeError').textContent='';if(!$('closeDialog').open)$('closeDialog').showModal();
  $('keepEditing').focus();
}
async function output(){
  commitActive();await new Promise(r=>setTimeout(r,120));
  await scripting.dispatchWillSave();await new Promise(r=>setTimeout(r,0));
  return new Blob([await doc.saveDocument()],{type:'application/pdf'});
}
function download(blob){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
async function save(external=false){
  if(!doc||saving||readOnly)return;
  busy(true);$('closeError').textContent='';status('Enregistrement…');
  try{
    let blob=await output();const snapshot=version;if(lastAttempt?.version===snapshot)blob=lastAttempt.blob;
    if(external||!hosted||!fileId){download(blob);busy(false);status('PDF téléchargé.');return;}
    const requestId=lastAttempt?.version===snapshot?lastAttempt.id:'save-'+crypto.randomUUID();
    lastAttempt={id:requestId,version:snapshot,blob};
    pending={id:requestId,version:snapshot};
    pending.timer=setTimeout(()=>{if(pending?.id!==requestId)return;pending=null;fail(new Error('La sauvegarde n’a pas encore été confirmée. Le PDF reste ouvert; réessayez ou téléchargez vos réponses.'));},90000);
    tell({type:'CDQ_READER_SAVE',blob,name,requestId});
  }catch(e){fail(e);}
}
async function open(data){
  const blob=data.blob;
  if(!(blob instanceof Blob)||blob.size>32*1024*1024||(await blob.slice(0,5).text())!=='%PDF-')throw Error('PDF invalide (32 Mo maximum).');
  if(doc)return; // A repeated READY/OPEN exchange must never erase current answers.
  opening=true;$('viewer').inert=true;name=String(data.name||name);fileId=String(data.fileId||'');readOnly=!!data.readOnly;
  $('name').textContent=name;$('empty').style.display='none';status('Ouverture du PDF…');
  const task=api.getDocument({data:new Uint8Array(await blob.arrayBuffer()),standardFontDataUrl:assets+'standard_fonts/',cMapUrl:assets+'cmaps/',cMapPacked:true,wasmUrl:assets+'wasm/',isEvalSupported:false,enableXfa:false,enableHWA:true});
  doc=await task.promise;viewer.setDocument(doc);viewer.linkService.setDocument(doc);
  doc.annotationStorage.onSetModified=()=>{if(!readOnly&&!opening){dirty=true;status('Modifications à enregistrer');}};
  $('save').hidden=readOnly;$('saveClose').hidden=readOnly;
  // Scripting can initialise fields after the first canvas appears. User input is
  // tracked independently and is never cleared by a delayed render or rotation.
  await viewer.firstPagePromise;
  const fields=fieldDefinitions=await doc.getFieldObjects(),actions=await doc.getJSActions();
  nativeInput.configure(fields);$('viewer').classList.toggle('cdq-form',!!(fields?.get?.('client_nom')||fields?.client_nom)&&!!(fields?.get?.('charge_point_1_charge_utilisee')||fields?.charge_point_1_charge_utilisee));
  if(fields?.size||fields&&Object.keys(fields).length||actions){const deadline=Date.now()+12000;while(!scripting.ready){if(Date.now()>deadline)throw Error('Les calculs du PDF n’ont pas pu démarrer. Fermez le document puis réessayez.');await new Promise(r=>setTimeout(r,25));}}
  opening=false;busy(false);$('viewer').dataset.ready='true';status(readOnly?'Consultation seulement':'');
  tell({type:'CDQ_READER_OPENED'});
}
function menu(hide=false){$('more').hidden=hide?true:!$('more').hidden;$('menu').setAttribute('aria-expanded',String(!$('more').hidden));}
function zoom(factor,origin){if(viewer&&doc){const target=Math.max(.35,Math.min(4,viewer.currentScale*factor));viewer.updateScale({scaleFactor:target/viewer.currentScale,origin,drawingDelay:0});}}
$('menu').onclick=()=>menu();$('fit').onclick=()=>{if(viewer)viewer.currentScaleValue='page-width';menu(true);};
$('rotate').onclick=()=>{if(doc)viewer.pagesRotation=(viewer.pagesRotation+90)%360;menu(true);};
$('plus').onclick=()=>zoom(1.2);$('minus').onclick=()=>zoom(1/1.2);
$('container').addEventListener('wheel',e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();zoom(Math.exp(-Math.max(-100,Math.min(100,e.deltaY))*.004),[e.clientX,e.clientY]);},{passive:false});
let drag=null;
$('container').addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&(e.button===1||e.button===0&&!e.target.closest('input,textarea,select,button,a'))){e.preventDefault();$('container').classList.add('dragging');drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:$('container').scrollLeft,top:$('container').scrollTop};$('container').setPointerCapture(e.pointerId);}});
$('container').addEventListener('pointermove',e=>{if(drag?.id===e.pointerId){$('container').scrollLeft=drag.left+drag.x-e.clientX;$('container').scrollTop=drag.top+drag.y-e.clientY;}});
for(const type of ['pointerup','pointercancel'])$('container').addEventListener(type,()=>{drag=null;$('container').classList.remove('dragging')});
$('save').onclick=()=>save();$('download').onclick=()=>{menu(true);save(true);};$('external').onclick=()=>{menu(true);save(true);};
$('back').onclick=requestClose;$('saveClose').onclick=()=>{closeAfterSave=true;save();};
$('keepEditing').onclick=()=>{$('closeDialog').close();closeAfterSave=false;};
$('discard').onclick=()=>{
  if(!hosted||!fileId){close();return;}
  busy(true);status('Fermeture…');
  const requestId='discard-'+crypto.randomUUID();
  pending={id:requestId,discard:true,timer:setTimeout(()=>{pending=null;fail(new Error('La fermeture n’a pas été confirmée. Réessayez.'));},15000)};
  tell({type:'CDQ_READER_DISCARD',requestId});
};
$('closeDialog').addEventListener('cancel',e=>{if(saving)e.preventDefault();closeAfterSave=false;});
$('viewer').addEventListener('input',modified);$('viewer').addEventListener('change',modified);
$('viewer').addEventListener('pointerdown',e=>{if(cdqTextEntryFieldV2550(e.target))cdqKeyboardFieldV2550(true,e.target);},{capture:true});
$('viewer').addEventListener('focusin',e=>{if(cdqTextEntryFieldV2550(e.target))cdqKeyboardFieldV2550(true,e.target);},{capture:true});
$('viewer').addEventListener('focusout',()=>{setTimeout(()=>{const active=document.activeElement;if(!cdqTextEntryFieldV2550(active))cdqKeyboardFieldV2550(false);},80);});
window.visualViewport?.addEventListener('resize',cdqScheduleViewportFieldV2550);
window.addEventListener('beforeunload',e=>{if(!closed&&(dirty||saving)){e.preventDefault();e.returnValue='';}});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();save();}else if(e.key==='Escape'&&!$('closeDialog').open){e.preventDefault();requestClose();}});
$('file').onchange=()=>{if(doc){status('Fermez le PDF actuel avant d’en ouvrir un autre.');return;}const f=$('file').files[0];if(f)open({blob:f,name:f.name}).catch(fail);};
// Listen before loading the engine; parent identity and source are both checked.
window.addEventListener('message',async e=>{
  if(!hosted||e.source!==parent||!parentOrigin||e.origin!==parentOrigin)return;
  const d=e.data||{};
  if(d.type==='CDQ_READER_REQUEST_CLOSE'){requestClose();return;}
  if(d.type==='CDQ_READER_SAVED'&&pending&&d.requestId===pending.id){
    clearTimeout(pending.timer);const snapshot=pending.version,discarding=pending.discard;pending=null;
    if(!d.ok){fail(new Error(d.error||'Enregistrement impossible. Le PDF reste ouvert.'));return;}
    if(discarding){busy(false);close();return;}
    lastAttempt=null;savedVersion=snapshot;dirty=version!==savedVersion;busy(false);await scripting.dispatchDidSave();
    status(d.queued?'Conservé sur cet appareil — synchronisation en attente.':'✓ Enregistré dans le dossier client');
    if(closeAfterSave&&!dirty){close();}else closeAfterSave=false;
  }
  if(d.type==='CDQ_READER_OPEN'&&api&&viewer)try{await open(d)}catch(err){opening=false;fail(err);}
});
try{
  api=await import(assets+'build/pdf.mjs');api.GlobalWorkerOptions.workerSrc=assets+'build/pdf.worker.mjs';
  const ui=await import(assets+'web/pdf_viewer.mjs'),eventBus=new ui.EventBus(),linkService=new ui.PDFLinkService({eventBus,externalLinkTarget:2});
  scripting=new ui.PDFScriptingManager({eventBus,sandboxBundleSrc:assets+'build/pdf.sandbox.mjs',wasmUrl:assets+'wasm/'});
  viewer=new ui.PDFViewer({container:$('container'),viewer:$('viewer'),eventBus,linkService,scriptingManager:scripting,removePageBorders:true,annotationMode:api.AnnotationMode.ENABLE_FORMS,maxCanvasPixels:16777216,enableDetailCanvas:false,textLayerMode:0});
  linkService.setViewer(viewer);scripting.setViewer(viewer);
  touch=installTouchNavigation({container:$('container'),surface:$('viewer'),getViewer:()=>viewer});
  nativeInput=installNativeTextInput($('viewer'));
  form=installFormNavigation({surface:$('viewer'),toolbar:$('formNav'),previous:$('previousField'),next:$('nextField'),done:$('doneFields'),reveal:field=>{if(!cdqTextEntryFieldV2550(field))cdqRevealFieldV2550(field);}});
  eventBus.on('pagesinit',()=>{viewer.currentScaleValue='page-width';});
  eventBus.on('scalechanging',e=>{$('zoom').textContent=Math.round(e.scale*100)+' %';});
  eventBus.on('pagerendered',e=>{if(e.error)fail(e.error);});
  eventBus.on('annotationlayerrendered',()=>{if(readOnly)for(const field of $('viewer').querySelectorAll('input,textarea,select,button'))field.disabled=true;form.refresh();nativeInput.configure(fieldDefinitions);});
  eventBus.on('textlayerrendered',()=>form.refresh());
  document.addEventListener('visibilitychange',()=>{if(document.hidden)touch.reset();});
  if(hosted){$('empty').style.display='none';status('Ouverture…');}else status('Choisissez un PDF.');
  tell({type:'CDQ_READER_READY'});
}catch(e){fail(e);$('empty').textContent='Le lecteur n’a pas pu démarrer. Fermez puis mettez à jour l’application.';}
