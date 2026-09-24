# CDQ Étalonnage — Android et iPhone

## Distribution

- Android : `https://jprodrigue86.github.io/Rapports--talonnages-CDQ/installer.html?platform=android`
- iPhone / iPad : `https://jprodrigue86.github.io/Rapports--talonnages-CDQ/iphone/`
- Page de partage commune : `https://jprodrigue86.github.io/Rapports--talonnages-CDQ/installer.html`

L’iPhone utilise une application web installable (PWA), pas une APK et pas une application App Store. Dans Safari, ouvrir l’application, choisir Partager → Sur l’écran d’accueil, laisser « Ouvrir comme app web » activé lorsque proposé, puis Ajouter. Une connexion Internet et un compte CDQ autorisé sont nécessaires pour la première utilisation. Aucun droit de compte n’est accordé par le partage du lien.

L’APK Android V25.30 possède déjà le bouton qui ouvre la page de partage commune. Publier les deux liens sur cette page ne nécessite donc pas une nouvelle APK. L’APK et sa signature ne sont pas modifiées par cette livraison.

## Base fonctionnelle commune

`scripts/build-iphone.mjs` génère l’iPhone à partir des fichiers web réellement produits pour Android par `scripts/build-embedded-android-v2528.mjs`. Le manifeste iPhone conserve la version, le build source et l’empreinte SHA-256 du Selector Android. Les images et le PDF modèle restent identiques octet par octet. Le correctif V25.30 des fichiers copiés est inclus.

Les services Apps Script existants et leur pont RPC authentifié sont réutilisés. Le serveur reste responsable des autorisations. Aucune session ni donnée client n’est intégrée au paquet public. Aucun changement de compte, d’autorisation ou de déploiement Apps Script n’est fait par cette publication.

## Mises à jour iPhone

L’ouverture ou le retour dans l’application déclenche une vérification. Le bouton « Vérifier la mise à jour iPhone » permet de forcer la vérification. La nouvelle interface n’est proposée qu’après téléchargement et contrôle SHA-256 de tous ses fichiers statiques. Le bouton « Mettre à jour et relancer » exige une confirmation après enregistrement des documents. Aucun redémarrage n’est imposé pendant une saisie.

Le cache est isolé sous `/iphone/app/`, avec le préfixe `cdq-iphone-shell-`. Le service worker ne met pas en cache les requêtes d’authentification ni les données Drive. Il ne supprime pas les caches de documents, les sessions, localStorage ou IndexedDB. La version actuellement active reste utilisable si la préparation d’une mise à jour échoue. Les limitations de stockage du navigateur et l’accès Internet aux données non déjà disponibles restent applicables.

## Règle de maintenance

Lors d’une correction Android touchant l’interface ou les fonctions partagées, générer et tester iPhone dans la même livraison :

```sh
node scripts/build-embedded-android-v2528.mjs
node scripts/build-iphone.mjs
node tests/iphone-install.test.mjs
node tests/iphone-browser.test.mjs
```

Le workflow `iphone-install-share.yml` effectue cette génération et ces contrôles lors des changements des sources concernées. Ne pas fusionner une livraison dont ces tests échouent. Ne jamais remplacer silencieusement une API native Android par une fausse API sur iPhone : documenter et tester l’équivalent web/iOS ou signaler l’écart. La biométrie native, les sélecteurs Android et les applications PDF externes ne sont pas garantis identiques sur iPhone.

## Vérifications

Les tests statiques contrôlent les versions, les ressources conservées, les liens par téléphone et toutes les empreintes du cache. Les tests Chromium/WebKit utilisent un compte et des réponses serveur fictifs ; ils ne modifient aucun dossier réel. Ils contrôlent l’interface mobile, la liste client simulée, le partage, la fermeture des fenêtres et le cycle de mise à jour avec confirmation, conservation des données et rechargement hors ligne.

Ces tests automatisés ne constituent pas une validation physique sur l’iPhone de Karim : sa connexion Google réelle, son accès aux dossiers, la modification/enregistrement des PDF et le comportement de Face ID restent à vérifier sur son appareil.
