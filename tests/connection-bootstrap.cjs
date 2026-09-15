'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {harness,script}=require('./biometric-startup.cjs');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const boot=fs.readFileSync(path.join(__dirname,'../firebase-config.js'),'utf8');
function start({token,returning=false}={}){
  const h=harness(),session=new Map(),events={},opened=[];
  h.c.self=h.win;h.c.navigator.onLine=true;
  h.c.sessionStorage={getItem:k=>session.get(k)||null,setItem:(k,v)=>session.set(k,v),removeItem:k=>session.delete(k)};
  h.win.location.href='https://jprodrigue86.github.io/Rapports--talonnages-CDQ/'+(returning?'?cdq_connected=1':'');
  h.win.location.replace=url=>h.redirect=url;h.win.location.assign=url=>h.redirect=url;
  h.win.history={replaceState:(a,b,url)=>h.win.location.href=url};
  h.win.open=url=>{opened.push(url);return {closed:false,focus(){},close(){},location:{href:url}};};
  h.document.readyState='loading';h.document.addEventListener=(name,fn)=>events[name]=fn;
  if(token)h.stored.set('cdq_auth_device_token_v2',token);
  vm.runInContext(boot,h.c);vm.runInContext(script(html)[0],h.c);
  h.document.readyState='complete';events.DOMContentLoaded?.();
  h.opened=opened;return h;
}
let count=0;
function test(name,fn){fn();count++;console.log('OK',name);}
test('Première ouverture complète : choix Google immédiat en navigation principale',()=>{
  const h=start();assert.equal(new URL(h.redirect).origin,'https://accounts.google.com');
  assert.equal(new URL(h.redirect).pathname,'/AccountChooser');assert(!h.el('app').src);
});
test('Appareil activé : bootstrap préserve le bouton de reprise du nouveau lanceur',()=>{
  const h=start({token:'test-token'});assert(!h.redirect);assert(!h.el('google-connect').dataset.cdqAccountChooserFix);
  h.el('google-connect').listeners.click();assert.equal(h.opened.length,1);assert.equal(h.el('app').src,'about:blank');
  assert.equal(h.stored.get('cdq_auth_device_token_v2'),'test-token');
});
test('Retour Google complet : échec intégré puis accès direct, sans interception ancienne',()=>{
  const h=start({returning:true});assert(!h.redirect);assert(h.el('app').src);
  h.run(45000);h.el('google-connect').listeners.click();assert.equal(h.opened.length,1);
  const next=new URL(new URL(h.opened[0]).searchParams.get('continue'));
  assert(!next.searchParams.has('cdq_connect'));assert(!h.stored.get('cdq_auth_device_token_v2'));
});
test('Configuration Firebase importable dans le service worker sans DOM',()=>{
  const c=vm.createContext({self:{}});vm.runInContext(boot,c);
  assert(c.self.CDQ_FIREBASE_CONFIG);assert.equal(c.self.CDQ_FIREBASE_VAPID_KEY,'');
});
console.log(count+' tests d’intégration du démarrage réussis.');
