import fs from 'node:fs';
import vm from 'node:vm';

function replaceOne(source, before, after) {
  if (source.split(before).length !== 2) throw Error('Full-name anchor mismatch: ' + before.slice(0,120));
  return source.replace(before, after);
}

export function applyFullNames2536(source) {
  if (source.includes('id="cdqFullNamesV2536"')) throw Error('Full-name layout already applied');
  const runtime = fs.readFileSync(new URL('../full-names-v2536.js', import.meta.url), 'utf8');
  new vm.Script(runtime);

  source = replaceOne(
    source,
    '<head>',
    '<head>\n<script id="cdqFullNamesV2536">\n' + runtime + '\n</script>'
  );

  const anchor =
    '    window.cdqFitButtonWordsV2534({unit,topLabel,label});\n' +
    '    applyPalette();\n' +
    '    layoutCompanyMenu(unit, textScale);';

  return replaceOne(
    source,
    anchor,
    anchor + '\n    window.cdqFitFullNamesV2536?.();'
  );
}
