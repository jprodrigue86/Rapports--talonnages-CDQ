// Configuration PUBLIQUE de l'application Web Firebase.
// GitHub/PWA uniquement. Ne jamais coller dans Code.gs.
// Aucune configuration réelle n'a été retrouvée pendant cet audit.
// Compléter avec le projet Firebase déjà utilisé avant d'activer les notifications.
// Ne jamais placer ici une clé privée de compte de service, un jeton ou un NIP.
self.CDQ_FIREBASE_CONFIG = self.CDQ_FIREBASE_CONFIG || {};
self.CDQ_FIREBASE_VAPID_KEY = self.CDQ_FIREBASE_VAPID_KEY || '';

// V21.42 — correctif du pont de connexion Google.
// Ce fichier est volontairement utilisé pour le correctif parce que le service
// worker le recharge en priorité à chaque ouverture lorsque le réseau est présent.
// Il ne remplace pas Firebase et ne contient aucun secret.
(function (root) {
  'use strict';

  // importScripts() charge aussi ce fichier dans le Service Worker : ne rien
  // installer dans ce contexte, où window n'existe pas.
  if (typeof window === 'undefined') return;

  root.CDQ_GOOGLE_BRIDGE_HOTFIX = '2026.09.16.0832';

  // iPhone / iPad SEULEMENT : réglage local de la taille de l'interface.
  // Android reste strictement inchangé. Ce réglage ne touche ni au NIP, ni à
  // l'authentification, ni aux données Apps Script : il ne fait que changer
  // l'échelle visuelle de l'iframe dans la PWA GitHub.
  (function installerReglageIOS() {
    try {
      const ua = navigator.userAgent || '';
      const ios = /iPhone|iPad|iPod/i.test(ua) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      if (!ios) return;

      const STORAGE_KEY = 'cdq_ios_interface_size_v1';
      const MIN_SCALE = 1.10;
      const MAX_SCALE = 1.34;
      const DEFAULT_PERCENT = 50;

      function clampPercent(value) {
        const n = Math.round(Number(value));
        return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : DEFAULT_PERCENT;
      }

      function percentToScale(percent) {
        const p = clampPercent(percent);
        return MIN_SCALE + ((MAX_SCALE - MIN_SCALE) * p / 100);
      }

      function lirePercent() {
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          return saved === null ? DEFAULT_PERCENT : clampPercent(saved);
        } catch (e) {
          return DEFAULT_PERCENT;
        }
      }

      function appliquer(percent, save) {
        const p = clampPercent(percent);
        const scale = percentToScale(p);
        document.documentElement.style.setProperty('--interface-scale', scale.toFixed(3));
        document.documentElement.dataset.cdqIosScale = scale.toFixed(3);
        document.documentElement.dataset.cdqIosPercent = String(p);
        if (save) {
          try { localStorage.setItem(STORAGE_KEY, String(p)); } catch (e) {}
        }
        const value = document.getElementById('cdq-ios-scale-value');
        if (value) value.textContent = p + ' %';
        const slider = document.getElementById('cdq-ios-scale-range');
        if (slider && Number(slider.value) !== p) slider.value = String(p);
      }

      // 50 % est le nouveau réglage recommandé. L'ancien 1.30 était trop grand
      // sur certains iPhone étroits; 50 % correspond maintenant à ~1.22.
      appliquer(lirePercent(), false);

      function creerInterfaceReglage() {
        if (document.getElementById('cdq-ios-scale-button')) return;

        const style = document.createElement('style');
        style.id = 'cdq-ios-scale-style';
        style.textContent = `
          #cdq-ios-scale-button{
            position:fixed;right:8px;bottom:calc(env(safe-area-inset-bottom,0px) + 92px);
            z-index:20000;width:44px;height:44px;border:1px solid rgba(255,255,255,.28);
            border-radius:13px;background:rgba(14,34,52,.88);color:#fff;font:800 17px/1 system-ui,sans-serif;
            box-shadow:0 7px 22px rgba(0,0,0,.38);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);
            opacity:.82;touch-action:manipulation;
          }
          #cdq-ios-scale-button:active{transform:scale(.96);opacity:1}
          #cdq-ios-scale-overlay{
            position:fixed;inset:0;z-index:20001;display:none;align-items:center;justify-content:center;
            padding:20px;box-sizing:border-box;background:rgba(0,0,0,.58);color:#fff;
          }
          #cdq-ios-scale-overlay.open{display:flex}
          #cdq-ios-scale-card{
            width:min(390px,92vw);padding:22px 20px 18px;border-radius:22px;
            background:#0c2235;border:1px solid #35536b;box-shadow:0 18px 60px rgba(0,0,0,.55);
            font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
          }
          #cdq-ios-scale-card h2{margin:0 0 7px;font-size:21px}
          #cdq-ios-scale-card p{margin:0 0 18px;color:#c6d7e5;font-size:14px;line-height:1.4}
          #cdq-ios-scale-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px}
          #cdq-ios-scale-row label{font-weight:800;font-size:15px}
          #cdq-ios-scale-value{min-width:58px;text-align:right;font-size:18px;font-weight:900;color:#ffd34f}
          #cdq-ios-scale-range{width:100%;height:34px;accent-color:#19a2ff;touch-action:pan-x}
          #cdq-ios-scale-marks{display:flex;justify-content:space-between;color:#8fa7ba;font-size:11px;margin-top:-4px}
          #cdq-ios-scale-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:18px}
          #cdq-ios-scale-actions button{
            min-height:48px;border:0;border-radius:13px;font:800 15px/1.2 system-ui,sans-serif;touch-action:manipulation;
          }
          #cdq-ios-scale-android{background:#1d6fb5;color:#fff}
          #cdq-ios-scale-close{background:#263b4c;color:#fff}
          #cdq-ios-scale-note{margin-top:12px!important;margin-bottom:0!important;font-size:12px!important;color:#91aabd!important}
        `;
        document.head.appendChild(style);

        const button = document.createElement('button');
        button.id = 'cdq-ios-scale-button';
        button.type = 'button';
        button.textContent = 'Aa';
        button.title = 'Taille de l’interface iPhone';
        button.setAttribute('aria-label', 'Régler la taille de l’interface iPhone');

        const overlay = document.createElement('div');
        overlay.id = 'cdq-ios-scale-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        overlay.innerHTML = `
          <div id="cdq-ios-scale-card" role="dialog" aria-modal="true" aria-labelledby="cdq-ios-scale-title">
            <h2 id="cdq-ios-scale-title">Taille de l’interface iPhone</h2>
            <p>Ajuste seulement l’affichage sur cet iPhone. Android n’est pas modifié.</p>
            <div id="cdq-ios-scale-row">
              <label for="cdq-ios-scale-range">Grandeur</label>
              <span id="cdq-ios-scale-value">50 %</span>
            </div>
            <input id="cdq-ios-scale-range" type="range" min="0" max="100" step="1" value="50" aria-label="Grandeur de l’interface iPhone">
            <div id="cdq-ios-scale-marks"><span>Plus petit</span><span>Comme Android</span><span>Plus grand</span></div>
            <div id="cdq-ios-scale-actions">
              <button id="cdq-ios-scale-android" type="button">Comme Android</button>
              <button id="cdq-ios-scale-close" type="button">Fermer</button>
            </div>
            <p id="cdq-ios-scale-note">Le réglage est mémorisé seulement sur cet appareil.</p>
          </div>`;

        document.body.appendChild(button);
        document.body.appendChild(overlay);

        const slider = document.getElementById('cdq-ios-scale-range');
        const close = document.getElementById('cdq-ios-scale-close');
        const android = document.getElementById('cdq-ios-scale-android');

        function ouvrir() {
          appliquer(lirePercent(), false);
          overlay.classList.add('open');
          overlay.setAttribute('aria-hidden', 'false');
        }
        function fermer() {
          overlay.classList.remove('open');
          overlay.setAttribute('aria-hidden', 'true');
        }

        button.addEventListener('click', ouvrir);
        close.addEventListener('click', fermer);
        android.addEventListener('click', function () { appliquer(DEFAULT_PERCENT, true); });
        slider.addEventListener('input', function () { appliquer(slider.value, true); });
        overlay.addEventListener('click', function (event) { if (event.target === overlay) fermer(); });
        document.addEventListener('keydown', function (event) { if (event.key === 'Escape') fermer(); });

        appliquer(lirePercent(), false);
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', creerInterfaceReglage, {once:true});
      } else {
        creerInterfaceReglage();
      }
    } catch (e) {}
  })();

  let pendingGoogleRequest = null;
  let restoreTimer = 0;

  function selectorBridgeReady() {
    try {
      return typeof selectorReady !== 'undefined' && selectorReady === true &&
        typeof afficherConnexionGoogleV42 === 'function' &&
        typeof selectorWindow !== 'undefined' && !!selectorWindow &&
        typeof selectorOrigin !== 'undefined' && !!selectorOrigin;
    } catch (e) {
      return false;
    }
  }

  function requestFreshChallengeIfNeeded() {
    try {
      if (typeof replyToSelector === 'function' && selectorWindow && selectorOrigin) {
        replyToSelector(selectorWindow, {type:'CDQ_GOOGLE_AUTH_RETRY', authProtocol:42});
      }
    } catch (e) {}
  }

  function restoreGooglePromptSoon() {
    clearTimeout(restoreTimer);
    restoreTimer = setTimeout(function () {
      if (!pendingGoogleRequest || !selectorBridgeReady()) return;

      if (pendingGoogleRequest.expiresAt &&
          Number(pendingGoogleRequest.expiresAt) <= Date.now() + 1000) {
        pendingGoogleRequest = null;
        requestFreshChallengeIfNeeded();
        return;
      }

      try {
        // Le Selector envoie CDQ_GOOGLE_AUTH_REQUIRED puis immédiatement
        // CDQ_ACCESS_STATE=input. L'ancien gestionnaire générique masquait alors
        // la vraie carte Google. On la remet après la fin du même événement.
        afficherConnexionGoogleV42(pendingGoogleRequest);
      } catch (e) {}
    }, 0);
  }

  window.addEventListener('message', function (event) {
    const data = event.data || {};
    const type = String(data.type || '');
    if (!type.startsWith('CDQ_')) return;

    // Attendre que les fonctions du script principal existent, puis réutiliser
    // exactement sa validation de provenance du Selector Apps Script.
    try {
      if (typeof isSelectorMessage !== 'function' || !isSelectorMessage(event)) return;
    } catch (e) {
      return;
    }

    if (type === 'CDQ_GOOGLE_AUTH_REQUIRED') {
      if (!data.challengeId || !data.nonce) return;
      pendingGoogleRequest = {
        challengeId: String(data.challengeId),
        nonce: String(data.nonce),
        clientId: String(data.clientId || (root.CDQ_GOOGLE_AUTH_CONFIG || {}).clientId || ''),
        expiresAt: Number(data.expiresAt) || 0,
        message: String(data.message || 'Connectez votre compte Google pour continuer.')
      };
      restoreGooglePromptSoon();
      return;
    }

    // Corrige aussi la course de démarrage : AUTH_REQUIRED peut arriver avant
    // CDQ_SELECTOR_READY. Dès que le handshake est établi, la demande mémorisée
    // est rejouée dans le parent GitHub.
    if (type === 'CDQ_SELECTOR_READY' ||
        (type === 'CDQ_ACCESS_STATE' && data.state !== 'ready')) {
      if (pendingGoogleRequest) restoreGooglePromptSoon();
      return;
    }

    if (type === 'CDQ_GOOGLE_AUTH_OK' ||
        type === 'CDQ_GOOGLE_AUTH_HIDE' ||
        (type === 'CDQ_ACCESS_STATE' && data.state === 'ready')) {
      pendingGoogleRequest = null;
      clearTimeout(restoreTimer);
    }
  }, false);
})(globalThis);

// La connexion est gérée par index.html avec Google Identity Services.
// Les valeurs Firebase réelles ajoutées par l'administrateur doivent être conservées.
