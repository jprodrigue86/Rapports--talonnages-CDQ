// Interactions du lecteur, indépendantes du moteur et des calculs du PDF.
const clampScale = scale => Math.max(.35, Math.min(4, scale));
const distance = (a, b) => Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
const middle = (a, b) => ({x:(a.clientX + b.clientX) / 2, y:(a.clientY + b.clientY) / 2});

export function installTouchNavigation({container, surface, getViewer, now = Date.now, requestFrame = requestAnimationFrame, cancelFrame = cancelAnimationFrame}) {
  let gesture = null, suppressClickUntil = 0, inertia = 0;
  function stopInertia(){if(inertia)cancelFrame(inertia);inertia=0;}
  function coast(previous){
    if(!previous.moved||now()-previous.sampleTime>90)return;
    let vx=Math.max(-7,Math.min(7,previous.vx||0)),vy=Math.max(-7,Math.min(7,previous.vy||0)),last=now();
    function frame(){
      const time=now(),dt=Math.min(32,Math.max(1,time-last));last=time;
      const x=container.scrollLeft,y=container.scrollTop;
      container.scrollLeft=x+vx*dt;container.scrollTop=y+vy*dt;
      if(Math.abs(container.scrollLeft-x)<.1)vx=0;if(Math.abs(container.scrollTop-y)<.1)vy=0;
      const friction=Math.exp(-dt/325);vx*=friction;vy*=friction;
      if(Math.hypot(vx,vy)>.035){suppressClickUntil=time+100;inertia=requestFrame(frame);}else inertia=0;
    }
    if(Math.hypot(vx,vy)>.08)inertia=requestFrame(frame);
  }
  const resetPreview = () => {
    surface.style.transform = '';
    surface.style.transformOrigin = '';
    surface.style.willChange = '';
  };
  function finish(commit = true) {
    const previous = gesture;
    gesture = null;
    resetPreview();
    if (!previous) return;
    if (previous.moved || previous.mode === 'pinch') suppressClickUntil = now() + 450;
    if(previous.mode==='pan'&&commit)coast(previous);
    if (previous.mode !== 'pinch' || !commit) return;
    const viewer = getViewer();
    if (!viewer) return;
    viewer.updateScale({
      scaleFactor:previous.targetScale / previous.scale,
      origin:[previous.start.x, previous.start.y],
      pan:[previous.mid.x - previous.start.x, previous.mid.y - previous.start.y],
      drawingDelay:0,
    });
  }
  function startPan(t) {
    gesture = {mode:'pan', x:t.clientX, y:t.clientY,
      left:container.scrollLeft, top:container.scrollTop, moved:false, sampleX:t.clientX,sampleY:t.clientY,sampleTime:now(),vx:0,vy:0};
  }
  function start(e) {
    stopInertia();
    if (e.touches.length === 1) {gesture=null;return;}
    else if (e.touches.length === 2 && getViewer()) {
      if (gesture?.mode === 'pinch') finish();
      const [a, b] = e.touches, mid = middle(a, b);
      const scale = Number(getViewer().currentScale) || 1;
      gesture = {mode:'pinch', distance:Math.max(1, distance(a, b)), scale,
        targetScale:scale, start:mid, mid, rect:surface.getBoundingClientRect()};
      surface.style.transformOrigin = '0 0';
      surface.style.willChange = '';
      e.preventDefault();
    } else finish(false);
  }
  function move(e) {
    if (!gesture) return;
    if (gesture.mode === 'pan' && e.touches.length === 1) {
      const t = e.touches[0], dx = t.clientX - gesture.x, dy = t.clientY - gesture.y;
      if (!gesture.moved && Math.hypot(dx, dy) < 5) return;
      const time=now(),dt=time-gesture.sampleTime;
      if(dt>0){const weight=dt>80?1:.7;gesture.vx=(1-weight)*gesture.vx+weight*(gesture.sampleX-t.clientX)/dt;gesture.vy=(1-weight)*gesture.vy+weight*(gesture.sampleY-t.clientY)/dt;gesture.sampleX=t.clientX;gesture.sampleY=t.clientY;gesture.sampleTime=time;}
      gesture.moved = true;
      suppressClickUntil = now() + 450;
      e.preventDefault();
      container.scrollLeft = gesture.left - dx;
      container.scrollTop = gesture.top - dy;
    } else if (gesture.mode === 'pinch' && e.touches.length === 2) {
      e.preventDefault();
      const [a, b] = e.touches;
      gesture.mid = middle(a, b);
      gesture.targetScale = clampScale(gesture.scale * distance(a, b) / gesture.distance);
      const ratio = gesture.targetScale / gesture.scale, {start, mid, rect} = gesture;
      const x = mid.x - rect.left - (start.x - rect.left) * ratio;
      const y = mid.y - rect.top - (start.y - rect.top) * ratio;
      surface.style.transform = `translate(${x}px, ${y}px) scale(${ratio})`;
    }
  }
  function end(e) {
    finish(e.type !== 'touchcancel' && (gesture?.mode==='pinch'||e.touches.length===0));
    if(e.type==='touchcancel')stopInertia();
  }
  function click(e) {
    if (now() < suppressClickUntil) { e.preventDefault(); e.stopPropagation(); }
  }
  const options = {passive:false, capture:true};
  container.addEventListener('touchstart', start, options);
  container.addEventListener('touchmove', move, options);
  container.addEventListener('touchend', end, options);
  container.addEventListener('touchcancel', end, options);
  container.addEventListener('click', click, {capture:true});
  return {reset:() => {stopInertia();finish(false)}};
}

