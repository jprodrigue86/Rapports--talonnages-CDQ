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
    "each('.bottom-nav > .bottom-nav-item small', {'font-size':px(label), 'flex':'0 0 auto',\n      'line-height':'1.15','padding':'0','margin':'0','max-width':'100%','white-space':'normal','overflow-wrap':'anywhere','text-overflow':'clip','overflow':'visible'});",
    "each('.bottom-nav > .bottom-nav-item small', {'font-size':px(label), 'flex':'0 0 auto',\n      'line-height':'1.15','padding':'0','margin':'0','max-width':'100%','white-space':'normal','overflow-wrap':'normal','word-break':'normal','hyphens':'none','text-overflow':'clip','overflow':'visible'});");
  source=replaceOne(source,
    "each('#cdqTopActionsV2204 > .cdq-top-action > span:last-child, .quick-name', {'font-size':px(topLabel),\n      'line-height':'1.12','white-space':'normal','overflow-wrap':'anywhere','word-break':'normal',\n      'min-width':'0','width':'auto','flex':'1 1 0','max-width':'100%','text-overflow':'clip','text-align':'center'});",
    "each('#cdqTopActionsV2204 > .cdq-top-action > span:last-child, .quick-name', {'font-size':px(topLabel),\n      'line-height':'1.12','white-space':'normal','overflow-wrap':'normal','word-break':'normal','hyphens':'none',\n      'min-width':'0','width':'auto','flex':'1 1 0','max-width':'100%','text-overflow':'clip','text-align':'center'});");
  source=replaceOne(source,
    "  function apply() {\n    if (!root.matches('.android,.ios,.mobile-device') && window.innerWidth > 899) return;",
    "  function apply() {\n    window.cdqButtonLabelFitV2534?.reset();\n    if (!root.matches('.android,.ios,.mobile-device') && window.innerWidth > 899) return;");
  source=replaceOne(source,
    "    applyPalette();\n    layoutCompanyMenu(unit, textScale);\n    measureNavigation();",
    "    applyPalette();\n    layoutCompanyMenu(unit, textScale);\n    window.cdqButtonLabelFitV2534?.fit();\n    measureNavigation();");
  return source;
}
