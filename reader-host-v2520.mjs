let active=null;
export function openReader(data){
  if(active)return active;
  if(!(data.blob instanceof Blob)||data.blob.type!=='application/pdf'||!data.blob.size||data.blob.size>32*1024*1024)throw Error('PDF invalide.');
  const frame=document.createElement('iframe');frame.id='legacy-pdf-reader';frame.title='Lecteur PDF CDQ';
  frame.src=new URL('./reader-v2520.html',import.meta.url).href;frame.referrerPolicy='origin';
  frame.style.cssText='position:fixed;inset:0;width:100%;height:100%;border:0;z-index:2147483000;background:#101820';
  const origin=new URL(frame.src).origin,saves=new Map();let closed=false,guard=false,ready=false;
  const marker='cdq-reader-'+crypto.randomUUID();
  const tell=message=>{if(!closed)frame.contentWindow?.postMessage(message,origin)};
  function pop(){if(closed)return;history.pushState({cdqReader:marker},'',location.href);tell({type:'CDQ_READER_REQUEST_CLOSE'});}
  function close(){
    if(closed)return;closed=true;active=null;clearTimeout(timer);
    window.removeEventListener('message',receive);window.removeEventListener('popstate',pop);frame.remove();
    if(guard&&history.state?.cdqReader===marker)history.back();
    data.onClose?.();
  }
  async function receive(event){
    if(closed||event.source!==frame.contentWindow||event.origin!==origin)return;
    const m=event.data||{};
    if(m.type==='CDQ_READER_READY'){
      ready=true;clearTimeout(timer);
      if(!guard){history.pushState({cdqReader:marker},'',location.href);guard=true;window.addEventListener('popstate',pop);}
      tell({type:'CDQ_READER_OPEN',blob:data.blob,name:data.name,fileId:data.onSave?String(data.fileId||'local-copy'):'',readOnly:!!data.readOnly});
    }
    if(m.type==='CDQ_READER_CLOSE')close();
    if(m.type==='CDQ_READER_DISCARD'&&/^discard-[\w-]{8,80}$/.test(String(m.requestId||''))){
      try{await data.onDiscard?.();tell({type:'CDQ_READER_SAVED',requestId:m.requestId,ok:true});}
      catch(e){tell({type:'CDQ_READER_SAVED',requestId:m.requestId,ok:false,error:e.message||String(e)});}
    }
    if(m.type==='CDQ_READER_SAVE'&&data.onSave&&!data.readOnly){
      if(!/^save-[\w-]{8,80}$/.test(String(m.requestId||''))||!(m.blob instanceof Blob)||m.blob.type!=='application/pdf'||m.blob.size<8||m.blob.size>32*1024*1024)return;
      if(!saves.has(m.requestId))saves.set(m.requestId,Promise.resolve().then(()=>data.onSave(m.blob,m.requestId)));
      try{const result=await saves.get(m.requestId);tell({type:'CDQ_READER_SAVED',requestId:m.requestId,ok:true,queued:!!result?.queued});}
      catch(e){saves.delete(m.requestId);tell({type:'CDQ_READER_SAVED',requestId:m.requestId,ok:false,error:e.message||String(e)});}
    }
  }
  const timer=setTimeout(()=>{if(!ready){close();data.onError?.(new Error('Le lecteur n’a pas démarré. Mettez à jour l’application puis réessayez.'));}},30000);
  window.addEventListener('message',receive);document.body.append(frame);
  active={requestClose:()=>tell({type:'CDQ_READER_REQUEST_CLOSE'})};return active;
}
