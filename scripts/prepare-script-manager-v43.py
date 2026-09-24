"""Apply the V43 integration once, refusing unexpected V42 source anchors.
Does not access Google, edit a bundle, build an APK or deploy Apps Script.
"""
from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'apps-script-manager'

def replace_once(text, old, new):
    if text.count(old) != 1:
        raise ValueError('Unexpected source anchor: ' + old[:100])
    return text.replace(old, new, 1)


def prepare():
    app = (BASE / 'app.js').read_text()
    if "const APP_VERSION = 'V43';" in app:
        assert 'startVersionDiagnosticV43' in app
        return
    assert hashlib.sha1(b'blob '+str(len(app.encode())).encode()+b'\0'+app.encode()).hexdigest() == '8d84a5e94b3dc2e5488ade8c8cd1bff287cc8a30', 'V42 app.js changed; reconcile first'
    app = replace_once(app, "const APP_VERSION = 'V42';", "const APP_VERSION = 'V43';")
    app = replace_once(app, "  autoBundleChecked: false,", "  autoBundleChecked: false,\n  projectReadGeneration: 0,")
    app = replace_once(app, "  LS.setItem(TOKEN_EXPIRES_KEY, String(CDQ.expiresAt));", "  LS.setItem(TOKEN_EXPIRES_KEY, String(CDQ.expiresAt));\n  LS.setItem('cdqsm_google_scopes_v43', CDQ.grantedScopes || '');")
    app = replace_once(app, "  LS.removeItem(TOKEN_EXPIRES_KEY);", "  LS.removeItem(TOKEN_EXPIRES_KEY);\n  LS.removeItem('cdqsm_google_scopes_v43');")
    app = replace_once(app, "  CDQ.expiresAt = expiresAt;", "  CDQ.expiresAt = expiresAt;\n  CDQ.grantedScopes = LS.getItem('cdqsm_google_scopes_v43') || '';")
    app = replace_once(app, "      const announced=lastSelector||lastSeen;", "      const announced=diagnosticVersionLabelV43(lastSelector)||diagnosticVersionLabelV43(lastSeen);")
    app = replace_once(app, "      if(expectedBuild && announced && compareBuildLabels(announced,expectedBuild)<0){", "      if(expectedBuild && (!announced || compareBuildLabels(announced,expectedBuild)<0)){")
    app = replace_once(app, "        build:lastSeen||'version backend non annoncée',\n        selectorBuild:lastSelector||'version Selector non annoncée',", "        build:diagnosticVersionLabelV43(lastSeen),\n        selectorBuild:diagnosticVersionLabelV43(lastSelector),")
    app = replace_once(app, "    const ready=Boolean(S.pkg.size||S.bundleAlreadyApplied);\n    packageState.textContent=ready?'✓ Package prêt':'● Package en attente';", "    const ready=Boolean(S.pkg.size||S.bundleAlreadyApplied||S.redeploySource);\n    packageState.textContent=S.redeploySource&&!S.pkg.size?'● Source prête à déployer':ready?'✓ Package prêt':'● Aucun package chargé';")
    app = replace_once(app, "    if(S.bundleAlreadyApplied)packageNote.textContent=", "    if(S.redeploySource&&!S.pkg.size)packageNote.textContent='La source Google diffère du déploiement versionné. Aucun nouveau fichier requis pour la republier.';\n    else if(S.bundleAlreadyApplied)packageNote.textContent=")
    app = replace_once(app, "async function writeProjectChanges() {", "async function writeProjectChanges() {\n  invalidateVersionDiagnosticV43();\n  S.projectReadGeneration++;")
    app = replace_once(app, "async function deployNewVersion(targetOverride = null) {", "async function deployNewVersion(targetOverride = null) {\n  invalidateVersionDiagnosticV43();\n  S.projectReadGeneration++;")
    app = replace_once(app, "async function handleGoogleConnect() {", "async function handleGoogleConnect() {\n  invalidateVersionDiagnosticV43();\n  S.projectReadGeneration++;")
    app = replace_once(app, "function handleGoogleDisconnect() {", "function handleGoogleDisconnect() {\n  invalidateVersionDiagnosticV43();\n  S.projectReadGeneration++;")
    app = replace_once(app, "  stat('Lecture du projet…');\n\n  // V39", "  const readGeneration = ++S.projectReadGeneration;\n  invalidateVersionDiagnosticV43();\n  stat('Lecture du projet…');\n\n  // V39")
    app = replace_once(app, "  const content = await getProjectContent(id, cid());\n  if (!content", "  const content = await getProjectContent(id, cid());\n  if(readGeneration !== S.projectReadGeneration)return;\n  if (!content")
    app = replace_once(app, "  let deps = [];\n  try {\n    deps = await listDeployments(id, cid());\n  } catch (_) {\n    deps = [];\n  }", "  let deps = [];\n  let deploymentsReadOk = true;\n  try {\n    deps = await listDeployments(id, cid());\n  } catch (_) {\n    deploymentsReadOk = false;\n  }\n  if(readGeneration !== S.projectReadGeneration)return;\n  CDQ.deployments = deps;")
    app = replace_once(app, "  const sourceBuild=detectBuildLabel(S.files)||'version non détectée';", "  const sourceBuild=diagnosticMainBuildV43(S.files)||'version non détectée';")
    start = app.index('  if(S.bundleUrl)await maybeImportBundleV24();\n', app.index('async function readProject('))
    end = app.index('\n}\n\nasync function loadSelectedProject()', start)
    app = app[:start] + '''  try {
    if(S.bundleUrl)await maybeImportBundleV24();
    else if(isProductionProject())await prepareLatestBundleV41();
  } catch (error) {
    setQuickResult('Lecture de la mise à jour impossible : '+error.message, 'err');
  } finally {
    if(readGeneration === S.projectReadGeneration){
      // Read-only Google audit; Drive receives only a private, sanitized report.
      // Never interpret a missing live version label as an outdated deployment.
      void startVersionDiagnosticV43({id, files:content.files, deployments:deps, deploymentsReadOk, readGeneration});
    }
  }''' + app[end:]
    app = replace_once(app, "navigator.serviceWorker.register('sw.js?v=42')", "navigator.serviceWorker.register('sw.js?v=43')")
    (BASE / 'app.js').write_text(app)
    module = (BASE / 'diagnostics.js').read_text()
    module = replace_once(module, "(String(v).match(/v?(\\d+)\\.(\\d+)(?:\\.(\\d+))?/i)||[])", "(String(v).match(/v(\\d+)\\.(\\d+)(?:\\.(\\d+))?/i)||String(v).match(/^(\\d+)\\.(\\d+)(?:\\.(\\d+))?$/)||[])")
    (BASE / 'diagnostics.js').write_text(module)

    api = (BASE / 'api.js').read_text()
    api = replace_once(api, "  scriptApiBase: '',", "  scriptApiBase: '',\n  grantedScopes: '',")
    api = replace_once(api, "  'https://www.googleapis.com/auth/drive.metadata.readonly',", "  'https://www.googleapis.com/auth/drive.metadata.readonly',\n  // Only app-created diagnostic files, not general Drive write access.\n  'https://www.googleapis.com/auth/drive.file',")
    api = replace_once(api, "      CDQ.token = response.access_token || '';", "      CDQ.token = response.access_token || '';\n      CDQ.grantedScopes = response.scope || '';")
    api = replace_once(api, "  CDQ.token = '';\n  CDQ.expiresAt = 0;", "  CDQ.token = '';\n  CDQ.expiresAt = 0;\n  CDQ.grantedScopes = '';")
    api = replace_once(api, "        const error = new Error(friendlyGoogleError(response.status, data));", "        const error = new Error(friendlyGoogleError(response.status, data));\n        error.status = response.status;")
    api = replace_once(api, '''async function getProjectContent(scriptId, clientId) {
  const content = await googleFetch(scriptApiUrl(`/projects/${encodeURIComponent(scriptId)}/content`), clientId);
  CDQ.content = content;
  return content;
}''', '''async function getProjectContent(scriptId, clientId, versionNumber = null) {
  if(versionNumber !== null && (!Number.isInteger(versionNumber) || versionNumber < 1))throw new Error('Version Apps Script invalide.');
  const query = versionNumber === null ? '' : '?versionNumber=' + versionNumber;
  const content = await googleFetch(scriptApiUrl(`/projects/${encodeURIComponent(scriptId)}/content${query}`), clientId);
  // Reading an immutable deployed version must never replace the editable HEAD.
  if(versionNumber === null)CDQ.content = content;
  return content;
}''')
    api = replace_once(api, '''  const data = await googleFetch(scriptApiUrl(`/projects/${encodeURIComponent(scriptId)}/deployments`), clientId);
  CDQ.deployments = data.deployments || [];
  return CDQ.deployments;''', '''  const deployments = [];
  const seen = new Set();
  let pageToken = '';
  do {
    const query = pageToken ? '?pageToken=' + encodeURIComponent(pageToken) : '';
    const data = await googleFetch(scriptApiUrl(`/projects/${encodeURIComponent(scriptId)}/deployments${query}`), clientId);
    deployments.push(...(data.deployments || []));
    pageToken = data.nextPageToken || '';
    if(pageToken && (seen.has(pageToken) || seen.size >= 100))throw new Error('Liste des déploiements incomplète.');
    seen.add(pageToken);
  } while(pageToken);
  CDQ.deployments = deployments;
  return deployments;''')
    (BASE / 'api.js').write_text(api)

    html = (BASE / 'index.html').read_text().replace('v=42', 'v=43').replace('V42', 'V43')
    html = replace_once(html, '<link rel="stylesheet" href="style.css?v=43">', '<link rel="stylesheet" href="style.css?v=43">\n  <link rel="stylesheet" href="diagnostics.css?v=43">')
    card = '''    <section class="card" id="diagnosticCard" aria-labelledby="diagnosticHeading">
      <div class="section-title"><span>✓</span><h2 id="diagnosticHeading">Diagnostic des versions</h2></div>
      <p class="muted">« Lire le projet » vérifie la source Google, le déploiement versionné et les versions publiées Android, iPhone et Web. Aucun code n’est écrit ni déployé.</p>
      <p id="diagnosticStatus" role="status" aria-live="polite">Lis le projet pour préparer le diagnostic.</p>
      <dl id="diagnosticRows" class="diagnostic-rows"></dl>
      <label class="session-option" for="diagnosticAutoDrive">
        <input id="diagnosticAutoDrive" type="checkbox" checked>
        <span><b>Enregistrer le diagnostic dans mon Drive privé</b><small>Automatique pour le projet CDQ. Rapport de versions uniquement : ni code source, ni mot de passe, ni jeton. ChatGPT pourra le lire avec ta connexion Drive, quand tu le demandes. Aucun accès à distance ni surveillance permanente.</small></span>
      </label>
      <div class="actions two">
        <button id="diagnosticAuthorize" class="primary" type="button" hidden>Autoriser le rapport Drive</button>
        <button id="diagnosticSave" class="secondary" type="button" disabled>Enregistrer le rapport</button>
        <button id="diagnosticCopy" class="secondary" type="button" disabled>Copier le diagnostic</button>
        <a id="diagnosticDriveLink" target="_blank" rel="noopener noreferrer" hidden>Ouvrir le rapport privé</a>
      </div>
      <p id="diagnosticDriveStatus" class="muted" role="status" aria-live="polite">Une autorisation Google supplémentaire peut être nécessaire la première fois pour créer ce rapport.</p>
      <details><summary>Voir le diagnostic complet</summary><pre id="diagnosticText" class="diagnostic-text">Aucun diagnostic.</pre></details>
    </section>

'''
    html = replace_once(html, '    <section class="card advanced-section" id="googleCard">', card + '    <section class="card advanced-section" id="googleCard">')
    html = replace_once(html, '  <script src="app.js?v=43"></script>', '  <script src="diagnostics.js?v=43"></script>\n  <script src="app.js?v=43"></script>')
    (BASE / 'index.html').write_text(html)
    sw = (BASE / 'sw.js').read_text().replace('v42-patch-line-endings', 'v43-private-version-diagnostic').replace('v=42', 'v=43')
    sw = replace_once(sw, "'app.js?v=43'", "'app.js?v=43','diagnostics.js?v=43','diagnostics.css?v=43','version.json'")
    sw = replace_once(sw, "  if(u.origin!==self.location.origin)return;", "  if(u.origin!==self.location.origin||u.searchParams.has('cdq_diag'))return;")
    (BASE / 'sw.js').write_text(sw)
    (BASE / 'version.json').write_text(json.dumps({'version':'V43','build':'2026.09.24-v43-diagnostic-drive-prive','diagnosticSchema':'cdq-version-diagnostic-v1'}, indent=2)+'\n')

if __name__ == '__main__':
    prepare()
