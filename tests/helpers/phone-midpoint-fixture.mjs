// Component browser tests use synthetic document data; no private Apps Script source is uploaded.
import fs from 'node:fs';
import {buildDisplayControls} from './settings-fixture.mjs';
const script = fs.readFileSync('bundles/balance-cdq/v25.12/mobile-layout.js', 'utf8');
const css = fs.readFileSync('bundles/balance-cdq/v25.12/mobile-layout.css', 'utf8');
const displayControls = buildDisplayControls();
const legacyCss = fs.readFileSync('tests/fixtures/phone-v2511.css', 'utf8');
const fixture = `<!doctype html><html class="android"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
${legacyCss}
</style><style>${css}</style></head><body><main class="container"><header class="app-header">BALANCE CDQ</header><div class="company-wrapper"><button class="company-button">Client démo</button><button class="company-reset-button">↻</button></div>
<div class="quick-buttons"><button class="quick-button"><span class="quick-icon">⚖</span><span class="quick-name">Balance intermédiaire</span></button><button class="quick-button"><span class="quick-icon">🚛</span><span class="quick-name">Balance<br>à camion</span></button><button class="quick-button"><span class="quick-icon">⊥</span><span class="quick-name">Balance<br>de précision</span></button><button class="quick-button"><span class="quick-icon">⚖</span><span class="quick-name">Balance<br>multi-tête</span></button></div>
<div id="cdqTopActionsV2204">${['clientNoteButton','cdqV19OfflineStatus','clientPhotoButton','cdqTopDisplayButtonV2204'].map((id,i)=>`<button id="${id}" class="cdq-top-action"><span style="font-size:22px!important">${['✎','⇩','▣','⚙'][i]}</span><span>${['Note','Hors ligne','Photos','Réglages'][i]}</span></button>`).join('')}</div>
<div id="clientInfoBar" class="client-info-bar"><div class="client-info-name">Client démo</div><div class="client-stats">2 dossiers visibles • contenu chargé au besoin</div></div><button id="createFolderButton" style="display:none">📁+</button><section class="files"><div class="file-row"><span class="file-icon">▤</span><div class="file-info"><div class="file-name">Bal 7</div><div class="file-date">Modifié le 2026-09-20 21 h 59</div></div></div><div class="file-row"><span class="file-icon">▤</span><div class="file-info"><div class="file-name">Bal 6</div><div class="file-date">Modifié le 2026-09-20 21 h 59</div></div></div><div class="file-row"><span class="file-icon">▤</span><div class="file-info"><div class="file-name">Bal 8</div><div class="file-date">Modifié le 2026-09-20 21 h 59</div></div></div><div class="file-row"><span class="file-icon">▤</span><div class="file-info"><div class="file-name">Bal 2</div><div class="file-date">Modifié le 2026-09-20 21 h 59</div></div></div><div class="file-row"><span class="file-icon">▤</span><div class="file-info"><div class="file-name">Bal-1</div><div class="file-date">Modifié le 2026-09-20 21 h 59</div></div></div><div class="file-row"><span class="file-icon">▤</span><div class="file-info"><div class="file-name">KWS SW-12</div><div class="file-date">Modifié le 2026-09-20 21 h 59</div></div></div><div class="file-row"><span class="file-icon">▤</span><div class="file-info"><div class="file-name">Liste des balances du client</div><div class="file-date">Modifié le 2026-09-20 21 h 59</div></div></div></section><div class="folder-header"><span>📁</span><span class="folder-name">Archives des rapports d’étalonnage</span><span>▸</span></div><div class="folder-header"><span>📁</span><span class="folder-name">Rapports PDF</span><span>▸</span></div></main>
<nav class="bottom-nav">${['Accueil','Favoris','Dossier','Inventaire','Factures','Corbeille'].map((name,i)=>`<button class="bottom-nav-item" ${i===2?'id="folderActionButton"':''}><span ${i===2?'id="folderActionIcon"':''}>${['⌂','☆','📁+','◇','▤','♜'][i]}</span><small>${name}</small></button>`).join('')}</nav>
<div id="cdqDisplayModal" style="display:none"><div class="cdq-modal-body"></div></div>
<div id="cdqSettingsModalV2294" class="modal-overlay" style="display:none"><div class="modal"><h2 class="cdq-modal-title">Réglages</h2><div class="cdq-modal-body"><div class="cdq-settings-v2294"><section><div id="cdqDefaultGoogleStatusV2294">Aucun compte par défaut</div><input type="email"></section><section id="cdqAndroidUpdateCardV2315"><button>Mise à jour Android</button></section></div></div><div class="modal-buttons"><button id="cdqSettingsCloseV2294" onclick="document.getElementById('cdqSettingsModalV2294').style.display='none'">Fermer</button></div></div></div>
<script>
window.saved=0;
window.cdqClampScaleV89=v=>Math.max(0,Math.min(100,Number(v)));
for(const name of ['General','Text','Icon']){
 window['cdq'+name+'ValueV89']=()=>Number(localStorage.getItem('cdqUi'+name+'ScaleV89')??50);
 window['cdqApply'+name+'ScaleV89']=(value)=>{localStorage.setItem('cdqUi'+name+'ScaleV89',value);window.cdqMobileLayout.apply()};
}
window.cdqApplyVisibleIconScaleV2208=window.cdqApplyIconScaleV89;
window.cdqMarkDisplayLocalEditV2212=()=>{};
window.cdqSaveDisplayPreferencesNowV2212=()=>window.saved++;
window.cdqScheduleSavePreferencesV72=()=>{};
window.cdqDetachBottomNavV96=()=>window.cdqMobileLayout.apply();
window.cdqFitGeneralScaleV92=()=>window.cdqMobileLayout.apply();
window.utilisateurCourantRole='technicien';window.CDQ_BUILD='V25.11';
window.cdqVersionLabelV87=v=>v;window.cdqRefreshUpdateCenterUI=()=>{};
window.cdqApplyTheme=theme=>localStorage.setItem('cdqTheme',theme);
window.cdqSetLongPress=v=>localStorage.setItem('cdqLongPressMs',v);
window.cdqSetSwipeSensitivity=v=>localStorage.setItem('cdqSwipeSensitivity',v);
window.cdqUpdateInfo={};window.cdqForceUpdate=()=>{};window.cdqCheckUpdate=()=>{};window.afficherMessage=()=>{};
${displayControls}
window.ouvrirReglagesAffichage=cdqOpenDisplaySettings;
</script><script>${script}</script></body></html>`;
export {fixture};
