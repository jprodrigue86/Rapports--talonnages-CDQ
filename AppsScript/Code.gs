const CONFIG = {
  MASTER_FOLDER_ID: '1cU0ekKqfuf9nOytUsnH1Mbljx8gWWe77',
  DESTINATAIRE: 'jp.rodrigue86@gmail.com',
  NOM_EXPEDITEUR: 'Conversion PDF',
  FORMAT_PAPIER: 'tabloid',
  PORTRAIT: true,

  // Cache serveur. Le cache Android persistant est géré dans Selector.html.
  CACHE_COMPAGNIES_SECONDES: 21600, // jusqu'à 6 h
  CACHE_CLIENT_SECONDES: 21600,     // jusqu'à 6 h
  CACHE_CLIENT_MAX_CARACTERES: 90000
};


/* =====================================================
   SECURITE / UTILISATEURS AUTORISES
===================================================== */
function obtenirUtilisateurCourant_() {
  return (Session.getActiveUser().getEmail() || '').trim().toLowerCase();
}

function obtenirAdministrateurPrincipal_() {
  // IMPORTANT : garder l'administrateur principal fixe.
  // Cela évite les problèmes de Session.getEffectiveUser() selon le déploiement.
  return 'jp.rodrigue86@gmail.com';
}

function obtenirUtilisateursAutorises_() {
  const props = PropertiesService.getScriptProperties();
  const brut = props.getProperty('UTILISATEURS_AUTORISES');
  let utilisateurs = [];

  if (brut) {
    try {
      utilisateurs = JSON.parse(brut);
    } catch (e) {
      utilisateurs = [];
    }
  }

  if (!Array.isArray(utilisateurs)) utilisateurs = [];

  const admin = obtenirAdministrateurPrincipal_();
  if (admin && !utilisateurs.some(function(u) { return u && u.email === admin; })) {
    utilisateurs.unshift({ email: admin, role: 'admin' });
  }

  return utilisateurs.filter(function(u) { return u && u.email; });
}

function verifierAcces_() {
  const email = obtenirUtilisateurCourant_();
  const admin = obtenirAdministrateurPrincipal_();

  if (email && admin && email === admin) {
    return { autorise: true, email: email, role: 'admin' };
  }

  const utilisateur = obtenirUtilisateursAutorises_().find(function(u) {
    return u.email === email;
  });

  if (!email || !utilisateur) {
    throw new Error(
      'ACCÈS REFUSÉ : votre compte Google n’est pas autorisé à utiliser cette application.'
    );
  }

  return {
    autorise: true,
    email: email,
    role: utilisateur.role === 'admin' ? 'admin' : 'user'
  };
}

function obtenirEtatAcces() {
  try {
    const u = verifierAcces_();
    return { autorise: true, email: u.email, role: u.role };
  } catch (e) {
    return { autorise: false, message: e.message };
  }
}

function obtenirListeUtilisateurs() {
  const u = verifierAcces_();
  if (u.role !== 'admin') throw new Error('Droits administrateur requis.');
  return obtenirUtilisateursAutorises_();
}

function ajouterUtilisateur(email, role) {
  const u = verifierAcces_();
  if (u.role !== 'admin') throw new Error('Droits administrateur requis.');

  email = (email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Adresse courriel invalide.');
  }

  role = role === 'admin' ? 'admin' : 'user';

  const admin = obtenirAdministrateurPrincipal_();
  const props = PropertiesService.getScriptProperties();
  const utilisateurs = obtenirUtilisateursAutorises_().filter(function(x) {
    return x.email !== admin;
  });

  const existant = utilisateurs.find(function(x) { return x.email === email; });
  if (existant) {
    existant.role = role;
  } else {
    utilisateurs.push({ email: email, role: role });
  }

  props.setProperty('UTILISATEURS_AUTORISES', JSON.stringify(utilisateurs));
  return obtenirUtilisateursAutorises_();
}

