const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const index=read('index.html');
const scripts=html=>Array.from(html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)).filter(x=>! /\bsrc=/.test(x[1])).map(x=>({attr:x[1],code:x[2]}));
let count=0;const results=[];
async function test(name,fn){await fn();results.push(name);count++;console.log('OK',name);}
const tick=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function domHarness(){
 const timers=new Map(),listeners={},els=new Map(),sent=[],stored=new Map();let seq=0;
 function el(id){if(!els.has(id)){const e={id,style:{},listeners:{},textContent:'',dataset:{},disabled:false,addEventListener(n,f){this.listeners[n]=f;},remove(){},classList:{add(){},remove(){},toggle(){}},appendChild(){}};els.set(id,e);}return els.get(id);}
 const win={listeners,addEventListener(n,f){(listeners[n]??=[]).push(f);},location:{reload(){win.reloads++;},ancestorOrigins:[]},reloads:0};win.parent=win;win.top=win;
 const document={getElementById:el,scripts:[],head:{appendChild(){}},createElement:()=>el('created-'+seq++),addEventListener(){}};
 const c=vm.createContext({window:win,document,navigator:{},performance:{now:()=>0},URL,Map,Uint8Array,AbortController,crypto:crypto.webcrypto,btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary'),console,localStorage:{getItem:k=>stored.has(k)?stored.get(k):null,setItem:(k,v)=>stored.set(k,String(v)),removeItem:k=>stored.delete(k)},setTimeout(f,ms){timers.set(++seq,{f,ms});return seq;},clearTimeout(id){timers.delete(id);},setInterval(){},fetch:async()=>({ok:true,json:async()=>JSON.parse(read('version.json'))}),caches:{keys:async()=>[],delete:async()=>true},Notification:{permission:'default'}});
 const app=el('app');app.contentWindow={parent:win,postMessage:(d,o)=>sent.push({d,o})};
 function fire(n,e){for(const f of listeners[n]||[])f(e);}
 function runTimers(ms){for(const [id,t] of [...timers])if(t.ms===ms){timers.delete(id);t.f();}}
 return {c,win,document,el,app,fire,timers,runTimers,sent,stored};
}
function pwa(){const h=domHarness();vm.runInContext(scripts(index)[0].code,h.c);return h;}
function child(h){return {parent:h.app.contentWindow,postMessage:(d,o)=>h.sent.push({d,o})};}
const origin='https://test-script.googleusercontent.com';
function announce(h,source=child(h)){h.fire('message',{source,origin,data:{type:'CDQ_SELECTOR_READY',build:'old-selector'}});return source;}
async function main(){
 const original=Buffer.from("%PDF-test-form");

 await test('Le chargement Google seul ne signifie pas application prête',()=>{const h=pwa();h.app.listeners.load();h.runTimers(15000);assert.equal(h.el('load-help').style.display,'flex');});
 await test('Le signal du Selector imbriqué termine le chargement',()=>{const h=pwa();announce(h);h.runTimers(1300);h.runTimers(15000);assert.equal(h.el('loading').style.display,'none');assert.equal(h.el('load-help').style.display,'none');});
 await test('Origines étrangères, cadres étrangers et source nulle rejetés',()=>{const h=pwa();for(const e of [{source:child(h),origin:'https://evil.example'},{source:child(h),origin:'https://test-script.googleusercontent.com.evil.example'},{source:{parent:h.win},origin},{source:null,origin}])h.fire('message',{...e,data:{type:'CDQ_SELECTOR_READY'}});h.runTimers(15000);assert.equal(h.el('load-help').style.display,'flex');});
 await test('Biométrie et Push reçus seulement du Selector identifié',()=>{const h=pwa(),source=announce(h);h.fire('message',{source,origin,data:{type:'CDQ_BIOMETRIC_REGISTER',email:'test@example.invalid'}});assert.equal(h.el('bio-setup').style.display,'flex');assert.equal(h.sent.at(-1).o,origin);h.fire('message',{source,origin,data:{type:'CDQ_PUSH_REQUEST'}});assert.equal(h.el('push-setup').style.display,'flex');h.el('push-cancel').listeners.click();assert.equal(h.sent.at(-1).d.type,'CDQ_PUSH_CANCELLED');});
 await test('Le jeton d’appareil reste dans la PWA et revient au Selector',()=>{const h=pwa(),source=announce(h);h.fire('message',{source,origin,data:{type:'CDQ_AUTH_TOKEN_STORE',token:'stable-device-token'}});assert.equal(h.stored.get('cdq_auth_device_token_v2'),'stable-device-token');h.fire('message',{source,origin,data:{type:'CDQ_AUTH_TOKEN_REQUEST'}});assert.equal(h.sent.at(-1).d.type,'CDQ_AUTH_TOKEN_VALUE');assert.equal(h.sent.at(-1).d.token,'stable-device-token');});
 await test('Une nouvelle tentative réarme le délai et annule la fermeture précédente',()=>{const h=pwa();announce(h);h.el('load-retry').listeners.click();h.runTimers(1300);assert.equal(h.el('loading').style.display,'grid');h.runTimers(15000);assert.equal(h.el('load-help').style.display,'flex');});
 await test('Pas de boucle de mise à jour lorsque seul le Selector est ancien',async()=>{const h=pwa(),source=announce(h);h.fire('message',{source,origin,data:{type:'CDQ_CHECK_UPDATE',build:'2026.09.14.1805-v21.21-biometric-fallback'}});await tick();assert.equal(h.sent.at(-1).d.available,false);assert.equal(h.sent.at(-1).d.current,JSON.parse(read('version.json')).version);assert.equal(h.win.reloads,0);});
 await test('Une vraie nouvelle version PWA est détectée',async()=>{const h=pwa(),source=announce(h);h.c.fetch=async()=>({ok:true,json:async()=>({version:'2026.09.16.0000-v21.25'})});h.fire('message',{source,origin,data:{type:'CDQ_CHECK_UPDATE',build:'ancien'}});await tick();assert.equal(h.sent.at(-1).d.available,true);});
 await test('Service worker conserve les caches des autres applications',async()=>{const handlers={},deleted=[],waiting=[];const c=vm.createContext({URL,Response,console,importScripts(){},self:{registration:{scope:'https://jprodrigue86.github.io/Rapports--talonnages-CDQ/'},clients:{claim:async()=>{}},addEventListener:(n,f)=>handlers[n]=f},caches:{keys:async()=>['cdq-installable-old','techbench-cache','cdq-offline-data',read('sw.js').match(/const CACHE = '([^']+)'/)[1]],delete:async k=>deleted.push(k)}});vm.runInContext(read('sw.js'),c);handlers.activate({waitUntil:p=>waiting.push(p)});await Promise.all(waiting);assert.deepEqual(deleted,['cdq-installable-old']);});
 await test('Service worker ignore Google et les requêtes des autres applications',()=>{const handlers={};const c=vm.createContext({URL,Response,console,importScripts(){},self:{registration:{scope:'https://jprodrigue86.github.io/Rapports--talonnages-CDQ/'},addEventListener:(n,f)=>handlers[n]=f}});vm.runInContext(read('sw.js'),c);for(const url of ['https://accounts.google.com/','https://script.google.com/exec','https://jprodrigue86.github.io/TechBench/'])handlers.fetch({request:{url,method:'GET'},respondWith:()=>assert.fail('interception interdite')});assert.equal(c.shellKey(new URL('https://jprodrigue86.github.io/Rapports--talonnages-CDQ/?retry=1')),'https://jprodrigue86.github.io/Rapports--talonnages-CDQ/index.html');});
 await test('Hors connexion: réponse explicite 503 sans cache, jamais undefined',async()=>{const handlers={};let response;const c=vm.createContext({URL,Response,console,importScripts(){},fetch:async()=>{throw Error('offline')},caches:{open:async()=>({match:async()=>undefined})},self:{registration:{scope:'https://jprodrigue86.github.io/Rapports--talonnages-CDQ/'},addEventListener:(n,f)=>handlers[n]=f}});vm.runInContext(read('sw.js'),c);handlers.fetch({request:{url:'https://jprodrigue86.github.io/Rapports--talonnages-CDQ/?retry=1',method:'GET',mode:'navigate'},respondWith:p=>{response=p;}});assert.equal((await response).status,503);});
 console.log(`${count} tests PWA réussis.`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
