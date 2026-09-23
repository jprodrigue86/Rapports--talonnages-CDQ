(function(){
const active=new Map();
function finish(id){const old=active.get(id);if(!old)return;clearTimeout(old.timer);for(const el of old.elements)el.remove();for(const row of old.rows)row.removeAttribute('aria-busy');active.delete(id);}
window.cdqRowLoading23={start(id){finish(id);const key=CSS.escape(String(id)),rows=[...document.querySelectorAll('[data-file="'+key+'"],[data-file-id="'+key+'"]')].map(n=>n.closest('tr,.file-row,.cdq23-drive-row')||n).filter((n,i,a)=>a.indexOf(n)===i),elements=[];for(const row of rows){const spinner=document.createElement('span');spinner.className='cdq23-row-spinner';spinner.setAttribute('role','status');spinner.setAttribute('aria-label','Ouverture du PDF en cours');const host=row.matches('tr')?row.querySelector('td'):row;host?.append(spinner);row.setAttribute('aria-busy','true');elements.push(spinner);}active.set(id,{rows,elements,timer:setTimeout(()=>finish(id),90000)});return ()=>finish(id);},finish};
})();
