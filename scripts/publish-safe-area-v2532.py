#!/usr/bin/env python3
"""Assemble a privately signed, tested APK from a PUBLIC signature-only delta.
No private key/password is read or transferred by this publication script.
"""
from pathlib import Path
import argparse,base64,hashlib,json,re,struct,subprocess,tempfile,zipfile,zlib
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--handoff',type=Path,required=True);p.add_argument('--spec',type=Path,required=True);a=p.parse_args();s=json.loads(a.spec.read_text())
def check(v,m):
    if not v:raise SystemExit(m)
def sha(v):return hashlib.sha256(v).hexdigest()
check(s['schema']=='cdq-signed-apk-delta-v1','Unknown signature transport')
u=a.handoff/'Balance-CDQ-Android-25.32-unsigned.apk';base=u.read_bytes()
check(sha(base)==s['baseSha256'],'Unsigned APK mismatch')
check((a.handoff/'source-commit.txt').read_text().strip()==s['sourceCommit'],'Source commit mismatch')
subprocess.run(['git','diff','--exit-code',s['sourceCommit'],'--','balance-cdq-android','scripts/build-embedded-android-v2528.mjs','scripts/safe-area-v2532.mjs','safe-viewport-v2532.js','scripts/home-underline-v2531.mjs','scripts/instant-files-v2530.mjs','assets','icons','vendor'],check=True)
start,removed=s['prefixBytes'],s['removeBytes'];check(removed==0 and isinstance(start,int) and 0<=start<=len(base),'Only a signature insertion is accepted')
encoded=s['insertZlibBase64'];encoded=''.join(encoded) if isinstance(encoded,list) else encoded
check(isinstance(encoded,str) and len(encoded)<300000,'Oversized signature block')
c=base64.b64decode(encoded,validate=True);d=zlib.decompressobj();block=d.decompress(c,1000000)
check(d.eof and not d.unused_data and not d.unconsumed_tail,'Invalid signature block')
check(block[-16:]==b'APK Sig Block 42','Not an APK signature block')
eocd=base.rfind(b'PK\x05\x06');check(eocd>=0 and eocd+22==len(base),'Unsupported ZIP layout');check(struct.unpack_from('<I',base,eocd+16)[0]==start,'Not the ZIP directory boundary')
final=bytearray(base[:start]+block+base[start:]);struct.pack_into('<I',final,eocd+len(block)+16,start+len(block));final=bytes(final)
check(len(final)==s['outputBytes'] and sha(final)==s['outputSha256'],'Signed APK mismatch')
out=Path('/tmp/Balance-CDQ-Android-25.32.apk');out.write_bytes(final)
v=subprocess.run(['java','-jar',str(a.handoff/'apksigner.jar'),'verify','--verbose','--print-certs',str(out)],capture_output=True,text=True,check=True).stdout
identity=json.loads(Path('balance-cdq-android/signing/release-certificate.json').read_text());certs=re.findall(r'^Signer #\d+ certificate SHA-256 digest: (\w+)$',v,re.M)
check([x.upper() for x in certs]==[identity['sha256'].upper()],'Wrong existing CDQ identity')
check(all('Verified using '+k+' scheme (APK Signature Scheme '+k+'): true' in v for k in ['v2','v3']),'Signature v2/v3 not verified')
with zipfile.ZipFile(u) as unsigned,zipfile.ZipFile(out) as signed:
    check(unsigned.namelist()==signed.namelist(),'ZIP entries changed while signing')
    check(all(unsigned.read(n)==signed.read(n) for n in unsigned.namelist()),'Signed contents changed')
with zipfile.ZipFile('downloads/Balance-CDQ-Android-25.31.apk') as old,zipfile.ZipFile(out) as new,tempfile.TemporaryDirectory() as tmp:
    prefix='assets/cdq-web/';om=json.loads(old.read(prefix+'asset-manifest.json'));nm=json.loads(new.read(prefix+'asset-manifest.json'))
    check(om['version']=='25.31' and nm['version']=='25.32','Wrong packaged versions')
    check(set(nm['files'])==set(om['files'])|{'safe-viewport-v2532.js'},'Unexpected asset addition/removal')
    for name,meta in nm['files'].items():
        after=new.read(prefix+name);check(sha(after)==meta['sha256'],'Packaged asset checksum '+name)
        if name=='safe-viewport-v2532.js':check(after==Path(name).read_bytes(),'Safe viewport differs from reviewed source');continue
        before=old.read(prefix+name)
        if not meta['text']:check(before==after,'Binary artwork, font or PDF changed: '+name);continue
        expected=before.decode().replace('native/v25.31/','native/v25.32/').replace('2026.09.24-v25.31-accueil-sans-trait','2026.09.25-v25.32-ecran-adaptatif')
        if name in ['index.html','Selector.html']:
            left=Path(tmp)/('before-'+name);right=Path(tmp)/('after-'+name);left.write_text(expected);right.write_bytes(after)
            fn='applySafeShell2532' if name=='index.html' else 'applySafeSelector2532'
            js="import fs from 'node:fs';import assert from 'node:assert/strict';import {"+fn+"} from './scripts/safe-area-v2532.mjs';assert.equal("+fn+"(fs.readFileSync(process.argv[1],'utf8')),fs.readFileSync(process.argv[2],'utf8'));"
            subprocess.run(['node','--input-type=module','-e',js,str(left),str(right)],check=True)
        else:check(expected==after.decode(),'Unexpected module change: '+name)
Path('downloads/Balance-CDQ-Android-25.32.apk').write_bytes(final)
with zipfile.ZipFile('downloads/Balance-CDQ-Android-25.32.zip','w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:z.write(out,out.name)
p=Path('downloads/android-release-update.json');r=json.loads(p.read_text());check(r['versionCode'] in [2531,2532],'Refusing newer/unrelated release')
r.update(versionName='25.32',versionCode=2532,apkUrl='https://jprodrigue86.github.io/Rapports--talonnages-CDQ/downloads/Balance-CDQ-Android-25.32.apk',sha256=s['outputSha256'],sourceCommit=s['sourceCommit'])
p.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
print('PASS: existing release identity, v2/v3 signatures, exact tested contents; reviewed safe viewport and version changes only; artwork/PDF/fonts unchanged.')
print('APK SHA-256: '+s['outputSha256'])
