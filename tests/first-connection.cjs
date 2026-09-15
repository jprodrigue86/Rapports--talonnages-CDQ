'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {harness,script}=require('./biometric-startup.cjs');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function app({token,googleHint,returning=false,offline=false,popupBlocked=false}={}) {
  const h=harness(),opened=[],popups=[];
  h.win.location.href='https://jprodrigue86.github.io/Rapports--talonnages-CDQ/'+(returning?'?cdq_connected=1':'');
  h.win.location.assign=url=>h.assigned=url;
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
  return {...h,popups,opened,source,get popup(){return popups.at(-1);},get assigned(){return h.assigned;},
    connect:()=>h.el('google-connect').listeners.click(),retry:()=>h.el('load-retry').listeners.click(),
    returned:()=>h.fire('message',{source:{top:popups.at(-1)},origin:'https://test-script.googleusercontent.com',data:{type:'CDQ_GOOGLE_CONNECTED'}}),
    ready:()=>h.fire('message',{source,origin:'https://test-script.googleusercontent.com',data:{type:'CDQ_SELECTOR_READY',authProtocol:24,accessState:'input'}})};
}
let n=0;function test(name,fn){fn();n++;console.log('OK',name);}
test('Premier démarrage : connexion visible, aucun iframe Google automatique',()=>{
  const h=app();assert.equal(h.el('load-help').style.display,'flex');assert.equal(h.el('loading').style.display,'none');
  assert(!h.el('app').src);assert.equal(h.el('app').style.visibility,'hidden');assert(h.el('load-retry').hidden);
  assert.match(h.el('load-message').textContent,/code reçu/);assert(!/<iframe[^>]*\ssrc=/s.test(html));
});
test('Choix explicite du compte Google, sans NIP ni jeton dans les URL',()=>{
  const h=app();h.connect();const url=new URL(h.opened[0].url),next=new URL(url.searchParams.get('continue'));
  assert.equal(url.origin,'https://accounts.google.com');assert.equal(url.pathname,'/AccountChooser');
  assert.equal(next.origin,'https://script.google.com');assert.equal(next.searchParams.get('cdq_connect'),'1');
  for(const u of [url,next])for(const key of u.searchParams.keys())assert(!/token|nip|pin|email/i.test(key));
  assert.equal(h.el('app').src,'about:blank');assert(!h.el('load-retry').hidden);
});
test('Seule la fenêtre Google ouverte peut annoncer son retour',()=>{
  const h=app();h.connect();
  for(const e of [{source:h.popup,origin:'https://evil.invalid'},{source:{top:{}},origin:'https://script.google.com'},{source:null,origin:'https://script.google.com'},
    {source:h.popup,origin:'https://script.google.com.evil.invalid'},{source:h.popup,origin:'https://script.google.com:8443'}])
    h.fire('message',{...e,data:{type:'CDQ_GOOGLE_CONNECTED'}});
  assert.equal(h.el('app').src,'about:blank');assert(!h.stored.get('cdq_google_connected_v1'));
  h.returned();assert.match(h.el('app').src,/cdq_deploy=272/);assert(!h.popup.closed);
  assert.equal(h.el('loading').style.display,'grid');assert(!h.stored.get('cdq_auth_device_token_v2'));
});
test('Retour Google : pas de fermeture prématurée ni de session inventée',()=>{
  const h=app();h.connect();h.returned();assert(!h.popup.closed);assert(!h.stored.get('cdq_google_connected_v1'));
  h.ready();assert(h.popup.closed);assert.equal(h.stored.get('cdq_google_connected_v1'),'1');h.run(1300);assert.equal(h.el('app').style.visibility,'visible');
});
test('Un retour Google dupliqué ne relance pas le chargement',()=>{
  const h=app();h.connect();h.returned();const generation=vm.runInContext('loadGeneration',h.c);h.returned();
  assert.equal(vm.runInContext('loadGeneration',h.c),generation);
});
test('Ancienne fenêtre Google rejetée après une nouvelle tentative',()=>{
  const h=app();h.connect();const old=h.popup;h.connect();assert(old.closed);assert.notEqual(h.opened[0].name,h.opened[1].name);
  h.fire('message',{source:{top:old},origin:'https://script.google.com',data:{type:'CDQ_GOOGLE_CONNECTED'}});
  assert.equal(h.el('app').src,'about:blank');
});
test('Le bouton de retour attend Google au lieu de charger un iframe prématuré',()=>{
  const h=app();h.connect();h.retry();assert(h.popup.focused);assert.equal(h.el('app').src,'about:blank');
});
test('Annulation de la fenêtre Google : retour à la connexion sans autorisation',()=>{
  const h=app();h.connect();h.popup.close();h.retry();assert.match(h.el('load-message').textContent,/fermée/);
  assert.equal(h.el('app').src,'about:blank');assert(!h.stored.get('cdq_auth_device_token_v2'));
});
test('Appareil activé : jeton et biométrie conservés',()=>{
  const h=app({token:'existing-device-token'});h.stored.set('cdq_biometric_credentials_v1','existing-credentials');
  assert(h.el('app').src);assert.equal(h.el('load-help').style.display,'none');assert.equal(h.opened.length,0);
  h.run(45000);assert.equal(h.stored.get('cdq_auth_device_token_v2'),'existing-device-token');
  assert.equal(h.stored.get('cdq_biometric_credentials_v1'),'existing-credentials');
});
test('Retour manuel nettoyé : essai de chargement, jamais une session CDQ',()=>{
  const h=app({returning:true});assert(h.el('app').src);assert(!h.stored.get('cdq_google_connected_v1'));
  assert(!h.win.location.href.includes('cdq_connected'));assert(!h.stored.get('cdq_auth_device_token_v2'));
});
test('Popup bloquée : connexion au premier plan, même destination Google',()=>{
  const h=app({popupBlocked:true});h.connect();assert.equal(h.assigned,h.opened[0].url);
  const next=new URL(new URL(h.assigned).searchParams.get('continue'));assert.equal(next.searchParams.get('cdq_connect'),'1');
});
test('Chargement lent : pas de fausse affirmation de déconnexion',()=>{
  const h=app({googleHint:true});const initial=h.el('app').src;h.run(15000);
  assert.match(h.el('load-title').textContent,/plus long/);assert.equal(h.el('app').src,initial);
  assert(!/interrompue|401|déconnecté/.test(h.el('load-message').textContent));h.ready();h.run(1300);assert.equal(h.el('load-help').style.display,'none');
});
test('Échec intégré : reprise directe conservant le compte Google',()=>{
  const h=app();h.connect();h.returned();h.run(45000);
  const direct=new URL(h.popup.location.href);assert.equal(direct.origin,'https://script.google.com');
  assert(!direct.searchParams.has('cdq_connect'));assert(!h.popup.closed);assert(h.popup.focused);
  assert.equal(h.el('app').src,'about:blank');assert.match(h.el('load-message').textContent,/onglet Google/);
});
test('Réponse tardive de l’iframe abandonné : aucun second écran d’activation',()=>{
  const h=app();h.connect();h.returned();h.run(45000);h.ready();h.run(1300);
  assert(!h.popup.closed);assert.equal(h.el('app').style.visibility,'hidden');assert(!h.stored.get('cdq_google_connected_v1'));
});
test('Nouvelle connexion après échec : va vers CDQ, pas vers la boucle de retour',()=>{
  const h=app({googleHint:true});h.run(45000);assert(!h.stored.get('cdq_google_connected_v1'));h.connect();
  const target=new URL(new URL(h.opened[0].url).searchParams.get('continue'));assert(!target.searchParams.has('cdq_connect'));
  assert.equal(target.searchParams.get('cdq_deploy'),'272');
});
test('Un rapport ouvert dans l’onglet de secours n’est pas fermé par une reconnexion',()=>{
  const h=app();h.connect();h.returned();h.run(45000);const direct=h.popup;h.connect();assert(!direct.closed);
});
test('Hors ligne : aucune tentative Google et aucune suppression locale',()=>{
  const h=app({offline:true,token:'preserved'});assert.match(h.el('load-title').textContent,/Internet/);assert(h.el('google-connect').hidden);
  h.retry();h.connect();assert(!h.el('app').src);assert.equal(h.opened.length,0);assert.equal(h.stored.get('cdq_auth_device_token_v2'),'preserved');
});
test('Fond noir, grandes commandes et identité PWA conservés',()=>{
  const m=JSON.parse(fs.readFileSync(path.join(__dirname,'../manifest.webmanifest'),'utf8'));
  assert.equal(m.background_color,'#000000');assert.equal(m.theme_color,'#000000');assert.equal(m.start_url,'./');assert.equal(m.scope,'./');
  assert.deepEqual(m.icons.map(i=>i.src),['icons/icon-heavy-v3-192.png','icons/icon-heavy-v3-512.png']);
  assert.match(html,/<meta name="theme-color" content="#000000">/);assert.match(html,/#google-connect\{/);assert.match(html,/#load-retry\{/);
});
console.log(n+' tests de première connexion réussis.');
