/* Balance CDQ — configuration publique de la connexion Google.
 * Identifiant fourni par le propriétaire du projet Google Cloud Balance CDQ.
 * Ne jamais ajouter de secret client, de NIP ou de clé d'activation ici.
 * Le serveur vérifie l'identité Google; l'autorisation CDQ et le NIP restent
 * des vérifications distinctes.
 */
(function (root) {
  'use strict';

  root.CDQ_GOOGLE_AUTH_CONFIG = Object.freeze({
    clientId: '764508884818-u4qnjmflg2bbht0e8ja22m8blrbm8nmk.apps.googleusercontent.com',
    expectedOrigin: 'https://jprodrigue86.github.io',
    uxMode: 'popup',
    autoSelect: false
  });

  /* =====================================================
     HOTFIX ANDROID 2026-09-17
     Empêche l'écran d'activation de s'afficher sans preuve Google valide.
     Le Selector peut envoyer AUTH_REQUIRED puis ACCESS_STATE=input. Dans ce
     cas la carte Google doit rester prioritaire jusqu'à réception de AUTH_OK.
     Sur un appareil non encore activé, si le Selector arrive directement à
     l'écran de clé sans avoir demandé Google, on lui demande un nouveau défi.
     Aucun jeton, NIP, code d'activation ou donnée client n'est stocké ici.
  ===================================================== */
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const DEVICE_TOKEN_KEY = 'cdq_auth_device_token_v2';
  const RECENT_GOOGLE_KEY = 'cdq_google_ok_recent_v53';
  let pendingGoogleRequest = null;
  let restoreTimer = 0;
  let freshChallengeTimer = 0;
  let lastFreshChallengeAt = 0;

  function recentGoogleAt() {
    try { return Number(sessionStorage.getItem(RECENT_GOOGLE_KEY) || 0) || 0; }
    catch (e) { return 0; }
  }

  function rememberGoogleOk() {
    try { sessionStorage.setItem(RECENT_GOOGLE_KEY, String(Date.now())); }
    catch (e) {}
  }

  function hasStableDeviceToken() {
    try { return !!String(localStorage.getItem(DEVICE_TOKEN_KEY) || '').trim(); }
    catch (e) { return false; }
  }

  function selectorMessage(event) {
    try {
      return typeof isSelectorMessage === 'function' && isSelectorMessage(event);
    } catch (e) {
      return false;
    }
  }

  function bridgeReady() {
    try {
      return typeof selectorReady !== 'undefined' && selectorReady === true &&
        typeof selectorWindow !== 'undefined' && !!selectorWindow &&
        typeof selectorOrigin !== 'undefined' && !!selectorOrigin &&
        typeof replyToSelector === 'function';
    } catch (e) {
      return false;
    }
  }

  function requestFreshChallenge(reason) {
    clearTimeout(freshChallengeTimer);
    freshChallengeTimer = setTimeout(function () {
      if (!bridgeReady() || hasStableDeviceToken() || pendingGoogleRequest) return;
      if (Date.now() - recentGoogleAt() < 10 * 60 * 1000) return;
      if (Date.now() - lastFreshChallengeAt < 4000) return;
      lastFreshChallengeAt = Date.now();
      try {
        replyToSelector(selectorWindow, {
          type: 'CDQ_GOOGLE_AUTH_RETRY',
          authProtocol: 42,
          reason: String(reason || 'activation')
        });
      } catch (e) {}
    }, 120);
  }

  function restoreGooglePrompt() {
    clearTimeout(restoreTimer);
    restoreTimer = setTimeout(function () {
      if (!pendingGoogleRequest) return;
      if (!bridgeReady()) {
        restoreTimer = setTimeout(restoreGooglePrompt, 120);
        return;
      }
      if (pendingGoogleRequest.expiresAt &&
          Number(pendingGoogleRequest.expiresAt) <= Date.now() + 1000) {
        pendingGoogleRequest = null;
        requestFreshChallenge('expired-challenge');
        return;
      }
      try {
        if (typeof afficherConnexionGoogleV42 === 'function') {
          afficherConnexionGoogleV42(pendingGoogleRequest);
        }
      } catch (e) {}
    }, 0);
  }

  window.addEventListener('message', function (event) {
    const data = event.data || {};
    const type = String(data.type || '');
    if (!type.startsWith('CDQ_') || !selectorMessage(event)) return;

    if (type === 'CDQ_GOOGLE_AUTH_REQUIRED') {
      if (!data.challengeId || !data.nonce) return;
      pendingGoogleRequest = {
        challengeId: String(data.challengeId),
        nonce: String(data.nonce),
        clientId: String(data.clientId || root.CDQ_GOOGLE_AUTH_CONFIG.clientId || ''),
        expiresAt: Number(data.expiresAt) || 0,
        message: String(data.message || 'Connectez votre compte Google pour continuer.')
      };
      restoreGooglePrompt();
      return;
    }

    if (type === 'CDQ_GOOGLE_AUTH_OK') {
      rememberGoogleOk();
      pendingGoogleRequest = null;
      clearTimeout(restoreTimer);
      clearTimeout(freshChallengeTimer);
      return;
    }

    if (type === 'CDQ_GOOGLE_AUTH_ERROR') {
      pendingGoogleRequest = null;
      clearTimeout(restoreTimer);
      requestFreshChallenge('google-error');
      return;
    }

    if (type === 'CDQ_GOOGLE_AUTH_HIDE' ||
        (type === 'CDQ_ACCESS_STATE' && data.state === 'ready')) {
      pendingGoogleRequest = null;
      clearTimeout(restoreTimer);
      clearTimeout(freshChallengeTimer);
      return;
    }

    if (type === 'CDQ_SELECTOR_READY') {
      if (pendingGoogleRequest) restoreGooglePrompt();
      if (String(data.accessState || '') === 'input' &&
          !hasStableDeviceToken() && Date.now() - recentGoogleAt() >= 10 * 60 * 1000) {
        requestFreshChallenge('selector-ready-input');
      }
      return;
    }

    if (type === 'CDQ_ACCESS_STATE') {
      if (pendingGoogleRequest && data.state !== 'ready') {
        restoreGooglePrompt();
        return;
      }
      // Nouveau technicien : ne jamais accepter l'écran de clé comme première
      // étape si aucune connexion Google récente et aucun appareil activé n'existe.
      if (data.state === 'input' && !hasStableDeviceToken() &&
          Date.now() - recentGoogleAt() >= 10 * 60 * 1000) {
        requestFreshChallenge('activation-input-without-google');
      }
    }
  }, true);
})(globalThis);
