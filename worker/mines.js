import {create,reveal,view,configuration,chord,validateFlags} from '../static/games/mines/engine.mjs';
const fail=(message,status=400)=>{throw {status,message};};
const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
export async function minesBoard(DB,level){
 try{configuration(level);}catch(e){fail(e.message);}
 return {items:(await DB.prepare('SELECT nickname,elapsed_ms,finished_at FROM (SELECT *,ROW_NUMBER() OVER (PARTITION BY player ORDER BY elapsed_ms,finished_at,session_id) AS n FROM mines_scores WHERE level=?) WHERE n=1 ORDER BY elapsed_ms,finished_at,session_id LIMIT 50').bind(level).all()).results};
}
export async function minesAction(DB,path,data,player){
 const now=Date.now();
 if(path==='start'){
  if(!uuid(data.sessionId))fail('对局参数不正确。');
  let config;try{config=configuration(data.level);}catch(e){fail(e.message);}
  if(!Number.isInteger(data.index)||data.index<0||data.index>=config.rows*config.cols)fail('格子不正确。');
  // 客户端重试使用同一 sessionId，网络抖动不会生成第二张棋盘。
  await DB.prepare('DELETE FROM mines_sessions WHERE started_at < ?').bind(now-7200000).run();
  const g=create(data.level,data.index,()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296);
  await DB.prepare('INSERT INTO mines_sessions(id,player,level,board,started_at,finished_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(data.sessionId,player,data.level,JSON.stringify(g),now,g.state==='won'?now:null).run();
 }
 if(!uuid(data.sessionId))fail('对局编号不正确。');
 const s=await DB.prepare('SELECT * FROM mines_sessions WHERE id=? AND player=?').bind(data.sessionId,player).first();
 if(!s)fail('对局不存在或已过期，请重新开始。',404);
 if(now-s.started_at>7200000)fail('本局已超过两小时，请重新开始。',410);
 if(path==='submit'){
  const name=typeof data.nickname==='string'?data.nickname.trim():'';
  if(!name||name.length>24||/[\x00-\x1f\x7f]/.test(name))fail('请填写 1–24 字符昵称。');
  if(JSON.parse(s.board).state!=='won'||s.finished_at===null)fail('只有通关成绩可以入榜。');
  await DB.prepare('INSERT INTO mines_scores VALUES (?,?,?,?,?,?) ON CONFLICT(session_id) DO NOTHING').bind(s.id,player,s.level,name,Math.max(1,s.finished_at-s.started_at),now).run();
  return {ok:true,elapsed_ms:Math.max(1,s.finished_at-s.started_at)};
 }
 if(!['start','reveal','chord','state'].includes(path))fail('接口不存在。',404);
 let g=JSON.parse(s.board);
 if(path==='reveal'||path==='chord'){
  if(!Number.isInteger(data.index)||data.index<0||data.index>=g.cells.length)fail('格子不正确。');
  if(data.version!==s.version)fail('对局状态已更新，请同步后重试。',409);
  const flags=data.flags??[];
  try{validateFlags(g,flags);if(path==='chord')chord(g,data.index,flags);else reveal(g,data.index,flags);}catch(e){fail(e.message);}
  const ended=g.state!=='playing'?(s.finished_at??now):null;
  const result=await DB.prepare('UPDATE mines_sessions SET board=?,version=version+1,finished_at=? WHERE id=? AND version=?').bind(JSON.stringify(g),ended,s.id,s.version).run();
  if(!result.meta.changes)fail('对局状态已更新，请同步后重试。',409);
  s.version++;s.finished_at=ended;
 }
 return {...view(g),id:s.id,level:s.level,version:s.version,elapsed_ms:Math.max(0,(s.finished_at??now)-s.started_at)};
}
