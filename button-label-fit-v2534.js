/* Keep complete words in mobile tiles while preserving the user's icon/text settings and established geometry when no fit is needed. */
(function(){
  'use strict';
  const targets=[
    {selector:'.quick-name',maxLines:2,min:5.75},
    {selector:'#cdqTopActionsV2204 > .cdq-top-action > span:last-child',maxLines:2,min:6},
    {selector:'.bottom-nav > .bottom-nav-item small',maxLines:1,min:5.75}
  ];
  const canvas=document.createElement('canvas');
  const ctx=canvas.getContext('2d');
  const num=v=>Number.parseFloat(v)||0;
  function mobile(){return document.documentElement.matches('.android,.ios,.mobile-device')||innerWidth<900;}
  function fontString(cs,size){
    return [cs.fontStyle,cs.fontVariant,cs.fontWeight,size+'px',cs.fontFamily].filter(Boolean).join(' ');
  }
  function longestWord(el,size){
    if(!ctx)return 0;
    const cs=getComputedStyle(el),spacing=num(cs.letterSpacing);
    ctx.font=fontString(cs,size);
    return String(el.textContent||'').trim().split(/\s+/).filter(Boolean).reduce((max,word)=>{
      const w=ctx.measureText(word).width+Math.max(0,word.length-1)*spacing;
      return Math.max(max,w);
    },0);
  }
  function lineCount(el){
    const tops=[];
    const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
    for(let node=walker.nextNode();node;node=walker.nextNode()){
      const text=node.nodeValue||'';
      for(const match of text.matchAll(/\S+/g)){
        const range=document.createRange();
        range.setStart(node,match.index);
        range.setEnd(node,match.index+match[0].length);
        for(const rect of range.getClientRects()){
          if(rect.width<=.1||rect.height<=.1)continue;
          if(!tops.some(top=>Math.abs(top-rect.top)<1))tops.push(rect.top);
        }
      }
    }
    return Math.max(1,tops.length);
  }
  function fits(el,maxLines,size){
    const width=el.clientWidth;
    if(width<=0)return el.offsetParent===null;
    return longestWord(el,size)<=width+.1 && lineCount(el)<=maxLines && el.scrollWidth<=width+.25;
  }
  function ensureStyle(){
    if(document.getElementById('cdqButtonLabelFitStyleV2534'))return;
    const style=document.createElement('style');
    style.id='cdqButtonLabelFitStyleV2534';
    style.textContent=`
      .quick-button.cdq-label-stack-v2534,
      .cdq-top-action.cdq-label-stack-v2534{
        flex-direction:column!important;
        justify-content:center!important;
        column-gap:0!important;row-gap:0!important;gap:0!important;
        padding-left:1px!important;padding-right:1px!important;
        height:auto!important;
      }
      .quick-button.cdq-label-stack-v2534>.quick-name,
      .cdq-top-action.cdq-label-stack-v2534>span:last-child{
        width:100%!important;max-width:100%!important;min-width:0!important;
        flex:0 0 auto!important;
      }
    `;
    document.head.appendChild(style);
  }
  function stackButton(el){
    const button=el.closest('.quick-button,.cdq-top-action');
    if(!button)return false;
    button.classList.add('cdq-label-stack-v2534');
    for(const [p,v] of Object.entries({
      'flex-direction':'column','justify-content':'center','column-gap':'0','row-gap':'0','gap':'0',
      'padding-left':'1px','padding-right':'1px','height':'auto'
    }))button.style.setProperty(p,v,'important');
    el.style.setProperty('display','block','important');
    el.style.setProperty('width','100%','important');
    el.style.setProperty('max-width','100%','important');
    el.style.setProperty('min-width','0','important');
    el.style.setProperty('flex','0 0 auto','important');
    return true;
  }
  function fitOne(el,maxLines,min){
    const requested=num(getComputedStyle(el).fontSize);
    let size=requested;
    if(!size)return false;
    // Whole words are a hard rule, even when the legacy layout happened to fit
    // only because overflow-wrap:anywhere was allowed.
    el.style.setProperty('white-space','normal','important');
    el.style.setProperty('overflow-wrap','normal','important');
    el.style.setProperty('word-break','normal','important');
    el.style.setProperty('hyphens','none','important');
    el.style.setProperty('-webkit-hyphens','none','important');
    el.style.setProperty('text-overflow','clip','important');
    el.style.setProperty('overflow','visible','important');
    if(fits(el,maxLines,size))return false;
    el.style.setProperty('display','block','important');
    el.style.setProperty('min-width','0','important');
    el.style.setProperty('max-width','100%','important');
    if(el.closest('.quick-button,.cdq-top-action') && el.clientWidth>0 && longestWord(el,size)>el.clientWidth-.5){
      stackButton(el);
      size=requested;
      el.style.setProperty('font-size',size.toFixed(2)+'px','important');
    }
    if(fits(el,maxLines,size))return true;
    const preferred=Math.max(min,size*.76);
    for(;size>preferred+.01&&!fits(el,maxLines,size);){
      size=Math.max(preferred,size-.25);
      el.style.setProperty('font-size',size.toFixed(2)+'px','important');
    }
    if(fits(el,maxLines,size))return true;
    if(stackButton(el)){
      size=requested;
      el.style.setProperty('font-size',size.toFixed(2)+'px','important');
      if(fits(el,maxLines,size))return true;
    }
    for(;size>min+.01&&!fits(el,maxLines,size);){
      size=Math.max(min,size-.25);
      el.style.setProperty('font-size',size.toFixed(2)+'px','important');
    }
    // WebKit rounds text and client widths differently. Keep a small real
    // margin after the normal fit so no final glyph can be painted outside.
    const emergency=min;
    let guard=0;
    while(el.offsetParent!==null && guard++<48 && size>emergency+.01){
      const width=el.clientWidth;
      const tooWide=width>0 && (el.scrollWidth>width || longestWord(el,size)>width-.5);
      if(!tooWide && lineCount(el)<=maxLines)break;
      size=Math.max(emergency,size-.2);
      el.style.setProperty('font-size',size.toFixed(2)+'px','important');
    }
    return true;
  }
  function equalize(selector){
    const buttons=[...document.querySelectorAll(selector)].filter(el=>el.offsetParent!==null);
    if(buttons.length<2||!buttons.some(el=>el.classList.contains('cdq-label-stack-v2534')))return;
    const height=Math.max(...buttons.map(el=>Math.max(el.scrollHeight,el.getBoundingClientRect().height)));
    buttons.forEach(el=>{
      const existing=num(getComputedStyle(el).minHeight);
      if(height>existing+.25)el.style.setProperty('min-height',Math.ceil(height)+'px','important');
    });
  }
  function reset(){
    document.querySelectorAll('.cdq-label-stack-v2534').forEach(el=>el.classList.remove('cdq-label-stack-v2534'));
    for(const target of targets)document.querySelectorAll(target.selector).forEach(el=>{
      for(const p of ['display','width','min-width','max-width','flex','font-size','white-space','overflow-wrap','word-break','hyphens','-webkit-hyphens','text-overflow','overflow'])
        el.style.removeProperty(p);
    });
    document.querySelectorAll('.quick-buttons > .quick-button,#cdqTopActionsV2204 > .cdq-top-action').forEach(el=>{
      for(const p of ['min-height','flex-direction','justify-content','column-gap','row-gap','gap','padding-left','padding-right','height'])
        el.style.removeProperty(p);
    });
  }
  function fit(){
    if(!mobile())return;
    ensureStyle();
    for(const target of targets)document.querySelectorAll(target.selector).forEach(el=>fitOne(el,target.maxLines,target.min));
    equalize('.quick-buttons > .quick-button');
    equalize('#cdqTopActionsV2204 > .cdq-top-action');
  }
  window.cdqButtonLabelFitV2534=Object.freeze({fit,reset});
})();