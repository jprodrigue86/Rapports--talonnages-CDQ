// Configuration PUBLIQUE de l'application Web Firebase.
// GitHub/PWA uniquement. Ne jamais coller dans Code.gs.
// Aucune configuration réelle n'a été retrouvée pendant cet audit.
// Compléter avec le projet Firebase déjà utilisé avant d'activer les notifications.
// Ne jamais placer ici une clé privée de compte de service, un jeton ou un NIP.
self.CDQ_FIREBASE_CONFIG = self.CDQ_FIREBASE_CONFIG || {};
self.CDQ_FIREBASE_VAPID_KEY = self.CDQ_FIREBASE_VAPID_KEY || '';

/* =====================================================
   HOTFIX CONNEXION GOOGLE — BALANCE CDQ
   - Un nouvel appareil passe d'abord par le sélecteur de compte Google en
     navigation principale, jamais par Google dans l'iframe.
   - Un appareil déjà activé conserve son jeton et va directement au
     déverrouillage NIP / biométrie.
   - Si l'iframe perd sa session Google, le bouton de reconnexion repasse par
     le sélecteur de compte explicite au lieu de relancer la même page 401.
   Ce fichier est aussi importé par le service worker : tout le code DOM est
   donc strictement protégé par le test window/document ci-dessous.
===================================================== */
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  (function(){
    'use strict';

    const CDQ_LOGIN_APP_URL = 'https://script.google.com/macros/s/AKfycbzZt5zgKLJA3FlRXgJOqR8OLopFBkCg8vapy4fLMNM37rlrYv0U__p8V22O_QAq5gk/exec?cdq_deploy=272';
    const CDQ_LOGIN_DEVICE_KEY = 'cdq_auth_device_token_v2';
    const CDQ_LOGIN_GOOGLE_KEY = 'cdq_google_connected_v1';
    const CDQ_LOGIN_GUARD_KEY = 'cdq_google_accountchooser_guard_v1';

    function cdqHasStableDeviceToken(){
      try { return !!String(localStorage.getItem(CDQ_LOGIN_DEVICE_KEY) || '').trim(); }
      catch(e) { return false; }
    }

    function cdqReturnedFromGoogle(){
      try { return new URL(window.location.href).searchParams.get('cdq_connected') === '1'; }
      catch(e) { return false; }
    }

    function cdqAccountChooserUrl(){
      const retour = CDQ_LOGIN_APP_URL + '&cdq_connect=1';
      return 'https://accounts.google.com/AccountChooser?continue=' + encodeURIComponent(retour);
    }

    function cdqRememberRedirectNow(){
      try { sessionStorage.setItem(CDQ_LOGIN_GUARD_KEY, String(Date.now())); } catch(e) {}
    }

    function cdqCanRedirectNow(){
      try {
        const dernier = Number(sessionStorage.getItem(CDQ_LOGIN_GUARD_KEY) || 0);
        return !dernier || (Date.now() - dernier) > 10000;
      } catch(e) { return true; }
    }

    function cdqOpenGoogleChooser(replace){
      if (navigator.onLine === false) return false;
      cdqRememberRedirectNow();
      const url = cdqAccountChooserUrl();
      try {
        if (replace) window.location.replace(url);
        else window.location.assign(url);
        return true;
      } catch(e) { return false; }
    }

    const retourGoogle = cdqReturnedFromGoogle();
    const appareilActif = cdqHasStableDeviceToken();

    // L'ancien simple marqueur « Google connecté » ne doit plus court-circuiter
    // la vraie connexion d'un appareil qui n'a jamais terminé son activation.
    if (!appareilActif && !retourGoogle) {
      try { localStorage.removeItem(CDQ_LOGIN_GOOGLE_KEY); } catch(e) {}
    }
    if (retourGoogle) {
      try { sessionStorage.removeItem(CDQ_LOGIN_GUARD_KEY); } catch(e) {}
    }

    // Première ouverture : afficher immédiatement le choix du compte Google.
    // Une navigation de premier niveau évite la page d'authentification Google
    // interdite dans l'iframe. Le retour Apps Script ramène ensuite vers CDQ.
    if (!appareilActif && !retourGoogle && navigator.onLine !== false && cdqCanRedirectNow()) {
      cdqOpenGoogleChooser(true);
    }

    function cdqInstallReconnectButton(){
      const bouton = document.getElementById('google-connect');
      if (!bouton || bouton.dataset.cdqAccountChooserFix === '1') return;
      bouton.dataset.cdqAccountChooserFix = '1';
      bouton.addEventListener('click', function(event){
        if (navigator.onLine === false) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        cdqOpenGoogleChooser(false);
      }, true);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', cdqInstallReconnectButton, {once:true});
    } else {
      cdqInstallReconnectButton();
    }
  })();
}
