# Balance CDQ V25.21

[Installer avec CDQ Script Manager](https://jprodrigue86.github.io/Rapports--talonnages-CDQ/apps-script-manager/?bundle=%2FRapports--talonnages-CDQ%2Fbundles%2Fbalance-cdq%2Fv25.21%2FBalance_CDQ_V25_21.cdq)

Compatible avec V25.19 et V25.20. Dans Script Manager, charger le projet, vérifier le correctif puis utiliser **ÉCRIRE + DÉPLOYER**. Fermer et rouvrir CDQ avec Internet après l’installation. Le package comprend les corrections du lecteur V25.20 lorsque nécessaire.

- Copie de Balance de plancher : le pont utilise le cache dans son module privé, ce qui corrige `cdqV2112GetCachedTemplate is not defined`. Les octets du PDF intégré restent identiques.
- PC : Clients et Réglages ont une icône dans chacun des cinq styles. Favoris et Drive général figurent dans le menu latéral. Le premier menu d’un fichier propose Favoris et Supprimer.
- Android : le bouton Favoris existant ouvre la liste des favoris quand aucun fichier n’est sélectionné. Dans Choisir une compagnie, le dossier jaune, juste avant le X, ouvre le Drive général.
- Drive général : point de départ `1F7rgU20Hc1PmjxQHY7ALTqkqArN6RSsf`, navigation dans les sous-dossiers, recherche dans la liste chargée, pagination et étoiles pour les favoris. Les fichiers s’ouvrent dans Google Drive. Les parcours de rapports clients conservent le lecteur CDQ.
- Favoris personnels par compte CDQ, incluant les anciens favoris Drive autorisés. Retirer un ancien favori le masque pour ce compte sans modifier les étoiles des autres utilisateurs. Les favoris ne donnent aucun nouveau droit d’écriture.
- Utilisateurs : onglets Utilisateurs / Ajouter / Codes d’activation, recherche, fiches dépliables, une zone de défilement et boutons accessibles sur PC et téléphone. Les protections du compte principal restent présentes; le serveur conserve ses contrôles de rôle.
- Écran NIP : cadenas gris et contrôles sombres.
- Murs musicaux retouchés en conservant le collage sombre et la disposition générale.

## Écran de démarrage Android natif

[APK Android 25.21 signée](https://jprodrigue86.github.io/Rapports--talonnages-CDQ/downloads/Balance-CDQ-Android-25.21.apk) : fond noir pour le splash, la fenêtre et le WebView. La clé durable de la 25.15 a été restaurée depuis `Balance_CDQ_SIGNATURE_PRIVEE_2026.zip` et son certificat vérifié. Cette APK est une mise à jour de la 25.15 signée avec cette même clé.

Le canal des anciennes APK debug (`android-update.json`) reste suspendu; il ne représente pas la disponibilité de la nouvelle clé. Le canal de signature durable est `android-release-update.json`. Voir `balance-cdq-android/signing/README.md` pour les prochaines signatures. La clé privée reste hors dépôt.

## Vérification

`node scripts/build-interface-v2521.mjs` régénère le package déterministe. Le générateur normalise les changements V25.20 en mémoire puis les applique une fois, avant les corrections V25.21. Les deux sources privées V25.19 et V25.20 ont produit exactement la même sortie V25.21. Aucun fichier source privé complet n’est publié.

Tests : autorisation avant lecture Drive, périmètre des deux racines, raccourcis et éléments supprimés, pagination, favoris déplacés et séparation des comptes; copie PDF avec cache réellement privé, octets originaux et création durable hors ligne; interface PC 1440×900 et Android 393×851 / 320×568, défilement, rôle principal protégé, ajout d’utilisateur, navigation/favoris et réponses tardives. Tests des lecteurs V25.20 conservés. Les données de compte et Drive des tests sont fictives; aucun compte ni rapport client réel n’a été modifié. Vérification locale supplémentaire avec les styles et le module privé du vrai Selector.

## Images

Retouches créées avec ImageGen à partir des deux murs existants : `assets/music-wall-panoramic-v2517.webp` et `assets/music-wall-choice1.webp`. Images finales : `assets/music-wall-pc-v2521.webp`, `assets/music-wall-android-v2521.webp`; conversion WebP uniquement, sans modification de pixels par script.

Consigne : préserver le fond noir texturé, les couleurs, la disposition et tous les groupes non concernés; remplacer les noms présents suivant cette correspondance : Spiritbox → Slaughter to Prevail, Chelsea Grin → Thy Art Is Murder, The Ghost Inside → Carnifex, ERRA → Death, Polaris → Shadow of Intent, Sleep Token → Dying Fetus, Currents → Cattle Decapitation, While She Sleeps → Signs of the Swarm, Beartooth → Obituary. Le mur Android ne contient qu’une partie des noms : les groupes absents n’y sont pas ajoutés. Une seconde retouche Android a restauré Whitechapel et Suicide Silence et retiré un ajout non demandé.
