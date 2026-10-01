(() => {
  const $=id=>document.getElementById(id), app=$('feedback-app'), api=window.CatrixCommunity;
  api.configure(app.dataset.api);
  let page=1, revision=0, adminKey='', requestId='', last='', busy=false;
  async function load(){const current=++revision;$('feedback-status').textContent='正在读取建议…';try{
    const data=await api.request('feedback?page='+page);if(current!==revision)return;
    $('feedback-list').replaceChildren();
    for(const item of data.items){
      const article=document.createElement('article');article.className='feedback-item';
      const name=document.createElement('strong');name.textContent=item.nickname;
      const time=document.createElement('time');time.textContent=new Date(item.created_at).toLocaleDateString('zh-CN');
      const body=document.createElement('p');body.textContent=item.body;
      const actions=document.createElement('div');actions.className='feedback-actions';actions.append(api.likeButton('feedback',item.id,()=>{page=1;load();}));
      if(adminKey){const remove=document.createElement('button');remove.type='button';remove.textContent='删除建议';remove.addEventListener('click',async()=>{
        if(!confirm('删除这条建议？正文及昵称将清除，无法恢复。'))return;
        remove.disabled=true;try{await api.request('admin/delete-feedback',{id:item.id},{'X-Comments-Key':adminKey});await load();}catch(error){$('feedback-status').textContent=error.message;remove.disabled=false;}
      });actions.append(remove);}
      article.append(name,time,body,actions);$('feedback-list').append(article);
    }
    $('feedback-prev').disabled=page===1;$('feedback-next').disabled=!data.more;$('feedback-page').textContent='第 '+page+' 页';$('feedback-status').textContent=data.items.length?'':'还没有建议，欢迎留下第一个想法。';
  }catch(error){if(current===revision)$('feedback-status').textContent=error.message+' 可点击刷新重试。';}}
  $('feedback-form').addEventListener('submit',async event=>{event.preventDefault();if(busy)return;
    const payload={nickname:$('feedback-name').value.trim(),body:$('feedback-body').value.trim()};const serialized=JSON.stringify(payload);
    if(last!==serialized){last=serialized;requestId=crypto.randomUUID();}
    busy=true;$('feedback-fields').disabled=true;
    try{await api.request('feedback',{...payload,requestId});$('feedback-body').value='';last='';page=1;await load();$('feedback-status').textContent='建议已发布，感谢你的反馈。';}catch(error){$('feedback-status').textContent=error.message;}finally{busy=false;$('feedback-fields').disabled=false;}
  });
  $('feedback-prev').addEventListener('click',()=>{if(page>1){page--;load();}});$('feedback-next').addEventListener('click',()=>{page++;load();});$('feedback-refresh').addEventListener('click',load);
  $('feedback-admin-login').addEventListener('click',async()=>{const key=$('feedback-key').value;$('feedback-key').value='';try{await api.request('admin/check',{}, {'X-Comments-Key':key});adminKey=key;$('feedback-admin-logout').hidden=false;await load();}catch(error){$('feedback-status').textContent=error.message;}});
  $('feedback-admin-logout').addEventListener('click',()=>{adminKey='';$('feedback-admin-logout').hidden=true;load();});load();
})();