function normalizedName(value){
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
    .replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
}

export function isAutomaticFieldName(name){
  const n=normalizedName(name);
  if(!n)return false;
  if(/(^|_)echelon($|_)/.test(n))return true;
  if((n.includes('type')&&n.includes('balance'))||n==='balance_type')return true;
  if(/(^|_)(tolerance|erreur|conforme|non_conforme|statut_conformite)($|_)/.test(n))return true;
  return false;
}

export function fieldRank(name) {
  const match = /^charge_point_(\d+)_(charge_utilisee|avant_correction|apres_correction)$/.exec(name || '');
  if (match) return ['charge_utilisee','avant_correction','apres_correction'].indexOf(match[2]) * 100 + Number(match[1]);
  if (name === 'charge_excentricite') return 1000;
  const corner = /^excentricite_(avant|apres)_(arriere_gauche|avant_gauche|arriere_droit|avant_droit)$/.exec(name || '');
  if (corner) return 1001 + (corner[1] === 'apres' ? 4 : 0) +
    ['arriere_gauche','avant_gauche','arriere_droit','avant_droit'].indexOf(corner[2]);
  return null;
}

function visualPosition(field){
  if(!field||typeof field.getBoundingClientRect!=='function')return null;
  const rect=field.getBoundingClientRect();
  if(!rect||![rect.top,rect.left,rect.width,rect.height].every(Number.isFinite))return null;
  const page=field.closest?.('.page');
  const pageRect=page&&typeof page.getBoundingClientRect==='function'?page.getBoundingClientRect():null;
  const pageNumber=Number(page?.dataset?.pageNumber||page?.getAttribute?.('data-page-number')||0);
  const width=Math.max(1,Number(pageRect?.width)||1),height=Math.max(1,Number(pageRect?.height)||1);
  return {
    page:Number.isFinite(pageNumber)?pageNumber:0,
    top:pageRect?(rect.top-pageRect.top)/height:rect.top,
    left:pageRect?(rect.left-pageRect.left)/width:rect.left,
    height:pageRect?rect.height/height:Math.max(1,rect.height)
  };
}

// Les vrais champs du PDF suivent leur position visuelle: page par page,
// de haut en bas, puis de gauche à droite sur une même ligne. Pour les petits
// tests sans géométrie, conserver l’ordre CDQ historique comme repli.
export function orderFields(items, nameOf = item => item.name) {
  const enriched=items.map((item,index)=>({item,index,pos:visualPosition(item),rank:fieldRank(nameOf(item))}));
  const positioned=enriched.filter(x=>x.pos);
  if(positioned.length===enriched.length&&enriched.length){
    enriched.sort((a,b)=>{
      if(a.pos.page!==b.pos.page)return a.pos.page-b.pos.page;
      const rowTolerance=Math.max(.004,Math.min(a.pos.height,b.pos.height)*.45);
      const dy=a.pos.top-b.pos.top;
      if(Math.abs(dy)>rowTolerance)return dy;
      const dx=a.pos.left-b.pos.left;
      if(Math.abs(dx)>.001)return dx;
      return a.index-b.index;
    });
    return enriched.map(x=>x.item);
  }
  const selected = items.filter(item => fieldRank(nameOf(item)) !== null)
    .sort((a, b) => fieldRank(nameOf(a)) - fieldRank(nameOf(b)));
  let i = 0;
  return items.map(item => fieldRank(nameOf(item)) === null ? item : selected[i++]);
}

export function isEditable(field) {
  return !!field && !field.disabled && !field.readOnly && field.type !== 'hidden' &&
    !field.closest('[hidden]') && field.getClientRects().length > 0 &&
    getComputedStyle(field).visibility !== 'hidden';
}

export function isNavigableField(field){
  return isEditable(field)&&!isAutomaticFieldName(field.name);
}

