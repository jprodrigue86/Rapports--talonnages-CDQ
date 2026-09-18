'use strict';

const CDQ = {
  token: '',
  expiresAt: 0,
  tokenClient: null,
  currentProject: null,
  content: null,
  deployments: [],
  versions: [],
};

const SCOPES = [
  'https://www.googleapis.com/auth/script.projects',
  'https://www.googleapis.com/auth/script.deployments',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
].join(' ');

function normalizeScriptId(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const patterns = [
    /\/projects\/([A-Za-z0-9_-]+)/,
    /\/d\/([A-Za-z0-9_-]+)/,
  ];
  for (const p of patterns) {
    const m = raw.match(p);
    if (m) return m[1];
  }
  return raw.replace(/\s+/g, '');
}

function apiErrorPayload(text) {
  try { return text ? JSON.parse(text) : {}; }
  catch { return { raw: text }; }
}

function friendlyGoogleError(status, data) {
  const message = data?.error?.message || data?.error_description || data?.raw || `Erreur Google ${status}`;
  const disabled = /has not been used|hasn't been used|disabled|SERVICE_DISABLED/i.test(message);

  if (disabled && /(Google Drive API|drive\.googleapis\.com|drive\.googleapis)/i.test(message)) {
    return 'L’API Google Drive n’est pas activée dans le projet Google Cloud de ce Client ID. Active « Google Drive API » dans Balance CDQ, puis reconnecte Google.';
  }
  if (disabled && /(Apps Script API|script\.googleapis\.com|script\.googleapis)/i.test(message)) {
    return 'L’API Google Apps Script n’est pas activée dans le projet Google Cloud de ce Client ID.';
  }
  if (/insufficient.*scope|insufficient authentication scopes/i.test(message)) {
    return 'Google n’a pas accordé toutes les autorisations nécessaires. Déconnecte puis reconnecte Google.';
  }
  if (/read-only deployments may not be modified/i.test(message)) {
    return 'Ce déploiement est en lecture seule (HEAD/test). Choisis « Nouveau déploiement » ou un déploiement versionné existant.';
  }
  if (/permission|forbidden|not have permission/i.test(message)) {
    return 'Ton compte Google n’a pas la permission d’accéder à ce projet Apps Script.';
  }
  if (status === 401) return 'La session Google a expiré. Reconnecte-toi puis réessaie.';
  return message;
}

async function waitForGoogleIdentity() {
  for (let i = 0; i < 100; i++) {
    if (window.google?.accounts?.oauth2) return true;
    await new Promise(r => setTimeout(r, 60));
  }
  throw new Error('Le module de connexion Google ne s’est pas chargé. Ouvre l’application dans Google Chrome avec Internet.');
}

async function prepareGoogleClient(clientId) {
  await waitForGoogleIdentity();
  if (!clientId) throw new Error('OAuth Client ID manquant.');
  if (CDQ.tokenClient && CDQ.tokenClient.__clientId === clientId) return CDQ.tokenClient;
  const client = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    include_granted_scopes: true,
    callback: () => {},
    error_callback: () => {},
  });
  client.__clientId = clientId;
  CDQ.tokenClient = client;
  return client;
}

async function requestGoogleToken(clientId, forceConsent = false) {
  let client = (CDQ.tokenClient && CDQ.tokenClient.__clientId === clientId) ? CDQ.tokenClient : null;
  if (!client) client = await prepareGoogleClient(clientId);
  return new Promise((resolve, reject) => {
    let settled = false;
    const finishError = (err) => {
      if (settled) return;
      settled = true;
      const code = err?.type || err?.error || '';
      if (code === 'popup_failed_to_open') return reject(new Error('Chrome a bloqué la fenêtre Google. Vérifie que tu utilises bien Chrome et réessaie en touchant directement « Se connecter à Google ».'));
      if (code === 'popup_closed') return reject(new Error('La fenêtre Google a été fermée avant la fin de la connexion.'));
      reject(new Error(err?.message || err?.error_description || code || 'Connexion Google impossible.'));
    };
    client.callback = (response) => {
      if (settled) return;
      if (response?.error) return finishError(response);
      settled = true;
      CDQ.token = response.access_token || '';
      const expiresIn = Number(response.expires_in || 3600);
      CDQ.expiresAt = Date.now() + Math.max(60, expiresIn - 60) * 1000;
      resolve(response);
    };
    client.error_callback = finishError;
    try {
      client.requestAccessToken({ prompt: forceConsent ? 'consent select_account' : 'select_account' });
    } catch (err) {
      finishError(err);
    }
  });
}

function hasLiveToken() {
  return Boolean(CDQ.token && Date.now() < CDQ.expiresAt);
}

