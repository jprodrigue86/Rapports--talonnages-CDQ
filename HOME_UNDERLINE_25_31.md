# CDQ 25.31 — retrait du trait bleu sous Accueil

Seule la décoration `::after` du bouton Accueil actif est masquée. Les anciennes
règles ciblant Accueil avaient une spécificité supérieure à la règle générale
qui était supposée supprimer les traits. La correction augmente la précision
uniquement sur ce bouton, sans cibler le pseudo-élément de son icône interne.

La correction est appliquée dans la génération commune Android/iPhone. Les
icônes, textes, dimensions, positions, clics, autres boutons, PDF, calculs et
services Google sont inchangés. La correction de connexion iPhone R1 est conservée.

Le code embarqué Android nécessite une nouvelle APK 25.31 signée avec l'identité
CDQ existante. Aucun APK debug ou non signé ne doit être publié aux techniciens.
L'iPhone reçoit une nouvelle empreinte de publication par son mécanisme existant
« Mettre à jour et relancer ». Aucun paquet Script Manager n'est nécessaire.

Tests : comparaison des styles avant/après avec Chromium/WebKit, classes
Android/iOS/mobile/Windows, trois largeurs; vérification de l'icône interne, des
rectangles, des libellés, des autres boutons et du clic Accueil. La version
source est préparée sur une branche isolée; la publication attend une signature
privée vérifiée et les tests de la livraison finale. Aucun test ne modifie les
comptes ou les dossiers clients.
