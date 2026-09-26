import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {installTouchNavigation, installFormNavigation, fieldRank, orderFields} from '../reader-interactions-v2520.mjs';
import {installTouchNavigation as installTouchNavigation2525, installFormNavigation as installFormNavigation2525} from '../reader-interactions-v2525.mjs';

function harness() {
  const listeners = {}, calls = [], surface = {style:{}, getBoundingClientRect:() => ({left:-100,top:-200})};
  const container = {scrollLeft:100, scrollTop:200, addEventListener:(name, fn) => listeners[name] = fn};
  const viewer = {currentScale:1, updateScale(options) {calls.push(options); this.currentScale *= options.scaleFactor;}};
  let clock = 0;
  const navigation = installTouchNavigation({container, surface, getViewer:() => viewer, now:() => clock});
  function fire(type, points = []) {
    const e = {type, touches:points.map(([clientX, clientY]) => ({clientX,clientY})),
      prevented:false, stopped:false, preventDefault(){this.prevented=true;}, stopPropagation(){this.stopped=true;}};
    listeners[type](e);return e;
  }
  return {container,surface,viewer,calls,fire,navigation,advance:n => clock += n};
}
test('Un doigt glisse horizontalement et verticalement, même en partant d’un champ', () => {
  const h=harness();h.fire('touchstart',[[80,150]]);h.fire('touchmove',[[50,110]]);
  assert.equal(h.container.scrollLeft,130);assert.equal(h.container.scrollTop,240);assert.equal(h.calls.length,0);
});
test('Un tap et les petits tremblements permettent encore d’éditer', () => {
  const h=harness();h.fire('touchstart',[[80,150]]);
  assert.equal(h.fire('touchmove',[[82,152]]).prevented,false);
  h.fire('touchend');assert.equal(h.fire('click').prevented,false);
});
test('Le clic après déplacement est bloqué, pas les clics suivants', () => {
  const h=harness();h.fire('touchstart',[[80,150]]);h.fire('touchmove',[[20,150]]);h.fire('touchend');
  assert.equal(h.fire('click').stopped,true);h.advance(451);assert.equal(h.fire('click').prevented,false);
});
test('Pincement puis maintien long : aucun nouveau rendu PDF, aperçu conservé', () => {
  const h=harness();h.fire('touchstart',[[100,200],[200,200]]);
  for(let n=0;n<=60;n++) h.fire('touchmove',[[100-n,200],[200+n,200]]);
  const preview=h.surface.style.transform;h.advance(30000);
  assert.match(preview,/scale\(2\.2\)/);assert.equal(h.surface.style.transform,preview);
  assert.equal(h.viewer.currentScale,1);assert.equal(h.calls.length,0);
});
test('Relâchement : un seul rendu différé et point d’ancrage conservé', () => {
  const h=harness();h.fire('touchstart',[[100,200],[200,200]]);h.fire('touchmove',[[100,220],[300,220]]);h.fire('touchend');
  assert.equal(h.surface.style.transform,'');assert.deepEqual(h.calls,[{scaleFactor:2,origin:[150,200],pan:[50,20],drawingDelay:0}]);
  h.fire('touchend');assert.equal(h.calls.length,1);
});
test('Relâcher immédiatement après un mouvement ne laisse aucune frame périmée', () => {
  const h=harness();h.fire('touchstart',[[0,0],[100,0]]);h.fire('touchmove',[[0,0],[140,0]]);h.fire('touchend');
  assert.doesNotThrow(()=>h.fire('touchmove'));assert.equal(h.calls.length,1);
});
test('Deux doigts vers un doigt : zoom validé puis déplacement continu', () => {
  const h=harness();h.fire('touchstart',[[0,0],[100,0]]);h.fire('touchmove',[[0,0],[140,0]]);
  h.fire('touchend',[[140,0]]);h.fire('touchmove',[[110,20]]);
  assert.equal(h.calls.length,1);assert.equal(h.container.scrollLeft,130);assert.equal(h.container.scrollTop,180);
});
test('Annulation et changement de PDF retirent l’aperçu sans appliquer le zoom', () => {
  for (const reset of [h=>h.fire('touchcancel'),h=>h.navigation.reset()]) {
    const h=harness();h.fire('touchstart',[[0,0],[100,0]]);h.fire('touchmove',[[0,0],[200,0]]);reset(h);
    assert.equal(h.surface.style.transform,'');assert.equal(h.surface.style.willChange,'');assert.equal(h.calls.length,0);
  }
});
test('Bornes 35 % et 400 % respectées sans modifier le rendu pendant le geste', () => {
  for (const [width,want] of [[5,.35],[900,4]]) {
    const h=harness();h.fire('touchstart',[[0,0],[100,0]]);h.fire('touchmove',[[0,0],[width,0]]);
    assert.equal(h.calls.length,0);h.fire('touchend');assert.equal(h.viewer.currentScale,want);
  }
});
test('Bloc 3 : les six charges, six avant, six après, dans cet ordre', () => {
  const columns=['charge_utilisee','avant_correction','apres_correction'];
  const rowMajor=Array.from({length:6},(_,i)=>columns.map(c=>({name:`charge_point_${i+1}_${c}`}))).flat();
  const expected=columns.flatMap(c=>Array.from({length:6},(_,i)=>`charge_point_${i+1}_${c}`));
  assert.deepEqual(orderFields(rowMajor).map(f=>f.name),expected);
});
test('Excentricité : charge, quatre avant, quatre après', () => {
  const corners=['arriere_gauche','avant_gauche','arriere_droit','avant_droit'];
  const expected=['charge_excentricite',...['avant','apres'].flatMap(g=>corners.map(c=>`excentricite_${g}_${c}`))];
  assert.deepEqual(orderFields([...expected].reverse().map(name=>({name}))).map(f=>f.name),expected);
});
test('Les champs inconnus, indicateurs et calculs ne sont pas permutés', () => {
  const names=['client_nom','charge_point_1_apres_correction','charge_point_1_tolerance','charge_point_1_charge_utilisee','Bouton_Conforme','resume_commentaires'];
  assert.deepEqual(orderFields(names,n=>n),['client_nom','charge_point_1_charge_utilisee','charge_point_1_tolerance','charge_point_1_apres_correction','Bouton_Conforme','resume_commentaires']);
  for (const name of ['charge_point_1_erreur_avant','tolerance_excentricite','Statut_conformite']) assert.equal(fieldRank(name),null);
});
test('Couleur : surbrillance image supprimée, fond original non masqué', () => {
  const html=readFileSync(new URL('../reader.html',import.meta.url),'utf8');
  assert.match(html,/background-image:none!important/);
  assert.doesNotMatch(html,/input,textarea,select\)\{background-color:transparent/);
  assert.match(html,/buttonWidgetAnnotation[^}]*background:transparent!important/);
});
test('Le cache hors ligne contient exactement les nouveaux modules du lecteur', () => {
  const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  assert.match(sw,/'\.\/reader\.mjs\?v=21\.33'/);assert.match(sw,/'\.\/reader-interactions\.mjs\?v=21\.33'/);
});

