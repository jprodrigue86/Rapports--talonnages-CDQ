import assert from 'node:assert/strict';

// Target the button's decoration, never the icon sprite on its inner span.
// The previous general rule lost to the more specific active-home !important rule.
export const HOME_UNDERLINE_CSS = 'html:is(.android,.ios,.mobile-device) .bottom-nav > .bottom-nav-item.cdq-nav-home.active::after{content:none!important;display:none!important}';
export const HOME_UNDERLINE_STYLE = '\n<style id="cdqHomeUnderlineV2531">\n' + HOME_UNDERLINE_CSS + '\n</style>\n';
export function applyHomeUnderline2531(source) {
  assert.equal(typeof source, 'string');
  if (source.includes(HOME_UNDERLINE_STYLE)) return source;
  assert(!source.includes('id="cdqHomeUnderlineV2531"'), 'Unexpected existing home decoration patch');
  assert(source.includes('.cdq-nav-home.active::after'), 'Home decoration not found');
  assert(source.includes('.cdq-icon-host-v2514::after'), 'Icon sprite contract changed');
  assert.equal(source.split('</body>').length, 2, 'Expected one body end');
  return source.replace('</body>', HOME_UNDERLINE_STYLE + '</body>');
}
