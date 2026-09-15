# V21.38 — Reprise de la connexion Google

Correctif PWA : `2026.09.15.1828-v21.38`.
Ce correctif ne remplace ni le serveur Apps Script ni le Selector. Le lecteur PDF et les nouveaux modèles hors ligne sont conservés.

## Corrections

- La première ouverture conserve le choix Google immédiat ajouté en parallèle. Son ancien intercepteur de bouton laisse ensuite la reprise au nouveau lanceur.
- Le véritable lanceur utilise maintenant le choix explicite du compte Google, et pas seulement la page de diagnostic.
- Le bouton de retour attend la connexion Google au lieu de relancer prématurément le cadre intégré.
- La fenêtre Google reste ouverte jusqu'au démarrage confirmé du Selector. Les retours obsolètes ou dupliqués sont ignorés.
- Après 15 secondes, le message indique seulement un chargement lent. Après 45 secondes sans démarrage confirmé, une connexion Google déjà terminée peut continuer dans son onglet au premier plan, au lieu de répéter la même intégration.
- Le cadre abandonné est arrêté pour éviter qu'une réponse tardive ferme l'onglet de secours ou provoque une seconde activation.
- Une nouvelle tentative ne ferme pas un rapport déjà ouvert dans l'onglet de secours. Aucun NIP, jeton d'appareil, enregistrement biométrique ou rapport local n'est effacé.
- Les styles des boutons de connexion ciblent leurs vrais identifiants. Le fond noir, les icônes et l'identité de l'application sont conservés.

## Vérification

65 tests locaux réussis : 18 tests de première connexion, 11 tests de démarrage biométrique, 11 tests PWA et 21 tests des interactions du lecteur PDF et 4 tests d’intégration du démarrage complet. Ces tests utilisent des services et fenêtres simulés ; ils ne remplacent pas une connexion réelle d'un technicien ni un essai sur téléphone Android physique.

## Limites et mise à jour

Ce correctif améliore la reprise et fournit une sortie au premier plan. Il ne supprime pas les restrictions de connexion Google dans un cadre tiers et ne constitue pas une refonte de l'authentification serveur. Dans l'onglet Google direct, le déverrouillage reste celui déjà prévu par le Selector : NIP ; le pont biométrique de la PWA ne s'y applique pas.

Aucune modification des droits Google, du déploiement Apps Script, de la configuration Firebase ni des documents clients par ce correctif. Fermer complètement CDQ puis le rouvrir avec Internet pour charger la mise à jour. Ne pas désinstaller l'application et ne pas effacer ses données.

Les fichiers `index.html` et `sw.js` appartiennent uniquement au site GitHub/PWA. Ne jamais les coller dans `Code.gs`.