function formHarness(names, installer=installFormNavigation) {
  const classes = new Set(), allFields = [], blurEvents = [];
  function node(props = {}) {
    return Object.assign({listeners:{}, children:[], hidden:false, disabled:false,
      addEventListener(type,fn,options={}) {(this.listeners[type] ||= []).push({fn,capture:options.capture});},
      contains(item) {return this === item || this.children.some(c => c.contains(item));},
      querySelector() {return this.children.find(c => c.name) || null;},
      appendChild(item) {const i=this.children.indexOf(item);if(i>=0)this.children.splice(i,1);this.children.push(item);},
      getClientRects() {return this.invisible ? [] : [{width:100,height:20}];},
      closest() {return this.hidden ? this : null;},
      matches() {return !!this.name;},
      scrollIntoView(options) {this.scrolled=options;},
    },props);
  }
  const owner=node({body:{classList:{toggle(k,on){if(on)classes.add(k);else classes.delete(k);}}}});
  const layer=node(),surface=node({children:[layer]}),toolbar=node({hidden:true});
  const previous=node(),next=node(),done=node();toolbar.children=[previous,next,done];
  surface.querySelectorAll=selector=>selector === '.annotationLayer' ? [layer] : layer.children.flatMap(s=>s.children);
  for(const name of names) {
    const field=node({name,type:'text',tagName:'INPUT',readOnly:false});
    field.focus=()=>{
      const old=owner.activeElement;owner.activeElement=field;
      if(old&&old!==field)blurEvents.push({from:old.name,to:field.name});
      fire(surface,'focusin',field);fire(owner,'focusin',field);
    };
    layer.children.push(node({children:[field]}));allFields.push(field);
  }
  const getStyle=globalThis.getComputedStyle;
  globalThis.getComputedStyle=field=>({visibility:field.visibility||'visible'});
  const navigation=installer({surface,toolbar,previous,next,done,owner});
  function fire(target,type,field=target,extra={}) {
    const e={target:field,key:'',prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...extra};
    const listeners=[...(target.listeners[type]||[])].sort((a,b)=>Number(!!b.capture)-Number(!!a.capture));
    for(const {fn} of listeners){fn(e);if(e.stopped)break;}return e;
  }
  return {surface,layer,toolbar,previous,next,owner,navigation,allFields,classes,blurEvents,fire,
    field:name=>allFields.find(f=>f.name===name),cleanup(){globalThis.getComputedStyle=getStyle;}};
}
test('Ordre DOM natif corrigé et réappliqué après reconstruction PDF.js', () => {
  const h=formHarness(['charge_point_1_charge_utilisee','charge_point_1_avant_correction','charge_point_2_charge_utilisee']);
  try {
    h.navigation.refresh();const expected=['charge_point_1_charge_utilisee','charge_point_2_charge_utilisee','charge_point_1_avant_correction'];
    assert.deepEqual(h.surface.querySelectorAll('').map(f=>f.name),expected);
    h.layer.children.reverse();h.navigation.refresh();assert.deepEqual(h.surface.querySelectorAll('').map(f=>f.name),expected);
    assert(h.allFields.every(f=>f.enterKeyHint==='next'&&f.tabIndex===0));
  } finally {h.cleanup();}
});
test('Entrée descend et valide par un vrai changement de focus; pas de script Entrée concurrent', () => {
  const h=formHarness(['charge_point_1_charge_utilisee','charge_point_1_avant_correction','charge_point_2_charge_utilisee']);
  try {
    h.navigation.refresh();const first=h.field('charge_point_1_charge_utilisee');first.focus();
    const e=h.fire(h.surface,'keydown',first,{key:'Enter'});
    assert(e.prevented&&e.stopped);assert.equal(h.owner.activeElement.name,'charge_point_2_charge_utilisee');
    assert.deepEqual(h.blurEvents,[{from:first.name,to:'charge_point_2_charge_utilisee'}]);
  } finally {h.cleanup();}
});
test('Tab, Maj+Tab et boutons Suivant/Précédent partagent le même ordre', () => {
  const h=formHarness(['charge_point_1_charge_utilisee','charge_point_1_avant_correction','charge_point_2_charge_utilisee']);
  try {
    h.navigation.refresh();h.allFields[0].focus();assert.equal(h.toolbar.hidden,false);
    h.fire(h.surface,'keydown',h.owner.activeElement,{key:'Tab'});assert.equal(h.owner.activeElement.name,'charge_point_2_charge_utilisee');
    h.fire(h.surface,'keydown',h.owner.activeElement,{key:'Tab',shiftKey:true});assert.equal(h.owner.activeElement.name,'charge_point_1_charge_utilisee');
    h.fire(h.next,'click');assert.equal(h.owner.activeElement.name,'charge_point_2_charge_utilisee');
    h.fire(h.previous,'click');assert.equal(h.owner.activeElement.name,'charge_point_1_charge_utilisee');
    assert(h.fire(h.next,'pointerdown').prevented);
  } finally {h.cleanup();}
});
test('Calculs, champs masqués et lecture seule sautés sans altérer leur état', () => {
  const h=formHarness(['charge_point_1_charge_utilisee','charge_point_1_tolerance','cache','lecture','charge_point_2_charge_utilisee']);
  try {
    h.allFields[1].disabled=true;h.allFields[2].invisible=true;h.allFields[3].readOnly=true;
    h.navigation.refresh();h.allFields[0].focus();h.fire(h.next,'click');
    assert.equal(h.owner.activeElement.name,'charge_point_2_charge_utilisee');assert.equal(h.allFields[1].tabIndex,-1);assert(h.allFields[1].disabled);
  } finally {h.cleanup();}
});
test('Excentricité dans les contrôles : charge puis avant complet puis après complet', () => {
  const expected=['charge_excentricite',...['avant','apres'].flatMap(g=>['arriere_gauche','avant_gauche','arriere_droit','avant_droit'].map(p=>`excentricite_${g}_${p}`))];
  const h=formHarness([...expected].reverse());
  try {
    h.navigation.refresh();h.field(expected[0]).focus();
    for(const name of expected.slice(1)){h.fire(h.next,'click');assert.equal(h.owner.activeElement.name,name);}
    assert.equal(h.next.disabled,true);
  } finally {h.cleanup();}
});
test('Commentaires multilignes et composition du clavier ne sont pas interceptés', () => {
  const h=formHarness(['resume_commentaires','charge_point_1_charge_utilisee','charge_point_2_charge_utilisee']);
  try {
    h.allFields[0].tagName='TEXTAREA';h.navigation.refresh();h.allFields[0].focus();
    assert.equal(h.fire(h.surface,'keydown',h.allFields[0],{key:'Enter'}).prevented,false);
    h.allFields[1].focus();assert.equal(h.fire(h.surface,'keydown',h.allFields[1],{key:'Enter',isComposing:true}).prevented,false);
    assert.equal(h.owner.activeElement,h.allFields[1]);
  } finally {h.cleanup();}
});
test('Changer de document masque la navigation; aucune boucle au dernier champ', () => {
  const h=formHarness(['client_nom','resume_commentaires']);
  try {
    h.navigation.refresh();h.allFields[1].focus();assert.equal(h.next.disabled,true);
    assert.equal(h.fire(h.surface,'keydown',h.allFields[1],{key:'Tab'}).prevented,false);
    h.navigation.reset();assert(h.toolbar.hidden);assert(!h.classes.has('form-navigation'));
  } finally {h.cleanup();}
});


