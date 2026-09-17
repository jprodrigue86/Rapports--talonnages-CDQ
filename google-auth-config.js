/* Balance CDQ — configuration publique de la connexion Google.
 * Identifiant fourni par le propriétaire du projet Google Cloud Balance CDQ.
 * Ne jamais ajouter de secret client, de NIP ou de clé d'activation ici.
 *
 * IMPORTANT — récupération 2026-09-17 :
 * Le fichier index.html conserve volontairement l'ancien déploiement Apps Script
 * connu fonctionnel. Aucun remplacement d'URL d'iframe n'est fait ici.
 * Le correctif de course Google/Android reste chargé par firebase-config.js.
 */
(function (root) {
  'use strict';
  root.CDQ_GOOGLE_AUTH_CONFIG = Object.freeze({
    clientId: '764508884818-u4qnjmflg2bbht0e8ja22m8blrbm8nmk.apps.googleusercontent.com',
    expectedOrigin: 'https://jprodrigue86.github.io',
    uxMode: 'popup',
    autoSelect: false
  });
})(globalThis);
