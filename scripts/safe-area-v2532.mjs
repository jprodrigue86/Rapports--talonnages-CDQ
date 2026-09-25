import assert from 'node:assert/strict';
function insert(html,role){
 const tag='<script src="./safe-viewport-v2532.js" data-cdq-viewport="'+role+'"></script>';
 if(html.includes(tag))return html;
 assert.equal(html.split('<head>').length,2,'Expected one HTML head');
 return html.replace('<head>','<head>\n'+tag);
}
export function applySafeShell2532(html){return insert(html,'shell');}
export function applySafeSelector2532(html){
 if(html.includes('data-cdq-viewport="selector"'))return html;
 const old='const reference = Math.min(480, Math.max(280, window.innerWidth)) / 384;';
 assert.equal(html.split(old).length,2,'Mobile sizing source changed');
 html=html.replace(old,'const reference = Math.min(480, Math.max(240, document.documentElement.clientWidth || window.innerWidth)) / 384;');
 const padding="set(document.body, {'padding-top':'var(--cdq-safe-top)'});";
 assert.equal(html.split(padding).length,2,'Mobile body padding source changed');
 html=html.replace(padding,"set(document.body, {'padding-top':'var(--cdq-safe-top)', ...(root.dataset.cdqSafeFrame === '1' ? {'padding-left':'0','padding-right':'0'} : {})});");
 // Safe areas are already outside this iframe on native Android and the iPhone shell.
 // Keep the browser env fallback when Selector is opened outside a safe parent.
 html=html.replace(/env\(safe-area-inset-(top|right|bottom|left)(?:,\s*0px)?\)/g,
   (env,side)=>'var(--cdq-content-safe-'+side+','+env+')');
 return insert(html,'selector');
}
