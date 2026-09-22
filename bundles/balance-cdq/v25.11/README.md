# Balance CDQ V25.11 et Android 25.12

Le package `Balance_CDQ_V25_11.cdq` s’importe ou se colle dans CDQ Script Manager V40, sur un projet déjà en V25.10. Si le projet est encore en V25.09, utiliser `Balance_CDQ_V25_11_depuis_V25_09.cdq`, qui inclut aussi la correction V25.10 R2. Aucun de ces packages ne supprime de fichier modèle. Le Manager vérifie le code installé, sauvegarde le projet avant écriture et relit le résultat.

- **Tailles** : icônes Dossier, Hors ligne, Réglages, navigation et cadres pilotés par les curseurs; format téléphone plus compact. Les valeurs enregistrées sont conservées. Réglages → Tailles → « Appliquer le format téléphone compact » propose Interface 25, Texte 35, Icônes 35.
- **Réglages** : catégories Tailles, Apparence, Fichiers, Gestes, Mises à jour et Avancé; compte Google et lecteur PDF réunis dans Fichiers.
- **Documents Android** : lecteurs VIEW/EDIT et import PDF des applications iLovePDF/Acrobat; ouverture VIEW prioritaire, URI de fichier et droits transmis. Les applications de courriel/partage ne sont pas proposées comme lecteurs. Si le lecteur importe une copie, l’écran le précise : il faut enregistrer cette copie dans Drive depuis le lecteur.
- **Délais** : autorisation Google en parallèle du choix du lecteur; une requête de contenu conditionnelle remplace métadonnées puis téléchargement. Les fichiers en cache restent séparés par compte et sont revalidés auprès de Drive. Sheets conserve son passage direct à l’application Google Sheets.
- **Biométrie** : après un premier déverrouillage avec cette version, un appareil Android déjà enregistré peut demander la biométrie avant l’appel d’état d’accès. L’accès reste verrouillé jusqu’à l’obtention d’une nouvelle session du serveur.

Les modifications Android nécessitent l’APK 25.12; le patch Apps Script seul ne les installe pas. Mettre à jour l’APK existant, sans désinstaller l’application.

## Vérifications et limites

Le moteur réel du Manager applique le package aux deux fichiers reconstruits V25.10 R2; 42 scripts passent l’analyse syntaxique. Les modèles installés sont conservés. Des tests automatisés vérifient les composants mobiles à 320, 360 et 412 pixels ainsi que les intentions Android et leurs permissions.

Ces tests ne confirment pas le comportement physique d’iLovePDF, Acrobat, Google Sheets ou de la biométrie sur le téléphone. Ils ne confirment pas non plus la configuration OAuth Google du projet. Si Google renvoie le code 10, il faut corriger le client OAuth Android (nom de package et empreinte du certificat de signature); un changement de lecteur ne corrige pas cette autorisation. L’erreur est maintenant persistante et le passage à Drive reste un choix explicite.

Aucun délai quasi instantané n’est garanti pour un premier téléchargement ou une demande de consentement Google. Aucun projet Apps Script de production n’a été écrit depuis cette session.
