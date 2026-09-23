(function(){
const base=CDQ_PWA_ORIGIN+'/Rapports--talonnages-CDQ/';
window.cdqCreationV2523={
 async context(clientId){
  const email=String(utilisateurCourantEmail||''),key='cdq-client-context23:'+email+':'+clientId;let v={};try{v=JSON.parse(localStorage.getItem(key)||'{}')}catch{}
  if(navigator.onLine!==false){v=await window.cdqAppelServeur('obtenirContexteCreationCDQV2523',[clientId]);if(String(utilisateurCourantEmail||'')!==email)throw Error('Le compte a changé.');try{localStorage.setItem(key,JSON.stringify(v));}catch{}}
  v.client_nom=String(clientId)===String(compagnieSelectionnee)?String(nomCompagnieSelectionnee||v.client_nom||''):v.client_nom||'';
  v.client_technicien=String(utilisateurCourantNomRapport||v.client_technicien||'').trim();return v;
 },
 async fill(blob,clientId){const values=await this.context(clientId),{fillInFrame}=await import(base+'pdf-fill-client-v2523.mjs');return fillInFrame(values,{blob,strict:false});},
 async created(result,clientId,requestId){
  if(!result?.id)return;if(await window.cdqAppelServeur('verifierCreationPreRemplieCDQV2523',[result.id,'save-'+requestId]))return;const email=String(utilisateurCourantEmail||''),meta=await window.cdqAppelServeur('obtenirPdfLecteurCDQV2520',[result.id,'']);
  let bytes;if(meta.base64)bytes=Uint8Array.from(atob(meta.base64),c=>c.charCodeAt(0));else{const parts=[];for(let i=0;i<meta.chunks;i++){const p=await window.cdqAppelServeur('obtenirChunkDocumentPdfCDQ',[result.id,meta.revision,i]);parts.push(Uint8Array.from(atob(p.base64),c=>c.charCodeAt(0)));}bytes=new Uint8Array(await new Blob(parts).arrayBuffer());}
  const blob=await this.fill(new Blob([bytes],{type:'application/pdf'}),clientId);if(String(utilisateurCourantEmail||'')!==email)throw Error('Le compte a changé.');const out=new Uint8Array(await blob.arrayBuffer());let bin='';for(let i=0;i<out.length;i+=32768)bin+=String.fromCharCode(...out.subarray(i,i+32768));
  await window.cdqAppelServeur('enregistrerPdfLecteurCDQV2520',[result.id,btoa(bin),'save-'+requestId,meta.revision]);
 }
};
})();