function supprimerUtilisateur(email) {
  const u = verifierAcces_();
  if (u.role !== 'admin') throw new Error('Droits administrateur requis.');

  email = (email || '').trim().toLowerCase();
  const admin = obtenirAdministrateurPrincipal_();

  if (email === admin) {
    throw new Error('Le compte administrateur principal ne peut pas être supprimé.');
  }

  const utilisateurs = obtenirUtilisateursAutorises_().filter(function(x) {
    return x.email !== email && x.email !== admin;
  });

  PropertiesService
    .getScriptProperties()
    .setProperty('UTILISATEURS_AUTORISES', JSON.stringify(utilisateurs));

  return obtenirUtilisateursAutorises_();
}

function modifierRoleUtilisateur(email, role) {
  const u = verifierAcces_();
  if (u.role !== 'admin') throw new Error('Droits administrateur requis.');

  email = (email || '').trim().toLowerCase();
  const admin = obtenirAdministrateurPrincipal_();

  if (email === admin) {
    throw new Error('Le rôle de l’administrateur principal ne peut pas être modifié.');
  }

  const utilisateurs = obtenirUtilisateursAutorises_().filter(function(x) {
    return x.email !== admin;
  });

  const cible = utilisateurs.find(function(x) { return x.email === email; });
  if (!cible) throw new Error('Utilisateur introuvable.');

  cible.role = role === 'admin' ? 'admin' : 'user';

  PropertiesService
    .getScriptProperties()
    .setProperty('UTILISATEURS_AUTORISES', JSON.stringify(utilisateurs));

  return obtenirUtilisateursAutorises_();
}


