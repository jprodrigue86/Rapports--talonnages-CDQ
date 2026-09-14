const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const script=html=>[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m=>! /\bsrc=/.test(m[1])).map(m=>m[2]);
const tick=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function harness(){
  const els=new Map(),listeners={},timers=new Map(),sent=[],stored=new Map();let n=0;
  function el(id){if(!els.has(id))els.set(id,{id,style:{},dataset:{},value:'',textContent:'',listeners:{},disabled:false,focus(){},addEventListener(k,f){this.listeners[k]=f;},classList:{add(){},remove(){},toggle(){},contains(){return true;}}});return els.get(id);}
  const win={location:{ancestorOrigins:[],reload(){}},addEventListener(k,f){(listeners[k]??=[]).push(f);},dispatchEvent(){}};win.parent=win;win.top=win;
  const document={getElementById:el,documentElement:el('html'),addEventListener(){},head:{appendChild(){}},scripts:[],createElement:()=>el('new'+n++)};
  const pub={isUserVerifyingPlatformAuthenticatorAvailable:async()=>true};win.PublicKeyCredential=pub;
  const c=vm.createContext({window:win,document,PublicKeyCredential:pub,navigator:{credentials:{}},performance:{now:()=>0},Event:class {constructor(type){this.type=type;}},URL,Map,Uint8Array,AbortController,crypto:crypto.webcrypto,console,btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary'),localStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v),removeItem:k=>stored.delete(k)},setTimeout(f,ms){timers.set(++n,{f,ms});return n;},clearTimeout(i){timers.delete(i);},setInterval(){},fetch:async()=>({ok:true,json:async()=>({version:'old'})}),Notification:{permission:'default'}});
  el('app').contentWindow={parent:win};
  function fire(k,e){for(const f of listeners[k]||[])f(e);}
  function run(ms){for(const [i,t] of [...timers])if(t.ms===ms){timers.delete(i);t.f();}}
  return {c,el,win,document,sent,stored,fire,run,timers};
}
function pwa(){
  const h=harness();vm.runInContext(script(fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'))[0],h.c);
  const source={parent:h.el('app').contentWindow,postMessage:(d,o)=>h.sent.push({d,o})};
  h.message=data=>h.fire('message',{source,origin:'https://test-script.googleusercontent.com',data});
  h.message({type:'CDQ_SELECTOR_READY',authProtocol:24,accessState:'pending'});
  h.stored.set('cdq_biometric_credentials_v1',JSON.stringify({'test@example.invalid':{id:'AQID'}}));
  h.unlock=(requestId='r1')=>h.message({type:'CDQ_BIOMETRIC_REQUEST',email:'test@example.invalid',requestId});
  return h;
}
const results=[];
async function test(name,fn){await fn();results.push(name);console.log('OK',name);}
async function main(){
  await test('Biométrie directe sans confirmation HTML ni deuxième clic',async()=>{const h=pwa();let gets=0;h.c.navigator.credentials.get=async options=>{gets++;assert.equal(options.publicKey.userVerification,'required');assert.deepEqual([...options.publicKey.allowCredentials[0].transports],['internal']);return {};};h.unlock();await tick();assert.equal(gets,1);assert.equal(h.el('bio-setup').style.display,'none');assert.equal(h.sent.at(-1).d.success,true);assert.equal(h.sent.at(-1).d.requestId,'r1');});
  await test('Aucune inscription biométrique automatique pendant le déverrouillage',async()=>{const h=pwa();h.stored.clear();h.c.navigator.credentials.get=()=>assert.fail('get interdit');h.c.navigator.credentials.create=()=>assert.fail('create interdit');h.unlock();await tick();assert.equal(h.sent.at(-1).d.success,false);assert.equal(h.el('bio-setup').style.display,'none');});
  await test('Téléphone incompatible : échec transmis sans fenêtre intermédiaire',async()=>{const h=pwa();h.c.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable=async()=>false;h.unlock();await tick();assert.equal(h.sent.at(-1).d.success,false);});
  await test('Annulation native : repli demandé immédiatement',async()=>{const h=pwa();h.c.navigator.credentials.get=async()=>{throw Error('NotAllowedError');};h.unlock();await tick();assert.equal(h.sent.at(-1).d.success,false);assert.equal(h.el('bio-setup').style.display,'none');});
  await test('Le chargement reste visible pendant la biométrie et la validation serveur',()=>{const h=pwa();h.run(1300);h.run(15000);assert.equal(h.el('loading').style.display,'grid');h.message({type:'CDQ_ACCESS_STATE',state:'ready'});h.run(1300);assert.equal(h.el('loading').style.display,'none');});
  await test('Le NIP ou l’activation apparaît seulement au signal de saisie',()=>{const h=pwa();h.message({type:'CDQ_ACCESS_STATE',state:'input'});h.run(1300);assert.equal(h.el('loading').style.display,'none');h.run(90000);assert.notEqual(h.el('load-help').style.display,'flex');});
  await test('Demande dupliquée : un seul appel au téléphone',async()=>{const h=pwa(),d=deferred();let gets=0;h.c.navigator.credentials.get=()=>{gets++;return d.promise;};h.unlock();h.unlock();await tick();assert.equal(gets,1);d.resolve({});await tick();});
  await test('Résultat tardif après choix du NIP ignoré',async()=>{const h=pwa(),d=deferred();let signal;h.c.navigator.credentials.get=o=>{signal=o.signal;return d.promise;};h.unlock();await tick();h.message({type:'CDQ_BIOMETRIC_CANCEL',requestId:'r1'});const count=h.sent.length;d.resolve({});await tick();assert(signal.aborted);assert.equal(h.sent.length,count);});
  await test('Une demande remplacée ne termine ni n’annule la nouvelle',async()=>{const h=pwa(),a=deferred(),b=deferred();let count=0,signals=[];h.c.navigator.credentials.get=o=>{signals.push(o.signal);return ++count===1?a.promise:b.promise;};h.unlock('r1');await tick();h.unlock('r2');await tick();a.resolve({});await tick();assert(signals[0].aborted);assert.equal(signals[1].aborted,false);assert(!h.sent.some(x=>x.d.type==='CDQ_BIOMETRIC_RESULT'));b.resolve({});await tick();assert.equal(h.sent.at(-1).d.requestId,'r2');});
  await test('Une annulation ancienne ne ferme pas la demande actuelle',async()=>{const h=pwa(),d=deferred();let signal;h.c.navigator.credentials.get=o=>{signal=o.signal;return d.promise;};h.unlock('r2');await tick();h.message({type:'CDQ_BIOMETRIC_CANCEL',requestId:'r1'});assert.equal(signal.aborted,false);d.resolve({});await tick();assert.equal(h.sent.at(-1).d.success,true);});
  await test('Délai final : affichage du secours sans chargement infini',()=>{const h=pwa();h.run(90000);assert.equal(h.el('loading').style.display,'none');assert.equal(h.el('load-help').style.display,'flex');});
  console.log(results.length+' tests de démarrage biométrique réussis.');
}
module.exports={harness,script,tick,deferred,test};
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
