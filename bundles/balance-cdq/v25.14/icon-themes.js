(function () {
  'use strict';
  const styles = [
    {id:'current', title:'Icônes actuelles', crop:82, y:5},
    {id:'minimal', title:'4 · Minimaliste', crop:70, y:393},
    {id:'dark-pro', title:'5 · Dark Pro', crop:96, y:508},
    {id:'metal-music', title:'6 · Metal Music', crop:100, y:634, clip:'inset(7% 0 5% 0)'},
    {id:'isometric', title:'7 · 3D isométrique', crop:100, y:760, clip:'inset(7% 0 5% 0)'}
  ];
  const names = ['Accueil','Favoris','Dossier','Inventaire','Factures','Corbeille'];
  const centers = [347,556,762,969,1177,1398];
  const memory = new Map();
  let owner = '', state = {style:'current', revision:0, pending:false};
  let syncState = '', syncSequence = 0, saveTimer = null;
  function email() {
    try { return String(typeof utilisateurCourantEmail !== 'undefined' ? utilisateurCourantEmail : '').trim().toLowerCase(); }
    catch (error) { return ''; }
  }
  function clean(value) {
    return {style:styles.some(s => s.id === value?.style) ? value.style : 'current',
      revision:Number.isSafeInteger(value?.revision) && value.revision > 0 ? value.revision : 0,
      pending:value?.pending === true};
  }
  function load(user) {
    if (!user) return clean(null);
    try { return clean(JSON.parse(localStorage.getItem('cdqIconThemeV2514:' + user) || 'null')); }
    catch (error) { return clean(memory.get(user)); }
  }
  function persist() {
    if (!owner) return;
    memory.set(owner, {...state});
    try { localStorage.setItem('cdqIconThemeV2514:' + owner, JSON.stringify(state)); }
    catch (error) { syncState = 'Le choix sera conservé après sa synchronisation avec ton compte.'; }
  }
  function sprite(element, styleId, index) {
    const style = styles.find(s => s.id === styleId) || styles[0];
    const x = centers[index] - style.crop / 2;
    const size = (1536 / style.crop * 100) + '% ' + (1024 / style.crop * 100) + '%';
    const position = (x / (1536 - style.crop) * 100) + '% ' + (style.y / (1024 - style.crop) * 100) + '%';
    if (element.style.getPropertyValue('--cdq-art-size') !== size) element.style.setProperty('--cdq-art-size', size);
    if (element.style.getPropertyValue('--cdq-art-position') !== position) element.style.setProperty('--cdq-art-position', position);
    const clip = style.clip || 'none';
    if (element.style.getPropertyValue('--cdq-art-clip') !== clip) element.style.setProperty('--cdq-art-clip', clip);
  }
  function refreshChoices() {
    document.querySelectorAll('.cdq-icon-choice-v2514').forEach(button => {
      const selected = button.dataset.iconStyle === state.style;
      button.setAttribute('aria-pressed', String(selected));
      button.disabled = !owner;
      button.querySelector('.cdq-icon-choice-mark-v2514').textContent = selected ? '✓ Choisi' : '';
    });
    document.querySelectorAll('.cdq-icon-status-v2514').forEach(node => {
      const text = !owner ? 'Connecte-toi pour choisir tes icônes.' : syncState ||
        (state.pending ? 'Choix enregistré sur cet appareil. Synchronisation en attente.' : 'Ce choix est personnel à ton compte CDQ.');
      if (node.textContent !== text) node.textContent = text;
    });
  }
  function paint() {
    document.querySelectorAll('.bottom-nav > .bottom-nav-item').forEach(button => {
      const host = button.querySelector(':scope > span');
      if (!host) return;
      // Match the current action, not the index: navigation items may be inserted or hidden.
      const label = button.querySelector('small')?.textContent.trim() || '';
      const index = names.indexOf(label);
      const active = !!owner && state.style !== 'current' && index >= 0;
      host.classList.toggle('cdq-icon-host-v2514', active);
      if (active) sprite(host, state.style, index);
      else {
        host.style.removeProperty('--cdq-art-size');
        host.style.removeProperty('--cdq-art-position');
        host.style.removeProperty('--cdq-art-clip');
      }
    });
    refreshChoices();
  }
  function accept(user, result, sequence) {
    if (email() !== user || owner !== user || syncSequence !== sequence || result?.email !== user) return false;
    const incoming = clean(result);
    if (incoming.revision < state.revision) return false;
    state = incoming; syncState = 'Choix enregistré pour ton compte.'; persist(); paint();
    return true;
  }
  function save() {
    if (!owner || email() !== owner || !state.pending || !navigator.onLine) return;
    const user = owner, sent = {...state}, sequence = syncSequence;
    syncState = 'Enregistrement du choix…'; refreshChoices();
    try {
      cdqApiRun().withSuccessHandler(result => {
        if (!accept(user, result, sequence) && owner === user && email() === user && state.pending && state.revision > sent.revision)
          queueSave();
      }).withFailureHandler(() => {
        if (owner === user && email() === user && syncSequence === sequence) {
          syncState = 'Choix enregistré sur cet appareil. Synchronisation en attente.'; refreshChoices();
        }
      }).enregistrerStyleIconesCDQV2514(user, {style:sent.style, revision:sent.revision});
    } catch (error) {
      syncState = 'Choix enregistré sur cet appareil. Synchronisation en attente.'; refreshChoices();
    }
  }
  function queueSave() { clearTimeout(saveTimer); saveTimer = setTimeout(save, 250); }
  function synchronize() {
    const user = email();
    if (owner !== user) {
      clearTimeout(saveTimer); owner = user; state = load(user); syncState = ''; syncSequence++;
    }
    paint();
    if (!owner || !navigator.onLine) return;
    const sequence = ++syncSequence;
    try {
      cdqApiRun().withSuccessHandler(result => {
        if (owner !== user || email() !== user || sequence !== syncSequence || result?.email !== user) return;
        accept(user, result, sequence);
        if (state.pending) queueSave();
      }).withFailureHandler(() => {
        if (owner === user && email() === user && sequence === syncSequence && state.pending) queueSave();
      }).obtenirStyleIconesCDQV2514(user);
    } catch (error) { if (state.pending) queueSave(); }
  }
  function choose(id) {
    if (!styles.some(s => s.id === id) || !email()) return;
    if (owner !== email()) synchronize();
    state = {style:id, revision:Math.max(Date.now(), state.revision + 1), pending:true};
    syncState = ''; persist(); paint(); queueSave();
  }
  function mount(modal) {
    const tab = modal.querySelector('[data-settings-tab="appearance"]');
    if (tab) tab.textContent = 'Thème';
    const theme = Array.from(modal.querySelectorAll('.cdq-display-group')).find(group =>
      group.querySelector(':scope > .cdq-display-label')?.textContent.trim() === 'Thème');
    if (!theme || theme.querySelector('.cdq-icon-picker-v2514')) return;
    const section = document.createElement('section'); section.className = 'cdq-icon-picker-v2514';
    const title = document.createElement('h3'); title.textContent = 'Jeu d’icônes';
    const note = document.createElement('p'); note.textContent = 'Choisis les icônes de ta navigation du bas.';
    const choices = document.createElement('div'); choices.className = 'cdq-icon-choices-v2514';
    choices.setAttribute('role','group'); choices.setAttribute('aria-label','Jeu d’icônes personnel');
    styles.forEach(style => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'cdq-icon-choice-v2514';
      button.dataset.iconStyle = style.id; button.setAttribute('aria-label',style.title);
      const head = document.createElement('span'); head.className = 'cdq-icon-choice-head-v2514';
      const name = document.createElement('span'); name.textContent = style.title;
      const mark = document.createElement('span'); mark.className = 'cdq-icon-choice-mark-v2514'; mark.setAttribute('aria-hidden','true');
      head.append(name,mark);
      const preview = document.createElement('span'); preview.className = 'cdq-icon-preview-v2514'; preview.setAttribute('aria-hidden','true');
      names.forEach((name,index) => { const icon = document.createElement('i'); icon.className = 'cdq-icon-sample-v2514'; sprite(icon,style.id,index); preview.appendChild(icon); });
      button.append(head,preview); button.onclick = () => choose(style.id); choices.appendChild(button);
    });
    const status = document.createElement('p'); status.className = 'cdq-icon-status-v2514'; status.setAttribute('role','status');
    section.append(title,note,choices,status); theme.appendChild(section); refreshChoices();
  }
  const organize = window.cdqOrganizeSettings;
  if (typeof organize === 'function') window.cdqOrganizeSettings = function(modal) {
    organize(modal); mount(modal); synchronize();
  };
  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      if (email() !== owner) synchronize();
      else paint();
    });
  }
  function start() {
    synchronize();
    // Only original child/text changes matter; CSS/artwork updates cannot create a loop.
    new MutationObserver(records => {
      if (records.some(record => record.target.nodeType === 1
        ? record.target.closest('.bottom-nav') || Array.from(record.addedNodes).some(n => n.nodeType === 1 && (n.matches('.bottom-nav') || n.querySelector('.bottom-nav')))
        : record.target.parentElement?.closest('.bottom-nav'))) schedule();
    }).observe(document.body,{subtree:true,childList:true,characterData:true});
  }
  window.addEventListener('cdq:access-ready',synchronize);
  window.addEventListener('online',synchronize);
  document.addEventListener('visibilitychange',() => { if (!document.hidden) synchronize(); });
  window.addEventListener('storage',event => {
    if (owner && event.key === 'cdqIconThemeV2514:' + owner) { state = load(owner); paint(); }
  });
  window.cdqIconThemesV2514 = {synchronize};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
