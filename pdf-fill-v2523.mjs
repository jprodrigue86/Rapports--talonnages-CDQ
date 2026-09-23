// Fill raw inputs, then run the approved PDF's own JavaScript calculations.
import {floorTemplate} from './floor-template-v2519.mjs';
const assets=new URL('./vendor/pdfjs-6.3.289/',import.meta.url).href;
export const rawField=/^(client_(nom|telephone|technicien|adresse|ville)|(?:prochain_etalonnage|date_etalonnage)_[123]|frequence_etalonnage|(?:indicateur|base_balance)_(fabricant|modele|numero_serie|numero_am)|imprimante_(fabricant|modele|numero_serie)|identification_balance|etendue_verifiee|legal_pour_commerce|capacite_maximale|unite_mesure|echelon|etalon_utilise|charge_point_[1-6]_(charge_utilisee|avant_correction|apres_correction)|charge_excentricite|excentricite_(avant|apres)_(arriere_gauche|avant_gauche|arriere_droit|avant_droit))$/;
let engine;
const norm=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
export async function fillPdf(values,{blob,strict=true}={}){
  const entries=Object.entries(values||{}).filter(([,v])=>v!==null&&v!==undefined&&String(v).trim()!=='');
  for(const [k,v] of entries)if(!rawField.test(k)||String(v).length>1000)throw Error('Champ de transfert refusé : '+k);
  let bytes=new Uint8Array(await (blob||(await floorTemplate()).blob).arrayBuffer());
  await import('./vendor/pdf-lib-1.17.1.min.js');
  const lib=await globalThis.PDFLib.PDFDocument.load(bytes),form=lib.getForm();let changed=false;
  for(const entry of entries){
    const [name,value]=entry;const field=form.getFieldMaybe(name);
    if(!field){if(strict)throw Error('Champ absent du modèle : '+name);continue;}
    if(field instanceof globalThis.PDFLib.PDFDropdown){
      const found=field.getOptions().find(o=>norm(o)===norm(value));
      // Existing options may have distinct export/display values; match export too.
      const raw=field.acroField.getOptions().find(o=>norm(o.value.decodeText())===norm(value));
      if(raw)entry[1]=raw.value.decodeText();
      else if(found){const opt=field.acroField.getOptions().find(o=>o.display?.decodeText()===found);entry[1]=opt?.value.decodeText()||found;}
      else if(name==='client_technicien'||name==='etalon_utilise'){field.addOptions([String(value).trim()]);changed=true;}
      else throw Error('Choix inconnu pour '+name+' : '+value);
    }
  }
  if(changed)bytes=await lib.save({updateFieldAppearances:false});
  engine||=import(assets+'build/pdf.mjs');const api=await engine;api.GlobalWorkerOptions.workerSrc=assets+'build/pdf.worker.mjs';
  const task=api.getDocument({data:bytes,standardFontDataUrl:assets+'standard_fonts/',cMapUrl:assets+'cmaps/',cMapPacked:true,wasmUrl:assets+'wasm/',isEvalSupported:false});const doc=await task.promise;
  let sandbox;const valid=new Set();
  const update=e=>{const {id,siblings,...detail}=e.detail||{};for(const key of [id,...(siblings||[])])if(valid.has(key))doc.annotationStorage.setValue(key,detail);};
  try{
    const objects=await doc.getFieldObjects();if(!objects)throw Error('Ce PDF ne contient pas de formulaire.');
    const fields=objects instanceof Map?objects:new Map(Object.entries(objects));
    for(const defs of fields.values())for(const def of defs)valid.add(def.id);
    window.addEventListener('updatefromsandbox',update);
    const {QuickJSSandbox}=await import(assets+'build/pdf.sandbox.mjs');sandbox=await QuickJSSandbox(assets+'wasm/');
    sandbox.create({objects,calculationOrder:await doc.getCalculationOrderIds(),appInfo:{platform:navigator.platform,language:'fr-CA'},docInfo:{...(await doc.getMetadata()).info,numPages:doc.numPages,actions:await doc.getJSActions()}});
    sandbox.dispatchEvent({id:'doc',name:'Open'});
    for(const [name,raw] of entries){
      const defs=fields.get(name);if(!defs?.length){if(strict)throw Error('Champ absent : '+name);continue;}
      const value=String(raw),id=defs[0].id;
      sandbox.dispatchEvent({id,name:'Keystroke',value,willCommit:true,commitKey:1,selStart:0,selEnd:value.length});
      sandbox.dispatchEvent({id,name:'Blur',value});
    }
    sandbox.dispatchEvent({id:'doc',name:'WillSave'});
    // Allow document timers to finish; Enter navigation is not triggered by this transfer.
    await new Promise(r=>setTimeout(r,80));
    const output=new Blob([await doc.saveDocument()],{type:'application/pdf'});
    return output;
  }finally{window.removeEventListener('updatefromsandbox',update);sandbox?.nukeSandbox();await task.destroy();}
}
