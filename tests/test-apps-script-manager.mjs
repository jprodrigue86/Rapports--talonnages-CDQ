import puppeteer from 'puppeteer-core';
import {spawn} from 'node:child_process';

const chrome = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const server = spawn('python3',['-m','http.server','8080','--bind','127.0.0.1'],{stdio:'inherit'});
const sleep = ms => new Promise(r=>setTimeout(r,ms));
function assert(cond,msg){ if(!cond) throw new Error(msg); }

let browser;
try {
  await sleep(800);
  browser = await puppeteer.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request',req=>{
    if(req.url().startsWith('https://accounts.google.com/')) req.abort();
    else req.continue();
  });
  const client = await page.createCDPSession();

  await page.goto('http://127.0.0.1:8080/apps-script-manager/',{waitUntil:'domcontentloaded',timeout:15000});
  await page.waitForSelector('#connect',{timeout:5000});
  const swReady = await page.evaluate(async()=>{
    if(!('serviceWorker' in navigator)) return false;
    try { await Promise.race([navigator.serviceWorker.ready,new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),7000))]); return true; }
    catch { return false; }
  });
  assert(swReady,'Service worker did not become ready');
  await sleep(800);

  const manifest = await client.send('Page.getAppManifest');
  assert(!manifest.errors?.length,'Manifest errors: '+JSON.stringify(manifest.errors));
  const parsed = JSON.parse(manifest.data || '{}');
  const icons = (parsed.icons||[]).map(i=>i.src);
  assert(icons.some(x=>x.includes('icon-192.png')),'Manifest missing 192 PNG icon');
  assert(icons.some(x=>x.includes('icon-512.png')),'Manifest missing 512 PNG icon');

  const installErrors = await client.send('Page.getInstallabilityErrors');
  assert((installErrors.installabilityErrors||[]).length===0,'Chrome installability errors: '+JSON.stringify(installErrors.installabilityErrors));

  const dims = await page.evaluate(async()=>{
    async function dim(src){ const r=await fetch(src); if(!r.ok) throw new Error(src+' HTTP '+r.status); const b=await r.blob(); const bm=await createImageBitmap(b); return [bm.width,bm.height]; }
    return {i192:await dim('icon-192.png'), i512:await dim('icon-512.png')};
  });
  assert(dims.i192[0]===192 && dims.i192[1]===192,'192 icon dimensions invalid');
  assert(dims.i512[0]===512 && dims.i512[1]===512,'512 icon dimensions invalid');

  await page.evaluate(()=>{
    window.google={accounts:{oauth2:{initTokenClient(opts){return{requestAccessToken(){setTimeout(()=>opts.callback({access_token:'TEST_TOKEN'}),10)}}}}}};
  });
  await page.click('#connect');
  await page.waitForFunction(()=>document.querySelector('#authBadge')?.textContent.includes('connecté'),{timeout:5000});

  await page.evaluate(()=>{
    document.querySelector('#scriptId').value='TEST_SCRIPT_ID';
    document.querySelector('#codeEditor').value='function test(){ return 1; }';
    document.querySelector('#selectorEditor').value='<div>test</div>';
    const realFetch=window.fetch.bind(window);
    window.fetch=async (url,opts={})=>{
      const s=String(url);
      if(!s.startsWith('https://script.googleapis.com/v1')) return realFetch(url,opts);
      const ok=data=>new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
      if(s.endsWith('/content') && (!opts.method || opts.method==='GET')) return ok({files:[
        {name:'Code',type:'SERVER_JS',source:'old'},
        {name:'Selecteur',type:'HTML',source:'old'},
        {name:'appsscript',type:'JSON',source:'{}'}
      ]});
      if(s.endsWith('/content') && opts.method==='PUT') return ok(JSON.parse(opts.body));
      if(s.endsWith('/deployments') && (!opts.method || opts.method==='GET')) return ok({deployments:[{deploymentId:'dep1',deploymentConfig:{versionNumber:1,description:'Production'}}]});
      if(s.endsWith('/versions') && opts.method==='POST') return ok({scriptId:'TEST_SCRIPT_ID',versionNumber:99,description:'test'});
      if(s.includes('/deployments/dep1') && opts.method==='PUT') return ok({deploymentId:'dep1',deploymentConfig:{versionNumber:99,description:'test'}});
      return new Response(JSON.stringify({error:{message:'Unexpected mocked request '+s+' '+(opts.method||'GET')}}),{status:500,headers:{'Content-Type':'application/json'}});
    };
  });

  await page.click('#loadProject');
  await page.waitForFunction(()=>document.querySelector('#deployment')?.options.length>1,{timeout:5000});
  await page.select('#deployment','dep1');
  await page.click('#oneClick');
  await page.waitForFunction(()=>document.querySelector('#status')?.textContent.includes('TERMINÉ'),{timeout:7000});
  const status = await page.$eval('#status',el=>el.textContent);
  assert(status.includes('Version 99'),'Deployment flow did not finish on version 99: '+status);
  const backup = await page.evaluate(()=>localStorage.getItem('cdq_backup'));
  assert(!!backup,'Automatic backup was not created');

  console.log('PASS: manifest valid');
  console.log('PASS: Chrome reports zero installability errors');
  console.log('PASS: service worker ready');
  console.log('PASS: PNG icons 192x192 and 512x512 decode correctly');
  console.log('PASS: Google OAuth button callback path works');
  console.log('PASS: read -> backup -> replace -> version -> deploy flow works');
} finally {
  if(browser) await browser.close();
  server.kill('SIGTERM');
}
