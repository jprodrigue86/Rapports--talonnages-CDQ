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
    return true;
  }
  function fitOne(el,maxLines,min){
    el.style.setProperty('white-space','normal');
    el.style.setProperty('overflow-wrap','normal');
    el.style.setProperty('word-break','normal');
    el.style.setProperty('hyphens','none');
    el.style.setProperty('-webkit-hyphens','none');
    el.style.setProperty('text-overflow','clip');
    el.style.setProperty('overflow','visible');
    const requested=num(getComputedStyle(el).fontSize);
    let size=requested;
    if(!size||fits(el,maxLines,size))return;
    const preferred=Math.max(min,size*.76);
    for(;size>preferred+.01&&!fits(el,maxLines,size);){
      size=Math.max(preferred,size-.25);
      el.style.setProperty('font-size',size.toFixed(2)+'px');
    }
    if(fits(el,maxLines,size))return;
    if(stackButton(el)){
      size=requested;
      el.style.setProperty('font-size',size.toFixed(2)+'px');
      if(fits(el,maxLines,size))return;
    }
    for(;size>min+.01&&!fits(el,maxLines,size);){
      size=Math.max(min,size-.25);
      el.style.setProperty('font-size',size.toFixed(2)+'px');
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
    ensureStyle();
    document.querySelectorAll('.cdq-label-stack-v2534').forEach(el=>el.classList.remove('cdq-label-stack-v2534'));
    for(const target of targets)document.querySelectorAll(target.selector).forEach(el=>fitOne(el,target.maxLines,target.min));
    equalize('.quick-buttons > .quick-button');
    equalize('#cdqTopActionsV2204 > .cdq-top-action');
  }
  window.cdqButtonLabelFitV2534=Object.freeze({fit});
})();