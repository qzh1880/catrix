import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../comments-worker.js';
import { createDatabase } from './database.mjs';
import { replay, periodStart, rules } from '../rankings.js';
import blocks from '../../static/games/tetris/engine.js';
const KEY='community-test-secret-over-32-characters';
function setup(t){
  const DB=createDatabase();t.after(()=>DB.sqlite.close());const visitor=crypto.randomUUID();
  const env={DB,COMMENTS_ADMIN_KEY:KEY,COMMENTS_RATE_SALT:KEY};
  const call=(path,data,headers={})=>worker.fetch(new Request('https://api.example/community/'+path,{method:data?'POST':'GET',headers:{Origin:'https://catrix.net','CF-Connecting-IP':'192.0.2.1','Content-Type':'application/json',...headers},...(data?{body:JSON.stringify({visitor,...data})}:{})}),env);
  const feedback=(extra={})=>call('feedback',{nickname:'读者',body:'希望增加夜间阅读模式',requestId:crypto.randomUUID(),...extra});
  return {DB,env,visitor,call,feedback};
}
function finishedLog(seed){const game=new blocks.Game(rules.seeded(seed));game.start();const log=[];while(game.state==='running'&&log.length<100){game.hardDrop();log.push('drop');}assert.equal(game.state,'over');return {log,score:game.score};}

test('feedback is public, idempotent, plaintext and sorted by votes',async t=>{
  const {feedback,call,visitor}=setup(t);const requestId=crypto.randomUUID();
  assert.equal((await feedback({requestId})).status,201);assert.equal((await feedback({requestId})).status,200);
  assert.equal((await feedback({requestId,body:'不同正文'})).status,409);
  await feedback({body:'<script>hello</script>'});
  let rows=(await (await call('feedback')).json()).items;assert.equal(rows.length,2);assert.equal(rows[0].id,2);
  const vote=()=>call('like',{kind:'feedback',id:1,liked:true});await Promise.all([vote(),vote()]);
  rows=(await (await call('feedback')).json()).items;assert.equal(rows[0].id,1);assert.equal(rows[0].likes,1);
  const info=await (await call('likes?kind=feedback&ids=1,2&visitor='+visitor)).json();assert.equal(info.items[0].liked,1);
  await call('like',{kind:'feedback',id:1,liked:false});await call('like',{kind:'feedback',id:1,liked:false});
  assert.equal((await (await call('feedback')).json()).items[0].id,2);
  assert.equal((await feedback({body:' '})).status,400);
});

test('comment likes reject private or deleted targets',async t=>{
  const {DB,call}=setup(t);
  DB.sqlite.prepare("INSERT INTO comments(request_id,article,nickname,body,status) VALUES (?,'/posts/a/','读者','正文','pending')").run(crypto.randomUUID());
  assert.equal((await call('like',{kind:'comment',id:1,liked:true})).status,404);
  DB.sqlite.exec("UPDATE comments SET status='approved'");
  assert.equal((await call('like',{kind:'comment',id:1,liked:true})).status,200);
  DB.sqlite.exec("UPDATE comments SET body='',nickname='',status='rejected'");
  assert.equal((await call('like',{kind:'comment',id:1,liked:true})).status,404);
});

test('feedback deletion requires admin and cannot be resurrected by retries',async t=>{
  const {feedback,call,DB}=setup(t);const requestId=crypto.randomUUID();await feedback({requestId});
  assert.equal((await call('admin/check',{})).status,401);
  assert.equal((await call('admin/check',{},{'X-Comments-Key':KEY})).status,200);
  assert.equal((await call('admin/delete-feedback',{id:1})).status,401);
  assert.equal((await call('admin/delete-feedback',{id:1},{'X-Comments-Key':KEY})).status,200);
  assert.equal((await feedback({requestId})).status,410);
  assert.equal(DB.sqlite.prepare('SELECT body FROM feedback').get().body,'');
  assert.equal((await (await call('feedback')).json()).items.length,0);
});

