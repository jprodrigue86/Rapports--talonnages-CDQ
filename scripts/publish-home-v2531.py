#!/usr/bin/env python3
"""Restore an already privately signed APK from an integrity-checked public delta.
No signing key, password or credential is accepted or stored by this script.
"""
from pathlib import Path
import argparse,base64,hashlib,json,re,struct,subprocess,zipfile,zlib
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--handoff',type=Path,required=True)
parser.add_argument('--spec',type=Path,required=True)
a=parser.parse_args();s=json.loads(a.spec.read_text())
def check(ok,msg):
    if not ok:raise SystemExit(msg)
def sha(b):return hashlib.sha256(b).hexdigest()
check(s['schema']=='cdq-signed-apk-delta-v1','Unknown delta format')
base=(a.handoff/'Balance-CDQ-Android-25.31-unsigned.apk').read_bytes()
check(sha(base)==s['baseSha256'],'Unsigned APK mismatch')
check((a.handoff/'source-commit.txt').read_text().strip()==s['sourceCommit'],'Source commit mismatch')
subprocess.run(['git','diff','--exit-code',s['sourceCommit'],'--','balance-cdq-android','scripts/build-embedded-android-v2528.mjs','scripts/home-underline-v2531.mjs','scripts/instant-files-v2530.mjs','assets','icons','vendor'],check=True)
start,removed=s['prefixBytes'],s['removeBytes']
check(isinstance(start,int) and isinstance(removed,int) and 0<=start<=len(base) and 0<=removed<=len(base)-start,'Invalid delta range')
compressed=base64.b64decode(s['insertZlibBase64'],validate=True)
check(len(compressed)<200000,'Oversized signature delta')
dec=zlib.decompressobj();insert=dec.decompress(compressed,1000000)
check(dec.eof and not dec.unused_data and not dec.unconsumed_tail,'Invalid or oversized signature delta')
final=base[:start]+insert+base[start+removed:]
if s.get('adjustZipCentralDirectoryOffset') is True:
    # Signing only inserts a public signature block before the unchanged ZIP
    # central directory. Adjust its single EOCD offset instead of republishing it.
    eocd=base.rfind(b'PK\x05\x06')
    check(removed==0 and eocd>=0 and eocd+22==len(base), 'Unsupported signing-only ZIP layout')
    check(struct.unpack_from('<I',base,eocd+16)[0]==start, 'Signature insertion must precede the central directory')
    position=eocd+len(insert)
    check(final[position:position+4]==b'PK\x05\x06', 'ZIP end marker changed')
    mutable=bytearray(final)
    struct.pack_into('<I',mutable,position+16,start+len(insert))
    final=bytes(mutable)
check(len(final)==s['outputBytes'] and sha(final)==s['outputSha256'],'Final APK mismatch')
out=Path('/tmp/Balance-CDQ-Android-25.31.apk');out.write_bytes(final)
verify=subprocess.run(['java','-jar',str(a.handoff/'apksigner.jar'),'verify','--verbose','--print-certs',str(out)],check=True,capture_output=True,text=True).stdout
identity=json.loads(Path('balance-cdq-android/signing/release-certificate.json').read_text())
certs=re.findall(r'^Signer #\d+ certificate SHA-256 digest: (\w+)$',verify,re.M)
check([x.upper() for x in certs]==[identity['sha256'].upper()],'Wrong signing identity')
check('Verified using v2 scheme (APK Signature Scheme v2): true' in verify and 'Verified using v3 scheme (APK Signature Scheme v3): true' in verify,'Required signatures not verified')
with zipfile.ZipFile(a.handoff/'Balance-CDQ-Android-25.31-unsigned.apk') as u,zipfile.ZipFile(out) as f:
    check(u.namelist()==f.namelist(),'Signing changed ZIP entries')
    check(all(u.read(n)==f.read(n) for n in u.namelist()),'Signing changed APK contents')
# Verify the actual packaged web assets, not only the source helper.
with zipfile.ZipFile('downloads/Balance-CDQ-Android-25.30.apk') as old,zipfile.ZipFile(out) as new:
    prefix='assets/cdq-web/'
    om=json.loads(old.read(prefix+'asset-manifest.json'));nm=json.loads(new.read(prefix+'asset-manifest.json'))
    check(nm['version']=='25.31' and om['version']=='25.30','Unexpected asset versions')
    check(set(om['files'])==set(nm['files']),'Unexpected asset additions/removals')
    css='html:is(.android,.ios,.mobile-device) .bottom-nav > .bottom-nav-item.cdq-nav-home.active::after{content:none!important;display:none!important}'
    style='\n<style id="cdqHomeUnderlineV2531">\n'+css+'\n</style>\n'
    for name,meta in nm['files'].items():
        before,after=old.read(prefix+name),new.read(prefix+name)
        check(sha(after)==meta['sha256'],'Invalid packaged asset checksum: '+name)
        if meta['text']:
            expected=before.decode().replace('native/v25.30/','native/v25.31/').replace('2026.09.24-v25.30-fichiers-immediats','2026.09.24-v25.31-accueil-sans-trait')
            if name=='Selector.html':expected=expected.replace('</body>',style+'</body>')
            check(after.decode()==expected,'Unexpected non-cosmetic asset change: '+name)
        else:check(after==before,'Binary asset changed: '+name)
Path('downloads/Balance-CDQ-Android-25.31.apk').write_bytes(final)
with zipfile.ZipFile('downloads/Balance-CDQ-Android-25.31.zip','w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    z.write(out,'Balance-CDQ-Android-25.31.apk')
p=Path('downloads/android-release-update.json');release=json.loads(p.read_text())
check(release['versionCode'] in [2530,2531],'Refusing to overwrite a newer/different release')
release.update(versionName='25.31',versionCode=2531,apkUrl='https://jprodrigue86.github.io/Rapports--talonnages-CDQ/downloads/Balance-CDQ-Android-25.31.apk',sha256=s['outputSha256'],sourceCommit=s['sourceCommit'])
p.write_text(json.dumps(release,ensure_ascii=False,indent=2)+'\n')
print('PASS: original CDQ identity, v2/v3 signatures, unmodified signed contents, every web asset checked; only Home decoration and necessary version/asset-path metadata changed.')
print('APK SHA-256: '+s['outputSha256'])
