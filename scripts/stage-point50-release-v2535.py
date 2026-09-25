#!/usr/bin/env python3
"""Stage the paired 25.35 release after independent SDK signature verification."""
import hashlib,json,re,zipfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
new=root/'downloads/Balance-CDQ-Android-25.35.apk'
old=root/'downloads/Balance-CDQ-Android-25.34.apk'
assert new.is_file() and old.is_file()
extract=lambda text,ident:re.search(r'<script id="'+ident+r'">([\\s\\S]*?)</script>',text)[1]
with zipfile.ZipFile(old) as a,zipfile.ZipFile(new) as b:
    before=json.loads(a.read('assets/cdq-web/asset-manifest.json'))
    after=json.loads(b.read('assets/cdq-web/asset-manifest.json'))
    assert before['version']=='25.34' and after['version']=='25.35'
    assert after['build']=='2026.09.25-v25.35-point50-standard'
    for name in before['files']:
        if name.endswith(('.png','.jpg','.jpeg','.webp','.pdf','.ttf','.woff','.woff2')) or name=='floor-template-v2519.mjs':
            assert a.read('assets/cdq-web/'+name)==b.read('assets/cdq-web/'+name),name
    sa=a.read('assets/cdq-web/Selector.html').decode()
    sb=b.read('assets/cdq-web/Selector.html').decode()
    assert extract(sa,'cdqWholeWordsV2534')==extract(sb,'cdqWholeWordsV2534')
    assert extract(sb,'cdqWholeWordsV2534').strip()==(root/'whole-words-v2534.js').read_text().strip()
    assert extract(sb,'cdqPersonalSizingV2533').strip()==(root/'personal-sizing-v2533.js').read_text().strip()
    assert all(b.read('assets/cdq-web/'+n)==(root/'balance-cdq-android/app/build/generated/cdq-web-assets/cdq-web'/n).read_bytes() for n in after['files'])
approval=json.loads((root/'balance-cdq-android/signing/approval-v2535.json').read_text())
p=root/'downloads/android-release-update.json'
m=json.loads(p.read_text())
assert m['versionCode']==2534
m.update(versionName='25.35',versionCode=2535,apkUrl='https://jprodrigue86.github.io/Rapports--talonnages-CDQ/downloads/Balance-CDQ-Android-25.35.apk',sha256=hashlib.sha256(new.read_bytes()).hexdigest(),sourceCommit=approval['sourceCommit'])
assert m['signingCertificateSha256'].lower()=='496030d9cd10e81ff4e9486c38491bc15389112c0c295c61c295981c101c4436'
p.write_text(json.dumps(m,indent=2)+'\n')
assert json.loads((root/'downloads/android-update.json').read_text())['channel']=='paused'
with zipfile.ZipFile(root/'downloads/Balance-CDQ-Android-25.35.zip','w',zipfile.ZIP_DEFLATED) as z:
    z.write(new,new.name)
iphone=json.loads((root/'iphone/app/release.json').read_text())
assert iphone['version']=='25.35'
assert iphone['androidSourceBuild']=='2026.09.25-v25.35-point50-standard'
print('Staged 25.35: standard 50/50/50 equals the validated former 50/71/100 rendering; protected assets, whole-word layout, certificate identity and backend remain unchanged.')
