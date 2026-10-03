import test from 'node:test';
import assert from 'node:assert/strict';
import {create,reveal,view,neighbors,LEVELS,configuration,chord} from '../../static/games/mines/engine.mjs';
import worker from '../comments-worker.js';
import {createDatabase} from './database.mjs';
function setup(t){const DB=createDatabase();t.after(()=>DB.sqlite.close());const visitor=crypto.randomUUID(),env={DB,COMMENTS_RATE_SALT:'mines-test-secret-more-than-32-characters'};const call=(path,data,overrides={})=>worker.fetch(new Request('https://api.example/community/'+path,{method:data?'POST':'GET',headers:{Origin:'https://catrix.net','CF-Connecting-IP':'192.0.2.2','Content-Type':'application/json',...overrides},...(data?{body:JSON.stringify({visitor,...data})}:{})}),env);return {DB,call,visitor};}
function chordFixture(){return {cols:3,rows:3,mines:1,cells:[-1,1,0,1,1,0,0,0,0],open:[4],state:'playing'};}
test('chord opens unflagged neighbors, rejects mismatched counts and wrong flags lose',()=>{
 const g=chordFixture();const original=JSON.stringify(g);assert.throws(()=>chord(g,4,[]));assert.equal(JSON.stringify(g),original);
 assert.throws(()=>chord(g,4,[0,0]));assert.throws(()=>chord(g,4,[4]));assert.throws(()=>chord(g,5,[0]));
 chord(g,4,[0]);assert.equal(g.state,'won');assert.equal(g.open.includes(0),false);
 const wrong=chordFixture();chord(wrong,4,[1]);assert.equal(wrong.state,'lost');assert.equal(wrong.hit,0);assert.equal(wrong.open.includes(1),false);
});
test('custom configurations validate bounds and preserve first-click safety at maximum density',()=>{
 for(const key of ['custom-5x5-16','custom-40x30-300']){const cfg=configuration(key),g=create(key,cfg.cols+1);assert.equal(g.cells.filter(n=>n===-1).length,cfg.mines);assert.equal(g.cells[cfg.cols+1],0);}
 for(const key of ['custom-4x9-10','custom-41x9-10','custom-9x31-10','custom-5x5-17','custom-40x30-301','custom-9x9-0','custom-09x9-10','custom-9.5x9-10'])assert.throws(()=>configuration(key));
 assert.ok(LEVELS.expert.mines/(LEVELS.expert.rows*LEVELS.expert.cols)>LEVELS.hard.mines/(LEVELS.hard.rows*LEVELS.hard.cols));
});
test('chord API checks flags and versions and commits a single authoritative result',async t=>{
 const {call,DB}=setup(t),id=crypto.randomUUID();await call('mines/start',{sessionId:id,level:'easy',index:0});
 DB.sqlite.prepare('UPDATE mines_sessions SET board=? WHERE id=?').run(JSON.stringify(chordFixture()),id);
 assert.equal((await call('mines/chord',{sessionId:id,index:4,version:0,flags:[]})).status,400);
 assert.equal((await call('mines/chord',{sessionId:id,index:4,version:10,flags:[0]})).status,409);
 const r=await call('mines/chord',{sessionId:id,index:4,version:0,flags:[0]});assert.equal(r.status,200);assert.equal((await r.json()).state,'won');
 assert.equal((await call('mines/submit',{sessionId:id,nickname:'双击测试'})).status,200);
});
test('custom and expert boards accept starts and rank only matching dimensions and mine counts',async t=>{
 const {call,DB}=setup(t);
 for(const level of ['expert','custom-8x8-12','custom-8x8-13']){const response=await call('mines/start',{sessionId:crypto.randomUUID(),level,index:0});assert.equal(response.status,200);assert.equal((await response.json()).level,level);}
 assert.equal((await call('mines/start',{sessionId:crypto.randomUUID(),level:'custom-5x5-100',index:0})).status,400);
 assert.equal((await call('mines/rankings?level=custom-0x0-1')).status,400);
 const add=(id,player,level,time)=>DB.sqlite.prepare('INSERT INTO mines_scores VALUES (?,?,?,?,?,?)').run(id,player,level,player,time,Date.now());
 add('a','alice','custom-8x8-12',2000);add('b','alice','custom-8x8-12',1000);add('c','bob','custom-8x8-13',500);add('d','dave','custom-9x8-12',400);add('e','emma','expert',3000);
 const board=await(await call('mines/rankings?level=custom-8x8-12')).json();assert.equal(board.items.length,1);assert.equal(board.items[0].elapsed_ms,1000);
 assert.equal((await(await call('mines/rankings?level=expert')).json()).items[0].nickname,'emma');
});
test('all difficulties have exact mine counts, safe first neighborhoods and concealed cells',()=>{
 for(const level of Object.keys(LEVELS))for(const first of [0,Math.floor(LEVELS[level].cols*LEVELS[level].rows/2),LEVELS[level].cols*LEVELS[level].rows-1]){
  const g=create(level,first);assert.equal(g.cells.filter(n=>n===-1).length,LEVELS[level].mines);for(const i of [first,...neighbors(first,g)])assert.notEqual(g.cells[i],-1);
  const publicState=view(g);assert.equal(publicState.cells.includes(-1),false);assert.equal('open' in publicState,false);
  for(let i=0;i<g.cells.length;i++)if(g.cells[i]!==-1)reveal(g,i);assert.equal(g.state,'won');
 }
});
test('mine ends a game, further moves have no effect, invalid coordinates fail',()=>{
 const g=create('easy',0);reveal(g,g.cells.indexOf(-1));assert.equal(g.state,'lost');assert.equal(view(g).cells.filter(n=>n===-1).length,10);const before=JSON.stringify(g);reveal(g,80);assert.equal(JSON.stringify(g),before);assert.throws(()=>create('bogus',0));assert.throws(()=>create('easy',81));assert.throws(()=>reveal(g,-1));
});
test('ranked boards stay on server, retries do not reset the clock and foreign players cannot access',async t=>{
 const {call,DB}=setup(t),id=crypto.randomUUID();const start={sessionId:id,level:'easy',index:0};const a=await(await call('mines/start',start)).json();assert.equal(a.state,'playing');assert.equal(a.cells.includes(-1),false);assert.equal(a.board,undefined);
 const stored=DB.sqlite.prepare('SELECT * FROM mines_sessions').get();const b=await(await call('mines/start',start)).json();assert.deepEqual(a.cells,b.cells);assert.equal(DB.sqlite.prepare('SELECT started_at FROM mines_sessions').get().started_at,stored.started_at);
 assert.equal((await call('mines/state',{sessionId:id,visitor:crypto.randomUUID()})).status,404);
 assert.equal((await call('mines/submit',{sessionId:id,nickname:'未通关'})).status,400);
 assert.equal((await call('mines/reveal',{sessionId:id,index:81,version:0})).status,400);
 assert.equal((await call('mines/reveal',{sessionId:id,index:1,version:99})).status,409);
 assert.equal((await call('mines/start',{sessionId:crypto.randomUUID(),level:'__proto__',index:0})).status,400);
});
test('server confirms wins, owns timing, stores only one result and partitions rankings',async t=>{
 const {call,DB}=setup(t),id=crypto.randomUUID();let s=await(await call('mines/start',{sessionId:id,level:'easy',index:0})).json();
 // Tests can inspect SQLite to find safe cells; the public client never has this access.
 const g=JSON.parse(DB.sqlite.prepare('SELECT board FROM mines_sessions').get().board);
 DB.sqlite.prepare('UPDATE mines_sessions SET started_at=started_at-5000 WHERE id=?').run(id);
 for(let i=0;i<g.cells.length&&s.state==='playing';i++)if(g.cells[i]>=0&&s.cells[i]===null){const r=await call('mines/reveal',{sessionId:id,index:i,version:s.version});assert.equal(r.status,200);s=await r.json();}
 assert.equal(s.state,'won');assert.ok(s.elapsed_ms>=5000);
 const data={sessionId:id,nickname:'测试玩家',elapsed_ms:1};assert.equal((await call('mines/submit',data)).status,200);assert.equal((await call('mines/submit',data)).status,200);
 assert.equal(DB.sqlite.prepare('SELECT COUNT(*) AS n FROM mines_scores').get().n,1);
 const board=await(await call('mines/rankings?level=easy')).json();assert.equal(board.items.length,1);assert.ok(board.items[0].elapsed_ms>=5000);assert.equal(board.items[0].player,undefined);
 assert.equal((await(await call('mines/rankings?level=hard')).json()).items.length,0);
 DB.sqlite.prepare('UPDATE mines_sessions SET started_at=0').run();assert.equal((await call('mines/state',{sessionId:id})).status,410);
});
test('simultaneous moves do not overwrite state and a losing game cannot rank',async t=>{
 const {call,DB}=setup(t),id=crypto.randomUUID();await call('mines/start',{sessionId:id,level:'easy',index:0});const g=JSON.parse(DB.sqlite.prepare('SELECT board FROM mines_sessions').get().board),index=g.cells.indexOf(-1);
 const results=await Promise.all([1,2].map(()=>call('mines/reveal',{sessionId:id,index,version:0})));assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 assert.equal((await call('mines/submit',{sessionId:id,nickname:'输了'})).status,400);
});
test('article likes persist per visitor and article, cancel idempotently and reject bad input',async t=>{
 const {call,visitor}=setup(t),article='/posts/test/';const vote={article,liked:true};await Promise.all([call('article-like',vote),call('article-like',vote)]);
 let a=await(await call('article-like?'+new URLSearchParams({article,visitor}))).json();assert.equal(a.likes,1);assert.equal(a.liked,1);
 await call('article-like',{...vote,visitor:crypto.randomUUID()});await call('article-like',{article:'/posts/other/',liked:true});
 await call('article-like',{article,liked:false});await call('article-like',{article,liked:false});a=await(await call('article-like?'+new URLSearchParams({article,visitor}))).json();assert.equal(a.likes,1);assert.equal(a.liked,0);
 assert.equal((await call('article-like',{article:'https://evil.example/',liked:true})).status,400);
 assert.equal((await call('article-like',vote,{Origin:'https://evil.example'})).status,403);
});
