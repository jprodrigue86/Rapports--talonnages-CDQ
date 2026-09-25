#!/usr/bin/env python3
"""Stage paired public release after independent SDK signature verification."""
import hashlib,json,re,zipfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
new=root/'downloads/Balance-CDQ-Android-25.34.apk'
old=root/'downloads/Balance-CDQ-Android-25.33.apk'
assert new.is_file() and old.is_file()
extract=lambda text,ident:re.search(r'<script id="'+ident+r'">([\s\S]*?)</script>',text)[1]
with zipfile.ZipFile(old) as a,zipfile.ZipFile(new) as b:
    before=json.loads(a.read('assets/cdq-web/asset-manifest.json'))
    after=json.loads(b.read('assets/cdq-web/asset-manifest.json'))
    assert after['version']=='25.34'
    for name in before['files']:
        if name.endswith(('.png','.jpg','.jpeg','.webp','.pdf','.ttf','.woff','.woff2')) or name=='floor-template-v2519.mjs':
            assert a.read('assets/cdq-web/'+name)==b.read('assets/cdq-web/'+name),name
    sa=a.read('assets/cdq-web/Selector.html').decode();sb=b.read('assets/cdq-web/Selector.html').decode()
    assert extract(sa,'cdqPersonalSizingV2533')==extract(sb,'cdqPersonalSizingV2533')
    assert extract(sb,'cdqWholeWordsV2534').strip()==(root/'whole-words-v2534.js').read_text().strip()
    assert all(b.read('assets/cdq-web/'+n)==(root/'balance-cdq-android/app/build/generated/cdq-web-assets/cdq-web'/n).read_bytes() for n in after['files'])
approval=json.loads((root/'balance-cdq-android/signing/approval-v2534.json').read_text())
p=root/'downloads/android-release-update.json';m=json.loads(p.read_text());assert m['versionCode'] in (2533,2534)
m.update(versionName='25.34',versionCode=2534,apkUrl='https://jprodrigue86.github.io/Rapports--talonnages-CDQ/downloads/Balance-CDQ-Android-25.34.apk',sha256=hashlib.sha256(new.read_bytes()).hexdigest(),sourceCommit=approval['sourceCommit'])
assert m['signingCertificateSha256'].lower()=='496030d9cd10e81ff4e9486c38491bc15389112c0c295c61c295981c101c4436'
p.write_text(json.dumps(m,indent=2)+'\n')
assert json.loads((root/'downloads/android-update.json').read_text())['channel']=='paused'
with zipfile.ZipFile(root/'downloads/Balance-CDQ-Android-25.34.zip','w',zipfile.ZIP_DEFLATED) as z:z.write(new,new.name)
p=root/'.github/workflows/build-balance-cdq-android.yml';s=p.read_text();assert "versionCode='2533'" in s or "versionCode='2534'" in s
s=s.replace('25.33','25.34').replace("versionCode='2533'","versionCode='2534'")
if "'whole-words-v2534.js'" not in s:
    anchor="      - 'personal-sizing-v2533.js'";assert s.count(anchor)==2
    s=s.replace(anchor,anchor+"\n      - 'whole-words-v2534.js'\n      - 'scripts/whole-words-v2534.mjs'")
p.write_text(s)
print('Staged 25.34: signed APK assets match generated interface; personal calibration, images, PDF/model and font bytes unchanged. No Google deployment or preference change.')
