/* Keep complete words in mobile tiles while preserving the user's icon/text settings. */
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
    const cs=getComputedStyle(el),size=num(cs.fontSize),lh=num(cs.lineHeight)||size*1.12;
    return Math.max(1,Math.ceil((el.scrollHeight-.35)/Math.max(1,lh)));
  }
  function fits(el,maxLines,size){
    const width=el.clientWidth;
    if(width<=0)return true;
    return longestWord(el,size)<=width+.6 && lineCount(el)<=maxLines && el.scrollWidth<=width+1;
  }
  function compactButton(el){
    const button=el.closest('.quick-button,.cdq-top-action');
    if(!button)return;
    button.style.setProperty('column-gap','1px','important');
    button.style.setProperty('gap','1px','important');
    button.style.setProperty('padding-left','1px','important');
    button.style.setProperty('padding-right','1px','important');
  }
  function fitOne(el,maxLines,min){
    el.style.setProperty('white-space','normal','important');
    el.style.setProperty('overflow-wrap','normal','important');
    el.style.setProperty('word-break','normal','important');
    el.style.setProperty('hyphens','none','important');
    el.style.setProperty('-webkit-hyphens','none','important');
    el.style.setProperty('text-overflow','clip','important');
    el.style.setProperty('overflow','visible','important');
    let size=num(getComputedStyle(el).fontSize);
    if(!size||fits(el,maxLines,size))return;
    const preferred=Math.max(min,size*.68);
    for(;size>preferred+.01&&!fits(el,maxLines,size);){
      size=Math.max(preferred,size-.25);
      el.style.setProperty('font-size',size.toFixed(2)+'px','important');
    }
    if(fits(el,maxLines,size))return;
    compactButton(el);
    for(;size>min+.01&&!fits(el,maxLines,size);){
      size=Math.max(min,size-.25);
      el.style.setProperty('font-size',size.toFixed(2)+'px','important');
    }
  }
  function equalize(selector){
    const buttons=[...document.querySelectorAll(selector)].filter(el=>el.offsetParent!==null);
    if(buttons.length<2)return;
    const height=Math.max(...buttons.map(el=>el.scrollHeight));
    buttons.forEach(el=>el.style.setProperty('min-height',Math.ceil(height)+'px','important'));
  }
  function fit(){
    if(!mobile())return;
    for(const target of targets)document.querySelectorAll(target.selector).forEach(el=>fitOne(el,target.maxLines,target.min));
    equalize('.quick-buttons > .quick-button');
    equalize('#cdqTopActionsV2204 > .cdq-top-action');
  }
  window.cdqButtonLabelFitV2534=Object.freeze({fit});
})();