/* =====================================================
   OUVERTURE DE L'APPLICATION
===================================================== */
function doGet() {
  return HtmlService
    .createHtmlOutputFromFile('Selector')
    .setTitle('Rapports D’étalonnages')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function testerScript() {
  Logger.log('Le script fonctionne !');
}


/* =====================================================
   CACHE SERVEUR
===================================================== */
function cleCacheClient_(dossierId) {
  return 'CONTENU_CLIENT_V5_' + String(dossierId || '');
}

function invaliderCacheCompagnies_() {
  CacheService.getScriptCache().remove('LISTE_COMPAGNIES_V5');
}

function invaliderCacheContenuClient_(dossierId) {
  dossierId = String(dossierId || '').trim();
  if (!dossierId) return;
  CacheService.getScriptCache().remove(cleCacheClient_(dossierId));
}

function mettreEnCacheClient_(dossierId, resultat) {
  try {
    const json = JSON.stringify(resultat);
    if (json.length <= CONFIG.CACHE_CLIENT_MAX_CARACTERES) {
      CacheService
        .getScriptCache()
        .put(cleCacheClient_(dossierId), json, CONFIG.CACHE_CLIENT_SECONDES);
    }
  } catch (e) {
    console.log('Cache client ignoré :', e);
  }
}


/* =====================================================
   LISTE DES COMPAGNIES
===================================================== */
function obtenirDossiersClients(forceRefresh) {
  verifierAcces_();

  const cache = CacheService.getScriptCache();
  const cle = 'LISTE_COMPAGNIES_V5';

  if (!forceRefresh) {
    const brut = cache.get(cle);
    if (brut) {
      try {
        return JSON.parse(brut);
      } catch (e) {}
    }
  }

  const dossierPrincipal = DriveApp.getFolderById(CONFIG.MASTER_FOLDER_ID);
  const dossiers = dossierPrincipal.getFolders();
  const resultats = [];

  while (dossiers.hasNext()) {
    const dossier = dossiers.next();
    resultats.push({
      id: dossier.getId(),
      nom: dossier.getName()
    });
  }

  resultats.sort(function(a, b) {
    return a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' });
  });

  try {
    cache.put(cle, JSON.stringify(resultats), CONFIG.CACHE_COMPAGNIES_SECONDES);
  } catch (e) {
    console.log('Cache compagnies ignoré :', e);
  }

  return resultats;
}


/* =====================================================
   DOSSIERS
===================================================== */
function creerDossierDansCompagnie(idCompagnie, nomDossier) {
  verifierAcces_();

  idCompagnie = (idCompagnie || '').trim();
  nomDossier = (nomDossier || '').trim();

  if (!idCompagnie) throw new Error('Compagnie non sélectionnée.');
  if (!nomDossier) throw new Error('Le nom du dossier ne peut pas être vide.');
  if (nomDossier.length > 200) throw new Error('Le nom du dossier est trop long.');

  const compagnie = DriveApp.getFolderById(idCompagnie);
  const nouveauDossier = compagnie.createFolder(nomDossier);

  invaliderCacheContenuClient_(idCompagnie);

  return {
    id: nouveauDossier.getId(),
    nom: nouveauDossier.getName(),
    fichiers: [],
    dossiers: []
  };
}

function creerDossierClient(nomDossier) {
  verifierAcces_();

  nomDossier = (nomDossier || '').trim();
  if (!nomDossier) throw new Error('Le nom du dossier ne peut pas être vide.');
  if (nomDossier.length > 200) throw new Error('Le nom du dossier est trop long.');

  const dossierPrincipal = DriveApp.getFolderById(CONFIG.MASTER_FOLDER_ID);
  const nouveauDossier = dossierPrincipal.createFolder(nomDossier);

  invaliderCacheCompagnies_();

  return {
    id: nouveauDossier.getId(),
    nom: nouveauDossier.getName()
  };
}

function supprimerDossier(dossierId, idCompagnie) {
  verifierAcces_();

  dossierId = (dossierId || '').trim();
  idCompagnie = (idCompagnie || '').trim();

  if (!dossierId) throw new Error('Dossier introuvable.');
  if (dossierId === CONFIG.MASTER_FOLDER_ID) {
    throw new Error('Le dossier principal ne peut pas être supprimé.');
  }

  const dossier = DriveApp.getFolderById(dossierId);
  const nom = dossier.getName();
  dossier.setTrashed(true);

  if (idCompagnie) invaliderCacheContenuClient_(idCompagnie);

  return {
    id: dossierId,
    nom: nom,
    message: 'Dossier « ' + nom + ' » envoyé à la corbeille.'
  };
}


/* =====================================================
   FICHIERS COMPATIBLES
===================================================== */
function estFavoriFichier_(fichier) {
  try {
    return !!fichier.isStarred();
  } catch (e) {
    return false;
  }
}

function fichierCompatible_(fichier) {
  const nom = fichier.getName();
  const typeMime = fichier.getMimeType();
  const extension = nom.indexOf('.') >= 0
    ? nom.split('.').pop().toLowerCase()
    : '';

  const estGoogleSheet = typeMime === MimeType.GOOGLE_SHEETS;
  const estExcel = extension === 'xlsx' || extension === 'xls';
  const estPDF = extension === 'pdf' || typeMime === MimeType.PDF;

  if (!estGoogleSheet && !estExcel && !estPDF) return null;

  return {
    id: fichier.getId(),
    nom: nom,
    type: estPDF ? 'PDF' : (estGoogleSheet ? 'GOOGLE_SHEETS' : 'EXCEL'),
    dateModification: fichier.getLastUpdated().toISOString(),
    favori: estFavoriFichier_(fichier)
  };
}


/* =====================================================
   LECTURE RECURSIVE DU CLIENT
===================================================== */
function lireDossierRecursif_(dossier) {
  const resultat = {
    id: dossier.getId(),
    nom: dossier.getName(),
    fichiers: [],
    dossiers: []
  };

  const fichiers = dossier.getFiles();
  while (fichiers.hasNext()) {
    const compatible = fichierCompatible_(fichiers.next());
    if (compatible) resultat.fichiers.push(compatible);
  }

  const dossiers = dossier.getFolders();
  while (dossiers.hasNext()) {
    resultat.dossiers.push(lireDossierRecursif_(dossiers.next()));
  }

  resultat.fichiers.sort(function(a, b) {
    return new Date(b.dateModification) - new Date(a.dateModification);
  });

  resultat.dossiers.sort(function(a, b) {
    return a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' });
  });

  return resultat;
}


/* =====================================================
   CONTENU CLIENT OPTIMISE

   - forceRefresh=false : utilise d'abord le cache serveur.
   - forceRefresh=true  : relit Google Drive et renouvelle le cache.
===================================================== */
function obtenirContenuClientOptimise(dossierId, forceRefresh) {
  verifierAcces_();

  dossierId = String(dossierId || '').trim();
  if (!dossierId) throw new Error('Compagnie introuvable.');

  const cache = CacheService.getScriptCache();
  const cle = cleCacheClient_(dossierId);

  if (!forceRefresh) {
    const brut = cache.get(cle);
    if (brut) {
      try {
        const resultatCache = JSON.parse(brut);
        resultatCache.source = 'cache';
        return resultatCache;
      } catch (e) {}
    }
  }

  const dossier = DriveApp.getFolderById(dossierId);
  const contenu = lireDossierRecursif_(dossier);

  const resultat = {
    contenu: contenu,
    genereLe: Date.now(),
    source: 'drive'
  };

  mettreEnCacheClient_(dossierId, resultat);
  return resultat;
}

// Compatibilité avec l'ancienne interface.
function obtenirContenuClient(dossierId) {
  return obtenirContenuClientOptimise(dossierId, false).contenu;
}

// Appelé silencieusement par la nouvelle interface après avoir affiché
// instantanément le cache Android.
function actualiserContenuClient(dossierId) {
  return obtenirContenuClientOptimise(dossierId, true);
}


/* =====================================================
   META D'UN SEUL FICHIER
   Évite de rescanner toute la compagnie après Modifier.
===================================================== */
function obtenirMetaFichier(fichierId) {
  verifierAcces_();
  const fichier = DriveApp.getFileById(fichierId);
  const meta = fichierCompatible_(fichier);
  if (!meta) throw new Error('Type de fichier non supporté.');
  return meta;
}

function obtenirDateModificationFichier(fichierId) {
  return obtenirMetaFichier(fichierId).dateModification;
}


/* =====================================================
   NOTES ATTACHÉES AUX FICHIERS

   La note est conservée dans la description Google Drive.
   Un marqueur CDQ permet de préserver une description Drive
   qui pourrait déjà exister.
===================================================== */
const NOTE_CDQ_DEBUT_ = '[[CDQ_NOTE_V1]]';
const NOTE_CDQ_FIN_ = '[[/CDQ_NOTE_V1]]';
const NOTE_CDQ_MAX_CARACTERES_ = 2000;

function extraireNoteCDQ_(description) {
  description = String(description || '');

  const debut = description.indexOf(NOTE_CDQ_DEBUT_);
  if (debut < 0) return '';

  const positionTexte = debut + NOTE_CDQ_DEBUT_.length;
  const fin = description.indexOf(NOTE_CDQ_FIN_, positionTexte);

  if (fin < 0) return '';

  return description
    .substring(positionTexte, fin)
    .replace(/^\s*\n?/, '')
    .replace(/\n?\s*$/, '');
}

function remplacerNoteCDQ_(description, note) {
  description = String(description || '');
  note = String(note || '').trim();

  const debut = description.indexOf(NOTE_CDQ_DEBUT_);

  if (debut >= 0) {
    const fin = description.indexOf(
      NOTE_CDQ_FIN_,
      debut + NOTE_CDQ_DEBUT_.length
    );

    if (fin >= 0) {
      const apres = fin + NOTE_CDQ_FIN_.length;
      description =
        description.substring(0, debut) +
        description.substring(apres);
    }
  }

  description = description.trim();

  if (!note) {
    return description;
  }

  const bloc =
    NOTE_CDQ_DEBUT_ +
    '\n' +
    note +
    '\n' +
    NOTE_CDQ_FIN_;

  return description
    ? description + '\n\n' + bloc
    : bloc;
}

function obtenirNoteFichier(fichierId) {
  verifierAcces_();

  fichierId = String(fichierId || '').trim();

  if (!fichierId) {
    throw new Error('Fichier introuvable.');
  }

  const fichier = DriveApp.getFileById(fichierId);

  return {
    id: fichierId,
    nom: fichier.getName(),
    note: extraireNoteCDQ_(fichier.getDescription())
  };
}

function enregistrerNoteFichier(fichierId, note, idCompagnie) {
  verifierAcces_();

  fichierId = String(fichierId || '').trim();
  idCompagnie = String(idCompagnie || '').trim();
  note = String(note || '').trim();

  if (!fichierId) {
    throw new Error('Fichier introuvable.');
  }

  if (note.length > NOTE_CDQ_MAX_CARACTERES_) {
    throw new Error(
      'La note est trop longue. Maximum : ' +
      NOTE_CDQ_MAX_CARACTERES_ +
      ' caractères.'
    );
  }

  const fichier = DriveApp.getFileById(fichierId);
  const descriptionActuelle = fichier.getDescription() || '';
  const nouvelleDescription =
    remplacerNoteCDQ_(descriptionActuelle, note);

  fichier.setDescription(nouvelleDescription);

  if (idCompagnie) {
    invaliderCacheContenuClient_(idCompagnie);
  }

  const meta = fichierCompatible_(fichier);

  return {
    id: fichierId,
    note: note,
    meta: meta,
    message: note
      ? 'Note enregistrée.'
      : 'Note effacée.'
  };
}


/* =====================================================
   NOTES ATTACHÉES AUX DOSSIERS CLIENT / SOUS-DOSSIERS
   Utilise le même bloc CDQ dans la description Drive.
===================================================== */
function obtenirNoteDossier(dossierId) {
  verifierAcces_();

  dossierId = String(dossierId || '').trim();
  if (!dossierId) throw new Error('Dossier introuvable.');

  const dossier = DriveApp.getFolderById(dossierId);

  return {
    id: dossierId,
    nom: dossier.getName(),
    note: extraireNoteCDQ_(dossier.getDescription() || '')
  };
}

function enregistrerNoteDossier(dossierId, note, idCompagnie) {
  verifierAcces_();

  dossierId = String(dossierId || '').trim();
  idCompagnie = String(idCompagnie || '').trim();
  note = String(note || '').trim();

  if (!dossierId) throw new Error('Dossier introuvable.');
  if (note.length > NOTE_CDQ_MAX_CARACTERES_) {
    throw new Error('La note est trop longue. Maximum : ' + NOTE_CDQ_MAX_CARACTERES_ + ' caractères.');
  }

  const dossier = DriveApp.getFolderById(dossierId);
  const descriptionActuelle = dossier.getDescription() || '';
  dossier.setDescription(remplacerNoteCDQ_(descriptionActuelle, note));

  if (idCompagnie) invaliderCacheContenuClient_(idCompagnie);

  return {
    id: dossierId,
    note: note,
    message: note ? 'Note du dossier enregistrée.' : 'Note du dossier effacée.'
  };
}


/* =====================================================
   LISTE PLATE DES FICHIERS
===================================================== */
function obtenirFichiersSheets(dossierId) {
  verifierAcces_();

  const contenu = obtenirContenuClientOptimise(dossierId, false).contenu;
  const resultats = [];

  function parcourir(noeud) {
    (noeud.fichiers || []).forEach(function(f) { resultats.push(f); });
    (noeud.dossiers || []).forEach(parcourir);
  }

  parcourir(contenu);

  resultats.sort(function(a, b) {
    return new Date(b.dateModification) - new Date(a.dateModification);
  });

  return resultats;
}

function obtenirFichier_(fichierId) {
  verifierAcces_();
  return DriveApp.getFileById(fichierId);
}


/* =====================================================
   EXPORT GOOGLE SHEETS
===================================================== */
function convertirGoogleSheetEnPdf(fichierId) {
  verifierAcces_();

  const fichier = DriveApp.getFileById(fichierId);
  const spreadsheetId = fichier.getId();

  const url =
    'https://docs.google.com/spreadsheets/d/' +
    spreadsheetId +
    '/export?' +
    'format=pdf' +
    '&size=' + encodeURIComponent(CONFIG.FORMAT_PAPIER) +
    '&portrait=' + (CONFIG.PORTRAIT ? 'true' : 'false') +
    '&fitw=true' +
    '&sheetnames=false' +
    '&printtitle=false' +
    '&pagenumbers=false' +
    '&gridlines=false' +
    '&fzr=false';

  const response = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });

  if (response.getResponseCode() !== 200) {
    throw new Error('Impossible de convertir le fichier Google Sheets en PDF.');
  }

  const nomPdf = fichier.getName().replace(/\.xlsx?$/i, '') + '.pdf';
  return response.getBlob().setName(nomPdf);
}


