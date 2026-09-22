# Balance CDQ V25.17 — espace de travail PC

Mise à jour depuis **V25.16**, à appliquer avec **CDQ Script Manager V40** :

https://jprodrigue86.github.io/Rapports--talonnages-CDQ/apps-script-manager/?bundle=%2FRapports--talonnages-CDQ%2Fbundles%2Fbalance-cdq%2Fv25.17%2FBalance_CDQ_V25_17.cdq

Cliquer sur **ÉCRIRE + DÉPLOYER**, attendre la confirmation, puis fermer et rouvrir l’application PC existante. La publication GitHub met à jour l’enveloppe PC; le package met à jour son interface Apps Script. L’APK Android reste inchangée.

## Changements

- Mur de musique panoramique, dérivé du visuel Android, et bannière de concert conservée sans étirement de l’interface.
- Dimensions CSS natives dans le Selector et la fenêtre PC; suppression des anciens redimensionnements concurrents.
- Accueil avec quatre indicateurs et lignes de documents lisibles. Les indicateurs disparaissent des autres écrans.
- Liste complète des clients, recherche et défilement continu; même fonctionnement dans les dossiers.
- Ouverture par bouton, double-clic ou Entrée, fil d’Ariane, actions contextuelles et sélection multiple.
- Thèmes sombres, taille des textes et espacement propres au PC; jeux d’icônes personnels synchronisés avec Android.
- Rafraîchissement du dossier après les opérations et rattachement des actions au client du fichier.

## Vérification

Tests avec données de démonstration : 280 clients et 97 éléments, fenêtres 1024×768, 1280×720, 1366×768 et 1920×1080. Parcours d’ouverture, recherche, navigation, renommage, duplication et sélection multiple. Application du package avec le moteur réel du Manager au Selector existant; compilation de tous les scripts et préservation des blocs mobiles, PDF et d’authentification. Aucun fichier Drive de production n’est modifié par les tests.

Les parcours locaux ne remplacent pas un essai connecté sur le PC de l’utilisateur. La bannière conserve sa résolution source; cette version retire le zoom artificiel, elle ne recrée pas le logo.
