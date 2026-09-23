# Balance CDQ V25.20 — lecteurs PDF PC et Android

Installer **V25.19 d’abord**, puis ouvrir ce package dans CDQ Script Manager V40 :

[Installer V25.20](https://jprodrigue86.github.io/Rapports--talonnages-CDQ/apps-script-manager/?bundle=%2FRapports--talonnages-CDQ%2Fbundles%2Fbalance-cdq%2Fv25.20%2FBalance_CDQ_V25_20.cdq)

Choisir **ÉCRIRE + DÉPLOYER**, puis fermer et rouvrir PC et Android avec Internet pour charger les ressources. L’APK existante est conservée. Dans **Réglages → Lecteur PDF**, sélectionner **Lecteur CDQ**, ou le choisir à l’ouverture avec « Utiliser ce lecteur par défaut ».

- **Supprimer** est dans le premier menu ⋯ du fichier et dans la barre d’actions après sélection sur PC. La confirmation et les droits restent ceux de l’application.
- Les deux applications utilisent le même moteur PDF local, avec les couleurs originales du document et ses champs/calculs. Aucune comparaison pixel par pixel avec iLovePDF n’est revendiquée.
- Zoom, pincement à deux doigts, déplacement à un doigt et rotation de 90°. Le pincement conserve un aperçu et ne redessine qu’au relâchement.
- À la fermeture d’un PDF modifié : **Enregistrer et fermer**, **Continuer à remplir**, **Fermer sans enregistrer**. Les enregistrements explicites précédents restent acquis.
- Les rapports client existants sont mis à jour dans leur fichier et dossier d’origine. Une révision modifiée depuis l’ouverture bloque l’écrasement; la sauvegarde refusée reste consultable dans le lecteur et peut être téléchargée.
- Hors ligne, la confirmation indique que les réponses sont conservées sur cet appareil et attendent la synchronisation. Elle ne prétend pas que Drive a déjà reçu les modifications.

## Validation

Tests automatisés du lecteur réel dans Chromium PC et Android simulé : champs, calculs de tolérance/erreur/conformité, couleurs, zoom, rotation, réouverture, retour matériel simulé, les trois choix de fermeture, sauvegarde du même fichier, succession de sauvegardes hors ligne et conflits. Tests de la suppression PC, des droits et de l’isolation de compte, des ressources mises en cache et de l’application des 12 correctifs sur les sources V25.19.

La création du rapport de plancher hors ligne reste couverte par le parcours V25.19. Les octets du PDF approuvé ne changent pas. Aucun rapport client réel ni déploiement Apps Script privé n’a été modifié pour ces tests. Le comportement sur un téléphone physique reste à confirmer après installation.
