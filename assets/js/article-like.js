// 文章路径沿用评论区的规范形式，计数与文章评论数相互独立。
(() => {
 const root=document.querySelector('[data-article-like]');if(!root)return;
 const api=window.CatrixCommunity,button=root.querySelector('button'),status=root.querySelector('[role=status]');api.configure(root.dataset.api);
 let loaded=false,liked=false;
 function show(row){loaded=true;liked=!!row.liked;button.textContent=(liked?'♥ 已赞':'♡ 点赞')+' · '+row.likes;button.setAttribute('aria-pressed',String(liked));status.textContent='';}
 async function load(){try{show(await api.request('article-like?'+new URLSearchParams({article:root.dataset.article,visitor:api.visitor})));}catch{button.textContent='重试读取点赞';status.textContent='点赞暂不可用，点击重试。';}finally{button.disabled=false;}}
 button.addEventListener('click',async()=>{button.disabled=true;if(!loaded){await load();return;}try{show(await api.request('article-like',{article:root.dataset.article,liked:!liked}));}catch(e){status.textContent=e.message;}finally{button.disabled=false;}});
 load();
})();
