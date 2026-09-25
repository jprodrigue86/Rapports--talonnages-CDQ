import fs from 'node:fs';
import vm from 'node:vm';
function replaceOne(source, before, after) {
  if (source.split(before).length !== 2) throw Error('Personal sizing anchor mismatch: ' + before.slice(0,100));
  return source.replace(before, after);
}
export function applyPersonalSizing2533(source) {
  if (source.includes('id="cdqPersonalSizingV2533"')) throw Error('Personal sizing already applied');
  const runtime = fs.readFileSync(new URL('../personal-sizing-v2533.js',import.meta.url),'utf8');
  new vm.Script(runtime);
  source = replaceOne(source, '<head>', '<head>\n<script id="cdqPersonalSizingV2533">\n'+runtime+'\n</script>');
  source = replaceOne(source, 'function cdqGeneralZoomV89(v){', 'function cdqGeneralZoomBaseV2533(v){');
  source = replaceOne(source, 'function cdqTextZoomV89(v){return cdqScaleAround50V89(v,0.48,1.50);}',
    "function cdqGeneralZoomV89(v){return window.cdqPersonalSizing.factor('General',v,cdqGeneralZoomBaseV2533);}\nfunction cdqTextZoomV89(v){return window.cdqPersonalSizing.factor('Text',v,x=>cdqScaleAround50V89(x,0.48,1.50));}");
  source = replaceOne(source, 'function cdqIconZoomV89(v){return cdqScaleAround50V89(v,0.45,1.55);}',
    "function cdqIconZoomV89(v){return window.cdqPersonalSizing.factor('Icon',v,x=>cdqScaleAround50V89(x,0.45,1.55));}");
  source = replaceOne(source,
    "window.cdqGeneralDensityFactorV2221=function(value){value=cdqClampScaleV89(value);return value<=50?0.78+(1-0.78)*(value/50):1+(1.20-1)*((value-50)/50)};",
    "window.cdqGeneralDensityFactorV2221=function(value){return window.cdqPersonalSizing.factor('General',value,x=>{x=cdqClampScaleV89(x);return x<=50?0.78+(1-0.78)*(x/50):1+(1.20-1)*((x-50)/50)})};");
  for (const [name,values] of Object.entries({bottom:'16,29,43',top:'16,27,39',quick:'13,24,36',file:'18,31,44',action:'9,15,22'}))
    source = replaceOne(source,`const ${name}=interpV2208(value,${values});`,`const ${name}=window.cdqPersonalSizing.factor('Icon',value,x=>interpV2208(x,${values}));`);
  source = replaceOne(source, 'const density = around50(g, .78, 1.25), unit = reference * density;',
    "const density = window.cdqPersonalSizing?.factor('General',g,x=>around50(x,.78,1.25)) ?? around50(g,.78,1.25), unit = reference * density;");
  source = replaceOne(source, 'const textScale = around50(t, .78, 1.35), iconScale = around50(i, .65, 1.5);',
    "const textScale = window.cdqPersonalSizing?.factor('Text',t,x=>around50(x,.78,1.35)) ?? around50(t,.78,1.35), iconScale = window.cdqPersonalSizing?.factor('Icon',i,x=>around50(x,.65,1.5)) ?? around50(i,.65,1.5);");
  source = replaceOne(source, '    tabs.firstChild.click();', '    window.cdqPersonalSizing.mount(panels.sizes);\n    tabs.firstChild.click();');
  source = replaceOne(source, 'function cdqResetDisplayScalesV2208(){',
    'function cdqResetDisplayScalesV2208(){\n  if(window.cdqPersonalSizing?.current()){window.cdqPersonalSizing.reset();return;}');
  source = replaceOne(source, '    window.cdqMobileDimensions = {reference,density,top,bottom,label,navHeight:nav?.getBoundingClientRect().height || 0,buttonHeight,text,action};',
    '    window.cdqMobileDimensions = {reference,density,top,bottom,label,navHeight:nav?.getBoundingClientRect().height || 0,buttonHeight,text,action};\n    window.cdqPersonalSizing?.refreshControls();');
  return source;
}
