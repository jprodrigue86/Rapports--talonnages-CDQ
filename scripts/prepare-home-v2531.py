#!/usr/bin/env python3
"""Guarded mobile-only visual patch and required Android release identifiers."""
from pathlib import Path

def edit(path, pairs):
    p=Path(path);s=p.read_text()
    for old,new in pairs:
        assert s.count(old)==1, (path,old[:100],s.count(old))
        s=s.replace(old,new)
    p.write_text(s)

edit('scripts/build-embedded-android-v2528.mjs',[
 ("const local=base+'native/v25.30/';","const local=base+'native/v25.31/';"),
 ("const build='2026.09.24-v25.30-fichiers-immediats';","const build='2026.09.24-v25.31-accueil-sans-trait';"),
 ("const manifest={version:'25.30',build,files:{}};","const manifest={version:'25.31',build,files:{}};"),
 ("selector=applyInstantFiles2530(selector);","selector=applyInstantFiles2530(selector);\nselector=replace(selector,'</head>', '<style id=\"cdqHomeNoUnderlineV2531\">'+read('styles/home-no-underline-v2531.css')+'</style>\\n</head>');")])
edit('balance-cdq-android/app/build.gradle.kts', [('versionCode = 2530','versionCode = 2531'),('versionName = "25.30"','versionName = "25.31"')])
edit('balance-cdq-android/app/src/main/java/ca/balancecdq/android/PackagedWebAssets.kt', [('"native/v25.30/"','"native/v25.31/"')])
# Versioned resource paths in native regression fixtures follow the new package.
for p in Path('balance-cdq-android/app/src/test').rglob('*.kt'):
    s=p.read_text()
    if '/native/v25.30/' in s:p.write_text(s.replace('/native/v25.30/','/native/v25.31/'))
p=Path('.github/workflows/build-balance-cdq-android.yml');s=p.read_text();assert 'versionCode=\'2530\'' in s
p.write_text(s.replace('25.30','25.31').replace("versionCode='2530'","versionCode='2531'"))
print('Home underline CSS and version 25.31 prepared; no app logic, PDFs, artwork or Google source edited.')
