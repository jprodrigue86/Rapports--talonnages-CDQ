"""Real Manager UI with mocked Google/GitHub services; no real credentials used."""
import json
import os
from pathlib import Path
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PID = '1udMG-jQcBAwBAwk6kSEZ660JWo5n7nVvnq24lp2T4RDV5pfXe8QDlPdf'
DEP = 'AKfycbx8NuvklaL-azJBIVyCMKjPk_Hd9z62Q_2-NPl3vqw2kJRpI5wy63J8xkBN5toOFxEw'
BUILD = '2026.09.23-v25.28-apk-embarquee'
FILES = [dict(name='Code', type='SERVER_JS', source='const CDQ_BUILD="'+BUILD+'";\nconst PRIVATE_SECRET="NEVER_EXPORT_SOURCE";'),
         dict(name='Selector', type='HTML', source='<div>'+('CDQ ' * 300)+'</div>'),
         dict(name='appsscript', type='JSON', source='{"timeZone":"America/Toronto"}')]
DEPLOYMENT = dict(deploymentId=DEP, deploymentConfig=dict(versionNumber=505), updateTime='2026-09-24T00:46:24Z')

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)
    def log_message(self, *args):
        pass

server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{server.server_port}/apps-script-manager/'

def run_browser(p, name):
    browser = p.chromium.launch(executable_path=os.environ.get('CHROME_PATH', '/usr/bin/chromium'), args=['--no-sandbox']) if name == 'chromium' else p.webkit.launch()
    context = browser.new_context(viewport={'width':405,'height':900}, service_workers='block')
    context.add_init_script('''localStorage.setItem('cdqsm_google_access_token','MOCK_SESSION_TOKEN');
      localStorage.setItem('cdqsm_google_access_token_expires', String(Date.now()+3600000));
      localStorage.setItem('cdqsm_keep_connected','1');
      localStorage.setItem('cdqsm_script_id', '''+json.dumps(PID)+''');''')
    writes=[]
    state={'file':None,'mode':'equal','deny_drive':False,'reads':0}
    def fulfill(route,data,status=200):
        route.fulfill(status=status, content_type='application/json', body=json.dumps(data), headers={'Access-Control-Allow-Origin':'*'})
    def route_request(route):
        req=route.request; u=urlparse(req.url); path=u.path; query=parse_qs(u.query)
        if u.hostname=='accounts.google.com':
            route.fulfill(content_type='text/javascript',body='''window.google={accounts:{oauth2:{initTokenClient(opts){
              const client={__clientId:opts.client_id,callback:opts.callback,error_callback:opts.error_callback,
              requestAccessToken(){setTimeout(()=>client.callback({access_token:'MOCK_NEW_TOKEN',expires_in:3600,scope:opts.scope}),1)}};
              return client;},revoke(t,cb){cb&&cb();}}}};''');return
        if u.hostname in ('script.googleapis.com','scriptmanagement.googleapis.com'):
            if req.method != 'GET':
                writes.append(('SCRIPT_WRITE',req.url,req.post_data));fulfill(route,{'error':{'message':'Forbidden in audit test'}},400);return
            if path.endswith('/content'):
                state['reads']+=1
                if 'versionNumber' in query and state['mode']=='denied':
                    fulfill(route,{'error':{'message':'PRIVATE_API_ERROR'}},403);return
                data=FILES
                if 'versionNumber' in query and state['mode']=='different':
                    data=[dict(f,source=f['source']+'\nchanged') for f in FILES]
                fulfill(route,{'scriptId':PID,'files':data});return
            if path.endswith('/deployments'):
                fulfill(route,{'deployments':[DEPLOYMENT]});return
            if path.endswith('/deployments/'+DEP):
                fulfill(route,DEPLOYMENT);return
            fulfill(route,{'error':{'message':'Unexpected route'}},400);return
        if u.hostname=='www.googleapis.com':
            if req.method=='OPTIONS':route.fulfill(status=204,headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,content-type','Access-Control-Allow-Methods':'GET,POST,PATCH'});return
            if path.startswith('/upload/'):
                writes.append((req.method,req.url,req.post_data))
                if state['deny_drive']:fulfill(route,{'error':{'message':'PRIVATE_DRIVE_ERROR'}},403);return
                state['file']={'id':'PRIVATE_DIAGNOSTIC','name':'CDQ_Diagnostic_Versions.txt','shared':False,'ownedByMe':True,'mimeType':'text/plain',
                    'appProperties':{'cdqDiagnostic':'versions-v43','cdqScriptId':PID}}
                fulfill(route,state['file']);return
            if query.get('q',[''])[0].startswith("mimeType='application/vnd.google-apps.script'"):
                fulfill(route,{'files':[{'id':PID,'name':"Rapport D'étalonnage 1",'modifiedTime':'2026-09-24T00:46:24Z'}]});return
            if path.endswith('/PRIVATE_DIAGNOSTIC'):fulfill(route,state['file']);return
            fulfill(route,{'files':[state['file']] if state['file'] else []});return
        if u.hostname=='api.github.com':
            if path.endswith('/commits/main'):fulfill(route,{'sha':'a'*40,'commit':{'committer':{'date':'2026-09-24T15:00:00Z'}}});return
            if path.endswith('/contents/bundles/balance-cdq'):fulfill(route,[{'type':'dir','name':'v25.27'},{'type':'dir','name':'v25.28'}]);return
        if u.hostname=='jprodrigue86.github.io':
            assert 'authorization' not in req.headers
            if path.endswith('android-release-update.json'):data={'versionName':'25.30','versionCode':2530}
            elif path.endswith('iphone/app/release.json'):data={'version':'25.30','androidSourceBuild':'2026.09.24-v25.30-fichiers-immediats'}
            elif '/latest/manifest.json' in path:data={'version':'V25.27','build':'2026.09.23-v25.27-demarrage-dossiers','projectScriptId':PID}
            elif '/v25.28/manifest.json' in path:data={'version':'V25.28','build':BUILD,'projectScriptId':PID}
            elif '/apps-script-manager/version.json' in path:data={'version':'V43'}
            else:data={'version':'2026.09.23-v25.27-demarrage-dossiers'}
            fulfill(route,data);return
        if u.hostname=='127.0.0.1':route.continue_();return
        route.abort()
    context.route('**/*',route_request)
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(URL,wait_until='domcontentloaded')
    page.wait_for_function("document.querySelector('#diagnosticStatus').textContent.includes('Diagnostic terminé')",timeout=20000)
    assert page.locator('#versionChip').inner_text()=='V43'
    assert 'Source et déploiement identiques' in page.locator('#diagnosticRows').inner_text()
    assert page.locator('#diagnosticAuthorize').is_visible()
    assert not writes, 'Old V42 token may not automatically write a report'
    page.locator('#diagnosticAuthorize').click()
    page.wait_for_function("document.querySelector('#diagnosticDriveStatus').textContent.startsWith('Rapport privé enregistré')",timeout=20000)
    assert len(writes)==1 and writes[0][0]=='POST'
    exported=writes[0][2]
    assert all(secret not in exported for secret in ('NEVER_EXPORT_SOURCE','MOCK_SESSION_TOKEN','MOCK_NEW_TOKEN'))
    assert page.locator('#diagnosticDriveLink').get_attribute('href')=='https://drive.google.com/file/d/PRIVATE_DIAGNOSTIC/view'
    # On the next ordinary read the same private file is updated, without another grant.
    page.locator('[data-sm-tab="projects"]').click()
    before=state['reads'];page.locator('#loadProject').click()
    page.wait_for_function("document.querySelector('#diagnosticDriveStatus').textContent.startsWith('Rapport privé enregistré')",timeout=20000)
    assert state['reads']>=before+2
    assert len(writes)==2 and writes[1][0]=='PATCH'
    assert all(item[0]!='SCRIPT_WRITE' for item in writes)
    # No horizontal clipping on narrow Android/iPhone-size screens.
    page.locator('[data-sm-tab="deploy"]').click()
    for width in (320,405,1280):
        page.set_viewport_size({'width':width,'height':900})
        page.locator('#diagnosticCard').scroll_into_view_if_needed()
        assert page.locator('#diagnosticCard').evaluate('(el)=>el.scrollWidth<=el.clientWidth+2'),str(width)
    if os.environ.get('CDQ_TEST_SCREENSHOT'):
        page.set_viewport_size({'width':405,'height':1050})
        page.locator('#diagnosticCard').screenshot(path=os.environ['CDQ_TEST_SCREENSHOT'])
    # A real content difference enables the source redeploy state, but never writes.
    state['mode']='different';page.locator('[data-sm-tab="projects"]').click();page.locator('#loadProject').click()
    page.wait_for_function("document.querySelector('#diagnosticRows').textContent.includes('Source différente du déploiement')",timeout=20000)
    assert page.evaluate('S.redeploySource') is True
    page.wait_for_function("document.querySelector('#diagnosticDriveStatus').textContent.startsWith('Rapport privé enregistré')")
    # A denied API read produces unknown, not stale, and no automatic redeploy.
    state['mode']='denied';page.locator('#loadProject').click()
    page.wait_for_function("document.querySelector('#diagnosticStatus').textContent.includes('Diagnostic terminé')",timeout=20000)
    assert 'Comparaison non confirmée' in page.locator('#diagnosticRows').inner_text()
    assert page.evaluate('S.redeploySource') is False
    assert 'PRIVATE_API_ERROR' not in page.locator('#diagnosticText').text_content()
    page.wait_for_function("document.querySelector('#diagnosticDriveStatus').textContent.startsWith('Rapport privé enregistré')")
    # Opting out stops the next automatic upload, not reading Google.
    count=len(writes);page.locator('#diagnosticAutoDrive').uncheck();page.locator('#loadProject').click()
    page.wait_for_function("document.querySelector('#diagnosticStatus').textContent.includes('Diagnostic terminé')",timeout=20000)
    assert len(writes)==count
    assert not errors,errors
    print(name+': PASS — real UI, old-token consent, read-only audit, private create/update, unknown/different, opt-out, 320/405/1280 px')
    context.close();browser.close()

try:
    with sync_playwright() as p:
        run_browser(p,'chromium')
        if os.environ.get('CDQ_TEST_WEBKIT')=='1':run_browser(p,'webkit')
finally:
    server.shutdown();server.server_close()
