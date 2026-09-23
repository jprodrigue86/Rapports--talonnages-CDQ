# Balance CDQ V25.27 — démarrage et dossiers

Installer avec Script Manager V41 depuis V25.26 :
https://jprodrigue86.github.io/Rapports--talonnages-CDQ/apps-script-manager/?bundle=v25.27

Utiliser **ÉCRIRE + DÉPLOYER**, puis fermer et rouvrir Balance CDQ avec Internet. L’APK 25.26 existante convient : aucun changement natif ni nouvelle APK dans cette livraison.

## Changements

- Le service worker affiche immédiatement la page d’accueil déjà disponible, tout en vérifiant sa nouvelle version en arrière-plan. L’action explicite de mise à jour conserve son passage par le réseau.
- Les scripts de configuration ne bloquent plus l’analyse de la page. Suppression de l’attente minimale artificielle de 400 ms. Le gros module du modèle PDF est importé à sa première utilisation; le modèle reste embarqué et disponible hors ligne.
- Le Selector V25.26 récupéré depuis le déploiement public passe de 3 062 276 à 1 940 937 octets après application du paquet (36,6 %). Les deux images d’icônes sont identiques octet pour octet et référencées comme ressources séparées. Cette mesure porte sur le HTML, pas sur le temps de lancement ni sur la somme de tous les premiers téléchargements.
- Une connexion autorisée peut renvoyer immédiatement la liste des clients en cache. La vérification Drive intervient après l’affichage; le nettoyage IndexedDB attend trois secondes.
- Les listes de fichiers utilisent des métadonnées groupées par pages de 1 000 éléments. L’ancien chemin Drive reste disponible si le service avancé échoue.
- Jusqu’à huit sous-dossiers du niveau suivant du client courant sont préparés, un à la fois, après affichage des fichiers. Une place supplémentaire reste disponible pour le dossier demandé par l’utilisateur. Cliquer sur un préchargement en cours rejoint la même requête.
- Les rafraîchissements conservent les enfants préparés depuis moins de deux minutes. Sur téléphone, ouvrir un dossier rend son contenu préparé même si son élément visuel a été créé avant le préchargement.
- Le verrouillage, le changement de client ou de compte et la suppression d’un dossier invalident ses réponses tardives. Aucun préchargement spéculatif lorsque la page est cachée ou hors ligne.

## Vérification

Le générateur applique les 18 modifications gardées aux sources V25.26 et vérifie la syntaxe de tous les scripts obtenus. Les tests couvrent la priorité, la déduplication, la limite des requêtes, le cache, les changements de contexte, les badges Drive et le démarrage depuis le cache avec un réseau bloqué. Un test Chrome utilise le véritable rendu mobile des dossiers et vérifie l’apparition des Sheets après préchargement et pendant une requête partagée. Les parcours existants vérifient aussi le redémarrage hors ligne, la biométrie simulée, les documents persistants et le lecteur PDF.

Les gains en secondes sur le téléphone et sur le Drive réel restent à mesurer après le déploiement privé par le propriétaire. Le paquet ne désactive aucune étape de validation biométrique ou serveur. Les métadonnées de version ne déclarent pas ce déploiement privé comme déjà vérifié.
