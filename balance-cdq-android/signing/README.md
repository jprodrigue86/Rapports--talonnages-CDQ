# Signature Android Balance CDQ à conserver

La clé durable utilisée pour l’APK **25.15 / 2515** a été retrouvée et restaurée
le 23 septembre 2026. Son certificat correspond à l’APK 25.15 livrée.
Toutes les versions suivantes doivent conserver cette identité, y compris 25.26.

La sauvegarde privée existante se nomme **Balance_CDQ_SIGNATURE_PRIVEE_2026.zip**.
Elle est conservée dans les fichiers privés de l’utilisateur et contient
`balance-cdq-release-2026.p12` et les informations de récupération. La restauration
de cette archive a été vérifiée. Ne pas créer une autre clé ni publier cette archive,
le PKCS12 ou le mot de passe dans ce dépôt, une APK, les journaux ou un artefact CI.
Seuls le certificat public et les scripts sont versionnés ici.

Identité : `ca.balancecdq.android`, alias `balance-cdq-release-2026`.
Certificat SHA-256 : `496030D9CD10E81FF4E9486C38491BC15389112C0C295C61C295981C101C4436`.
SHA-1 Google Android : `FA:9E:FA:4A:37:C3:D2:76:B2:61:1D:8C:07:E3:A8:90:9C:7F:41:B8`.
La réutilisation de cette clé conserve l’identité Google de la 25.15.

## Fabrication

1. Le workflow teste le code et produit une release **non signée et non debuggable**.
   L’artefact `Balance-CDQ-Android-25.26-release-handoff` contient l’APK, le SHA-256,
   le commit source et les outils Android. L’APK debug éventuelle est réservée à la CI.
2. Restaurer la sauvegarde privée hors dépôt. Vérifier le certificat épinglé ici.
3. Exécuter `sign-release.py --apksigner <apksigner.jar> --keystore <p12 privé>
   --password-file <fichier privé> --input <release unsigned> --output <APK finale>`.
   Le script refuse une autre clé, une APK debuggable ou un fichier de sortie existant;
   il vérifie les signatures v2/v3 après signature.
4. Vérifier l’alignement, la version, les octets ZIP et l’absence de clé privée dans
   l’APK. Publier seulement l’APK signée et ses métadonnées vérifiées.

## Canaux

`downloads/android-release-update.json` est le canal de cette identité durable.
La 25.26 le consulte pour ses prochaines mises à jour. Les APK publiées pour ce
canal doivent passer `verify-published-release.py` avec le certificat épinglé.
La mise à jour directe de la **25.15 signée avec cette clé** conserve l’installation.

`downloads/android-update.json` concerne les anciennes APK debug 25.11/25.12,
qui utilisaient des certificats différents. Ce canal reste suspendu pour éviter
une proposition de mise à jour incompatible. Son état ne signifie pas que la clé
25.15 est manquante. Ne pas réactiver la publication automatique des APK debug.
