import blocks from '../static/games/tetris/engine.js';
import rules from '../static/games/tetris/rules.js';

// 不接收客户端分数；从服务端发出的种子和操作记录重新计算。
export function replay(seed, log) {
  if (!Array.isArray(log) || log.length > rules.MAX_ACTIONS * 2 + 1) throw { status:400, message:'操作记录过长或格式不正确。' };
  const game = new blocks.Game(rules.seeded(seed)); game.start();
  let ticks = 0, actions = 0;
  const moves = { left:()=>game.move(-1),right:()=>game.move(1),down:()=>game.softDrop(),rotate:()=>game.rotate(),reverse:()=>game.rotate(-1),drop:()=>game.hardDrop(),hold:()=>game.hold() };
  for (const entry of log) {
    if (game.state !== 'running' || ticks >= rules.MAX_TICKS) throw { status:400, message:'游戏结束后仍有操作。' };
    if (Array.isArray(entry) && entry.length === 2 && entry[0] === 'tick') {
      const count = entry[1];
      if (!Number.isSafeInteger(count) || count < 1 || ticks + count > rules.MAX_TICKS) throw { status:400, message:'游戏时间不正确。' };
      for (let i=0;i<count;i++) {
        if (game.state !== 'running') throw { status:400, message:'游戏结束后仍有计时。' };
        game.tick(rules.STEP); ticks++;
      }
    } else if (typeof entry === 'string' && Object.hasOwn(moves,entry)) {
      if (++actions > rules.MAX_ACTIONS) throw { status:400, message:'操作记录超出上限。' };
      moves[entry]();
    } else throw { status:400, message:'操作记录不正确。' };
  }
  if (game.state !== 'over' && ticks !== rules.MAX_TICKS && actions !== rules.MAX_ACTIONS) throw { status:400, message:'本局尚未结束。' };
  return { score:game.score, lines:game.lines, ticks };
}

// 统计时区固定为北京时间；周一零点开始一周，月初零点开始一月。
export function periodStart(period, now = Date.now()) {
  if (period === 'all') return 0;
  if (!['week','month'].includes(period)) throw { status:400, message:'榜单类型不正确。' };
  const date = new Date(now + 8 * 3600000);
  const start = Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),period === 'month' ? 1 : date.getUTCDate());
  return Math.floor((start - (period === 'week' ? ((date.getUTCDay()+6)%7)*86400000 : 0) - 8*3600000)/1000);
}
export { rules };
