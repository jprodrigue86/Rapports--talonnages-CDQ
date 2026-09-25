#!/usr/bin/env python3
"""Prepare an isolated release after independent SDK signature verification."""
import hashlib,json,subprocess,zipfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
new=root/'downloads/Balance-CDQ-Android-25.33.apk'
old=root/'downloads/Balance-CDQ-Android-25.32.apk'
assert new.is_file() and old.is_file()
with zipfile.ZipFile(old) as a,zipfile.ZipFile(new) as b:
    before=json.loads(a.read('assets/cdq-web/asset-manifest.json'))
    after=json.loads(b.read('assets/cdq-web/asset-manifest.json'))
    assert after['version']=='25.33'
    for name,entry in before['files'].items():
        if name.endswith(('.png','.jpg','.jpeg','.webp','.pdf','.ttf','.woff','.woff2')):
            assert a.read('assets/cdq-web/'+name)==b.read('assets/cdq-web/'+name),name
approval=json.loads((root/'balance-cdq-android/signing/approval-v2533.json').read_text())
p=root/'downloads/android-release-update.json';m=json.loads(p.read_text());assert m['versionCode'] in (2532,2533)
m.update(versionName='25.33',versionCode=2533,apkUrl='https://jprodrigue86.github.io/Rapports--talonnages-CDQ/downloads/Balance-CDQ-Android-25.33.apk',sha256=hashlib.sha256(new.read_bytes()).hexdigest(),sourceCommit=approval['sourceCommit'])
assert m['signingCertificateSha256'].lower()=='496030d9cd10e81ff4e9486c38491bc15389112c0c295c61c295981c101c4436'
p.write_text(json.dumps(m,indent=2)+'\n')
assert json.loads((root/'downloads/android-update.json').read_text())['channel']=='paused'
with zipfile.ZipFile(root/'downloads/Balance-CDQ-Android-25.33.zip','w',zipfile.ZIP_DEFLATED) as z:z.write(new,new.name)
print('Prepared 25.33 APK/ZIP metadata; image, PDF and font bytes unchanged; legacy channel remains paused.')
