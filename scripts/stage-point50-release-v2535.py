#!/usr/bin/env python3
"""Stage the current certified Balance CDQ Android/iPhone release generically."""
import hashlib,json,re,zipfile
from pathlib import Path

root=Path(__file__).resolve().parents[1]
approval_path=root/'balance-cdq-android/signing/approval-v2535.json'
approval=json.loads(approval_path.read_text())

gradle=(root/'balance-cdq-android/app/build.gradle.kts').read_text()
version=re.search(r'versionName\s*=\s*"([^"]+)"',gradle).group(1)
code=int(re.search(r'versionCode\s*=\s*(\d+)',gradle).group(1))

apk=root/'downloads'/f'Balance-CDQ-Android-{version}.apk'
assert apk.is_file(),apk
assert approval['artifactName']==f'Balance-CDQ-Android-{version}-release-handoff'
assert approval['sourceCommit']
assert approval['signedSha256']==hashlib.sha256(apk.read_bytes()).hexdigest()
assert approval['signingCertificateSha256'].lower()=='496030d9cd10e81ff4e9486c38491bc15389112c0c295c61c295981c101c4436'

generated=root/'balance-cdq-android/app/build/generated/cdq-web-assets/cdq-web'
manifest=json.loads((generated/'asset-manifest.json').read_text())
assert manifest['version']==version
with zipfile.ZipFile(apk) as z:
    packaged=json.loads(z.read('assets/cdq-web/asset-manifest.json'))
    assert packaged==manifest
    for name in manifest['files']:
        assert z.read('assets/cdq-web/'+name)==(generated/name).read_bytes(),name

channel_path=root/'downloads/android-release-update.json'
channel=json.loads(channel_path.read_text())
previous_code=int(channel.get('versionCode',0))
assert code>=previous_code
channel.update(
    versionName=version,
    versionCode=code,
    apkUrl=f'https://jprodrigue86.github.io/Rapports--talonnages-CDQ/downloads/Balance-CDQ-Android-{version}.apk',
    sha256=approval['signedSha256'],
    sourceCommit=approval['sourceCommit'],
    signingCertificateSha256=approval['signingCertificateSha256'],
    channel='stable',
    mandatory=False
)
channel_path.write_text(json.dumps(channel,indent=2)+'\n')

zip_path=root/'downloads'/f'Balance-CDQ-Android-{version}.zip'
with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED) as z:
    z.write(apk,apk.name)

iphone=json.loads((root/'iphone/app/release.json').read_text())
assert iphone['version']==version
assert iphone['androidSourceBuild']==manifest['build']
assert iphone['androidSelectorSha256']==manifest['files']['Selector.html']['sha256']

installer=(root/'installer.html').read_text()
apple=(root/'iphone/index.html').read_text()
for page in (installer,apple):
    assert f'Balance-CDQ-Android-{version}.apk' in page
    assert f'Balance-CDQ-Android-{version}.zip' in page
    assert f'Android · V{version}' in page
assert f'base V{version}' in installer
assert json.loads((root/'downloads/android-update.json').read_text())['channel']=='paused'

print(json.dumps({
    'versionName':version,
    'versionCode':code,
    'androidSha256':approval['signedSha256'],
    'sourceCommit':approval['sourceCommit'],
    'iphoneRelease':iphone['release']
},sort_keys=True))
