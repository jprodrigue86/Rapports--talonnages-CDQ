# Balance CDQ V25.15

Format mobile fondé sur la photo de référence fournie : trois curseurs à 50,
boutons supérieurs horizontaux, noms de fichiers plus grands, proportions de
la bannière, du sélecteur client et de la navigation harmonisées.

Les styles Minimaliste, Dark Pro, Metal Music et 3D isométrique utilisent un
WebP sans perte avec transparence. Le filtre coloré hérité du conteneur et du bouton est
retiré, y compris lorsqu'un ancien rafraîchissement le réapplique. Les couleurs
des libellés restent indépendantes des matériaux/couleurs propres aux dessins.

Compatible avec les packages V25.12, V25.13 et V25.14. Script Manager V40.
L'APK Android 25.15 existante est conservée; aucune nouvelle APK nécessaire.
Préférences et choix personnels conservés. Les fonctions de compte V25.14,
l'ouverture des documents et les modèles PDF ne changent pas.

## Construction

`node scripts/build-photo-baseline.mjs`

## Artwork

`icons-transparent.webp` est un détourage obtenu avec l'outil imagegen intégré,
à partir de `../v25.14/icons-reference.png`. Prompt : extraire les 24 icônes
des lignes 4–7 sur fond transparent, retirer titres/grille/fonds rectangulaires,
conserver dessins, matériaux et couleurs, badges Dark Pro et socles 3D, ne pas
ajouter de halo ou de teinte. Le PNG est encodé en WebP sans perte : alpha identique et aucune différence RGB sur les pixels visibles.
Les cadrages CSS suivent les positions du résultat, sans découper les dessins.

La vérification en navigateur utilise des données de démonstration. La taille
finale dans la WebView du téléphone reste à confirmer après installation.
