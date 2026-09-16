/* Balance CDQ — configuration publique de la nouvelle connexion Google.
 * Identifiant fourni par le propriétaire du projet Google Cloud Balance CDQ.
 * Ce fichier est préparé, mais n'est pas encore chargé par index.html.
 * Son ajout ne change pas la connexion actuelle, les comptes ni les droits.
 * Ne jamais ajouter de secret client, de NIP ou de clé d'activation ici.
 * Le serveur devra vérifier la signature Google, l'audience, l'émetteur,
 * l'expiration et le nonce avant toute utilisation de l'identité reçue.
 * L'autorisation CDQ et le NIP restent des vérifications distinctes.
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
