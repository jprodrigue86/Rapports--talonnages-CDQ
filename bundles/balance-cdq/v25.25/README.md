# Balance CDQ — reprise et corrections V25.25

Build : `2026.09.23-v25.25-lecteur-hors-ligne`. Base requise : V25.24. Script Manager V40. Compatible avec l’APK déjà installée.

## Installation

Ouvrir le paquet `Balance_CDQ_V25_25.cdq` dans Script Manager, puis **ÉCRIRE + DÉPLOYER**. Fermer et rouvrir CDQ avec Internet pour charger le lecteur et le stockage V25.25. Aucun dossier client n’est converti simplement en installant la mise à jour.

## Ce qui a été repris

V25.23 avait introduit le lecteur intégré, les calculs du PDF approuvé, le Drive dans la liste principale et la conversion reprise par le navigateur. V25.24 avait ajouté la sélection des PDF hors ligne, le pourcentage, l’annulation, le menu par compagnie, les points note/photo et la reprise de session mobile de 30 minutes.

Le retour après utilisation de V25.24 a révélé le blocage du partage, un bouton ajouté sur le mur musical, un parcours de conversion trop large et deux chemins de sauvegarde pour les documents préparés. V25.25 corrige ces points. Les fonctionnalités nouvelles doivent désormais entrer dans les icônes et menus existants.

## Changements V25.25

- **Installer / partager** ouvre son menu sans navigation de toute la fenêtre vers une intention Android. Fermer ou Échap retire entièrement la fenêtre de partage.
- **Démarrage** : aucun bouton « Documents hors ligne » sur le mur musical. Le chargement apparaît avec un libellé et une barre sur fond transparent. En démarrage sans Internet, les fichiers déjà préparés s’ouvrent dans leur page locale après déverrouillage.
- **Navigation** : retrait des traits de sélection, y compris dans la navigation PC; les icônes restent présentes.
- **Chargement d’un fichier** : progression dans la ligne et état de travail intégré à la page PC, sans carte flottante en bas à droite.
- **Lecteur PDF** : pleine page dans CDQ, déplacement au clic-glissé PC, défilement natif à un doigt sur téléphone, pincement et boutons de zoom. Un seul canvas par page évite la tuile de détail superposée pendant les déplacements. Champs noirs et gras. Enregistrement, confirmation avant fermeture, calculs et navigation des champs conservés.

## Fonctionnement hors ligne

1. Ouvrir le client, puis le menu Hors ligne. Cocher uniquement les PDF souhaités et préparer les fichiers.
2. Le point vert apparaît devant le nom des fichiers préparés dans la liste principale, y compris avec un nom long. Ce point confirme la disponibilité locale; il ne prouve pas que des modifications sont déjà synchronisées.
3. Ouvrir le PDF depuis cette liste et **Enregistrer** les réponses. La liste principale et les documents locaux utilisent la même copie persistante et la même file de synchronisation.
4. Avec Internet et une session déverrouillée, CDQ envoie automatiquement les modifications au PDF original dans Drive. Le retour au premier plan relance aussi cette vérification. Fermer complètement l’application suspend cette synchronisation locale jusqu’à sa prochaine ouverture.
5. Le retrait du mode hors ligne est bloqué si une sauvegarde attend une confirmation ou si un envoi est en cours. En cas de conflit avec une modification faite ailleurs, les réponses locales restent conservées. Le retrait réussi enlève le point vert et la copie locale, sans supprimer le PDF Drive.

Les fichiers Google Sheets gardent leur propre gestion hors connexion dans Google Sheets. Seuls les PDF sont annoncés comme disponibles hors ligne dans CDQ.

## Conversion des Sheets de plancher

Dans le client source ouvert, choisir **Convertir les Sheets de plancher** dans les réglages. Le menu indique le client et la destination avant de démarrer.

- Inventaire limité à ce client et ses sous-dossiers; détection de « Balance de plancher » dans le contenu du Sheet.
- Destination vérifiée : `VAPP1.0 → même client → Rapports d’étalonnage`.
- PDF nommé exactement comme le Sheet, avec l’extension `.pdf`. Si un autre PDF porte déjà ce titre, le fichier est signalé à vérifier; aucun suffixe inventé ni remplacement automatique.
- Colonne **Poids** du Sheet → charge utilisée du PDF. Colonne **Charge utilisée** du Sheet → **charge de contrainte** du PDF.
- Original Sheet conservé. Modèle PDF approuvé, en-têtes, dessin et scripts de calcul conservés; le PDF demeure modifiable.
- Traitement par un déclencheur Google, environ un fichier par minute, même après fermeture de l’application ou du téléphone. Une seule conversion active à la fois. Journal durable, identifiant de sortie réservé et reprise sans doublon.
- Google peut demander l’autorisation du service de déclencheurs au premier démarrage. Une erreur d’autorisation ou un quota apparaît dans le suivi; le journal conserve les étapes déjà terminées.

## Vérification et limites

Tests locaux avec Chrome : fermeture du partage, liste principale et sauvegarde hors ligne, protection contre retrait prématuré, redémarrage sans réseau avec le vrai service worker, lecteur PC/téléphone, glissement et pincement, saisie noire, sauvegarde et confirmation de fermeture. Tests du worker serveur avec services Google simulés : choix du client, chemin, titre, collision, reprise, révision source et génération réelle du PDF sans DOM ni temporisateurs.

L’application privée Apps Script et les données clients ne sont pas modifiées par ces essais. Le déclencheur et l’écriture réelle dans le Drive du client restent à confirmer après installation dans Script Manager et lancement explicite d’une conversion. La biométrie reste sélectionnée par Android; la priorité visage/empreinte ne peut pas être forcée par la page web.
