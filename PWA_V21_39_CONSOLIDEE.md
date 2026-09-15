# V21.39 — Corrections consolidées

Version PWA : `2026.09.15.1900-v21.39`. Cette mise à jour conserve les correctifs de connexion Google V21.38 et les ajouts parallèles de copie locale Balance à camion. L’URL Apps Script reste celle déjà utilisée (paramètre 272).

## Application publique

Les copies locales du panneau Modèles hors ligne peuvent être remplies puis enregistrées sur l’appareil. L’accusé du lecteur intervient seulement après validation de l’écriture locale. Une copie vierge ajoutée au Drive ne fait plus passer un PDF rempli en état synchronisé. Les réessais et accusés périmés conservent le même identifiant de copie et la bonne révision.

Le choix du dossier est explicite. La consultation du maître est en lecture seule. Les contrôles de rôle et de compte sont vérifiés avant la copie locale. La compatibilité avec le message de copie directe Balance à camion est conservée. Les cinq entrées déjà prévues sont préservées : plancher, Quvre 4, précision, camion et cuve 3 points.

Le chargement Google, le fond noir, les appareils activés, le NIP, la biométrie et les anciens fichiers locaux restent préservés. La mise à jour ne vide pas le cache fonctionnel avant l’activation du remplaçant.

## Extension serveur privée — non déployée par cette intervention

Un paquet privé séparé contient les corrections Code.gs et Selector.html, ainsi que les quatre PDF approuvés intégrés sous forme de ressources privées : plancher, Quvre 4, précision et camion. Le modèle cuve 3 points conserve son chemin Drive existant. Aucun PDF, code serveur privé ou contenu client n’est ajouté au dépôt public. Les originaux de CDQ Système restent inchangés.

La préparation des quatre ressources intégrées et la synchronisation des réponses des PDF remplis demandent l’import puis la publication de cette extension dans le projet Apps Script existant. Le protocole 38 doit être annoncé par ce serveur avant d’autoriser les envois remplis. Sans lui, les réponses restent locales et peuvent être téléchargées. Aucune nouvelle version Apps Script n’a été publiée ici. L’import et l’exécution des ressources intégrées de grande taille doivent encore être validés dans Google.

Firebase conserve sa configuration actuellement vide : les notifications ne sont pas annoncées comme fonctionnelles. Aucun secret n’est inventé ni publié.

## Vérifications

93 contrôles locaux réussis : 18 connexion, 4 intégration du bootstrap, 11 PWA, 11 biométrie, 38 tests Node de logique/lecteur/hors-ligne, 11 contrôles serveur et PDF. Les quatre empreintes SHA-256 des ressources reconstruites correspondent aux PDF approuvés.

Ce sont des tests locaux avec doublures de navigateur/Drive, pas une validation sur téléphone ni sur le service Google réel. Le navigateur d’essai a bloqué l’accès à la page locale par sa politique administrateur. La connexion d’un nouveau technicien sur Android, l’import du paquet serveur, la synchronisation réelle et Firebase restent à vérifier après déploiement autorisé.