test('V25.46 : le pincement garde le canvas composité sans délai de rendu forcé', () => {
  const listeners={},calls=[],surface={style:{},getBoundingClientRect:()=>({left:0,top:0})};
  const container={scrollLeft:0,scrollTop:0,addEventListener:(name,fn)=>listeners[name]=fn};
  const viewer={currentScale:1,updateScale(options){calls.push(options);this.currentScale*=options.scaleFactor;}};
  installTouchNavigation2525({container,surface,getViewer:()=>viewer,now:()=>100});
  const fire=(type,points=[])=>listeners[type]({type,touches:points.map(([x,y])=>({clientX:x,clientY:y})),preventDefault(){},stopPropagation(){}});
  fire('touchstart',[[100,200],[200,200]]);
  assert.equal(surface.style.willChange,'');
  fire('touchmove',[[80,200],[220,200]]);
  assert.match(surface.style.transform,/scale\(1\.4\)/);
  fire('touchend');
  assert.equal(calls.length,1);
  assert.equal(calls[0].drawingDelay,0);
});

test('V25.46 : choisir un menu déroulant passe automatiquement au prochain champ', async () => {
  const h=formHarness(['frequence_etalonnage','client_nom'],installFormNavigation2525);
  try{
    h.allFields[0].tagName='SELECT';
    h.navigation.refresh();
    h.allFields[0].focus();
    h.fire(h.surface,'change',h.allFields[0]);
    await Promise.resolve();
    assert.equal(h.owner.activeElement,h.allFields[1]);
    assert.deepEqual(h.blurEvents,[{from:'frequence_etalonnage',to:'client_nom'}]);
  }finally{h.cleanup();}
});

test('V25.46 : nouvelle interface mobile, marge Android et couleurs de conformité claires', () => {
  const html=readFileSync(new URL('../reader-v2525.html',import.meta.url),'utf8');
  assert.match(html,/id="zoomControls"/);
  assert.match(html,/padding-top:max\(10px,env\(safe-area-inset-top,0px\)\)/);
  assert.match(html,/conforme_vert/);
  assert.match(html,/#25e67a/);
  assert.match(html,/conforme_rouge/);
  assert.match(html,/#ff4b5d/);
  assert.match(html,/backface-visibility:visible!important/);
});
