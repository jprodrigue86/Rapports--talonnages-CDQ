# Balance CDQ V25.19 — Balance de plancher intégré

Installation depuis V25.18, dans Script Manager V40 :

https://jprodrigue86.github.io/Rapports--talonnages-CDQ/apps-script-manager/?bundle=%2FRapports--talonnages-CDQ%2Fbundles%2Fbalance-cdq%2Fv25.19%2FBalance_CDQ_V25_19.cdq

Choisir **ÉCRIRE + DÉPLOYER**, puis fermer et rouvrir l’application existante avec Internet une fois pour installer les ressources hors ligne. Aucun nouvel APK, aucune deuxième application. Le bouton reste **Balance intermédiaire → Balance de plancher** (ou **Rapports → Nouveau rapport** sur PC).

## Modèle et fonctionnement

- Dernier PDF approuvé : `Balance_de_plancher(5).pdf`, version du 22 septembre 2026 à 22:59 UTC, aussi présent à l’identique dans le dernier lot de douze PDF.
- 628 837 octets, une page, 139 champs interactifs. SHA-256 : `d386179c7186debc0f7fc17ded80133f739c15ca6f8a44407b69b6f147f5ee92`.
- Modèle conservé octet pour octet : mise en page, champs et scripts de calcul inchangés. Il est livré avec l’application et le serveur Apps Script; aucune lecture du modèle sur Drive lors de la création.
- Dans l’application installée, création locale durable, puis ouverture immédiate dans le lecteur intégré. Les réponses enregistrées restent sur cet appareil; la synchronisation ajoute la copie au dossier client quand la session et Internet sont disponibles.
- Mes copies locales permet de retrouver les copies conservées. Un redémarrage hors ligne nécessite le déverrouillage local déjà configuré dans l’application. La destination doit avoir été choisie au préalable.
- Le lecteur de ce modèle embarque PDF.js 6.3.289 et son moteur de calcul isolé; le service worker les conserve pour un démarrage sans réseau. Les autres modèles et leur lecteur restent inchangés.
- La synchronisation conserve les contrôles d’accès, l’identité du modèle et la protection contre les doublons. Aucun ancien rapport client n’est remplacé par le nouveau modèle.

## Vérification

Construction : `node scripts/build-floor-template.mjs`.
Tests : `node --test tests/floor-template.test.mjs tests/offline-controller.test.mjs tests/offline-templates.test.mjs`, puis `CDQ_TEST_READER=1 node tests/floor-template-browser.test.mjs` (`CHROME_PATH` si nécessaire).

Tests sur le moteur de patch Script Manager et les fonctions réelles du Selector : application sur V25.18; première copie avec cache modèle vide; ancien maître ignoré; droits lecture seule; isolation des comptes; sauvegarde locale; réessai sans doublon; acquittement distinct du PDF rempli après reconnexion. Le navigateur vérifie aussi l’ouverture et la saisie avec les ressources locales du lecteur. Aucune écriture dans un dossier client réel pendant ces tests.

Le déploiement Apps Script final et la synchronisation Google du compte réel seront effectués depuis Script Manager et la session de l’utilisateur.
