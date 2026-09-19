// Modèles privés intégrés : ne pas publier ces fichiers dans GitHub Pages.
// Les fonctions publiques de Code.gs contrôlent les droits avant chaque lecture.
const CDQ_MODELES_EMBARQUES_ = Object.freeze({"plancher":{"nom":"Balance de Plancher.pdf","id":"cdq-app-plancher-final-de0d77511bec1e12a453","taille":22617028,"sha256":"de0d77511bec1e12a45350de576fe6270730346ce0c4b4e29d28b6a67a4fffb0","modifieLe":1789790178040,"chunkSize":2097152,"assets":["CDQ_Model_plancher_0","CDQ_Model_plancher_1","CDQ_Model_plancher_2","CDQ_Model_plancher_3","CDQ_Model_plancher_4","CDQ_Model_plancher_5","CDQ_Model_plancher_6","CDQ_Model_plancher_7","CDQ_Model_plancher_8","CDQ_Model_plancher_9","CDQ_Model_plancher_10"]},"cuve4":{"nom":"Balance Quvre 4.pdf","id":"cdq-bundled-cuve4-1cd3be1e573821e54935","taille":13387963,"sha256":"1cd3be1e573821e54935e92d44219cdb130cfe55fa1d470e6271f1f4975af919","modifieLe":1789480800000,"chunkSize":2097152,"assets":["CDQ_Model_cuve4_0","CDQ_Model_cuve4_1","CDQ_Model_cuve4_2","CDQ_Model_cuve4_3","CDQ_Model_cuve4_4","CDQ_Model_cuve4_5","CDQ_Model_cuve4_6"]},"precision":{"nom":"Balance de précision.pdf","id":"cdq-bundled-precision-560f1684cea48a6f83a8","taille":12185539,"sha256":"560f1684cea48a6f83a8d6a208ce4078a1a9d797a6494e68fbe7686e8a5b023e","modifieLe":1789480800000,"chunkSize":2097152,"assets":["CDQ_Model_precision_0","CDQ_Model_precision_1","CDQ_Model_precision_2","CDQ_Model_precision_3","CDQ_Model_precision_4","CDQ_Model_precision_5"]},"camion":{"nom":"Balance à camion.pdf","id":"cdq-bundled-camion-a6d84417dde9b641f01d","taille":7420432,"sha256":"a6d84417dde9b641f01d13d68e337928207e640a1839abed882a357299d10bf1","modifieLe":1789480800000,"chunkSize":2097152,"assets":["CDQ_Model_camion_0","CDQ_Model_camion_1","CDQ_Model_camion_2","CDQ_Model_camion_3"]}});
function cdqMetaEmbarquee_(cle) {
  return Object.prototype.hasOwnProperty.call(CDQ_MODELES_EMBARQUES_,cle) ? CDQ_MODELES_EMBARQUES_[cle] : null;
}
function cdqChunkEmbarque_(cle,index) {
  const m=cdqMetaEmbarquee_(cle);
  if(!m || !Number.isInteger(index) || index<0 || index>=m.assets.length)throw new Error('Segment du modèle invalide.');
  const encoded=HtmlService.createHtmlOutputFromFile(m.assets[index]).getContent().trim();
  const bytes=Utilities.ungzip(Utilities.newBlob(Utilities.base64Decode(encoded),'application/x-gzip')).getBytes();
  const attendu=Math.min(m.chunkSize,m.taille-index*m.chunkSize);
  if(bytes.length!==attendu)throw new Error('Segment du modèle incomplet.');
  return bytes;
}
function cdqBlobEmbarque_(cle,nom) {
  const m=cdqMetaEmbarquee_(cle);if(!m)throw new Error('Modèle intégré inconnu.');
  let bytes=[];
  for(let i=0;i<m.assets.length;i++)bytes=bytes.concat(cdqChunkEmbarque_(cle,i));
  const hash=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,bytes).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');
  if(hash!==m.sha256)throw new Error('Le modèle intégré ne correspond pas au PDF approuvé.');
  return Utilities.newBlob(bytes,'application/pdf',nom||m.nom);
}
function cdqTemplateEmbarque_(cle) {
  const m=cdqMetaEmbarquee_(cle);if(!m)return null;
  return {cdqEmbedded:true,getId:()=>m.id,getLastUpdated:()=>new Date(m.modifieLe),getSize:()=>m.taille,
    getBlob:()=>cdqBlobEmbarque_(cle),makeCopy:(nom,dossier)=>dossier.createFile(cdqBlobEmbarque_(cle,nom))};
}