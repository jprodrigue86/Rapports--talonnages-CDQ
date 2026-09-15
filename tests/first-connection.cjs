const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {harness,script}=require('./biometric-startup.cjs');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function app({token,googleHint,returning=false,offline=false,popupBlocked=false}={}) {
  const h=harness(),opened=[];h.win.location.href='https://jprodrigue86.github.io/Rapports--talonnages-CDQ/'+(returning?'?cdq_connected=1':'');
  h.win.location.assign=url=>h.assigned=url;h.c.navigator.onLine=!offline;
  if(token)h.stored.set('cdq_auth_device_token_v2',token);
  if(googleHint)h.stored.set('cdq_google_connected_v1','1');
  const popup={closed:false,close(){this.closed=true;}};popup.top=popup;
  h.win.open=url=>{opened.push(url);return popupBlocked?null:popup;};
  vm.runInContext(script(html)[0],h.c);
  return {...h,popup,opened,get assigned(){return h.assigned;},connect:()=>h.el('google-connect').listeners.click(),retry:()=>h.el('load-retry').listeners.click()};
}
let n=0;function test(name,fn){fn();n++;console.log('OK',name);}
test('Premier démarrage : connexion visible, aucune requête iframe Google ni page 401',()=>{
  const h=app();assert.equal(h.el('load-help').style.display,'flex');assert.equal(h.el('loading').style.display,'none');
  assert(!h.el('app').src);assert.equal(h.el('app').style.visibility,'hidden');assert.equal(h.el('load-retry').hidden,true);
  assert.match(h.el('load-message').textContent,/code reçu/);assert(!/<iframe[^>]*\ssrc=/s.test(html));
});
test('Connexion Google ouverte normalement, sans NIP ni jeton dans le lien',()=>{
  const h=app();h.connect();const url=new URL(h.opened[0]);assert.equal(url.origin,'https://script.google.com');
  assert.equal(url.searchParams.get('cdq_connect'),'1');assert(!url.searchParams.has('token'));assert(!h.el('app').src);
  assert.equal(h.el('load-retry').hidden,false);
});
test('Seule la fenêtre Google ouverte peut annoncer son retour',()=>{
  const h=app();h.connect();
  for(const e of [{source:h.popup,origin:'https://evil.invalid'},{source:{top:{}},origin:'https://script.google.com'},{source:null,origin:'https://script.google.com'}])
    h.fire('message',{...e,data:{type:'CDQ_GOOGLE_CONNECTED'}});
  assert(!h.el('app').src);assert(!h.stored.get('cdq_google_connected_v1'));
  h.fire('message',{source:{top:h.popup},origin:'https://test-script.googleusercontent.com',data:{type:'CDQ_GOOGLE_CONNECTED'}});
  assert.match(h.el('app').src,/cdq_deploy=270/);assert(h.popup.closed);assert.equal(h.el('loading').style.display,'grid');
  assert.equal(h.stored.get('cdq_google_connected_v1'),'1');assert(!h.stored.get('cdq_auth_device_token_v2'));
});
test('Appareil déjà activé : biométrie/NIP conservés, aucune nouvelle page Google',()=>{
  const h=app({token:'existing-device-token'});assert(h.el('app').src);assert.equal(h.el('load-help').style.display,'none');
  assert.equal(h.stored.get('cdq_auth_device_token_v2'),'existing-device-token');assert.equal(h.opened.length,0);
});
test('Le retour manuel sert seulement à charger CDQ : jamais à autoriser une session',()=>{
  const h=app({returning:true});assert(h.el('app').src);assert.equal(h.stored.get('cdq_google_connected_v1'),'1');
  assert(!h.stored.get('cdq_auth_device_token_v2'));assert.equal(h.el('app').style.visibility,'hidden');
});
test('Popup bloquée : connexion dans le même onglet et retour prévu',()=>{
  const h=app({popupBlocked:true});h.connect();assert.equal(h.assigned,h.opened[0]);assert.equal(h.opened.length,1);
  // La destination reste la page de connexion Google protégée.
  assert.match(h.opened[0],/cdq_connect=1/);
});
test('401 ou serveur muet : frame masquée et connexion récupérable, sans boucle',()=>{
  const h=app({googleHint:true});const initial=h.el('app').src;h.run(15000);
  assert.equal(h.el('app').style.visibility,'hidden');assert.equal(h.el('load-help').style.display,'flex');
  assert.equal(h.el('app').src,initial);assert.match(h.el('load-message').textContent,/interrompue/);
});
test('Hors ligne au premier lancement : instruction Internet et reprise explicite',()=>{
  const h=app({offline:true});assert.match(h.el('load-title').textContent,/Internet/);assert(h.el('google-connect').hidden);assert(!h.el('app').src);
});
test('Fond de lancement noir; icônes, identité et portée de la PWA conservées',()=>{
  const m=JSON.parse(fs.readFileSync(path.join(__dirname,'../manifest.webmanifest'),'utf8'));
  assert.equal(m.background_color,'#000000');assert.equal(m.theme_color,'#000000');assert.equal(m.start_url,'./');assert.equal(m.scope,'./');
  assert.deepEqual(m.icons.map(i=>i.src),['icons/icon-heavy-v3-192.png','icons/icon-heavy-v3-512.png']);
  assert.match(html,/<meta name="theme-color" content="#000000">/);assert.match(html,/html,body\{[^}]*background:#000000/);
});
console.log(n+' tests de première connexion réussis.');
