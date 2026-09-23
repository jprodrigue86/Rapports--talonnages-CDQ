#!/usr/bin/env python3
"""Verify only public release bytes and the pinned signing certificate."""
import argparse,hashlib,json,re,subprocess
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--tools',required=True,type=Path);args=p.parse_args()
root=Path(__file__).resolve().parents[2]
identity=json.loads(Path(__file__).with_name('release-certificate.json').read_text())
manifest=root/'downloads/android-release-update.json'
if not manifest.exists():
    print('No durable signed release published yet.');raise SystemExit(0)
m=json.loads(manifest.read_text());name=m['apkUrl'].rsplit('/',1)[-1]
if not re.fullmatch(r'Balance-CDQ-Android-[0-9.]+\.apk',name):raise SystemExit('Invalid release filename')
apk=root/'downloads'/name
if hashlib.sha256(apk.read_bytes()).hexdigest()!=m['sha256']:raise SystemExit('Published APK hash mismatch')
result=subprocess.run([str(args.tools/'apksigner'),'verify','--verbose','--print-certs',str(apk)],capture_output=True,text=True,check=True)
signers=re.findall(r'^Signer #\d+ certificate SHA-256 digest: (\w+)$',result.stdout,re.M)
if [s.upper() for s in signers]!=[identity['sha256']]:raise SystemExit('Published APK signed with the wrong key')
if m.get('signingCertificateSha256','').upper()!=identity['sha256']:raise SystemExit('Manifest certificate mismatch')
if 'Verified using v2 scheme (APK Signature Scheme v2): true' not in result.stdout or 'Verified using v3 scheme (APK Signature Scheme v3): true' not in result.stdout:raise SystemExit('Release must have valid v2/v3 signatures')
badging=subprocess.run([str(args.tools/'aapt'),'dump','badging',str(apk)],capture_output=True,text=True,check=True).stdout
expected=f"package: name='{identity['applicationId']}' versionCode='{m['versionCode']}' versionName='{m['versionName']}'"
if expected not in badging or 'application-debuggable' in badging:raise SystemExit('Release package/version/debuggable mismatch')
subprocess.run([str(args.tools/'zipalign'),'-c','-P','16','4',str(apk)],check=True)
print('Published release verified: package, version, SHA-256, v2/v3, pinned certificate, alignment, non-debuggable.')
