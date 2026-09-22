# Balance CDQ V25.18 — PC lisible et plus rapide

Installation depuis V25.17 avec Script Manager V40 :

https://jprodrigue86.github.io/Rapports--talonnages-CDQ/apps-script-manager/?bundle=%2FRapports--talonnages-CDQ%2Fbundles%2Fbalance-cdq%2Fv25.18%2FBalance_CDQ_V25_18.cdq

Choisir ÉCRIRE + DÉPLOYER, attendre la confirmation, puis fermer et rouvrir l’application PC existante. Aucun nouvel APK ni deuxième application.

## Changements

- Retrait du menu Modèles et des boutons Importer. Nouveau rapport est dans Rapports, à la place du bouton Sélection multiple; choix du type de balance via le flux de création existant.
- Clic gauche maintenu 700 ms sur un fichier : mode sélection multiple. Relâcher conserve la sélection; déplacer la souris annule le maintien. Terminer la sélection revient au mode normal.
- En-tête Rapports compact; retrait du bouton Clients. Noms de fichiers et clients de 16 à 32 px, 24 px au réglage 50. Icônes de 24 à 44 px, 34 px au réglage 50. Espacement conservé séparément.
- Accueil : retrait de Nouveau rapport et des étiquettes À vérifier sur les documents sans statut. Les conformités connues restent affichées.
- Un seul écran Réglages PC : thèmes, lisibilité, jeux d’icônes, compte Google, lecteur PDF, mises à jour, synchronisation et administration selon le rôle.
- Enveloppe PC : attente artificielle après readiness réduite de 4 200 à 150 ms; contrôles d’accès et chargement iframe conservés.
- Clients disponibles avant les résumés et fichiers récents. Requêtes principales simultanées dédupliquées; données secondaires sans réinitialisation des sélections de rapports.
- Dossiers : cache mémoire de 30 s, limité à 30 dossiers, par compte; retours immédiats, Actualiser force la lecture, réponses tardives ignorées après navigation. Métadonnées locales des clients isolées par compte.
- Résumés : une lecture groupée des propriétés au lieu de jusqu’à 400 lectures individuelles.
- Contenu de dossier : Drive API en lots de 1 000 et lecture de toutes les pages; repli DriveApp si le service avancé manque. Vérification des droits et de l’ascendance avant le cache serveur.
- Téléchargements : Google Drive transmet directement le fichier au navigateur, après autorisation de la cible. Plus de blob/base64 transféré dans Apps Script pour ce bouton; exports Sheets XLSX, Docs DOCX, Slides PPTX. Google peut demander le compte ou une confirmation pour un gros fichier.

## Validation

- Package appliqué avec le moteur réel de Script Manager sur la chaîne V25.12 → V25.15 → V25.16 → V25.17 → V25.18. Base requise exacte `2026.09.23-v25.17-desktop-workspace`.
- Tests du vrai script PC et CSS Selector dans Chromium, RPC de démonstration : 280 clients, 97 éléments, écrans 1024, 1440 et 1920 px; authenticité du verrou de connexion, maintien/clic/déplacement, création vers le bon client, retour en cache, actualisation, réglages et tailles 50/100.
- Tests des lots, pages Drive, exclusion des dossiers système, refus d’accès, isolation des comptes et réponses réseau tardives.
- Syntaxe des scripts; préservation des blocs mobile, PDF, authentification et modèles. Seul un petit pont expose les fonctions de réglages existantes au nouvel écran PC.
- Aucun document client réel modifié par les tests. Le temps réel de réponse de Google Drive et l’ouverture dans les lecteurs du PC restent à confirmer dans la session de l’utilisateur.

Construction : `node scripts/build-desktop-ergonomics.mjs`.
Tests : `node --test tests/desktop-ergonomics.test.mjs` et `node tests/desktop-ergonomics-browser.test.mjs` (`CHROME_PATH` pour Chromium).

Documentation API de référence : https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list et https://developers.google.com/workspace/drive/api/guides/manage-downloads.