export function installFormNavigation({surface, toolbar, previous, next, done, owner = document, reveal}) {
  const selector = '.textWidgetAnnotation input, .textWidgetAnnotation textarea, .choiceWidgetAnnotation select';
  let active = null;
  const fields = () => orderFields(Array.from(surface.querySelectorAll(selector)).filter(isNavigableField));
  function update() {
    const list = fields(), index = list.indexOf(active);
    toolbar.hidden = index < 0;
    owner.body.classList.toggle('form-navigation', index >= 0);
    previous.disabled = index <= 0;
    next.disabled = index < 0 || index === list.length - 1;
  }
  function revealTarget(target){
    if(typeof reveal==='function'){reveal(target);return;}
    try{target.scrollIntoView({block:'nearest', inline:'nearest', behavior:'instant'});}catch(_){}
  }
  function go(step, from = active) {
    const list = fields(), index = list.indexOf(from), target = list[index + step];
    if (index < 0 || !target) return false;
    target.focus({preventScroll:true});
    revealTarget(target);
    return true;
  }
  function refresh() {
    const navigable=fields(), navSet=new Set(navigable);
    let index=0;
    for (const field of surface.querySelectorAll(selector)) {
      const auto=isAutomaticFieldName(field.name);
      field.tabIndex = navSet.has(field) ? 0 : -1;
      if(auto){
        field.dataset.cdqAutoField='true';
        field.setAttribute?.('aria-readonly','true');
      }else{
        delete field.dataset.cdqAutoField;
        field.removeAttribute?.('aria-readonly');
      }
      if(navSet.has(field))field.dataset.cdqNavIndex=String(index++);
      else delete field.dataset.cdqNavIndex;
      if (field.tagName !== 'TEXTAREA'&&navSet.has(field)) field.enterKeyHint = 'next';
    }
    if(active&&!navSet.has(active))active=null;
    update();
  }
  surface.addEventListener('focusin', e => {
    if (!e.target.matches(selector) || !isNavigableField(e.target)) return;
    active = e.target; update();
  });
  owner.addEventListener('focusin', e => {
    if (!surface.contains(e.target) && !toolbar.contains(e.target)) {active = null; update();}
  });
  surface.addEventListener('keydown', e => {
    if (e.isComposing || e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key === 'Enter' && fieldRank(e.target.name) !== null && isNavigableField(e.target) && e.target.tagName === 'INPUT') {
      if (go(e.shiftKey ? -1 : 1, e.target)) {e.preventDefault(); e.stopPropagation();}
    }
  }, {capture:true});
  surface.addEventListener('keydown', e => {
    if (e.key === 'Tab' && !e.isComposing && e.target.matches(selector) && isNavigableField(e.target) && go(e.shiftKey ? -1 : 1, e.target)) e.preventDefault();
  });
  surface.addEventListener('change', e => {
    if (!e.target.matches('.choiceWidgetAnnotation select') || !isNavigableField(e.target)) return;
    active = e.target; update();
    Promise.resolve().then(() => go(1, e.target));
  });
  for (const button of [previous, next]) button.addEventListener('pointerdown', e => e.preventDefault());
  previous.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
  done.addEventListener('click', () => {done.focus({preventScroll:true}); active = null; update();});
  return {refresh, reset:() => {active = null; update();}, fields};
}

export function installNativeTextInput(surface){
  const composing=new WeakSet();
  const editable=e=>e.target?.matches?.('.textWidgetAnnotation input,.textWidgetAnnotation textarea');
  surface.addEventListener('compositionstart',e=>{if(editable(e))composing.add(e.target)},{capture:true});
  surface.addEventListener('compositionend',e=>{composing.delete(e.target)},{capture:true});
  surface.addEventListener('beforeinput',e=>{
    if(!editable(e))return;
    if(e.target.dataset.cdqNativeInput==='true'||e.isComposing||composing.has(e.target)||!e.cancelable||/Composition|Replacement|FromPaste|FromDrop|historyUndo|historyRedo/.test(e.inputType))e.stopImmediatePropagation();
  },{capture:true});
  return {configure(fields){
    for(const input of surface.querySelectorAll('.textWidgetAnnotation input,.textWidgetAnnotation textarea')){
      const fieldActions=(fields?.get?.(input.name)||fields?.[input.name])?.[0]?.actions;const actions=fieldActions?.get?.('Keystroke')||fieldActions?.Keystroke;
      if(actions?.length&&actions.every(code=>/^\s*if\(event\.willCommit && event\.commitKey===2/.test(code)&&code.includes('_cdqNavigationTimer')))input.dataset.cdqNativeInput='true';
    }
  }};
}
