// 社区交互共享匿名浏览器标识。昵称不是账号；清理存储会重置标识。
(() => {
  let visitor;
  try { visitor=localStorage.getItem('catrix.visitor.v1'); if(!/^[0-9a-f-]{36}$/i.test(visitor||'')) {visitor=crypto.randomUUID();localStorage.setItem('catrix.visitor.v1',visitor);} }
  catch { visitor=crypto.randomUUID(); }
  let base='';
  async function request(path,data,headers={}) {
    if(!base)throw Error('社区服务尚未配置。');
    const response=await fetch(base+'/community/'+path,{method:data?'POST':'GET',headers:{...(data?{'Content-Type':'application/json'}:{}),...headers},...(data?{body:JSON.stringify({...data,visitor})}:{}),credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(20000)});
    const result=await response.json();if(!response.ok)throw Error(result.error||'请求失败，请稍后重试。');return result;
  }
  const queue=[];let scheduled=false;
  function likeButton(kind,id,onChange) {
    const button=document.createElement('button');button.type='button';button.className='like-button';button.textContent='赞 · …';button.disabled=true;
    let liked=false;
    const update=row=>{liked=!!row?.liked;button.textContent=(liked?'已赞':'赞')+' · '+(row?.likes||0);button.setAttribute('aria-pressed',String(liked));button.disabled=false;};
    queue.push({kind,id,update,button});
    if(!scheduled){scheduled=true;queueMicrotask(async()=>{
      scheduled=false;const pending=queue.splice(0);
      for(const kind of ['comment','feedback']) {
        const entries=pending.filter(item=>item.kind===kind);
        for(let i=0;i<entries.length;i+=20){const group=entries.slice(i,i+20);try{
          const data=await request('likes?'+new URLSearchParams({kind,ids:group.map(item=>item.id).join(','),visitor}));
          group.forEach(item=>item.update(data.items.find(row=>row.target_id===item.id)));
        }catch{group.forEach(item=>{item.button.textContent='点赞暂不可用';item.button.disabled=false;});}}
      }
    });}
    button.addEventListener('click',async()=>{button.disabled=true;try{const result=await request('like',{kind,id,liked:!liked});update(result);onChange?.();}catch(error){button.textContent=error.message;button.disabled=false;}});
    return button;
  }
  window.CatrixCommunity={request,likeButton,configure:value=>{base=String(value||'').replace(/\/$/,'');}};
})();
