#!/usr/bin/env python3
"""Align only published metadata; never contact Google or rebuild an application."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
TARGET = "2026.09.23-v25.28-apk-embarquee"
SHELL = "2026.09.23-v25.27-demarrage-dossiers"
CANONICAL = ROOT / "bundles/balance-cdq/v25.28/manifest.json"
ALIAS = ROOT / "bundles/balance-cdq/latest/manifest.json"
VERSION = ROOT / "version.json"
PREFIX = "/Rapports--talonnages-CDQ/"


def require(ok: bool, message: str) -> None:
    if not ok:
        raise SystemExit(message)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Validate without writing")
    args = parser.parse_args()
    canonical_bytes = CANONICAL.read_bytes()
    canonical = json.loads(canonical_bytes)
    git_sha = hashlib.sha1(b"blob " + str(len(canonical_bytes)).encode() + b"\0" + canonical_bytes).hexdigest()
    require(git_sha == "dceaa9dc46d913a1a8a707d0a458870aa6d2a127", "Canonical package changed; review it before alignment.")
    require(canonical["build"] == TARGET and canonical["version"] == "V25.28", "Unexpected target")
    previous_alias = json.loads(ALIAS.read_bytes())
    require(previous_alias["build"] in (SHELL, TARGET), "Refusing to replace an unrelated/newer automatic package")
    for entry in canonical.get("extraFiles", []):
        url = urlparse(entry["url"])
        require(url.scheme == "https" and url.netloc == "jprodrigue86.github.io" and url.path.startswith(PREFIX), "Unexpected package origin")
        path = (ROOT / url.path[len(PREFIX):]).resolve()
        require(path.is_relative_to(ROOT), "Package path escapes repository")
        actual = hashlib.sha256(path.read_bytes()).hexdigest()
        require(actual == entry["sha256"], "Package checksum mismatch: " + entry["name"])
    old_bytes = VERSION.read_bytes()
    old = json.loads(old_bytes)
    require(old["version"] == SHELL, "Web shell changed; reassess its component versions")
    index = (ROOT / "index.html").read_text(encoding="utf-8")
    sw = (ROOT / "sw.js").read_text(encoding="utf-8")
    require(re.search(r"const CDQ_PWA_BUILD\s*=\s*['\"]" + re.escape(SHELL) + r"['\"]", index) is not None, "Web launcher build mismatch")
    require(re.search(r"const FORCE_BUILD\s*=\s*['\"]" + re.escape(SHELL) + r"['\"]", sw) is not None, "Web worker build mismatch")
    # Do not change a runtime contract without reviewing its consumer first.
    for path in sorted(ROOT.iterdir()):
        if path.is_file() and path.suffix in (".html", ".js", ".mjs"):
            source = path.read_text(encoding="utf-8")
            for field in ("backend_version", "selector_version"):
                require(field not in source, "Review runtime consumer before metadata change: " + path.name + " / " + field)
    updated = dict(old)
    updated.update({
        "selector_version": TARGET,
        "backend_version": None,
        "version_scope": "web-shell",
        "selector_version_scope": "google-apps-script-interface",
        "backend_version_status": "not_detected_in_version_diagnostic",
        "server_package_version": canonical["version"],
        "server_package_build": TARGET,
        "references_updated_at": "2026-09-24",
    })
    # Preserve the shell release date, features, reader version and every other key.
    output = (json.dumps(updated, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    if args.check:
        require(ALIAS.read_bytes() == canonical_bytes, "Automatic package not aligned")
        require(json.loads(old_bytes) == updated, "Web component references not aligned")
    else:
        VERSION.write_bytes(output)
        ALIAS.write_bytes(canonical_bytes)
    print("Automatic package: V25.28 (exact canonical bytes; extra files SHA-256 verified)")
    print("Web launcher: V25.27 retained; Google interface reference: V25.28")
    print("Backend build: unknown, not inferred from the interface/package")
    print("No Android/iPhone sources, APK, Google project, service worker or application interface modified.")


if __name__ == "__main__":
    main()
