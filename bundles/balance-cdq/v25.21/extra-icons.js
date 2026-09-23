(function(){
 const paths={clients:'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 22v-3a7 7 0 0 1 14 0v3M18 4a4 4 0 0 1 0 8M19 15a6 6 0 0 1 3 5v2',settings:'M9 2h6l1 4 3 2 4-1 2 6-3 3-1 4 1 3-6 2-3-3-4-1-3 1-2-6 3-3 1-4-1-3 4-3ZM12 9a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',favorites:'m12 2 3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1Z',drive:'M2 5h8l3 3h9v14H2Z'};
 window.cdqExtraNavIconV2521=function(name,theme){
  if(!paths[name])return '';const current=theme==='current'||!theme,id='cdq-icon-'+name+'-'+theme;
  const color=name==='drive'?'#f7c34d':name==='clients'?'#b8e4ff':'#d2c7f4';
  const defs='<defs><linearGradient id="'+id+'" x2="0" y2="1"><stop stop-color="#f5fbff"/><stop offset=".45" stop-color="'+color+'"/><stop offset="1" stop-color="#4e5967"/></linearGradient></defs>';
  const round=theme==='dark-pro'?'<circle cx="14" cy="14" r="13" fill="#11171d" stroke="#8ba7bb" stroke-width="1.2"/><circle cx="14" cy="14" r="11.7" fill="#0b1117" stroke="#415260" stroke-width=".7"/>':'';
  const base=theme==='isometric'?'<ellipse cx="14" cy="25" rx="13" ry="4" fill="#1a2028" stroke="'+color+'"/>':'';
  const shape='<path d="'+paths[name]+'" fill="'+(current||theme==='minimal'?'none':'url(#'+id+')')+'" stroke="'+(current?'currentColor':theme==='minimal'?'#fff':theme==='metal-music'?'#dae2e8':color)+'" stroke-width="'+(theme==='minimal'?'2.4':'1.5')+'" fill-rule="evenodd" stroke-linejoin="round" stroke-linecap="round"/>';
  const metal=theme==='metal-music'?'<path d="m2 7-2 5 3 1M26 7l2 5-3 1" fill="#767c83" stroke="#bdc6cb"/><circle cx="3" cy="25" r="1" fill="#eef4f7"/><circle cx="25" cy="25" r="1" fill="#eef4f7"/>':'';
  return '<svg class="cdq-extra-nav-icon" data-icon-theme="'+theme+'" viewBox="-2 -2 32 34" aria-hidden="true">'+defs+round+base+metal+'<g transform="'+(theme==='dark-pro'?'translate(5 4) scale(.66)':theme==='isometric'?'translate(3 1) scale(.85)':'translate(1 1)')+'">'+shape+'</g></svg>';
 };
})();
