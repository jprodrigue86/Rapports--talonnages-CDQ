CDQ — Rapports D’étalonnages — version installable

Cette structure est prête pour être hébergée sur un domaine HTTPS afin d'être installée comme application (PWA).
Elle utilise le logo CDQ approuvé et ouvre votre application Apps Script actuelle.

Fichiers :
- index.html : écran/app installable
- manifest.webmanifest : nom, icône, affichage standalone
- sw.js : service worker
- icons/ : icônes 192, 512 et 1024

Important :
Une PWA doit être servie depuis HTTPS. Le fichier index.html ne doit pas être ouvert directement depuis le téléphone comme un fichier local.
La prochaine étape consiste donc à héberger ce petit dossier sur un service HTTPS (par exemple GitHub Pages, Cloudflare Pages ou Firebase Hosting), puis à installer l'application depuis Chrome.
