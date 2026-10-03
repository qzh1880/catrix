import {configuration,neighbors} from './engine.mjs?v=2';
const $=id=>document.getElementById(id),api=window.CatrixCommunity;
let shown=null,session=null,flags=new Set(),flagging=false,busy=false,started=0,elapsed=0,finished=false,level='easy',rankRequest=0,configured=false,lastTap=null;
async function configure(){
 if(configured)return;
 const r=await fetch('../../community-config/index.json',{cache:'no-store'});
 if(!r.ok)throw Error('无法读取服务配置。');
 const c=await r.json();if(!c.api)throw Error('排行榜尚未配置。');api.configure(c.api);configured=true;
}
const seconds=ms=>(ms/1000).toFixed(1)+' s';
function clock(){return finished?elapsed:started?elapsed+performance.now()-started:0;}
setInterval(()=>{$('timer').textContent=seconds(clock());},100);
function lock(value){
 busy=value;
 for(const id of ['level','new','send','custom-cols','custom-rows','custom-mines'])$(id).disabled=value;
}
function customKey(){return `custom-${$('custom-cols').value}x${$('custom-rows').value}-${$('custom-mines').value}`;}
function settingsKey(){return $('level').value==='custom'?customKey():$('level').value;}
function customVisibility(){
 $('custom-settings').hidden=$('level').value!=='custom'&&$('rank-level').value!=='custom';
 const cap=Math.min(300,Number($('custom-cols').value)*Number($('custom-rows').value)-9);
 $('custom-mines').max=String(Math.max(1,cap));
 $('custom-limit').textContent=`雷数最多 ${Math.max(1,cap)}；自定义榜按当前宽、高、雷数分别统计。`;
}
function reset(key){
 level=key;shown=null;session=null;flags.clear();started=0;elapsed=0;finished=false;lastTap=null;flagging=false;
 $('flag-mode').setAttribute('aria-pressed','false');$('flag-mode').textContent='⚑ 插旗：关';
 $('result').hidden=true;$('submit').hidden=false;$('sync').hidden=true;$('receipt').textContent='';$('send').disabled=false;
 $('status').textContent='点击任意格子开始排位。';$('current-level').textContent=configuration(level).name;
 render();
}
function render(){
 const cfg=configuration(level),board=$('board');
 if(board.children.length!==cfg.cols*cfg.rows||Number(board.dataset.cols)!==cfg.cols){
  board.replaceChildren();board.dataset.cols=cfg.cols;board.style.gridTemplateColumns=`repeat(${cfg.cols},auto)`;
  for(let i=0;i<cfg.cols*cfg.rows;i++){
   const b=document.createElement('button');b.type='button';b.className='cell';b.dataset.index=i;
   b.addEventListener('click',e=>{
    // 手机双击与桌面双击走同一后端动作，锁定请求防止重复展开。
    if(shown?.cells[i]>0){const now=performance.now();if(e.detail===0||(lastTap?.i===i&&now-lastTap.time<400)){lastTap=null;act(i,true);}else lastTap={i,time:now};}
    else act(i);
   });
   b.addEventListener('dblclick',e=>{e.preventDefault();act(i,true);});
   b.addEventListener('contextmenu',e=>{e.preventDefault();toggleFlag(i);});
   b.addEventListener('keydown',e=>{
    if(e.key.toLowerCase()==='f'){e.preventDefault();toggleFlag(i);}
    const steps={ArrowLeft:-1,ArrowRight:1,ArrowUp:-cfg.cols,ArrowDown:cfg.cols};
    if(e.key in steps){e.preventDefault();const n=i+steps[e.key];if(n>=0&&n<board.children.length)board.children[n].focus();}
   });board.append(b);
  }
 }
 [...board.children].forEach((b,i)=>{
  const n=shown?.cells[i]??null;if(n!==null)flags.delete(i);
  b.className='cell'+(n!==null?' open':'')+(n===-1?' mine':'');b.dataset.number=n??'';
  b.textContent=n===-1?'✹':n>0?String(n):flags.has(i)?'⚑':'';
  b.setAttribute('aria-label',`${Math.floor(i/cfg.cols)+1}行${i%cfg.cols+1}列，${n===-1?'地雷':n!==null?n===0?'空白':n+'个相邻雷':flags.has(i)?'已插旗':'未翻开'}`);
  b.setAttribute('aria-disabled',String(busy||finished));
 });
 $('flags').textContent=cfg.mines-flags.size;$('timer').textContent=seconds(clock());
}
function toggleFlag(i){
 if(busy||finished||shown?.cells[i]!=null)return;
 if(flags.has(i))flags.delete(i);
 else if(flags.size<configuration(level).mines)flags.add(i);
 else{$('status').textContent='标记已用完，可先取消一个旗子。';return;}
 render();
}
function apply(state){
 shown=state;session={id:state.id,version:state.version};elapsed=state.elapsed_ms;started=performance.now();
 if(state.state!=='playing'){
  finished=true;started=0;$('status').textContent=state.state==='won'?'全部安全格已翻开，通关！':'踩到地雷了，再来一局吧。';
  if(state.state==='won'){$('result').hidden=false;$('result-time').textContent=configuration(level).name+' · '+seconds(elapsed);}
 }else $('status').textContent='根据数字判断；旗数相同后可双击数字展开。';
 render();
}
function startData(s){return {sessionId:s.id,level,index:s.first};}
async function act(i,expand=false){
 if(busy||finished)return;
 if(expand){
  if(!shown||!(shown.cells[i]>0))return;
  if(neighbors(i,shown).filter(n=>flags.has(n)).length!==shown.cells[i]){$('status').textContent='周围旗子数量需要与数字相同。';return;}
  if(!neighbors(i,shown).some(n=>shown.cells[n]===null&&!flags.has(n)))return;
 }else{if(flagging){toggleFlag(i);return;}if(flags.has(i)||shown?.cells[i]!=null)return;}
 lock(true);render();$('status').textContent='正在翻开…';
 try{
  await configure();if(!session)session={id:crypto.randomUUID(),version:0,first:i,pending:true};const s=session;
  const state=await api.request('mines/'+(s.pending?'start':expand?'chord':'reveal'),s.pending?startData(s):{sessionId:s.id,index:i,version:s.version,flags:[...flags]});
  apply(state);$('sync').hidden=true;
 }catch(e){$('status').textContent=e.message+' 请同步后继续，计时不会暂停。';$('sync').hidden=!session;}
 finally{lock(false);render();}
}
$('sync').addEventListener('click',async()=>{
 if(busy||!session)return;lock(true);
 try{await configure();const s=session;apply(await api.request('mines/'+(s.pending?'start':'state'),s.pending?startData(s):{sessionId:s.id}));$('sync').hidden=true;}
 catch(e){$('status').textContent=e.message;}finally{lock(false);render();}
});
$('flag-mode').addEventListener('click',()=>{flagging=!flagging;$('flag-mode').setAttribute('aria-pressed',String(flagging));$('flag-mode').textContent='⚑ 插旗：'+(flagging?'开':'关');});
// 设置只在“新一局”时应用，编辑自定义参数不会突然丢失正在进行的棋局。
$('new').addEventListener('click',()=>{
 let key;try{key=settingsKey();configuration(key);}catch(e){$('settings-status').textContent=e.message;return;}
 if(session&&!finished&&!confirm('放弃当前对局并开始新一局？'))return;
 $('settings-status').textContent='';reset(key);$('rank-level').value=key.startsWith('custom-')?'custom':key;customVisibility();loadRanks();
});
$('level').addEventListener('change',()=>{customVisibility();$('settings-status').textContent='点击“新一局”应用难度。';});
for(const id of ['custom-cols','custom-rows','custom-mines'])$(id).addEventListener('input',customVisibility);
$('submit').addEventListener('submit',async e=>{
 e.preventDefault();if(busy||shown?.state!=='won')return;lock(true);
 try{await configure();const r=await api.request('mines/submit',{sessionId:session.id,nickname:$('nickname').value.trim()});$('receipt').textContent='已入榜 · '+seconds(r.elapsed_ms);$('submit').hidden=true;
  // 若玩家已编辑下一局的参数，仍展示刚刚完成的那张榜。
  if(level.startsWith('custom-')){const cfg=configuration(level);$('custom-cols').value=cfg.cols;$('custom-rows').value=cfg.rows;$('custom-mines').value=cfg.mines;}
  $('rank-level').value=level.startsWith('custom-')?'custom':level;customVisibility();loadRanks();
 }catch(e){$('receipt').textContent=e.message;}finally{lock(false);}
});
async function loadRanks(){
 const token=++rankRequest;$('rank-status').textContent='正在读取榜单…';$('ranking').replaceChildren();
 try{
  const key=$('rank-level').value==='custom'?customKey():$('rank-level').value;const cfg=configuration(key);$('rank-title').textContent=cfg.name+' · 最快纪录';
  await configure();const data=await api.request('mines/rankings?level='+encodeURIComponent(key));if(token!==rankRequest)return;
  $('rank-status').textContent=data.items.length?'用时越短排名越高。':'还没有成绩，来留下第一个纪录。';
  for(const row of data.items){const li=document.createElement('li'),name=document.createElement('span'),score=document.createElement('strong');name.textContent=row.nickname;score.textContent=seconds(row.elapsed_ms);li.append(name,score);$('ranking').append(li);}
 }catch(e){if(token===rankRequest)$('rank-status').textContent=e.message+' 请检查设置或稍后刷新。';}
}
$('refresh').addEventListener('click',loadRanks);$('rank-level').addEventListener('change',()=>{customVisibility();loadRanks();});
customVisibility();reset('easy');loadRanks();
