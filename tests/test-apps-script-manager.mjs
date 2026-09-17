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
  page.on('pageerror',e=>console.error('PAGEERROR:',e.message));
  page.on('console',m=>console.log('BROWSER:',m.type(),m.text()));
  await page.setRequestInterception(true);
  page.on('request',req=>{
    if(req.url().startsWith('https://accounts.google.com/')) req.abort();
    else req.continue();
  });
  const client = await page.createCDPSession();

  await page.goto('http://127.0.0.1:8080/apps-script-manager/',{waitUntil:'domcontentloaded',timeout:15000});
  await page.waitForSelector('#connect',{timeout:5000});

  const manifest = await client.send('Page.getAppManifest');
  assert(!manifest.errors?.length,'Manifest errors: '+JSON.stringify(manifest.errors));
  const parsed = JSON.parse(manifest.data || '{}');
  const icons = (parsed.icons||[]).map(i=>i.src);
  assert(icons.some(x=>x.includes('icon-192.png')),'Manifest missing 192 PNG icon');
  assert(icons.some(x=>x.includes('icon-512.png')),'Manifest missing 512 PNG icon');

  const dims = await page.evaluate(async()=>{
    async function dim(src){ const r=await fetch(src); if(!r.ok) throw new Error(src+' HTTP '+r.status); const b=await r.blob(); const bm=await createImageBitmap(b); return [bm.width,bm.height]; }
    return {i192:await dim('icon-192.png'), i512:await dim('icon-512.png')};
  });
  assert(dims.i192[0]===192 && dims.i192[1]===192,'192 icon dimensions invalid');
  assert(dims.i512[0]===512 && dims.i512[1]===512,'512 icon dimensions invalid');

  await page.evaluate(()=>{
    window.__mockFetchLog=[];
    window.__mockServerFiles=[
      {name:'Code',type:'SERVER_JS',source:'function oldCode(){ return 0; }'},
      {name:'Selecteur',type:'HTML',source:'<div>ancien</div>'},
      {name:'appsscript',type:'JSON',source:'{"timeZone":"America/Toronto"}'}
    ];
    window.google={accounts:{oauth2:{
      initTokenClient(opts){
        const tokenClient={
          callback:opts.callback,
          error_callback:opts.error_callback,
          requestAccessToken(){setTimeout(()=>tokenClient.callback({access_token:'TEST_TOKEN',expires_in:3600}),10)}
        };
        return tokenClient;
      },
      revoke(token,cb){ if(cb) cb(); }
    }}};
    const realFetch=window.fetch.bind(window);
    window.fetch=async (url,opts={})=>{
      const s=String(url),method=opts.method||'GET';
      window.__mockFetchLog.push(method+' '+s);
      const ok=data=>new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
      if(s.startsWith('https://www.googleapis.com/drive/v3/files')) return ok({files:[{id:'TEST_SCRIPT_ID',name:'Projet Test CDQ',modifiedTime:'2026-09-17T16:00:00Z',webViewLink:'https://script.google.com/'}]});
      if(!s.startsWith('https://script.googleapis.com/v1')) return realFetch(url,opts);
      if(s.endsWith('/projects/TEST_SCRIPT_ID') && method==='GET') return ok({scriptId:'TEST_SCRIPT_ID',title:'Projet Test CDQ'});
      if(s.endsWith('/projects/TEST_SCRIPT_ID/content') && method==='GET') return ok({scriptId:'TEST_SCRIPT_ID',files:JSON.parse(JSON.stringify(window.__mockServerFiles))});
      if(s.endsWith('/projects/TEST_SCRIPT_ID/content') && method==='PUT'){
        const body=JSON.parse(opts.body||'{}');
        window.__mockServerFiles=JSON.parse(JSON.stringify(body.files||[]));
        return ok({scriptId:'TEST_SCRIPT_ID',files:window.__mockServerFiles});
      }
      if(s.endsWith('/projects/TEST_SCRIPT_ID/deployments') && method==='GET') return ok({deployments:[{deploymentId:'dep1',deploymentConfig:{versionNumber:1,description:'Production'}}]});
      if(s.endsWith('/projects/TEST_SCRIPT_ID/versions') && method==='POST') return ok({scriptId:'TEST_SCRIPT_ID',versionNumber:99,description:'test'});
      if(s.includes('/projects/TEST_SCRIPT_ID/deployments/dep1') && method==='PUT') return ok({deploymentId:'dep1',deploymentConfig:{versionNumber:99,description:'test'}});
      return new Response(JSON.stringify({error:{message:'Unexpected mocked request '+s+' '+method}}),{status:500,headers:{'Content-Type':'application/json'}});
    };
  });

  await page.waitForFunction(()=>!document.querySelector('#connect')?.disabled,{timeout:8000});
  await page.click('#connect');
  await page.waitForFunction(()=>document.querySelector('#authBadge')?.textContent.includes('connecté'),{timeout:5000});
  await sleep(500);
  const afterAuth = await page.evaluate(()=>({
    topStatus:document.querySelector('#topStatus')?.textContent,
    auth:document.querySelector('#authBadge')?.textContent,
    options:document.querySelector('#projectSelect')?.options.length,
    html:document.querySelector('#projectSelect')?.innerHTML,
    fetchLog:window.__mockFetchLog
  }));
  console.log('STATE_AFTER_AUTH',JSON.stringify(afterAuth));
  await page.waitForFunction(()=>document.querySelector('#projectSelect')?.options.length>1,{timeout:5000});
  await page.select('#projectSelect','TEST_SCRIPT_ID');
  await page.click('#loadProject');
  await page.waitForFunction(()=>document.querySelector('#projectBadge')?.textContent.includes('Projet Test CDQ'),{timeout:5000});
  await page.waitForFunction(()=>document.querySelector('#deployment')?.options.length>1,{timeout:5000});

  const packageText=`=== FILE: Code.gs ===\nfunction test(){ return 1; }\n\n=== FILE: Selecteur.html ===\n<div>nouveau sélecteur</div>`;
  await page.$eval('#packageEditor',(el,text)=>{el.value=text;el.dispatchEvent(new Event('input',{bubbles:true}))},packageText);
  await page.click('#parsePackage');
  await page.waitForFunction(()=>document.querySelector('#changeBadge')?.textContent.includes('2'),{timeout:3000});
  await page.click('#validateChanges');
  await page.waitForFunction(()=>document.querySelector('#status')?.textContent.includes('Vérification réussie'),{timeout:3000});

  await page.select('#deployment','dep1');
  await page.click('#writeAndDeploy');
  await page.waitForFunction(()=>document.querySelector('#status')?.textContent.includes('Version 99') && document.querySelector('#status')?.textContent.includes('déployée'),{timeout:7000});

  const result = await page.evaluate(()=>({
    status:document.querySelector('#status')?.textContent,
    backup:localStorage.getItem('cdqsm_backups'),
    files:window.__mockServerFiles
  }));
  assert(result.status.includes('Version 99'),'Deployment flow did not finish on version 99: '+result.status);
  assert(!!result.backup,'Automatic backup was not created');
  const backup=JSON.parse(result.backup);
  assert(Array.isArray(backup) && backup.length>0,'Backup history is empty');
  const code=result.files.find(f=>f.type==='SERVER_JS'&&f.name==='Code');
  const selector=result.files.find(f=>f.type==='HTML'&&f.name==='Selecteur');
  const manifestFile=result.files.find(f=>f.type==='JSON'&&f.name==='appsscript');
  assert(code?.source==='function test(){ return 1; }','Code.gs was not replaced');
  assert(selector?.source==='<div>nouveau sélecteur</div>','Selecteur.html was not replaced');
  assert(!!manifestFile,'appsscript.json was not preserved');

  console.log('PASS: manager page loaded in Chrome');
  console.log('PASS: manifest and PNG icons valid');
  console.log('PASS: Google OAuth callback path works');
  console.log('PASS: Drive project listing works');
  console.log('PASS: package -> backup -> write -> readback verification -> deploy works');
  console.log('PASS: appsscript.json is preserved');
} finally {
  if(browser) await browser.close();
  server.kill('SIGTERM');
}
