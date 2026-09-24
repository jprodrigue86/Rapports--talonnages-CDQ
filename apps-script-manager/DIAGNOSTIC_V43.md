# CDQ Script Manager V43 — diagnostic privé des versions

Cette mise à jour concerne Script Manager seulement. Elle ne remplace aucune APK,
ne change aucun modèle et ne déploie pas le projet Google Apps Script.

## Utilisation

Ouvrir Script Manager V43 et toucher « Lire le projet ». Le bloc « Diagnostic des
versions » compare la source Google et le contenu de la version associée au
véritable déploiement CDQ, avec les empreintes SHA-256 des fichiers. Il relève
également les publications Android, iPhone, Web/PC, le package automatique, le
plus récent package serveur disponible et le commit de la branche GitHub main.

La première fois, un ancien jeton V42 peut manquer de l’autorisation Drive pour
le rapport. Toucher « Autoriser le rapport Drive » et accepter la demande Google.
Le projet est ensuite relu sous ce compte. Aux lectures suivantes, le rapport est
mis à jour automatiquement, si la case « Enregistrer le diagnostic dans mon Drive
privé » reste activée. Cette automatisation est limitée au projet CDQ connu.

Le fichier **CDQ_Diagnostic_Versions.txt** est créé dans Mon Drive, à la racine.
ChatGPT peut le rechercher et le lire avec le connecteur Drive autorisé lors
d’une demande ultérieure. Le bouton « Ouvrir le rapport privé » donne son lien
exact. « Copier le diagnostic » est disponible si l’enregistrement échoue.

## Confidentialité et limites

Le rapport contient des identifiants de projet/déploiement, dates, versions,
empreintes et états de vérification. Il ne contient pas le code source, les
mots de passe, les jetons Google, les identifiants OAuth ou les réponses brutes
d’erreur. Aucune permission de partage n’est créée ou modifiée. Un fichier partagé
ou non identifié comme rapport de cette application n’est pas écrasé.

Le scope Google supplémentaire est `drive.file`, limité aux fichiers créés ou
ouverts avec l’application ; il ne donne pas un droit d’écriture général sur Drive.
Le diagnostic ne donne pas un accès distant permanent au script, ne surveille
pas le compte en arrière-plan et ne déclenche aucune écriture Apps Script.

Une absence de version annoncée ne signifie plus « production différente ».
La comparaison porte sur le code de la version Google, pas sur un libellé manquant.
Les erreurs d’accès ou un changement de déploiement pendant la lecture restent
« non confirmés ». Les versions installées sur les téléphones et le bon fonctionnement
réel de l’URL `/exec` ne sont pas mesurés par ce diagnostic.

## Validation reproductible

Tests Node : `tests/script-manager-diagnostics-v43.test.mjs`, plus les suites
réseau V41 et patches V42. Tests d’interface :
`tests/test-script-manager-diagnostics-v43.py` (Chromium et WebKit avec services
Google/GitHub simulés) et `tests/test-apps-script-manager.mjs`.
La première autorisation réelle et le premier rapport du compte utilisateur
restent à confirmer dans l’application. Les tests n’utilisent pas son compte.
