#!/usr/bin/env python3
"""Sign an aligned CI release with the backed-up CDQ identity, never a debug key."""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--apksigner", required=True, type=Path)
parser.add_argument("--keystore", required=True, type=Path)
parser.add_argument("--password-file", required=True, type=Path)
parser.add_argument("--input", required=True, type=Path)
parser.add_argument("--output", required=True, type=Path)
args = parser.parse_args()
identity = json.loads(Path(__file__).with_name("release-certificate.json").read_text())
for source in (args.apksigner, args.keystore, args.password_file, args.input):
    if not source.is_file():
        raise SystemExit(f"Missing input: {source}")
if args.output.exists():
    raise SystemExit("Refusing to overwrite an existing signed APK")

certificate = subprocess.run([
    "keytool", "-exportcert", "-keystore", str(args.keystore),
    "-alias", identity["alias"], "-storepass:file", str(args.password_file),
], check=True, capture_output=True).stdout
if hashlib.sha256(certificate).hexdigest().upper() != identity["sha256"]:
    raise SystemExit("Wrong signing key: certificate does not match the pinned CDQ identity")

subprocess.run([
    "java", "-jar", str(args.apksigner), "sign",
    "--ks", str(args.keystore), "--ks-key-alias", identity["alias"],
    "--ks-pass", "file:" + str(args.password_file),
    # PKCS12 uses the store password for its key. Reusing the same password
    # file for --key-pass would consume a second (missing) line.
    "--debuggable-apk-permitted", "false", "--alignment-preserved", "true",
    "--v1-signing-enabled", "false", "--v2-signing-enabled", "true",
    "--v3-signing-enabled", "true", "--v4-signing-enabled", "false",
    "--out", str(args.output), str(args.input),
], check=True)
result = subprocess.run([
    "java", "-jar", str(args.apksigner), "verify", "--verbose", "--print-certs",
    str(args.output),
], capture_output=True, text=True)
signers = re.findall(r"^Signer #\d+ certificate SHA-256 digest: (\w+)$", result.stdout, re.M)
if result.returncode or [s.upper() for s in signers] != [identity["sha256"]]:
    args.output.unlink(missing_ok=True)
    raise SystemExit("APK signature verification failed; output removed")
print(result.stdout)
print("APK SHA-256:", hashlib.sha256(args.output.read_bytes()).hexdigest())
