# Android 25.21 — blocage Play Protect signalé

État au 23 septembre 2026 : non résolu. L’utilisateur a montré « Appli nuisible bloquée » et « Cette appli peut mettre votre appareil ou vos données en danger ». Le détail du classement n’est pas visible.

Faits vérifiés :

- Paquet : `ca.balancecdq.android`, version 25.21 / 2521, release non débogable.
- APK SHA-256 : `1baeebb7b9115f1ac952675cedc1a9899a6591f7fdd138ef5b98467b4f3b9ada`.
- Certificat SHA-256 : `496030d9cd10e81ff4e9486c38491bc15389112c0c295c61c295981c101c4436`, identique à la release 25.15.
- Les vérifications APK v2/v3, version, hachage et alignement ont réussi; le fichier téléchargé correspond au fichier signé.
- Le manifeste source déclare INTERNET, REQUEST_INSTALL_PACKAGES (mise à jour) et USE_BIOMETRIC. Il ne déclare ni lecture SMS, ni service d’accessibilité, ni écoute des notifications. Ces constatations ne déterminent pas la cause du classement.
- SDK cible 35. Dépendances déclarées : AndroidX Core 1.15.0, Browser 1.8.0 et Google Play Services Auth 21.6.0.

Points de revue à traiter avant de conclure à une fausse alerte :

- `MainActivity` expose un pont JavaScript dans le WebView; les navigations HTTP(S) ordinaires et le fallback d’un intent ne sont pas restreints à une liste d’origines approuvées. Il faut restreindre les navigations, les schémas et les capacités accessibles au contenu tiers, tout en préservant le chemin Google hors WebView.
- `UpdateActivity` vérifie le hachage, le nom du paquet et la version; la validation de l’APK devrait aussi épingler le certificat attendu avant de proposer l’installation. Android vérifie déjà les signatures des mises à jour, mais cela ne remplace pas le contrôle applicatif.
- Ces points sont des observations du code, pas une attribution du motif Play Protect. Aucun test antivirus complet ni approbation Google n’est revendiqué.

Prochaine information indispensable : ouvrir « Plus de détails » dans l’alerte et relever le texte exact. Si la revue conclut à un classement erroné, la procédure officielle est une demande de réexamen. Le formulaire demande notamment le nom du paquet et le SHA-256 de l’APK soumis à VirusTotal. Aucune soumission externe n’a été faite.

Références officielles :

- https://developers.google.com/android/play-protect/warning-dev-guidance
- https://support.google.com/googleplay/android-developer/contact/protectappeals

Ne pas annoncer le blocage corrigé à partir d’un nouveau numéro de version, d’un changement de nom ou d’une signature seule. Ne pas remplacer la clé durable pour essayer de changer le classement.