/* =====================================================
   EXPORT EXCEL
   Nécessite le service avancé Google Drive déjà utilisé
   par ton application.
===================================================== */
function convertirExcelEnPdf(fichierId) {
  verifierAcces_();

  const fichier = DriveApp.getFileById(fichierId);
  const blob = fichier.getBlob();

  const ressource = {
    name: 'TEMP_CONVERSION_' + fichier.getName(),
    mimeType: 'application/vnd.google-apps.spreadsheet'
  };

  const fichierTemp = Drive.Files.create(ressource, blob, { fields: 'id,name' });
  const tempId = fichierTemp.id;

  try {
    // Petite attente nécessaire pour que Google termine la conversion Excel -> Sheets.
    Utilities.sleep(1200);

    const url =
      'https://docs.google.com/spreadsheets/d/' +
      tempId +
      '/export?' +
      'format=pdf' +
      '&size=' + encodeURIComponent(CONFIG.FORMAT_PAPIER) +
      '&portrait=' + (CONFIG.PORTRAIT ? 'true' : 'false') +
      '&fitw=true' +
      '&sheetnames=false' +
      '&printtitle=false' +
      '&pagenumbers=false' +
      '&gridlines=false' +
      '&fzr=false';

    const response = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
      throw new Error('Impossible de convertir le fichier Excel en PDF.');
    }

    const nomPdf = fichier.getName().replace(/\.xlsx?$/i, '') + '.pdf';
    return response.getBlob().setName(nomPdf);

  } finally {
    try {
      DriveApp.getFileById(tempId).setTrashed(true);
    } catch (erreur) {
      console.log('Erreur suppression fichier temporaire :', erreur);
    }
  }
}


