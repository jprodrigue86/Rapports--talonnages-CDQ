# Balance CDQ — connexion V21.41

La connexion est maintenant pilotée uniquement par index.html. L'ancien renvoi automatique placé dans firebase-config.js est retiré. Une seule fenêtre Google est ouverte; un double clic retrouve la fenêtre existante.

Le protocole 41 attend le signal du vrai Selector et tente une seule reprise intégrée. Si le chargement intégré ne répond pas, le même Selector continue dans la fenêtre Google déjà authentifiée, sans retour forcé ni seconde activation parallèle. Les messages sont liés à la fenêtre, à l'origine et à un état aléatoire; ce signal n'accorde aucun droit d'accès.

Le serveur privé Code.gs et le Selector V21.41 sont livrés séparément, hors de ce dépôt public. Ils sont nécessaires pour supprimer la page intermédiaire « Continuer dans CDQ » et pour reprendre la création du NIP avec un ticket d'activation encore valide (30 minutes). Les anciennes versions serveur restent prises en charge pendant l'installation, avec leur ancien écran de retour.

Parcours prévu : compte Google, clé à usage unique à la première activation, NIP à quatre chiffres, puis biométrie facultative. Les ouvertures suivantes conservent le jeton de l'appareil et demandent la biométrie disponible ou le NIP. L'accès direct de secours dans un onglet utilise le NIP; il ne remplace pas toutes les fonctions de la PWA installée.

Le cache public est versionné sans effacer IndexedDB, les modèles, les rapports locaux, les inscriptions biométriques ou le jeton d'appareil. Aucune permission Google, aucun utilisateur, aucun maître Drive et aucune configuration privée Firebase ne sont modifiés par ce commit.

Validation : 136 contrôles locaux automatisés passent (Google et navigateur simulés), dont 22 tests du lanceur et 19 du parcours privé. Aucun compte technicien réel n'a été testé. Le test Chromium n'a pas pu naviguer dans l'environnement d'essai. Le déploiement Apps Script et les essais Android/PC restent à effectuer; version.json conserve ces indicateurs à false.
