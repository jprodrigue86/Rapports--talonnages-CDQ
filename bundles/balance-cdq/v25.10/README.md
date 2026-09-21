# Balance CDQ V25.10 / Android 25.11 / Script Manager V40

Correctif préparé le 21 septembre 2026 pour l'affichage, les documents et le modèle de balance de plancher. Le fonctionnement sur le téléphone et le déploiement Apps Script restent à confirmer.

## Problèmes identifiés et corrections

| Problème | Correction préparée |
| --- | --- |
| Logo coupé par le masque Android | Cadrage du logo existant dans la zone de sécurité de l'icône adaptative. Thème de démarrage Android 12+ explicite avec fond sombre. |
| Espace vide à droite après réglage de l'interface | Retrait du zoom V25.08 et du facteur 0,88 de la page parente Android. Conservation d'un seul moteur de densité avec largeur relative à l'écran; application pendant le déplacement du curseur. |
| Préférences de documents contournées | Retrait du gestionnaire PDF `pointerup` qui précédait le gestionnaire `click`. Un seul point d'entrée Android pour PDF, Sheets et notes TXT archivées. |
| Ancien compte réutilisé après effacement du défaut | Lecture du réglage visible V22.94 uniquement, sans déduction à partir du compte connecté. Retrait de la seconde carte de compte Android. |
| Choix du lecteur trop tardif | Choix du compte, puis du lecteur, avant l'autorisation Drive et la récupération du document. Les défauts explicites sautent les choix correspondants. |
| Ancien modèle de plancher prioritaire | Utilisation du modèle Drive existant; maintien du mécanisme de préparation hors ligne. |
| Multiples fichiers de modèle dans Apps Script | Retrait conditionnel de 24 fragments connus et de leur chargeur, selon leur présence et leur SHA-256. Aucun document client concerné. |
| Risque d'écraser une modification récente | Manager relit le projet et bloque les écritures si un fichier ciblé a changé; sauvegarde complète avant écriture et vérification après. |
| Réglages qui réécrivent continuellement leur DOM | Mise à jour des boutons uniquement lorsque leur contenu change. Retrait d'un bloc CSS strictement dupliqué. |
| Confirmation de production trompeuse | Une vérification web échouée reste signalée comme en attente; le Manager ne la remplace plus par une confirmation verte. |

## Vérifications

- Tests automatisés du routage : quatre combinaisons compte/lecteur, ancien compte, clic double, déplacement, appui long, sélection, Sheets, TXT et rôle lecture.
- Tests du nettoyage : empreintes, noms autorisés, références restantes, modification concurrente et nouvel appelant ajouté après préparation.
- Tests du résultat de déploiement : confirmation Google avec vérification de production réussie ou échouée; le statut final reflète le contrôle réel.
- Les 21 correctifs ont été appliqués avec le moteur réel du Manager sur une reconstruction V25.09; `Code.gs` et les 40 scripts JavaScript intégrés résultants passent l'analyse syntaxique.
- Les sources privées complètes restent hors du dépôt. La reconstruction provient de l'export V22.26 archivé et des correctifs du dépôt; elle ne prouve pas l'état du projet actuellement déployé.

## Conditions avant utilisation

1. Compiler et installer Android 25.11, puis vérifier le logo et l'écran de démarrage sur le téléphone. La capture annoncée par l'utilisateur n'a pas encore été reçue.
2. Ouvrir Script Manager V40 et charger le vrai projet. Le package accepte seulement la base V25.09. Les recherches littérales et empreintes doivent correspondre; tout écart bloque l'opération.
3. Vérifier le modèle Drive `1Eyji-xHX69Wa0EQTx0nx-D8KEmfY_hhB`, puis appliquer le package avec sauvegarde et mettre à jour le déploiement existant.
4. Sur le téléphone, tester les valeurs 0/50/100 des trois curseurs et le retour à 50, les quatre combinaisons compte/lecteur, deux comptes Google, une note TXT, un Sheet, puis le retour d'une modification PDF.

Le choix des applications peut être immédiat. L'affichage d'un document distant exige toutefois un accès Drive et éventuellement un transfert. Une autorisation Google peut être demandée lorsqu'elle manque ou a expiré. La configuration OAuth Android et le comportement du compte dans l'application Google Sheets doivent être vérifiés sur appareil.

Le lecteur interne CDQ explicitement choisi conserve son chemin existant. Le nouveau chemin des notes vise les fichiers TXT archivés. Cette intervention cible les causes observées; elle ne certifie pas l'absence de tout autre défaut dans les deux applications. Aucun fichier du projet Apps Script en ligne n'a été supprimé pendant la préparation.