/* =====================================================
   CONVERSION D'UN FICHIER
===================================================== */
function convertirFichierEnPdf(fichierId) {
  verifierAcces_();

  const fichier = DriveApp.getFileById(fichierId);
  const nom = fichier.getName().toLowerCase();
  const typeMime = fichier.getMimeType();

  if (typeMime === MimeType.GOOGLE_SHEETS) {
    return convertirGoogleSheetEnPdf(fichierId);
  }

  if (nom.endsWith('.xlsx') || nom.endsWith('.xls')) {
    return convertirExcelEnPdf(fichierId);
  }

  if (nom.endsWith('.pdf') || typeMime === MimeType.PDF) {
    return fichier.getBlob();
  }

  throw new Error('Type de fichier non supporté : ' + fichier.getName());
}


/* =====================================================
   COURRIEL
===================================================== */
function obtenirDestinataireParDefaut() {
  verifierAcces_();
  return CONFIG.DESTINATAIRE;
}

function validerAdresseCourriel(email) {
  verifierAcces_();
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function convertirEtEnvoyer(fichiersIds, email, message, nomCompagnie) {
  verifierAcces_();

  if (!validerAdresseCourriel(email)) {
    throw new Error('Adresse courriel invalide.');
  }

  if (!fichiersIds || !fichiersIds.length) {
    throw new Error('Aucun fichier sélectionné.');
  }

  const piecesJointes = [];
  fichiersIds.forEach(function(id) {
    piecesJointes.push(convertirFichierEnPdf(id));
  });

  const date = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    'yyyy-MM-dd'
  );

  const sujet =
    'Rapports d’étalonnages - ' +
    (nomCompagnie || 'Client') +
    ' - ' +
    date;

  const corps = message && message.trim()
    ? message
    : (
        'Bonjour,\n\n' +
        'Veuillez trouver ci-joint les rapports d’étalonnage de ' +
        (nomCompagnie || 'votre entreprise') +
        '.\n\nMerci.'
      );

  GmailApp.sendEmail(email, sujet, corps, {
    attachments: piecesJointes,
    name: CONFIG.NOM_EXPEDITEUR
  });

  return { message: 'Courriel envoyé avec succès.' };
}


