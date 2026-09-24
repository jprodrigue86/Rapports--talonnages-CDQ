# Alignement des références de publication — 24 septembre 2026

Cette intervention corrige uniquement les métadonnées de publication et ajoute
un contrôle de cohérence. Elle ne déploie rien dans Google Apps Script et ne
reconstruit ni l'application Android ni l'application iPhone.

## Paquet automatique

`bundles/balance-cdq/latest/manifest.json` devient une copie exacte du manifeste
canonique V25.28. Ses fichiers supplémentaires utilisent les URL versionnées
V25.28, dont les SHA-256 sont contrôlés. Le manifeste canonique reste inchangé.
La préparation automatique conserve ses protections : une source V25.28 ou plus
récente ne recharge pas ce paquet et aucune lecture ne lance un déploiement.

## Web / PC : distinguer les composants

Le lanceur `index.html` et son service worker restent réellement V25.27 : leurs
fichiers ne sont pas modifiés. `version.json.version` reste donc V25.27, avec
`version_scope: web-shell`. Ce lanceur charge l'interface depuis le déploiement
Google existant, au lieu d'embarquer l'interface Android V25.30.

La référence `selector_version` est alignée sur l'interface Google V25.28.
`server_package_version` et `server_package_build` identifient séparément le
paquet serveur publié. L'ancienne référence backend V25.10 est retirée :
`backend_version` vaut `null`, car le diagnostic disponible ne détecte pas de
numéro indépendant dans le code serveur. Il serait incorrect d'inventer ce
numéro à partir de celui de l'interface. Script Manager V43 accepte ce champ nul.
La date de la version du lanceur, les fonctionnalités et la version du lecteur
sont conservées; une date distincte indique la mise à jour des références.

Ces références publiques ne remplacent pas une vérification privée du
contenu du déploiement Google. Elles ne prouvent ni la santé réelle de `/exec`,
ni la version installée sur un appareil, ni la présence sur PC des corrections
propres à l'interface mobile V25.30.

## Contrôles

`tests/release-references.test.mjs` vérifie le paquet automatique, les ressources
SHA-256, les versions réelles du lanceur/worker, l'absence de version backend
inventée et la préparation du paquet sur des sources ancienne, identique et
plus récente. Les suites de régression Script Manager V41, V42 et V43 sont
exécutées avec ce contrôle. Elles n'accèdent pas au compte Google de l'utilisateur.

Aucun modèle PDF, écran de l'application, jeton, permission ou déploiement Google
n'est changé. Aucun diagnostic privé n'est copié dans ce dépôt.
