# Balance CDQ V25.28 — APK avec interface embarquée

L’APK 25.28 contient l’interface Android, les menus, les images, les icônes,
les lecteurs PDF, leurs dépendances et le modèle de plancher déjà approuvé.
Les 79 ressources représentent 13,8 Mo avant compression Android. Les fichiers
clients et les permissions restent sur le serveur et Drive.

Publier d’abord ce paquet avec Script Manager V42, puis installer l’APK 25.28
signée avec l’identité existante. Le paquet accepte le serveur V25.26 ou V25.27.
Il ne refait pas la modification fragile `company-list`. Les anciennes APK et
le PC conservent leur fonctionnement avec ce serveur.

La nouvelle interface démarre depuis les ressources APK sous le domaine CDQ
existant, afin de conserver le jeton appareil et les préférences de la coque.
Le cache propre à l’ancien cadre Google se reconstitue lors de la première
utilisation; il n’est pas copié entre origines. Un petit cadre Google assure
uniquement les appels de connexion et de données. Aucun accès client n’est
accordé par le seul fait de charger l’interface locale.

Les échanges vérifient l’origine, la descendance des cadres, un identifiant de
connexion aléatoire et la liste de fonctions exposées. Les mutations ne sont
jamais relancées automatiquement après une interruption réseau. Le contrôle
des sessions, des rôles, le NIP et la biométrie existants sont conservés.

Les ressources APK ne sont pas remplacées par un rechargement du site. Leurs
changements nécessitent une nouvelle APK. Les mises à jour de données et du
serveur restent séparées. Le canal Android stable reste sur 25.26 pendant
l’essai de cette APK; aucun déploiement automatique à tous les utilisateurs.

Construction : `node scripts/build-embedded-android-v2528.mjs`, puis Gradle.
Le snapshot compressé contient uniquement le HTML client auparavant servi au
navigateur. Aucun Code.gs privé, fichier client ou secret de signature ne fait
partie de l’APK. Le paquet serveur se reproduit avec
`node scripts/build-embedded-package-v2528.mjs`.

Validation : intégrité des ressources, routage Android local, protocole et
rejet des messages non autorisés, test navigateur de l’interface complète avec
connexion retardée, liste clients, PDF intégré et absence de téléchargement
de ressources fixes. Les données serveur sont simulées dans ce test; la mesure
de rapidité réelle et la connexion du téléphone restent à vérifier sur appareil.