/* =====================================================
   OUVRIR FICHIER POUR MODIFICATION
===================================================== */
function ouvrirFichierPourModification(fichierId) {
  verifierAcces_();

  const fichier = DriveApp.getFileById(fichierId);
  const nom = fichier.getName().toLowerCase();
  const typeMime = fichier.getMimeType();

  if (typeMime === MimeType.GOOGLE_SHEETS) {
    return 'https://docs.google.com/spreadsheets/d/' + fichierId + '/edit';
  }

  if (
    nom.endsWith('.pdf') ||
    typeMime === MimeType.PDF ||
    nom.endsWith('.xlsx') ||
    nom.endsWith('.xls')
  ) {
    return 'https://drive.google.com/file/d/' + fichierId + '/view';
  }

  return 'https://drive.google.com/file/d/' + fichierId + '/view';
}


/* =====================================================
   FAVORIS
===================================================== */
function definirFavorisFichiers(fichierIds, favori, idCompagnie) {
  verifierAcces_();

  if (!Array.isArray(fichierIds) || !fichierIds.length) {
    throw new Error('Aucun fichier sélectionné.');
  }

  const etat = !!favori;
  const resultats = [];

  fichierIds.forEach(function(id) {
    id = String(id || '').trim();
    if (!id) return;

    const fichier = DriveApp.getFileById(id);
    fichier.setStarred(etat);

    const meta = fichierCompatible_(fichier);
    if (meta) resultats.push(meta);
  });

  idCompagnie = String(idCompagnie || '').trim();
  if (idCompagnie) invaliderCacheContenuClient_(idCompagnie);

  return {
    favori: etat,
    fichiers: resultats,
    message: etat
      ? (resultats.length + ' fichier' + (resultats.length > 1 ? 's ajoutés' : ' ajouté') + ' aux favoris.')
      : (resultats.length + ' fichier' + (resultats.length > 1 ? 's retirés' : ' retiré') + ' des favoris.')
  };
}


