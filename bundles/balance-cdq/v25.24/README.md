# Balance CDQ V25.24 — reprise du travail et installation

La V25.23 publiée précédemment a corrigé le lecteur PDF, les copies préremplies, la navigation Drive et la conversion des Sheets de plancher. Son [résumé détaillé](../v25.23/README.md) reste la référence pour ces changements. La V25.24 ajoute les corrections demandées après les essais sur téléphone.

## Installer avec Script Manager V40

Choisir le lien correspondant à la version actuellement affichée par Script Manager, puis **ÉCRIRE + DÉPLOYER** :

- [V25.23 → V25.24](https://jprodrigue86.github.io/Rapports--talonnages-CDQ/apps-script-manager/?bundle=%2FRapports--talonnages-CDQ%2Fbundles%2Fbalance-cdq%2Fv25.24%2FBalance_CDQ_V25_24.cdq).
- [V25.22 → V25.24 en une seule opération](https://jprodrigue86.github.io/Rapports--talonnages-CDQ/apps-script-manager/?bundle=%2FRapports--talonnages-CDQ%2Fbundles%2Fbalance-cdq%2Fv25.24%2FBalance_CDQ_V25_24_depuis_V25_22.cdq). Ce paquet inclut aussi les corrections V25.23.

Fermer et rouvrir CDQ avec Internet après confirmation du déploiement. La partie web de l’application doit également être à jour pour accéder aux PDF au démarrage hors réseau. Aucune nouvelle APK n’est nécessaire. Le code est publié, mais le projet Apps Script privé doit être déployé par l’utilisateur dans Script Manager.

## Corrections

- **Hors ligne** ouvre un menu qui reste accessible pendant la préparation. Cocher les PDF désirés, ou utiliser Tout sélectionner/Tout désélectionner. La progression indique un pourcentage réel d’avancement par fichier et par fragment téléchargé; 100 % signifie que le traitement est terminé, avec les échecs affichés séparément.
- Fermer le menu laisse le travail continuer. Annuler arrête les téléchargements suivants après la requête en cours. Les PDF terminés restent conservés. Une fermeture complète interrompt les fichiers restants; ils doivent être sélectionnés et préparés de nouveau.
- Les fichiers conservés sont regroupés par compagnie et peuvent être retirés individuellement. Retirer une copie hors ligne ne supprime jamais le fichier Drive. Le retrait est refusé tant que des modifications attendent leur synchronisation. Un point vert marque les PDF disponibles dans la liste.
- Les nouveaux PDF préparés sont aussi conservés dans l’application installée. Au redémarrage, le bouton **Documents hors ligne** permet de les retrouver après déverrouillage, même sans Internet. Les PDF peuvent être remplis; leurs changements sont conservés puis synchronisés avec contrôle de révision. Les fichiers préparés avant V25.24 restent dans leur cache existant; les préparer une fois avec V25.24 ajoute l’accès depuis le démarrage hors ligne.
- Les Google Sheets doivent être rendus disponibles hors connexion dans Google Sheets. CDQ affiche cette limite et ne leur donne pas de faux point vert.
- Sur mobile, une session récemment déverrouillée peut être reprise pendant 30 minutes après la dernière activité. Le serveur vérifie à nouveau le jeton de session, l’utilisateur autorisé et l’appareil enregistré. Une déconnexion explicite efface cette reprise. Le simple passage en arrière-plan ne révoque pas la session. Si Android détruit le processus, un chargement reste nécessaire.
- Sans fichier sélectionné, Note et Photos ciblent la compagnie. Le point jaune près du nom ouvre sa note générale; le bleu ouvre ses photos. Avec un fichier sélectionné, les boutons Note/Photos ciblent ce fichier; les points de compagnie ciblent toujours la compagnie.
- Les anciennes routines qui réécrivaient la taille de la barre du bas sont remplacées par le réglage actuel. Les traits sous les icônes sont retirés. Le masque noir du démarrage est supprimé; le mur couvre l’écran et le chargement est de nouveau visible en bas.

## Biométrie et validation

La biométrie native est demandée avant le NIP. Le système Android choisit le capteur admissible (visage, empreinte ou autre); son API publique ne permet pas à CDQ de garantir l’ordre visage → empreinte. Aucun accès caméra ni reconnaissance faciale supplémentaire n’est ajouté.

Tests avec des données fictives : progression et annulation pendant un fragment PDF, fermeture/réouverture du menu, isolation des comptes, protection des modifications non synchronisées, reprise de session acceptée/refusée, clic sur les points de compagnie et stabilité de la navigation. Le test de démarrage ferme la page, coupe le réseau, recharge via le service worker, déverrouille avec un pont Android simulé et ouvre le vrai modèle PDF dans le lecteur. L’application du paquet simple et du paquet cumulatif sur les sources complètes donne un résultat identique. Aucun rapport client réel n’est modifié pendant ces tests; validation physique du téléphone à faire après installation.
