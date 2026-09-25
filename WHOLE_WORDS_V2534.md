# Mots complets dans les boutons — préparation V25.34

Demande : conserver le point 50 personnel et permettre l'agrandissement sans
couper intermédiaire, précision ou Réglages entre deux lignes.

Le correctif concerne les boutons de balances, les actions Hors ligne / Note /
Photos / Réglages et les légendes de navigation de la copie mobile commune.
Le texte est regroupé en lignes complètes (Balance / intermédiaire, Balance /
à camion, Balance / de précision, Balance / multi-tete). Les caractères, les
icônes, les couleurs et les actions restent inchangés.

Une mesure réelle du texte et de l'icône permet d'abord de conserver la
rangée de quatre boutons. Un ajustement typographique limité à 10 % évite un
réagencement inutile. Sinon, les icônes passent au-dessus des mots entiers et
la hauteur s'adapte. Aux réglages extrêmes, la grille passe à deux colonnes
plutôt que de couper les mots ou de réduire le texte excessivement.
La navigation réserve toujours sa hauteur réelle; ses colonnes peuvent
également se répartir en plusieurs rangées si ses icônes et mots l'exigent.

Aucun stockage, réglage personnel, consentement, session, compte, modèle PDF,
image, calcul ou déploiement Google n'est modifié par le correctif.
`personal-sizing-v2533.js` reste inchangé. Les tests du calibrage comparent
la même nouvelle disposition avant/après activation du point 50, avec
égalité géométrique exacte et absence d'écriture des préférences Google.

La vérification Chromium/WebKit couvre les dimensions, les mots/lignes,
les curseurs standard et personnalisés extrêmes, les clics, les zones sûres,
la persistance et la connexion iPhone R1. Les résultats réels des contrôles
sont dans GitHub Actions; ce document n'annonce pas leur réussite à l'avance.
La publication Android signée et la publication iPhone restent soumises à ces
contrôles et à la vérification des fichiers réellement servis.