async function ensureAuth(clientId) {
  if (hasLiveToken()) return CDQ.token;
  await requestGoogleToken(clientId, false);
  return CDQ.token;
}

function revokeGoogleToken() {
  const token = CDQ.token;
  CDQ.token = '';
  CDQ.expiresAt = 0;
  if (token && window.google?.accounts?.oauth2?.revoke) {
    try { google.accounts.oauth2.revoke(token, () => {}); } catch {}
  }
}

async function googleFetch(url, clientId, options = {}) {
  await ensureAuth(clientId);
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${CDQ.token}`);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  let response = await fetch(url, { ...options, headers });
  if (response.status === 401) {
    CDQ.token = '';
    CDQ.expiresAt = 0;
    await ensureAuth(clientId);
    headers.set('Authorization', `Bearer ${CDQ.token}`);
    response = await fetch(url, { ...options, headers });
  }
  const text = await response.text();
  const data = apiErrorPayload(text);
  if (!response.ok) throw new Error(friendlyGoogleError(response.status, data));
  return data;
}

function scriptApiUrl(path) {
  return `https://script.googleapis.com/v1${path}`;
}

async function listAppsScriptProjects(clientId) {
  const q = encodeURIComponent("mimeType='application/vnd.google-apps.script' and trashed=false");
  const fields = encodeURIComponent('files(id,name,modifiedTime,webViewLink,owners(displayName,emailAddress))');
  const orderBy = encodeURIComponent('modifiedTime desc');
  return googleFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&orderBy=${orderBy}&pageSize=200`, clientId);
}

async function getProjectMetadata(scriptId, clientId) {
  return googleFetch(scriptApiUrl(`/projects/${encodeURIComponent(scriptId)}`), clientId);
}

async function getProjectContent(scriptId, clientId) {
  const content = await googleFetch(scriptApiUrl(`/projects/${encodeURIComponent(scriptId)}/content`), clientId);
  CDQ.content = content;
  return content;
}

async function updateProjectContent(scriptId, files, clientId) {
  const result = await googleFetch(scriptApiUrl(`/projects/${encodeURIComponent(scriptId)}/content`), clientId, {
    method: 'PUT',
    body: JSON.stringify({ files }),
  });
  CDQ.content = result;
  return result;
}

async function listDeployments(scriptId, clientId) {
  const data = await googleFetch(scriptApiUrl(`/projects/${encodeURIComponent(scriptId)}/deployments`), clientId);
  CDQ.deployments = data.deployments || [];
  return CDQ.deployments;
}

async function createProjectVersion(scriptId, description, clientId) {
  return googleFetch(scriptApiUrl(`/projects/${encodeURIComponent(scriptId)}/versions`), clientId, {
    method: 'POST',
    body: JSON.stringify({ description: description || 'Mise à jour CDQ' }),
  });
}

async function createDeployment(scriptId, versionNumber, description, clientId) {
  return googleFetch(scriptApiUrl(`/projects/${encodeURIComponent(scriptId)}/deployments`), clientId, {
    method: 'POST',
    body: JSON.stringify({
      versionNumber,
      manifestFileName: 'appsscript',
      description: description || `Version ${versionNumber}`,
    }),
  });
}

async function updateDeployment(scriptId, deploymentId, versionNumber, description, clientId) {
  return googleFetch(scriptApiUrl(`/projects/${encodeURIComponent(scriptId)}/deployments/${encodeURIComponent(deploymentId)}`), clientId, {
    method: 'PUT',
    body: JSON.stringify({
      deploymentConfig: {
        scriptId,
        versionNumber,
        manifestFileName: 'appsscript',
        description: description || 'Mise à jour CDQ',
      },
    }),
  });
}

function apiNameFromDisplayName(displayName) {
  const name = String(displayName || '').trim();
  if (/^appsscript\.json$/i.test(name)) return { name: 'appsscript', type: 'JSON' };
  if (/\.gs$/i.test(name)) return { name: name.replace(/\.gs$/i, ''), type: 'SERVER_JS' };
  if (/\.html?$/i.test(name)) return { name: name.replace(/\.html?$/i, ''), type: 'HTML' };
  return { name, type: 'SERVER_JS' };
}

function displayNameForFile(file) {
  if (file.type === 'JSON' && file.name === 'appsscript') return 'appsscript.json';
  if (file.type === 'SERVER_JS') return `${file.name}.gs`;
  if (file.type === 'HTML') return `${file.name}.html`;
  return file.name;
}

function findFile(files, displayName) {
  const spec = apiNameFromDisplayName(displayName);
  return files.find(f => f.type === spec.type && String(f.name).toLowerCase() === spec.name.toLowerCase());
}
