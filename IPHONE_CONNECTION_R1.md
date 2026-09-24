# Correction de connexion iPhone — base V25.30, révision R1

La version de base demeure 25.30. Le fichier de publication iPhone possède une
nouvelle empreinte de livraison et `connectionRevision: 2026.09.24-iphone-rpc-r1`.
Le mécanisme de mise à jour compare les empreintes, pas seulement ce numéro de base.

## Cause reproduite sur la connexion Google réelle

Le 24 septembre 2026, les essais anonymes ont constaté une réponse Google reçue
par l'application mais rejetée par le transport WebKit. Le message READY provient
du cadre de code utilisateur HtmlService. Pour la réponse asynchrone, WebKit
signale comme source son parent relais immédiat, à la même origine Google.
Chromium signale le cadre utilisateur dans les deux cas.

Diagnostic de la source des messages :
https://github.com/jprodrigue86/Rapports--talonnages-CDQ/actions/runs/36057225564

Les essais de mise en page (cadre masqué, visible et hors écran) n'ont pas résolu
le problème. Il ne s'agissait pas d'une absence du paquet serveur V25.28.

## Correction limitée à la copie iPhone

`scripts/iphone-rpc-compat.mjs` adapte le fichier de transport après vérification
des ressources Android. Il épingle le relais parent exact lors du handshake
validé. Une réponse doit toujours correspondre à l'origine HTTPS Google épinglée,
au canal aléatoire, au protocole, à une requête envoyée et non terminée, et provenir
du cadre initial ou de ce relais précis dans le sous-arbre attendu. Les cadres
frères, autres origines et identifiants inattendus restent refusés. Les écritures
ne sont jamais rejouées automatiquement.

Le message d'expiration d'une vérification de connexion est distingué de celui
d'une écriture. Aucun conseil de redéploiement Google n'est donné par défaut.

## Actualisation lorsque les réglages ne sont pas accessibles

La page `/iphone/app/connection-repair.html` récupère le manifeste de publication,
prépare le service worker de la portée iPhone, vérifie son empreinte puis l'active
uniquement après confirmation de l'utilisateur. Elle ne supprime ni stockage
local ni caches de documents. Le code et les fichiers statiques sont actualisés;
les formulaires ouverts doivent être enregistrés avant la relance.

Le lien est présent sur les pages d'installation Android/iPhone. L'APK Android
et le ZIP restent masqués sur iPhone/iPad dans ces pages. Les deux parcours de
partage restent séparés. Une actualisation effectuée dans Safari concerne ce
contexte de navigation; elle ne prouve pas que le stockage séparé d'une icône
installée sur l'écran d'accueil a déjà adopté la même livraison. L'application
installée conserve son propre mécanisme de vérification et d'activation.

## Contrôles et limites

- `tests/iphone-rpc-compat.test.mjs` : identités exactes, origines, canaux,
  identifiants, messages tardifs et absence de rejeu.
- `tests/iphone-recovery.browser.mjs` : Chromium/WebKit, annulation, confirmation,
  passage d'un ancien service worker au nouveau, première installation,
  conservation d'une session locale et d'un document de test dans IndexedDB.
  Le rechargement hors ligne est testé sur Chromium uniquement. L'émulation
  hors ligne WebKit a produit une erreur interne de navigation; la réouverture
  hors ligne d'un iPhone n'est donc pas validée par cette suite. Le code de ce
  mode hors ligne n'est pas modifié par le correctif de connexion.
- `tests/iphone-rpc-live.test.mjs` : appel anonyme sur le vrai service Google,
  puis démarrage de l'interface jusqu'à l'écran de connexion Google, sans
  connexion à un compte, sans lecture ou écriture de dossier client.
- Les contrôles existants iPhone/Android vérifient les liens, l'interface et les
  empreintes des images et du modèle PDF conservés.
- Après publication, un contrôle séparé compare les empreintes des fichiers
  servis par GitHub Pages puis teste la connexion anonyme avec ces vrais fichiers.

Les résultats des contrôles sont disponibles dans GitHub Actions. Les tests
anonymes ne valident ni un iPhone physique, ni la connexion au compte réel d'un
technicien, ni ses opérations sur les PDF. Aucun projet Google, permission,
modèle PDF, code Android natif ou APK n'est modifié par cette correction.
