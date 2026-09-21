# Balance CDQ — pont Android pour le compte Google par défaut

Cette application Android est un **compagnon** de la PWA Balance CDQ. Elle ne remplace pas l'interface existante.

## Fonction

- Choisir une fois un compte Google présent sur le téléphone.
- Mémoriser ce compte localement.
- Recevoir des liens `balancecdq://open` depuis la PWA.
- Ouvrir les Google Sheets et PDF dans Chrome avec `authuser` + `login_hint` du compte choisi.
- Si aucun compte n'est enregistré, afficher le sélecteur Google une fois puis poursuivre l'ouverture du fichier.

## Liens pris en charge

- `balancecdq://pick`
- `balancecdq://open?kind=sheet&id=<FILE_ID>`
- `balancecdq://open?kind=pdf&id=<FILE_ID>`

## Sécurité / données

Le compte est enregistré uniquement dans SharedPreferences sur l'appareil. Aucun mot de passe ni jeton OAuth n'est stocké.

## Limite

Le pont force Chrome plutôt que l'application Google Sheets/Drive native. C'est volontaire : les applications Google natives gardent leur propre sélecteur de compte, qu'une autre application ne peut pas piloter de façon documentée.

## Build

Le workflow GitHub Actions `build-balance-cdq-android.yml` produit un APK debug installable pour les essais.
