import fs from 'node:fs';
import vm from 'node:vm';
export function applyWholeWords2534(source) {
  const runtime = fs.readFileSync(new URL('../whole-words-v2534.js',import.meta.url),'utf8');
  new vm.Script(runtime);
  if(source.includes('id="cdqWholeWordsV2534"'))throw Error('Whole-word layout already applied');
  const anchor = '    applyPalette();\n    layoutCompanyMenu(unit, textScale);';
  if(source.split(anchor).length!==2 || source.split('<head>').length!==2)throw Error('Whole-word layout anchor mismatch');
  source=source.replace('<head>','<head>\n<script id="cdqWholeWordsV2534">\n'+runtime+'\n</script>');
  return source.replace(anchor,'    window.cdqFitButtonWordsV2534({unit,topLabel,label});\n'+anchor);
}
