# Balance CDQ V25.16

Mise à jour de présentation pour **V25.15**, à installer avec **CDQ Script Manager V40**. L’APK Android 25.15 reste compatible.

[Ouvrir la mise à jour dans Script Manager](https://jprodrigue86.github.io/Rapports--talonnages-CDQ/apps-script-manager/?bundle=%2FRapports--talonnages-CDQ%2Fbundles%2Fbalance-cdq%2Fv25.16%2FBalance_CDQ_V25_16.cdq)

Choisir le projet existant, vérifier **V25.16**, puis **ÉCRIRE + DÉPLOYER**. Fermer et rouvrir Balance CDQ après le déploiement.

- La recherche utilise la hauteur visible au-dessus du clavier, avec des résultats compacts et défilants.
- La navigation réserve la hauteur réelle des icônes, des textes et de la zone Android; son cadre extérieur disparaît.
- La fiche compagnie tient sur une ligne et la présentation utilise la largeur disponible.
- Les six thèmes appliquent leur palette aux surfaces mobiles; Black métallique utilise des fonds noirs neutres.
- Curseurs, jeux d’icônes personnels et fonctionnement des documents conservés.

## Vérification

`node scripts/build-mobile-fit.mjs`

`node --test tests/mobile-fit.test.mjs`

`CHROME_PATH=/path/to/chrome node tests/mobile-fit-browser.test.mjs`

Essais ciblés à 320, 384 et 412 CSS px, curseurs simultanément à 0/50/100, viewport réduit pour le clavier, recherche/sélection/favoris/réouverture et six palettes. Le moteur de patch du Manager vérifie la conservation des autres modules. Les essais avec les styles du Selector réel restent locaux; les données privées ne sont pas publiées.
