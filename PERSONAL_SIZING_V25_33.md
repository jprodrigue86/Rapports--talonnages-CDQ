# Point 50 personnel — V25.33

Demande : conserver le rendu du téléphone propriétaire aux valeurs Interface 50,
Texte 71, Icônes 100, en montrant désormais 50 / 50 / 50. Il ne faut pas modifier
les autres téléphones ni les réglages de ce compte sur un autre appareil.

## Activation volontaire et locale

Dans Réglages > Tailles, un administrateur mobile peut choisir « Garder ces
tailles comme mon 50 / 50 / 50 ». La confirmation affiche les valeurs réellement
présentes sur le téléphone. Aucune activation n'a lieu lors de l'installation.
Un technicien n'obtient pas de nouveau profil automatiquement.

Le profil est conservé dans une clé locale distincte, par plateforme et compte.
Les anciennes préférences partagées ne sont ni remplacées par 50 ni envoyées à
Google par le calibrage. Les mouvements et la remise à 50 des curseurs d'un
profil personnel restent locaux. La suppression du profil restaure les réglages
habituels du compte. Aucun identifiant réel ni modèle de téléphone n'est inscrit
dans le code; ce n'est pas un changement réservé à tous les Samsung d'un modèle.

Pour chaque courbe de rendu existante F, le nouveau facteur vaut
F(référence) * F(curseur) / F(50). À 50, F(référence) est repris directement pour
éviter un arrondi intermédiaire. Ainsi, la référence Texte 71 et Icônes 100 est
préservée et les positions supérieures à 50 restent utilisables. Le rendu non
calibré conserve les calculs antérieurs. Les zones système V25.32 restent actives.

L'interface Android et la copie iPhone contiennent la même option volontaire.
Elle ne modifie pas les profils des autres appareils lors de la mise à jour.
Les modèles PDF, images, polices, connexion iPhone R1 et services Google sont
hors de cette intervention. La partie Web/PC servie par Apps Script ne change pas.

Le rapport de tests doit distinguer les courbes et la géométrie automatisées,
les tests de l'interface complète avec un compte simulé, et l'essai réel restant
à effectuer sur le téléphone propriétaire après son activation volontaire.
