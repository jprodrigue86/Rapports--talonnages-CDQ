"""Reassemble the exact signed release using its public signature block."""
import base64
import hashlib
import json
import re
import subprocess
import sys
import zipfile
from pathlib import Path

source = Path(sys.argv[1])
root = Path(__file__).resolve().parents[1]
metadata = json.loads(Path(__file__).with_name('v2529-apk-envelope.json').read_text())
unsigned = (source / 'Balance-CDQ-Android-25.29-unsigned.apk').read_bytes()
assert len(unsigned) == metadata['unsignedSize']
assert hashlib.sha256(unsigned).hexdigest() == metadata['unsignedSha256']
assert (source / 'source-commit.txt').read_text().strip() == metadata['sourceCommit']
signed = (unsigned[:metadata['insertAt']]
          + base64.b64decode(metadata['signatureBlock'])
          + unsigned[metadata['insertAt']:metadata['endAt']]
          + base64.b64decode(metadata['zipEnd']))
assert len(signed) == metadata['signedSize']
assert hashlib.sha256(signed).hexdigest() == metadata['signedSha256']
apk = root / 'downloads/Balance-CDQ-Android-25.29.apk'
apk.write_bytes(signed)
identity = json.loads((root / 'balance-cdq-android/signing/release-certificate.json').read_text())
result = subprocess.run(
    ['java', '-jar', str(source / 'apksigner.jar'), 'verify', '--verbose', '--print-certs', str(apk)],
    capture_output=True, text=True, check=True)
assert re.findall(r'^Signer #\d+ certificate SHA-256 digest: (\w+)$', result.stdout, re.M) == [identity['sha256'].lower()]
assert 'Verified using v2 scheme (APK Signature Scheme v2): true' in result.stdout
assert 'Verified using v3 scheme (APK Signature Scheme v3): true' in result.stdout
with zipfile.ZipFile(apk) as archive:
    assert archive.testzip() is None
with zipfile.ZipFile(root / 'downloads/Balance-CDQ-Android-25.29.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    archive.write(apk, apk.name)
    archive.writestr('Installation.txt', 'Balance CDQ Android 25.29\n\nOuvrez le fichier APK et confirmez l’installation par-dessus la version actuelle, sans la désinstaller. Chaque technicien se connecte avec son compte Google autorisé dans CDQ.\n')
print('Exact signed V25.29 prepared:', metadata['signedSha256'])
