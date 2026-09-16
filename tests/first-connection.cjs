'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {harness,script}=require('./biometric-startup.cjs');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function app({token,googleHint,returning=false,offline=false,popupBlocked=false}={}) {
  const h=harness(),opened=[],popups=[],session=new Map();
  h.c.sessionStorage={getItem:k=>session.get(k)||null,setItem:(k,v)=>session.set(k,v),removeItem:k=>session.delete(k)};
  h.win.location.href='https://jprodrigue86.github.io/Rapports--talonnages-CDQ/'+(returning?'?cdq_connected=1':'');
  h.win.location.assign=url=>h.assigned=url;h.win.location.replace=url=>h.assigned=url;
  h.win.history={replaceState:(a,b,url)=>{h.win.location.href=url;}};
  h.win.focus=()=>{h.focused=true;};h.c.navigator.onLine=!offline;
  if(token)h.stored.set('cdq_auth_device_token_v2',token);
  if(googleHint)h.stored.set('cdq_google_connected_v1','1');
  h.win.open=(url,name)=>{
    opened.push({url,name});
    const popup={closed:false,location:{href:url},focus(){this.focused=true;},close(){this.closed=true;}};
    popup.top=popup;popups.push(popup);return popupBlocked?null:popup;
  };
  vm.runInContext(script(html)[0],h.c);
  const source={parent:h.el('app').contentWindow,postMessage:(d,o)=>h.sent.push({d,o})};
  let peer=null;
  const state=()=>new URL(new URL(opened.at(-1).url).searchParams.get('continue')).searchParams.get('cdq_state');
  const peerSource=()=>peer||(peer={top:popups.at(-1),postMessage:(d,o)=>h.sent.push({d,o,popup:true})});
  const send=(data,override={})=>h.fire('message',{source:peerSource(),origin:'https://test-script.googleusercontent.com',data:{...data,protocol:41,state:state()},...override});
  return {...h,session,popups,opened,source,state,send,get popup(){return popups.at(-1);},get assigned(){return h.assigned;},
    connect:()=>{const before=popups.length;h.el('google-connect').listeners.click();if(popups.length!==before)peer=null;},retry:()=>h.el('load-retry').listeners.click(),
    returned:()=>send({type:'CDQ_GOOGLE_CONNECTED'}),
    ready:()=>h.fire('message',{source,origin:'https://test-script.googleusercontent.com',data:{type:'CDQ_SELECTOR_READY',authProtocol:24,accessState:'input'}})};
}
let n=0;function test(name,fn){fn();n++;console.log('OK',name);}
test('Premier démarrage : un seul bouton Google, aucune navigation automatique',()=>{
 const h=app();assert.equal(h.el('load-help').style.display,'flex');assert(!h.el('app').src);assert(h.el('load-retry').hidden);assert(h.el('open-direct').hidden);assert.equal(h.opened.length,0);
});
test('Choix du compte avec état aléatoire, sans NIP, courriel, clé ni jeton appareil dans URL',()=>{
 const h=app();h.connect();const url=new URL(h.opened[0].url),next=new URL(url.searchParams.get('continue'));
 assert.equal(url.origin,'https://accounts.google.com');assert.equal(url.pathname,'/AccountChooser');assert.equal(next.searchParams.get('cdq_connect'),'1');assert.match(h.state(),/^[0-9a-f]{48}$/);
 for(const key of next.searchParams.keys())assert(!/token|nip|pin|email/i.test(key));
});
test('Double clic : la même fenêtre, pas de seconde connexion Google',()=>{
 const h=app();h.connect();h.connect();assert.equal(h.opened.length,1);assert(h.popup.focused);assert(!h.popup.closed);
});
test('Retour automatique sans bouton Continuer dans CDQ, aucun accès accordé au retour',()=>{
 const h=app();h.connect();h.returned();assert(h.el('app').src.includes('cdq_deploy=272'));assert(h.sent.some(x=>x.d.type==='CDQ_LOGIN_WAIT'));assert(!h.stored.get('cdq_auth_device_token_v2'));assert(!h.popup.closed);
});
test('Origine, fenêtre et état incorrects : aucun chargement ou transfert de jeton',()=>{
 const h=app({token:'existing-token'});h.connect();const before=h.sent.length;
 h.send({type:'CDQ_GOOGLE_CONNECTED'},{origin:'https://script.google.com.evil.invalid'});
 h.send({type:'CDQ_GOOGLE_CONNECTED'},{source:{top:{}}});
 h.send({type:'CDQ_GOOGLE_CONNECTED'},{data:{type:'CDQ_GOOGLE_CONNECTED',protocol:41,state:'0'.repeat(48)}});
 assert.equal(h.el('app').src,'about:blank');assert.equal(h.sent.length,before);
});
test('Le vrai Selector se charge : fermeture automatique de la fenêtre Google',()=>{
 const h=app();h.connect();h.returned();h.ready();assert(h.popup.closed);assert(h.sent.some(x=>x.d.type==='CDQ_LOGIN_FINISH'));h.run(1300);assert.equal(h.el('app').style.visibility,'visible');
});
test('Retour dupliqué : le compteur de chargement reste stable',()=>{
 const h=app();h.connect();h.returned();const generation=vm.runInContext('loadGeneration',h.c);h.returned();assert.equal(vm.runInContext('loadGeneration',h.c),generation);
});
test('Iframe bloqué : une seule sonde puis démarrage du même Selector dans Google',()=>{
 const h=app();h.connect();h.returned();const url=h.popup.location.href;h.run(10000);
 assert(h.sent.some(x=>x.d.type==='CDQ_LOGIN_DIRECT'));assert.equal(h.popup.location.href,url);assert.equal(h.el('app').src,'about:blank');assert(!h.popup.closed);assert(h.popup.focused);
});
test('Iframe abandonné tardif : ne ferme jamais le CDQ de secours',()=>{
 const h=app();h.connect();h.returned();h.run(10000);h.ready();h.run(1300);assert(!h.popup.closed);assert.equal(h.el('app').style.visibility,'hidden');
});
test('Repli direct : Ouvrir CDQ retrouve la même fenêtre sans relancer Google',()=>{
 const h=app();h.connect();h.returned();h.run(10000);h.connect();h.retry();assert.equal(h.opened.length,1);assert(!h.popup.closed);
});
test('Le jeton appareil direct est conservé dans la PWA pour la prochaine ouverture',()=>{
 const h=app();h.connect();h.returned();h.run(10000);h.send({type:'CDQ_AUTH_TOKEN_STORE',token:'registered-test-device'});
 assert.equal(h.stored.get('cdq_auth_device_token_v2'),'registered-test-device');h.send({type:'CDQ_AUTH_TOKEN_REQUEST'});assert.equal(h.sent.at(-1).d.token,'registered-test-device');
});
test('Un message direct trop tôt ne peut ni lire ni écraser le jeton',()=>{
 const h=app({token:'preserved'});h.connect();h.returned();const count=h.sent.length;h.send({type:'CDQ_AUTH_TOKEN_STORE',token:'wrong'});h.send({type:'CDQ_AUTH_TOKEN_REQUEST'});assert.equal(h.stored.get('cdq_auth_device_token_v2'),'preserved');assert.equal(h.sent.length,count);
});
test('Une fenêtre ou un état étranger ne peut pas lire le jeton de secours',()=>{
 const h=app({token:'preserved'});h.connect();h.returned();h.run(10000);const count=h.sent.length;
 h.send({type:'CDQ_AUTH_TOKEN_REQUEST'},{source:{top:h.popup}});h.send({type:'CDQ_AUTH_TOKEN_REQUEST'},{data:{type:'CDQ_AUTH_TOKEN_REQUEST',protocol:41,state:'wrong'}});assert.equal(h.sent.length,count);
});
test('Activation intermédiaire : session uniquement, sans stocker le NIP ou la clé',()=>{
 const h=app();h.connect();h.returned();h.run(10000);
 h.send({type:'CDQ_ACTIVATION_STORE',pending:{token:'temporary-ticket',email:'tech@example.invalid',expiresAt:Date.now()+120000,pin:'1234',code:'123456'}});
 const saved=JSON.parse(h.session.get('cdq_activation_pending_v41'));assert.deepEqual(Object.keys(saved).sort(),['email','expiresAt','token']);assert(!h.stored.has('cdq_activation_pending_v41'));
 h.send({type:'CDQ_AUTH_TOKEN_REQUEST'});assert.equal(h.sent.at(-1).d.pendingActivation.token,'temporary-ticket');
 h.send({type:'CDQ_ACTIVATION_STORE',pending:null});assert(!h.session.has('cdq_activation_pending_v41'));
});
test('Une activation expirée n’est jamais réimportée',()=>{
 const h=app();h.connect();h.returned();h.run(10000);h.session.set('cdq_activation_pending_v41',JSON.stringify({token:'expired',expiresAt:Date.now()-10}));h.send({type:'CDQ_AUTH_TOKEN_REQUEST'});assert.equal(h.sent.at(-1).d.pendingActivation,null);
});
test('Appareil activé : démarre sans nouvelle clé ni sélection automatique du compte',()=>{
 const h=app({token:'existing'});assert(h.el('app').src);assert.equal(h.opened.length,0);h.stored.set('cdq_biometric_credentials_v1','saved');h.run(45000);assert.equal(h.stored.get('cdq_auth_device_token_v2'),'existing');assert.equal(h.stored.get('cdq_biometric_credentials_v1'),'saved');
});
test('Fenêtre bloquée : la même destination en premier plan, pas de boucle de retour',()=>{const h=app({popupBlocked:true});h.connect();assert.equal(h.assigned,h.opened[0].url);});
test('Annulation : aucune nouvelle activation inventée',()=>{const h=app();h.connect();h.popup.close();h.retry();assert.match(h.el('load-message').textContent,/fermée/);assert(!h.stored.get('cdq_auth_device_token_v2'));});
test('Compatibilité pendant installation : ancien retour Google encore accepté depuis sa seule fenêtre',()=>{
 const h=app();h.connect();h.send({type:'CDQ_GOOGLE_CONNECTED'},{data:{type:'CDQ_GOOGLE_CONNECTED'}});assert(h.el('app').src.includes('cdq_deploy=272'));h.ready();assert(h.popup.closed);
});
test('Retour historique nettoyé, sans autorisation par paramètre',()=>{const h=app({returning:true});assert(h.el('app').src);assert(!h.win.location.href.includes('cdq_connected'));assert(!h.stored.get('cdq_auth_device_token_v2'));});
test('Hors ligne : aucune navigation Google ni suppression des données',()=>{
 const h=app({offline:true,token:'preserved'});h.retry();h.connect();assert.equal(h.opened.length,0);assert.equal(h.stored.get('cdq_auth_device_token_v2'),'preserved');assert(!h.el('app').src);
});
test('Identité, icône et fond noir conservés',()=>{const m=JSON.parse(fs.readFileSync(path.join(__dirname,'../manifest.webmanifest'),'utf8'));assert.equal(m.background_color,'#000000');assert.equal(m.theme_color,'#000000');assert.equal(m.start_url,'./');});
console.log(n+' tests de première connexion V21.41 réussis.');
module.exports={app};
