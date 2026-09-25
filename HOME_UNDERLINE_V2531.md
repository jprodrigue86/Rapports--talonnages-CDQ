# Android / iPhone 25.31 — Accueil sans trait bleu

Seule la décoration `::after` du bouton Accueil est masquée. Le pseudo-élément de l'image de l'icône, ses couleurs, sa taille, sa position et les autres boutons ne sont pas modifiés. La règle commune est intégrée à la construction Android et héritée par la construction iPhone. La correction de connexion iPhone R1 et les fichiers immédiats V25.30 sont conservés.

La source Google, le paquet serveur, Script Manager et les PDF restent inchangés. Android requiert une APK signée actualisée; iPhone utilise son actualisation web existante. Les pages de partage sont générées avec la version mobile correspondante, puis publiées uniquement après validation de l'APK signée.

La clé privée de signature reste hors GitHub. La construction produit seulement un condensat public de l'APK non signée. Le bloc de signature public est assemblé et vérifié par les outils Android avant publication; le certificat doit être identique à la V25.30.

Les tests visuels ciblés comparent tous les styles et dimensions des boutons avant/après sur Chromium et WebKit. Ils ne se connectent pas à un compte technicien et ne créent aucun document client. Un essai sur téléphone physique reste distinct.