/* =====================================================
   RENOMMER
===================================================== */
function renommerFichier(fichierId, nouveauNom, idCompagnie) {
  verifierAcces_();

  nouveauNom = (nouveauNom || '').trim();
  idCompagnie = (idCompagnie || '').trim();

  if (!nouveauNom) throw new Error('Le nom ne peut pas être vide.');

  const fichier = DriveApp.getFileById(fichierId);
  fichier.setName(nouveauNom);

  if (idCompagnie) invaliderCacheContenuClient_(idCompagnie);

  const meta = fichierCompatible_(fichier);
  if (!meta) throw new Error('Type de fichier non supporté.');
  return meta;
}


/* =====================================================
   DUPLIQUER
===================================================== */
function dupliquerFichier(fichierId, idCompagnie) {
  verifierAcces_();

  fichierId = (fichierId || '').trim();
  idCompagnie = (idCompagnie || '').trim();

  if (!fichierId) throw new Error('Fichier introuvable.');

  const fichier = DriveApp.getFileById(fichierId);
  const parents = fichier.getParents();
  if (!parents.hasNext()) {
    throw new Error('Le dossier parent du fichier est introuvable.');
  }

  const dossierParent = parents.next();
  const nomOriginal = fichier.getName();
  const point = nomOriginal.lastIndexOf('.');
  const base = point > 0 ? nomOriginal.substring(0, point) : nomOriginal;
  const extension = point > 0 ? nomOriginal.substring(point) : '';

  let numero = 1;
  let nouveauNom = base + ' - Copie' + extension;

  while (dossierParent.getFilesByName(nouveauNom).hasNext()) {
    numero++;
    nouveauNom = base + ' - Copie ' + numero + extension;
  }

  const copie = fichier.makeCopy(nouveauNom, dossierParent);

  // Une copie est un nouveau rapport : elle démarre sans la note CDQ
  // de l'original, tout en conservant une éventuelle autre description Drive.
  try {
    const descriptionCopie = copie.getDescription() || '';
    const descriptionSansNote = remplacerNoteCDQ_(descriptionCopie, '');
    if (descriptionCopie !== descriptionSansNote) {
      copie.setDescription(descriptionSansNote);
    }
  } catch (e) {
    console.log('Note de la copie non modifiée :', e);
  }

  if (idCompagnie) invaliderCacheContenuClient_(idCompagnie);

  const meta = fichierCompatible_(copie);

  return {
    id: copie.getId(),
    nom: copie.getName(),
    type: meta ? meta.type : '',
    dateModification: meta ? meta.dateModification : copie.getLastUpdated().toISOString(),
    originalId: fichierId,
    message: 'Rapport dupliqué : ' + copie.getName()
  };
}


