#!/usr/bin/env python3
import hashlib,json,zipfile,re
from pathlib import Path
root=Path(__file__).resolve().parents[1]
new=root/'downloads/Balance-CDQ-Android-25.35.apk';old=root/'downloads/Balance-CDQ-Android-25.34.apk'
assert new.is_file() and old.is_file()
extract=lambda text,ident:re.search(r'<script id="'+ident+r'">([\s\S]*?)</script>',text)[1]
with zipfile.ZipFile(old) as a,zipfile.ZipFile(new) as b:
 before=json.loads(a.read('assets/cdq-web/asset-manifest.json'));after=json.loads(b.read('assets/cdq-web/asset-manifest.json'));assert after['version']=='25.35'
 for name in before['files']:
  if name.endswith(('.png','.jpg','.jpeg','.webp','.pdf','.ttf','.woff','.woff2')) or name=='floor-template-v2519.mjs':assert a.read('assets/cdq-web/'+name)==b.read('assets/cdq-web/'+name),name
 sb=b.read('assets/cdq-web/Selector.html').decode();assert extract(sb,'cdqWholeWordsV2534').strip()==(root/'whole-words-v2534.js').read_text().strip()
 assert 'defaultReferenceV2535' in extract(sb,'cdqPersonalSizingV2533')
p=root/'downloads/android-release-update.json';m=json.loads(p.read_text());assert m['versionCode'] in (2534,2535)
m.update(versionName='25.35',versionCode=2535,apkUrl='https://jprodrigue86.github.io/Rapports--talonnages-CDQ/downloads/Balance-CDQ-Android-25.35.apk',sha256=hashlib.sha256(new.read_bytes()).hexdigest())
p.write_text(json.dumps(m,indent=2)+'\n')
with zipfile.ZipFile(root/'downloads/Balance-CDQ-Android-25.35.zip','w',zipfile.ZIP_DEFLATED) as z:z.write(new,new.name)
print('Prepared 25.35 midpoint release; protected images, PDFs, fonts and whole-word renderer unchanged.')
