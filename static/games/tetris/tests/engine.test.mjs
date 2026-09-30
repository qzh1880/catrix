// 使用确定性随机数验证规则；不依赖浏览器、时钟或网络。
import test from 'node:test';
import assert from 'node:assert/strict';
import engine from '../engine.js';
const { Game, SHAPES, TYPES } = engine;
const create = () => { const game = new Game(() => .5); game.start(); return game; };
const piece = (type,x,y) => ({type,x,y,cells:SHAPES[type].map(row=>[...row])});

test('each shuffled bag contains all seven pieces exactly once', () => {
  const game = create(); game.bag = [];
  for (let i=0;i<10;i++) assert.deepEqual(Array.from({length:7},()=>game.drawType()).sort(), [...TYPES].sort());
});
test('start and restart produce an empty board and reset score, hold and timers', () => {
  const game = create(); game.hardDrop(); game.hold(); game.score = 1000; game.start();
  assert.equal(game.state,'running'); assert.equal(game.score,0); assert.equal(game.held,null);
  assert.equal(game.board.flat().filter(Boolean).length,0); assert.equal(game.queue.length,5); assert.equal(game.lockTime,0);
});
test('movement cannot leave walls or pass through occupied cells', () => {
  const game = create(); game.current = piece('O',0,5);
  assert.equal(game.move(-1),false); game.board[5][2]='J'; assert.equal(game.move(1),false);
  game.current.x=8; assert.equal(game.move(1),false);
});
test('rotation succeeds beside a wall by shifting the piece inside', () => {
  const game = create(); game.current = piece('T',0,5); game.rotate(); game.move(-1);
  assert.equal(game.current.x,-1); assert.equal(game.rotate(),true); assert.ok(game.fits(game.current));
});
test('rotation cannot move into a fully occupied area', () => {
  const game=create(); game.current=piece('T',4,6);
  for(let y=3;y<12;y++)game.board[y].fill('J');
  game.current.cells.forEach((r,dy)=>r.forEach((v,dx)=>{if(v)game.board[6+dy][4+dx]=null;}));
  const before=JSON.stringify(game.current); assert.equal(game.rotate(),false); assert.equal(JSON.stringify(game.current),before);
});
test('clockwise and anticlockwise rotations cancel each other in free space', () => {
  const game=create(); game.current=piece('L',3,5); const before=JSON.stringify(game.current.cells);
  game.rotate(); game.rotate(-1); assert.equal(JSON.stringify(game.current.cells),before);
});
test('ghost stops on stack and hard drop awards distance points', () => {
  const game=create(); game.current=piece('O',4,0); game.board[15][4]='J';
  assert.equal(game.ghostY(),13); game.hardDrop(); assert.equal(game.score,26); assert.equal(game.board[13][4],'O');
});
test('soft drop moves one cell and scores one point, but cannot penetrate floor', () => {
  const game=create(); game.current=piece('O',4,17); assert.equal(game.softDrop(),true);
  assert.equal(game.current.y,18); assert.equal(game.score,1); assert.equal(game.softDrop(),false);
});
test('one line clears and remaining rows fall without sharing row arrays', () => {
  const game=create(); game.board[19].fill('J'); game.board[19][0]=null; game.board[19][1]=null;
  game.current=piece('O',0,18); game.lock();
  assert.equal(game.lines,1); assert.equal(game.score,100); assert.equal(game.board[19][0],'O');
  game.board[0][0]='T'; assert.equal(game.board[1][0],null);
});
test('four lines clear together for 800 points', () => {
  const game=create(); for(let y=16;y<20;y++){game.board[y].fill('J');game.board[y][5]=null;}
  game.current={type:'I',x:3,y:16,cells:[[0,0,1,0],[0,0,1,0],[0,0,1,0],[0,0,1,0]]}; game.lock();
  assert.equal(game.lines,4); assert.equal(game.score,800); assert.equal(game.lastClear,4);
  assert.equal(game.board.flat().filter(Boolean).length,0);
});
test('level increases every ten lines and scoring uses level before the clear', () => {
  const game=create();game.lines=9;game.board[19].fill('J');game.board[19][0]=null;game.board[19][1]=null;
  game.current=piece('O',0,18);game.lock(); assert.equal(game.level,2);assert.equal(game.score,100);
});
test('hold can only be used once until the active piece locks', () => {
  const game=create();const first=game.current.type;assert.equal(game.hold(),true);assert.equal(game.held,first);
  assert.equal(game.hold(),false);game.hardDrop();assert.equal(game.hold(),true);assert.equal(game.current.type,first);
});
test('paused game ignores controls and elapsed time', () => {
  const game=create();game.pause();const before=JSON.stringify(game);
  game.tick(100);game.move(1);game.rotate();game.hardDrop();game.hold();assert.equal(JSON.stringify(game),before);
  game.resume();assert.equal(game.state,'running');
});
test('touchdown locks after delay and successful shifts reset it within a limit', () => {
  const game=create();game.current=piece('O',4,18);for(let i=0;i<4;i++)game.tick(100);
  assert.equal(game.pieces,0);game.move(1);assert.equal(game.lockTime,0);
  game.lockResets=15;game.lockTime=400;game.move(-1);assert.equal(game.lockTime,400);game.tick(50);assert.equal(game.pieces,1);
});
test('blocked spawn and locking above the top end the game', () => {
  const game=create();game.board[0].fill('J');game.spawn('O');assert.equal(game.state,'over');
  const second=create();second.current=piece('O',3,-1);second.lock();assert.equal(second.state,'over');
});
test('gravity progresses and a long inactive interval is capped', () => {
  const game=create();const y=game.current.y;for(let i=0;i<8;i++)game.tick(100);assert.equal(game.current.y,y);
  game.tick(100);assert.equal(game.current.y,y+1);game.tick(60000);assert.equal(game.current.y,y+1);
});
test('deterministic play simulation preserves board bounds and finite score', () => {
  let seed=12345;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
  const game=new Game(random);game.start();
  for(let i=0;i<250;i++){
    if(game.state==='over')game.start();
    for(let j=0;j<Math.floor(random()*4);j++)game.rotate();
    const dx=random()<.5?-1:1;for(let j=0;j<Math.floor(random()*8);j++)game.move(dx);
    if(random()<.2)game.hold();game.hardDrop();
    assert.equal(game.board.length,20);assert.ok(game.board.every(r=>r.length===10));
    assert.ok(Number.isFinite(game.score));assert.ok(game.board.flat().every(c=>c===null||TYPES.includes(c)));
  }
});
