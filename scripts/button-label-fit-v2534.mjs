import fs from 'node:fs';
import vm from 'node:vm';
function replaceOne(source,before,after){
  if(source.split(before).length!==2)throw Error('Button label fit anchor mismatch: '+before.slice(0,100));
  return source.replace(before,after);
}
export function applyButtonLabelFit2534(source){
  if(source.includes('id="cdqButtonLabelFitV2534"'))throw Error('Button label fit already applied');
  const runtime=fs.readFileSync(new URL('../button-label-fit-v2534.js',import.meta.url),'utf8');
  new vm.Script(runtime);
  source=replaceOne(source,'<head>','<head>\n<script id="cdqButtonLabelFitV2534">\n'+runtime+'\n</script>');
  source=replaceOne(source,
    "  function apply() {\n    if (!root.matches('.android,.ios,.mobile-device') && window.innerWidth > 899) return;",
    "  function apply() {\n    window.cdqButtonLabelFitV2534?.reset();\n    if (!root.matches('.android,.ios,.mobile-device') && window.innerWidth > 899) return;");
  source=replaceOne(source,
    "    applyPalette();\n    layoutCompanyMenu(unit, textScale);\n    measureNavigation();",
    "    applyPalette();\n    layoutCompanyMenu(unit, textScale);\n    window.cdqButtonLabelFitV2534?.fit();\n    measureNavigation();");
  return source;
}
