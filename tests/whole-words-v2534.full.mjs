// Extend the existing real-interface fixture without weakening its assertions.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
assert(fs.readFileSync('tests/safe-area-v2532.browser.mjs','utf8').includes('cdqWholeWordsV2534'),'Safe-area fixture includes the actual new layout dependency');
const path='tests/personal-sizing-full.fragment.txt',original=fs.readFileSync(path,'utf8');
const extra=String.raw`
  const wordBounds=()=>{
    const errors=[];
    for(const el of document.querySelectorAll('.quick-name,#cdqTopActionsV2204>.cdq-top-action>span:last-child,.bottom-nav-item>small')){
      const b=el.parentElement.getBoundingClientRect();if(!b.width||!b.height)continue;
      const lines=el.querySelectorAll(':scope>.cdq-word-line');if(!lines.length){errors.push([el.textContent,'unprotected']);continue;}
      for(const line of lines){const range=document.createRange();range.selectNodeContents(line);const r=range.getBoundingClientRect();
        if([...range.getClientRects()].filter(r=>r.width>0).length>1)errors.push([line.textContent,'split']);
        if(r.left<b.left-1||r.right>b.right+1||r.top<b.top-1||r.bottom>b.bottom+1)errors.push([line.textContent,'outside']);range.detach();
      }
    }
    return errors;
  };
  for(const values of [[50,50,100],[100,100,100],[50,50,50]]){
    await selector.evaluate(values=>{
      cdqOpenSettingsV2294();
      ['General','Text','Icon'].forEach((axis,i)=>{const input=document.getElementById('cdq'+axis+'ScaleRange');input.value=String(values[i]);for(const t of ['input','change','pointerup'])input.dispatchEvent(new Event(t,{bubbles:true}));});
    },values);
    await selector.click('#cdqSettingsCloseV2294');await new Promise(r=>setTimeout(r,600));
    assert.deepEqual(await selector.evaluate(wordBounds),[],'Actual interface: whole words inside tiles at '+values);
    assert.deepEqual(await selector.evaluate(()=>['General','Text','Icon'].map(a=>localStorage.getItem('cdqUi'+a+'ScaleV89'))),['50','71','100']);
  }
  await new Promise(r=>setTimeout(r,1300));
  assert.equal(calls.filter(n=>n==='rpc:enregistrerPreferencesUtilisateurCDQV72').length,writesBefore,'Word fitting must never write shared preferences');
  assert.deepEqual(await selector.evaluate(measured),originalSize,'Return to personal midpoint keeps its calibrated geometry');
  console.log('PASS: actual full interface, real icon markup, enlarged personal sliders, complete words, no shared-preference writes, midpoint retained.');
`;
try{fs.writeFileSync(path,original+'\n'+extra);execFileSync(process.execPath,['scripts/test-personal-full-v2533.mjs'],{stdio:'inherit'});}finally{fs.writeFileSync(path,original);}
