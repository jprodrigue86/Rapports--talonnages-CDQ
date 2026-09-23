// Dernier modèle Balance de plancher approuvé, intégré sans accès Drive.
const CDQ_MODELES_EMBARQUES_ = Object.freeze({
  "plancher": {
    "nom": "Balance de plancher.pdf",
    "id": "cdq-app-plancher-v2519-d386179c7186debc0f7f",
    "taille": 628837,
    "sha256": "d386179c7186debc0f7fc17ded80133f739c15ca6f8a44407b69b6f147f5ee92",
    "modifieLe": 1790117959420,
    "chunkSize": 645120,
    "assets": [
      "CDQ_Model_plancher_v2519_0"
    ]
  }
});
function cdqMetaEmbarquee_(cle){
  return Object.prototype.hasOwnProperty.call(CDQ_MODELES_EMBARQUES_,cle)
    ? CDQ_MODELES_EMBARQUES_[cle] : null;
}
function cdqChunkEmbarque_(cle,index){
  const m=cdqMetaEmbarquee_(cle);
  if(!m || !Number.isInteger(index) || index<0 || index>=m.assets.length)
    throw new Error('Segment du modèle invalide.');
  const encoded=HtmlService.createHtmlOutputFromFile(m.assets[index]).getContent().trim();
  const bytes=Utilities.base64Decode(encoded);
  const attendu=Math.min(m.chunkSize,m.taille-index*m.chunkSize);
  if(bytes.length!==attendu)throw new Error('Segment du modèle incomplet.');
  return bytes;
}
function cdqBlobEmbarque_(cle,nom){
  const m=cdqMetaEmbarquee_(cle);
  if(!m)throw new Error('Modèle intégré inconnu.');
  let bytes=[];
  for(let i=0;i<m.assets.length;i++)bytes=bytes.concat(cdqChunkEmbarque_(cle,i));
  const hash=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,bytes)
    .map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');
  if(hash!==m.sha256)
    throw new Error('Le modèle intégré ne correspond pas au PDF approuvé.');
  return Utilities.newBlob(bytes,'application/pdf',nom||m.nom);
}
function cdqTemplateEmbarque_(cle){
  const m=cdqMetaEmbarquee_(cle);
  if(!m)return null;
  return {
    cdqEmbedded:true,
    getId:()=>m.id,
    getLastUpdated:()=>new Date(m.modifieLe),
    getSize:()=>m.taille,
    getBlob:()=>cdqBlobEmbarque_(cle),
    makeCopy:(nom,dossier)=>dossier.createFile(cdqBlobEmbarque_(cle,nom))
  };
}
