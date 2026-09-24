#!/usr/bin/env python3
"""Reassemble only publicly shareable APK signing bytes; the private key is never uploaded."""
import base64,hashlib,io,json,os,re,subprocess,zipfile,zlib
from pathlib import Path
recipe=json.loads(Path('balance-cdq-android/releases/v25.30-signature.json').read_text())
assert recipe['versionName']=='25.30' and recipe['versionCode']==2530
assert recipe['certificateSha256']=='496030d9cd10e81ff4e9486c38491bc15389112c0c295c61c295981c101c4436'
assert re.fullmatch('[0-9a-f]{40}',recipe['sourceCommit'])
subprocess.run(['git','merge-base','--is-ancestor',recipe['sourceCommit'],'HEAD'],check=True)
subprocess.run(['git','diff','--exit-code',recipe['sourceCommit'],'HEAD','--','balance-cdq-android/app','balance-cdq-android/web-source','scripts/instant-files-v2530.mjs','scripts/build-embedded-android-v2528.mjs'],check=True)
with zipfile.ZipFile('/tmp/cdq-2530-handoff.zip') as archive:
    original=archive.read('Balance-CDQ-Android-25.30-unsigned.apk')
    assert archive.read('source-commit.txt').decode().strip()==recipe['sourceCommit']
assert hashlib.sha256(original).hexdigest()==recipe['unsignedSha256']
assert len(recipe['operations'])<=12
out=io.BytesIO()
for op in recipe['operations']:
    if 'copy' in op:
        start,length=op['copy'];assert isinstance(start,int) and isinstance(length,int) and 0<=start<=len(original) and 0<=length<=len(original)-start
        out.write(original[start:start+length])
    else:
        data=base64.b64decode(op['data'],validate=True)
        if op.get('zlib'):
            decoder=zlib.decompressobj();data=decoder.decompress(data,1000000);assert decoder.eof
        assert len(data)<1000000;out.write(data)
signed=out.getvalue();assert len(signed)==recipe['signedBytes']
assert hashlib.sha256(signed).hexdigest()==recipe['signedSha256']
apk=Path('downloads/Balance-CDQ-Android-25.30.apk');apk.write_bytes(signed)
tools=Path(os.environ['ANDROID_HOME'])/'build-tools/35.0.0'
verification=subprocess.run([str(tools/'apksigner'),'verify','--verbose','--print-certs',str(apk)],capture_output=True,text=True,check=True).stdout
assert re.findall(r'^Signer #\d+ certificate SHA-256 digest: (\w+)$',verification,re.M)==[recipe['certificateSha256']]
for scheme in ['v2','v3']:
    assert 'Verified using '+scheme+' scheme (APK Signature Scheme '+scheme+'): true' in verification
badging=subprocess.run([str(tools/'aapt'),'dump','badging',str(apk)],capture_output=True,text=True,check=True).stdout
assert "package: name='ca.balancecdq.android' versionCode='2530' versionName='25.30'" in badging
assert 'application-debuggable' not in badging
subprocess.run([str(tools/'zipalign'),'-c','-P','16','4',str(apk)],check=True)
manifest_path=Path('downloads/android-release-update.json');manifest=json.loads(manifest_path.read_text())
assert manifest['versionCode']<=2530 and manifest['signingCertificateSha256']==recipe['certificateSha256']
manifest.update(versionName='25.30',versionCode=2530,apkUrl='https://jprodrigue86.github.io/Rapports--talonnages-CDQ/'+str(apk),sha256=recipe['signedSha256'],sourceCommit=recipe['sourceCommit'])
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
assert json.loads(Path('downloads/android-update.json').read_text())['channel']=='paused'
with zipfile.ZipFile('downloads/Balance-CDQ-Android-25.30.zip','w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    z.write(apk,apk.name)
    z.writestr('INSTALLATION.txt','Balance CDQ Android V25.30\nInstaller cette APK par-dessus la version existante, sans désinstaller.\nActualisation ciblée des copies et fichiers modifiés. Signature durable CDQ conservée.\n')
installer=Path('installer.html');html=installer.read_text().replace('25.29','25.30')
html=html.replace('13,4 Mo',format(len(signed)/1000000,'.1f').replace('.',',')+' Mo');installer.write_text(html)
Path('balance-cdq-android/releases/v25.30-verification.json').write_text(json.dumps({'version':'25.30','sourceCommit':recipe['sourceCommit'],'sha256':recipe['signedSha256'],'certificateSha256':recipe['certificateSha256'],'bytes':len(signed),'v2':True,'v3':True,'debuggable':False,'physicalDeviceTested':False},indent=2)+'\n')
print('Verified signed Android 25.30 prepared for publication. No private signing material present.')
