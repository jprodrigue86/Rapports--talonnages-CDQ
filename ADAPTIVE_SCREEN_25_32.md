# CDQ Étalonnage 25.32 — écran adapté aux zones système

La zone de contenu Android est calculée depuis WindowInsets : barre d'état,
barre de navigation, découpes caméra et clavier. Elle ne dépend pas du nom du
téléphone. Le WebView entier est placé à l'intérieur de cette zone afin que la
bannière, les fenêtres et les boutons fixes du bas ne passent pas derrière les
commandes du système. Les marges ne sont pas additionnées à chaque événement.

L'interface enfant ne réapplique pas les mêmes marges. Les marges latérales
historiques qui réduisaient les rangées mobiles sont retirées dans ce contexte.
Les dimensions des éléments continuent de suivre la largeur utile. Les valeurs
personnelles Texte/Icônes/Interface ne sont ni effacées ni remplacées. En absence
de réglages, les valeurs neutres existantes (50/50/50) restent utilisées.

La même règle d'appartenance des marges est appliquée à l'iPhone : le cadre
parent utilise les safe-area-inset du navigateur et le visualViewport, tandis
que l'interface enfant n'applique pas une deuxième marge. Les changements de
clavier, orientation et dimensions provoquent une nouvelle mesure. Le pinch
zoom ne réécrit pas les préférences de présentation.

## Portée et installation

- Android : nouvelle APK 25.32 / 2532, même application et même certificat CDQ.
  Mise à jour par-dessus la version actuelle, sans désinstallation.
- iPhone : publication web 25.32, via la mise à jour confirmée dans l'application.
  Le correctif de connexion Google R1 reste conservé.
- Les pages Installer / partager sont générées depuis cette livraison commune.
- Aucun déploiement Apps Script, permission, modèle PDF, formule, image ou thème
  d'icônes n'est modifié. Le retrait du trait sous Accueil reste actif.

## Validation et limites

Les contrôles couvrent les insets Android, la navigation gestuelle et à trois
boutons, les dimensions étroites, le paysage, l'ouverture/fermeture du clavier,
les grandes préférences enregistrées et les marges iPhone parent/enfant. Les
navigateurs testés sont Chromium et WebKit. Les parcours existants de démarrage,
PDF embarqué, récupération iPhone et connexion Google anonyme sont conservés.
Le contenu de chaque ressource signée est comparé au build contrôlé et les
images/PDF/polices sont comparés octet par octet à 25.31 avant publication.

Ces tests ne constituent pas un essai sur le S25 Ultra physique de Simon ni
sur tous les modèles du marché. La règle s'adapte aux dimensions fournies par
le système; elle ne promet pas une identité pixel par pixel entre téléphones.
