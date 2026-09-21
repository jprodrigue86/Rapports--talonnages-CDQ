// Modèle Balance de plancher intégré à l'application - V22.91.
// Les octets intégrés correspondent au PDF approuvé dans _CDQ_SYSTEME / Templates.
const CDQ_MODELES_EMBARQUES_ = Object.freeze({
  plancher:{
    nom:'Balance de plancher.pdf',
    id:'cdq-app-plancher-v2291-d1c2c572f2041e813502',
    taille:7878619,
    sha256:'d1c2c572f2041e813502c9f5b16034bdfdf51aa58c152d7c0ea6188e3e50ccac',
    modifieLe:1789953637747,
    chunkSize:645120,
    assets:[
      'CDQ_Model_plancher_v2291_0',
      'CDQ_Model_plancher_v2291_1',
      'CDQ_Model_plancher_v2291_2',
      'CDQ_Model_plancher_v2291_3',
      'CDQ_Model_plancher_v2291_4',
      'CDQ_Model_plancher_v2291_5',
      'CDQ_Model_plancher_v2291_6',
      'CDQ_Model_plancher_v2291_7',
      'CDQ_Model_plancher_v2291_8',
      'CDQ_Model_plancher_v2291_9',
      'CDQ_Model_plancher_v2291_10',
      'CDQ_Model_plancher_v2291_11',
      'CDQ_Model_plancher_v2291_12'
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
