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
    // Une seule mise à l'échelle PDF.js au relâchement. drawingDelay conserve
    // le canvas précédent pendant la préparation du nouveau rendu.
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
    if (e.touches.length === 1) {gesture=null;return;} // Native compositor scrolling, including inertia.
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
      // Ne pas toucher à currentScale, aux dimensions ou aux pixels du canvas
      // pendant le geste (y compris lorsque les doigts restent immobiles).
      surface.style.transform = `translate(${x}px, ${y}px) scale(${ratio})`;
    }
  }
  function end(e) {
    finish(e.type !== 'touchcancel' && (gesture?.mode==='pinch'||e.touches.length===0));
    if(e.type==='touchcancel')stopInertia();
    // After a pinch, wait for the next gesture; do not compete with native scrolling.
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

export function fieldRank(name) {
  const match = /^charge_point_(\d+)_(charge_utilisee|avant_correction|apres_correction)$/.exec(name || '');
  if (match) return ['charge_utilisee','avant_correction','apres_correction'].indexOf(match[2]) * 100 + Number(match[1]);
  if (name === 'charge_excentricite') return 1000;
  const corner = /^excentricite_(avant|apres)_(arriere_gauche|avant_gauche|arriere_droit|avant_droit)$/.exec(name || '');
  if (corner) return 1001 + (corner[1] === 'apres' ? 4 : 0) +
    ['arriere_gauche','avant_gauche','arriere_droit','avant_droit'].indexOf(corner[2]);
  return null;
}

// Ne permuter que les champs connus : les autres modèles, liens, boutons de
// calendrier et indicateurs de conformité conservent leur ordre et leurs actions.
export function orderFields(items, nameOf = item => item.name) {
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

export function installFormNavigation({surface, toolbar, previous, next, done, owner = document}) {
  const selector = '.textWidgetAnnotation input, .textWidgetAnnotation textarea, .choiceWidgetAnnotation select';
  let active = null;
  const fields = () => orderFields(Array.from(surface.querySelectorAll(selector)).filter(isEditable));
  function update() {
    const list = fields(), index = list.indexOf(active);
    toolbar.hidden = index < 0;
    owner.body.classList.toggle('form-navigation', index >= 0);
    previous.disabled = index <= 0;
    next.disabled = index < 0 || index === list.length - 1;
  }
  function go(step, from = active) {
    const list = fields(), index = list.indexOf(from), target = list[index + step];
    if (index < 0 || !target) return false;
    // focus() déclenche les vrais Blur/Focus de PDF.js, donc la validation et
    // les calculs embarqués. Ne pas modifier directement annotationStorage.
    target.focus({preventScroll:true});
    target.scrollIntoView({block:'nearest', inline:'nearest', behavior:'instant'});
    return true;
  }
  function refresh() {
    for (const layer of surface.querySelectorAll('.annotationLayer')) {
      const original = Array.from(layer.children);
      const sorted = orderFields(original, section => section.querySelector('input,textarea,select')?.name);
      if (sorted.some((section, i) => section !== original[i])) {
        const focused = owner.activeElement;
        for (const section of sorted) layer.appendChild(section);
        if (focused && surface.contains(focused) && owner.activeElement !== focused) focused.focus({preventScroll:true});
      }
    }
    for (const field of surface.querySelectorAll(selector)) {
      field.tabIndex = field.disabled || field.readOnly ? -1 : 0;
      if (field.tagName !== 'TEXTAREA') field.enterKeyHint = 'next';
    }
    update();
  }
  surface.addEventListener('focusin', e => {
    if (!e.target.matches(selector) || !isEditable(e.target)) return;
    active = e.target; update();
  });
  owner.addEventListener('focusin', e => {
    if (!surface.contains(e.target) && !toolbar.contains(e.target)) {active = null; update();}
  });
  // Capture seulement Entrée des champs CDQ concernés. Les anciens PDF peuvent
  // avoir un script Entrée avec un autre ordre : le Blur conserve leurs calculs.
  surface.addEventListener('keydown', e => {
    if (e.isComposing || e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key === 'Enter' && fieldRank(e.target.name) !== null && e.target.tagName === 'INPUT') {
      if (go(e.shiftKey ? -1 : 1, e.target)) {e.preventDefault(); e.stopPropagation();}
    }
  }, {capture:true});
  surface.addEventListener('keydown', e => {
    if (e.key === 'Tab' && !e.isComposing && e.target.matches(selector) && go(e.shiftKey ? -1 : 1, e.target)) e.preventDefault();
  });
  // Un choix dans un menu déroulant est déjà une validation explicite.
  // Laisser PDF.js recevoir change, puis déplacer le focus au prochain champ.
  surface.addEventListener('change', e => {
    if (!e.target.matches('.choiceWidgetAnnotation select') || !isEditable(e.target)) return;
    active = e.target; update();
    Promise.resolve().then(() => go(1, e.target));
  });
  for (const button of [previous, next]) button.addEventListener('pointerdown', e => e.preventDefault());
  previous.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
  done.addEventListener('click', () => {done.focus({preventScroll:true}); active = null; update();});
  return {refresh, reset:() => {active = null; update();}};
}

// Let the keyboard commit composition/autocorrection itself. PDF.js still receives
// input, blur and willCommit, so validation and document calculations remain active.
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