test('community endpoints reject malformed IDs, forbidden origins and large bodies',async t=>{
  const {call}=setup(t);
  assert.equal((await call('like',{kind:'feedback',id:1,liked:true},{Origin:'https://evil.example'})).status,403);
  assert.equal((await call('like',{kind:'feedback',id:1,liked:true,visitor:'bad'})).status,400);
  assert.equal((await call('likes?kind=feedback&ids=1%20OR%201=1')).status,400);
  assert.equal((await call('feedback?page=-1')).status,400);
  assert.equal((await call('feedback',{nickname:'n',body:'x'.repeat(310000),requestId:crypto.randomUUID()})).status,413);
  assert.equal((await call('rankings?period=bad')).status,400);
});

test('ranked result is replayed, bound to player and submitted once',async t=>{
  const {call,DB}=setup(t);const session=await (await call('rankings/start',{})).json();const result=finishedLog(session.seed);
  const data={sessionId:session.id,version:rules.VERSION,nickname:'测试玩家',log:result.log,score:999999999};
  assert.equal((await call('rankings/submit',{...data,visitor:crypto.randomUUID()})).status,404);
  const response=await call('rankings/submit',data);assert.equal(response.status,201);
  assert.equal((await response.json()).score,result.score);
  assert.equal((await call('rankings/submit',data)).status,200);
  assert.equal(DB.sqlite.prepare('SELECT COUNT(*) AS n FROM ranked_scores').get().n,1);
  const board=(await (await call('rankings?period=all')).json()).items;
  assert.equal(board[0].nickname,'测试玩家');assert.equal(board[0].score,result.score);assert.equal(board[0].player,undefined);
});

test('ranking rejects unfinished, expired, unknown-version and invalid replays',async t=>{
  const {call,DB}=setup(t);const session=await (await call('rankings/start',{})).json();
  const data={sessionId:session.id,version:rules.VERSION,nickname:'读者',log:[]};
  assert.equal((await call('rankings/submit',data)).status,400);
  assert.equal((await call('rankings/submit',{...data,version:'wrong'})).status,400);
  for(const log of [['cheat'],[['tick',-1]],[['tick',rules.MAX_TICKS+1]],'bad'])assert.throws(()=>replay(1,log));
  const finished=finishedLog(1);assert.throws(()=>replay(1,[...finished.log,'drop']));
  DB.sqlite.prepare('UPDATE ranked_sessions SET expires_at=0 WHERE id=?').run(session.id);
  assert.equal((await call('rankings/submit',{...data,log:finishedLog(session.seed).log})).status,410);
});

test('Shanghai week and month roll over at their exact boundaries',()=>{
  assert.equal(periodStart('week',Date.parse('2026-10-04T15:59:59Z')),Date.parse('2026-09-27T16:00:00Z')/1000);
  assert.equal(periodStart('week',Date.parse('2026-10-04T16:00:00Z')),Date.parse('2026-10-04T16:00:00Z')/1000);
  assert.equal(periodStart('month',Date.parse('2026-09-30T16:00:00Z')),Date.parse('2026-09-30T16:00:00Z')/1000);
  assert.equal(periodStart('all'),0);
});

test('each ranking keeps one best result per browser and excludes earlier periods',async t=>{
  const {call,DB}=setup(t);const now=Math.floor(Date.now()/1000),start=periodStart('week');
  const add=(player,score,time)=>{const id=crypto.randomUUID();DB.sqlite.prepare('INSERT INTO ranked_sessions VALUES (?,?,?,?,?)').run(id,player,1,time,time+7200);DB.sqlite.prepare('INSERT INTO ranked_scores VALUES (?,?,?,?,?,?)').run(id,player,player,score,0,time);};
  add('player-a',100,now-1);add('player-a',200,now);add('player-b',300,start-1);
  const week=(await (await call('rankings?period=week')).json()).items;assert.equal(week.length,1);assert.equal(week[0].score,200);
  const all=(await (await call('rankings?period=all')).json()).items;assert.equal(all.length,2);assert.equal(all[0].score,300);
});

test('casual difficulty changes speed without changing default ranked rules',()=>{
  const easy=new blocks.Game(()=>.5,1.6),hard=new blocks.Game(()=>.5,.6),normal=new blocks.Game(()=>.5);for(const game of [easy,hard,normal])game.start();
  for(let i=0;i<6;i++)for(const game of [easy,hard,normal])game.tick(100);
  assert.equal(easy.current.y,-1);assert.equal(normal.current.y,-1);assert.equal(hard.current.y,0);
});
