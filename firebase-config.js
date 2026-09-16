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

  // iPhone / iPad : le Selector interne utilise une échelle visuelle plus petite
  // qu'Android. On compense uniquement dans l'enveloppe GitHub/PWA afin que les
  // icônes du bas, les boutons rapides et les zones tactiles aient une taille
  // proche de l'interface Android, sans modifier le Selector Apps Script.
  (function appliquerEchelleIOS() {
    try {
      const ua = navigator.userAgent || '';
      const ios = /iPhone|iPad|iPod/i.test(ua) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      if (!ios) return;
      document.documentElement.style.setProperty('--interface-scale', '1.30');
      document.documentElement.dataset.cdqIosScale = '1.30';
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
