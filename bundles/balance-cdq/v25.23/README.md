# Balance CDQ V25.23

Correctif web PC et Android pour une base V25.22, avec CDQ Script Manager V40.

[Charger le correctif dans Script Manager](https://jprodrigue86.github.io/Rapports--talonnages-CDQ/apps-script-manager/?bundle=%2FRapports--talonnages-CDQ%2Fbundles%2Fbalance-cdq%2Fv25.23%2FBalance_CDQ_V25_23.cdq), puis **ÉCRIRE + DÉPLOYER**. Fermer et rouvrir Balance CDQ une fois le déploiement confirmé. L’APK existante est conservée.

## Changements

- Le lecteur conserve les suggestions et compositions du clavier Android. Les champs des formulaires CDQ sont noirs et gras; les calculs, couleurs de fond et PDF originaux sont conservés.
- Le glissement du PDF continue après le geste, avec arrêt au toucher suivant. Les boutons du lecteur sont plus contrastés. L’ouverture affiche un petit indicateur dans la ligne du fichier.
- Les nouvelles copies reçoivent le nom du client et le technicien connecté. Ville et adresse sont reprises lorsqu’elles sont explicites et non ambiguës dans les rapports récents disponibles. Une nouvelle copie ne s’ouvre plus automatiquement.
- Drive général permet d’afficher un dossier ou l’emplacement d’un fichier dans la liste principale. Une réponse tardive ne remplace pas une autre page choisie entre-temps.
- La fenêtre NIP et l’icône Copier sont réduites. Le mur musical est adapté au format long du téléphone et le chargement est placé en bas. Le bouton flottant « Mes copies locales » est retiré; les fichiers en attente restent accessibles depuis les documents hors ligne.

## Conversion des Sheets de plancher

Dans Réglages, le propriétaire principal dispose du bouton **Convertir les Sheets de plancher**. L’autorisation est aussi vérifiée côté serveur. L’installation du correctif ne démarre pas une nouvelle conversion.

Le traitement inventorie l’arborescence d’origine, puis lit un Sheet à la fois, client par client. Seul le type indiqué dans le formulaire détermine s’il s’agit d’une Balance de plancher. Les PDF vont dans le client du même nom, dans son dossier de rapports d’étalonnage, sous la copie VAPP1.0 déjà désignée. Les Sheets originaux sont conservés.

| Source Sheets | Destination PDF |
| --- | --- |
| Date d’étalonnage | Date d’étalonnage |
| Date due / « du le » | Prochain étalonnage; jour absent conservé vide |
| Poids | Charge utilisée, points 1 à 6 |
| Avant / après correction | Mesures avant / après correspondantes |
| Charge et quatre points d’excentricité | Charge et coins correspondants avant / après |
| Étendue de la balance utilisée | Étendue vérifiée |
| Poids étalons utilisés | Équipement utilisé |
| Client, ville, adresse, technicien | Champs correspondants lorsqu’ils sont renseignés |
| Capacité, échelon, unité, identification et équipements | Champs correspondants |
| Intervalle entre les deux dates | Fréquence, si compatible avec les choix du PDF |

Les numéros de rapport, l’inspection visuelle, les erreurs et les tolérances du Sheet ne sont pas importés. Le PDF exécute ses propres formules. Les mises en page non reconnues et les données ambiguës sont signalées pour vérification, sans inventer de valeurs.

L’écran montre le pourcentage, le nombre traité et restant, les PDF créés et les erreurs. Le journal durable et l’identifiant de PDF réservé évitent les doublons après une interruption ou une réponse perdue. CDQ doit rester ouvert, connecté et déverrouillé pour avancer; après fermeture, une conversion en cours reprend à la prochaine ouverture. Une pause volontaire reste en pause.

## Validation et limites

Vérifications sur les sources complètes V25.22, les calculs du vrai modèle PDF, les contrôles serveur et des données fictives. Parcours navigateur PC, Android simulé et affichage 393/320 pixels. Aucun rapport client réel converti pendant les tests; installation Apps Script et essai sur téléphone physique à effectuer par l’utilisateur.

Le correctif web ne change pas la priorité visage/empreinte du dialogue biométrique natif Android et ne fournit pas de nouvelle APK.
