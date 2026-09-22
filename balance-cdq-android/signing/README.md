# Balance CDQ — durable release signature

Android 25.15 uses the existing application ID `ca.balancecdq.android` and a new
release signing identity. It replaces the previous installation; it does not
create a second app. The old 25.11 private key was not recovered, so this APK
cannot be installed over 25.11 as an ordinary update. Preserve unsynchronized
local documents and settings before uninstalling. Android backup is disabled.

## Private key and future builds

Only the public certificate and fingerprints are committed here. The PKCS12
private key and its recovery information are saved privately for the owner.
Never upload them as a repository file, CI artifact, log, or public release.
Do not generate another key for future updates.

CI runs the existing Android tests and produces an aligned, non-debuggable
unsigned release. Sign it with the preserved key and this script:

```sh
python3 balance-cdq-android/signing/sign-release.py \
  --apksigner /private/tools/apksigner.jar \
  --keystore /private/balance-cdq-release-2026.p12 \
  --password-file /private/mot-de-passe.txt \
  --input /private/Balance-CDQ-Android-25.15-unsigned.apk \
  --output /private/Balance-CDQ-Android-25.15.apk
```

The script checks the key against the pinned public certificate before signing
and verifies the final APK using Android's apksigner. Keep the APK unchanged
after signing. Future automated signing requires explicitly provisioned private
secrets; none are assumed to exist.

## Google authorization

The Android OAuth client in the existing Google Cloud project must pair
`ca.balancecdq.android` with the SHA-1 in `release-certificate.json`. The public
web OAuth client is a separate setting and does not register this certificate.
Do not remove existing clients or change the web client while adding the new
Android identity. Verify Drive API access, allowed scopes and test-user access
in the same project. Registration and a physical PDF-opening test remain
required; CI cannot validate the owner's Google Cloud configuration.

## Distribution

The legacy update manifest stays paused (versionCode 0). This workflow produces
artifacts only and cannot publish its temporary debug signature. Do not revive
the old automatic update channel for devices still using the lost certificate.
Decide on future release-channel promotion only after installation and Google
authorization have been validated with the owner.