function dupliquerFichiers(fichierIds, idCompagnie) {
  verifierAcces_();

  if (!Array.isArray(fichierIds) || !fichierIds.length) {
    throw new Error('Aucun fichier sélectionné.');
  }

  const copies = [];
  fichierIds.forEach(function(id) {
    const resultat = dupliquerFichier(String(id || ''), idCompagnie);
    if (resultat) copies.push(resultat);
  });

  return {
    fichiers: copies,
    message: copies.length + ' rapport' + (copies.length > 1 ? 's dupliqués.' : ' dupliqué.')
  };
}


/* =====================================================
   SUPPRIMER FICHIERS
===================================================== */
function supprimerFichiers(fichiersIds, idCompagnie) {
  verifierAcces_();

  idCompagnie = (idCompagnie || '').trim();

  if (!fichiersIds || !fichiersIds.length) {
    throw new Error('Aucun fichier à supprimer.');
  }

  let nombreSupprime = 0;
  const idsSupprimes = [];

  fichiersIds.forEach(function(id) {
    try {
      DriveApp.getFileById(id).setTrashed(true);
      nombreSupprime++;
      idsSupprimes.push(id);
    } catch (erreur) {
      console.log('Erreur suppression ' + id + ' :', erreur);
    }
  });

  if (idCompagnie) invaliderCacheContenuClient_(idCompagnie);

  return {
    nombre: nombreSupprime,
    ids: idsSupprimes,
    message:
      nombreSupprime +
      (nombreSupprime === 1 ? ' fichier supprimé.' : ' fichiers supprimés.')
  };
}
