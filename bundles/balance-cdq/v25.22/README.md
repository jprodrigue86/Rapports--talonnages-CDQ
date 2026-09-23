# Balance CDQ V25.22

Installer avec CDQ Script Manager V40, sur une base Balance CDQ V25.21 :

https://jprodrigue86.github.io/Rapports--talonnages-CDQ/apps-script-manager/?bundle=%2FRapports--talonnages-CDQ%2Fbundles%2Fbalance-cdq%2Fv25.22%2FBalance_CDQ_V25_22.cdq

Les sept changements demandés :

1. Date et heure retirées du panneau PC.
2. Version sur la ligne « En ligne », sous le profil JR Administrateur.
3. Ancienne ligne « Balance CDQ / version » retirée.
4. Indicateur animé pendant les ouvertures et opérations serveur, terminé sur réponse ou erreur.
5. Alerte de nouvelle version près du profil PC et au-dessus du contenu mobile. Elle distingue une version publiée à installer via Script Manager d’une version déjà déployée à charger.
6. Barre de sélection mobile compacte, avec le nombre sélectionné et deux boutons de 42 px.
7. Glissement vers la droite : « Copier » pour fichier ou dossier. Choix du dossier actuel ou d’un client puis de ses sous-dossiers. Le menu PC propose aussi cette action.

Les copies conservent les originaux, choisissent un nom sans écraser de fichier et réutilisent un reçu par demande pour éviter les doublons lors d’une reprise réseau. Les permissions CDQ et l’appartenance aux dossiers autorisés sont vérifiées côté serveur. Les copies de dossiers incluent les fichiers, sous-dossiers et dossiers vides. Les raccourcis Drive et les dossiers dépassant 200 éléments ou 25 niveaux sont refusés avant écriture. En cas d’erreur contrôlée, seule la nouvelle copie partielle est mise à la corbeille. Un arrêt forcé de l’exécution peut laisser une copie partielle, signalée par la demande restée en cours.

Ce paquet modifie l’interface web PC/Android et ne nécessite pas une nouvelle APK. Il ne modifie ni les PDF ni la clé Android. L’installation doit passer par les sauvegardes et vérifications habituelles de Script Manager.

## Blocage Android 25.21 signalé

La capture du 23 septembre montre « Appli nuisible bloquée » par Google Play Protect. La signature correcte et le SHA-256 vérifié ne prouvent pas l’absence de problèmes de sécurité et ne lèvent pas ce classement. Aucune nouvelle APK n’est présentée comme solution à ce blocage dans cette livraison.

Voir `balance-cdq-android/signing/PLAY_PROTECT_25_21.md` pour les faits vérifiés et les informations encore nécessaires. Aucun contournement de Play Protect n’est requis pour installer les modifications web sur l’application existante.
