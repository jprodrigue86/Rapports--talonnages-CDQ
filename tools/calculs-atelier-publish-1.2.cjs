// One-shot publisher. No app sources, local user data or private signing key.
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo='jprodrigue86/Rapports--talonnages-CDQ';
const prefix='downloads/calculs-atelier/';
const publicKey='MIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEAxdKXiDcNbbt1SKsNql+JTU2i2QI0bArhBOhuujjsYfI9RlJKJBg4iHdv4WUT5xSefEzaIl4Bm5sYXZg2DAj6FivcGeN9jRidC61avTEkG5xPFfQ8ZU/OUwMt+teEPKdLGx6Ir1eVCiX3K6y7dgug5APMHxb2KHI39w8GKoMTM738Gx4Uk4QoKX3NqvyeWv5/CogTQKAkw+zlpgX2UeKaYYQgdrInggfyD7FzQGupBpqzu9SFZmXJ73lxJtDwnsktpfh5TpYftzimgRjkMOLwHjhFC15y63SwxBopEUUVAywIALneECG/b3Du/a1Y4tzyFb3h5F/XFPw7dwiOaencppJ/G4wckMIeLf8MTo0L5gzPdEKGtRNjyywuAheUde3fEf67BBns/uCyuuxRDWsJDzyuWjBsG01yexsHqaN7Bd7g0O7CQSmf7FL4KnLo1U3rtx7nfqCr+jzPw68pze7g2fqEbxrD4wZObwrR0fx2iW+o8FJCUETVjARoUxAQ1fIXAgMBAAE=';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function api(route,method='GET',body){const r=await fetch('https://api.github.com/repos/'+repo+'/'+route,{method,headers:{Authorization:'Bearer '+process.env.GH_TOKEN,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(60000)});if(!r.ok){const e=new Error('GitHub '+r.status+' '+route+': '+(await r.text()).slice(0,1000));e.status=r.status;throw e;}return r.json();}
(async()=>{
 const bytes=fs.readFileSync(process.argv[2]);assert.equal(hash(bytes),'e49a3ab13d3337570935fbb44453d245fcc6ef4386ecc3f86a4f3e3a7b3108e3');
 const env=JSON.parse(bytes),raw=Buffer.from(env.payload,'base64');
 assert(crypto.verify('RSA-SHA256',raw,{key:Buffer.from(publicKey,'base64'),format:'der',type:'spki',padding:crypto.constants.RSA_PKCS1_PADDING},Buffer.from(env.signature,'base64')),'Invalid signature');
 const p=JSON.parse(raw),html=Buffer.from(p.html,'base64');
 assert.equal(p.appId,'com.atelier.calculs');assert.equal(p.schema,1);assert.equal(p.version,'1.2.0');assert.equal(p.versionCode,12000);assert.equal(p.minShellVersion,11000);assert.equal(hash(html),p.sha256);assert(html.length>600000);
 for(const marker of ['Historique','Envoyé','ADH','Surplus / manque','Thèmes'])assert(html.toString('utf8').includes(marker),marker);
 const info={app:'Calculs d’atelier',version:p.version,versionCode:p.versionCode,minShellVersion:p.minShellVersion,releasedAt:p.releasedAt,channel:'latest.atelier-update.json',packageSha256:hash(bytes),htmlSha256:p.sha256,packageBytes:bytes.length,htmlBytes:html.length,notes:p.notes,verification:{signature:'RSA-SHA256 validée avec la clé historique',calculationAndStorageGroups:35,arithmeticCombinations:10000,chromiumSimulatedStorageGroups:16,updaterGroups:24,physicalDeviceTest:false},privacy:'Contenu applicatif compilé et référentiel embarqué uniquement. Aucune saisie utilisateur, aucun historique local, aucune clé privée.'};
 let previous;try{previous=await api('contents/'+prefix+'release-info.json?ref=main');}catch(e){if(e.status!==404)throw e;}
 if(previous){const old=JSON.parse(Buffer.from(previous.content,'base64'));assert(old.versionCode<=12000,'A newer release already exists');if(old.versionCode===12000)assert.equal(old.packageSha256,hash(bytes),'Different 1.2 package already published');}
 const blob=await api('git/blobs','POST',{content:bytes.toString('base64'),encoding:'base64'});
 for(let attempt=0;attempt<3;attempt++){
  const ref=await api('git/ref/heads/main'),base=await api('git/commits/'+ref.object.sha);
  const tree=await api('git/trees','POST',{base_tree:base.tree.sha,tree:[...['latest.atelier-update.json','android-update.json','versions/1.2.0.atelier-update.json'].map(name=>({path:prefix+name,mode:'100644',type:'blob',sha:blob.sha})),{path:prefix+'release-info.json',mode:'100644',type:'blob',content:JSON.stringify(info,null,2)+'\n'}]});
  const commit=await api('git/commits','POST',{message:'Calculs d’atelier 1.2 : runs positifs, historique horodaté et six thèmes',tree:tree.sha,parents:[ref.object.sha]});
  try{await api('git/refs/heads/main','PATCH',{sha:commit.sha,force:false});console.log('Published commit',commit.sha);break;}catch(e){if(attempt===2||![409,422].includes(e.status))throw e;}
 }
 for(const name of ['latest.atelier-update.json','android-update.json']){
   const metadata=await api('contents/'+prefix+name+'?ref=main');assert.equal(metadata.sha,blob.sha);
   const remote=await api('git/blobs/'+metadata.sha);const rb=Buffer.from(remote.content.replace(/\s/g,''),'base64');assert.equal(hash(rb),hash(bytes));
 }
 console.log(JSON.stringify({published:true,version:p.version,bytes:bytes.length,packageSha256:hash(bytes),signature:true,fullApp:true,channelsVerified:2}));
})().catch(e=>{console.error(e);process.exitCode=1;});
