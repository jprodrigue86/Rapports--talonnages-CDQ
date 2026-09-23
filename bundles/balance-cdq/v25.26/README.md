# Balance CDQ V25.26 — Sheets et retour dans CDQ

Base Script Manager : V25.25. Manager V40. Android 25.26 nécessaire pour la correction du retour depuis l’éditeur.

- La sélection hors ligne contient les PDF et les Google Sheets du client, y compris ses sous-dossiers.
- Les PDF conservent le stockage, le point vert et la synchronisation protégée de V25.25.
- Les Sheets sélectionnés sont conservés sous forme de raccourcis par compagnie, accessibles même après redémarrage hors ligne et déverrouillage.
- Pour chaque Sheet, ouvrir Google Sheets et activer **⋮ → Disponible hors connexion**. CDQ affiche « À activer » jusqu’à confirmation manuelle. Le point vert confirmé par l’utilisateur ne constitue pas une vérification du cache Google.
- Google Sheets conserve et synchronise les modifications de ses feuilles. Retirer un raccourci de CDQ ne supprime ni la feuille ni sa copie Google. Avant de désactiver le hors connexion dans Sheets, vérifier sa synchronisation.
- L’ouverture d’une feuille ne remplace plus la page CDQ; suppression du repli différé vers la page Google. Sur Android, le parent reste sous l’éditeur jusqu’au retour. Sa recréation ne rouvre pas une seconde feuille.

Android peut toujours arrêter un processus pour récupérer de la mémoire; aucun maintien permanent n’est promis. Les tests vérifient le cycle de vie Android simulé et le stockage navigateur réel. La validation sur le téléphone et dans Google Sheets connecté reste à faire.

Historique : V25.24 a ajouté la sélection PDF et la reprise de session; V25.25 a unifié le stockage PDF, amélioré le lecteur et déplacé la conversion Sheets de plancher vers un traitement serveur. V25.26 cible la sélection Sheets et le retour depuis leur éditeur, sans modifier les modèles PDF ni la conversion.
