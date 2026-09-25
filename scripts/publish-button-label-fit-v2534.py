#!/usr/bin/env python3
"""Publish only the certified 25.34 APK and paired iPhone/static references."""
import hashlib,json,zipfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
new=root/'downloads/Balance-CDQ-Android-25.34.apk'
old=root/'downloads/Balance-CDQ-Android-25.33.apk'
assert new.is_file() and old.is_file()
with zipfile.ZipFile(old) as a,zipfile.ZipFile(new) as b:
    before=json.loads(a.read('assets/cdq-web/asset-manifest.json'))
    after=json.loads(b.read('assets/cdq-web/asset-manifest.json'))
    assert after['version']=='25.34'
    for name in before['files']:
        if name.endswith(('.png','.jpg','.jpeg','.webp','.pdf','.ttf','.woff','.woff2')):
            assert a.read('assets/cdq-web/'+name)==b.read('assets/cdq-web/'+name),name
approval=json.loads((root/'balance-cdq-android/signing/approval-v2534.json').read_text())
p=root/'downloads/android-release-update.json';m=json.loads(p.read_text());assert m['versionCode'] in (2533,2534)
m.update(versionName='25.34',versionCode=2534,apkUrl='https://jprodrigue86.github.io/Rapports--talonnages-CDQ/downloads/Balance-CDQ-Android-25.34.apk',sha256=hashlib.sha256(new.read_bytes()).hexdigest(),sourceCommit=approval['sourceCommit'])
assert m['signingCertificateSha256'].lower()=='496030d9cd10e81ff4e9486c38491bc15389112c0c295c61c295981c101c4436'
p.write_text(json.dumps(m,indent=2)+'\n')
assert json.loads((root/'downloads/android-update.json').read_text())['channel']=='paused'
with zipfile.ZipFile(root/'downloads/Balance-CDQ-Android-25.34.zip','w',zipfile.ZIP_DEFLATED) as z:z.write(new,new.name)
print('Prepared 25.34 APK/ZIP metadata; protected images, PDFs and fonts unchanged.')
