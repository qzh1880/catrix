/* 游戏规则独立于画布和浏览器，便于用 Node 测试碰撞、计分和消行。 */
(function (root) {
  'use strict';
  const SHAPES = {
    I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    O: [[1,1],[1,1]], T: [[0,1,0],[1,1,1],[0,0,0]],
    S: [[0,1,1],[1,1,0],[0,0,0]], Z: [[1,1,0],[0,1,1],[0,0,0]],
    J: [[1,0,0],[1,1,1],[0,0,0]], L: [[0,0,1],[1,1,1],[0,0,0]],
  };
  const TYPES = Object.keys(SHAPES);
  class Game {
    constructor(random = Math.random) { this.random = random; this.reset(); }
    reset() {
      this.board = Array.from({ length: 20 }, () => Array(10).fill(null));
      this.queue = []; this.bag = []; this.current = null; this.held = null;
      this.canHold = true; this.score = 0; this.lines = 0; this.level = 1;
      this.state = 'ready'; this.fallTime = 0; this.lockTime = 0; this.lockResets = 0;
      this.lastClear = 0; this.pieces = 0;
      this.fillQueue();
    }
    // 每袋包含七种方块各一个，打乱后逐个取出，减少某种方块长时间不出现。
    drawType() {
      if (!this.bag.length) {
        this.bag = [...TYPES];
        for (let i = this.bag.length - 1; i > 0; i--) {
          const j = Math.floor(this.random() * (i + 1));
          [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
        }
      }
      return this.bag.pop();
    }
    fillQueue() { while (this.queue.length < 5) this.queue.push(this.drawType()); }
    start() { this.reset(); this.state = 'running'; this.spawn(); }
    spawn(type) {
      type = type || this.queue.shift(); this.fillQueue();
      const cells = SHAPES[type].map(row => [...row]);
      this.current = { type, cells, x: Math.floor((10 - cells.length) / 2), y: -1 };
      this.fallTime = 0; this.lockTime = 0; this.lockResets = 0;
      if (!this.fits(this.current)) this.state = 'over';
    }
    fits(piece, x = piece.x, y = piece.y, cells = piece.cells) {
      return cells.every((row, dy) => row.every((filled, dx) => {
        if (!filled) return true;
        const bx = x + dx, by = y + dy;
        return bx >= 0 && bx < 10 && by < 20 && (by < 0 || !this.board[by][bx]);
      }));
    }
    grounded() { return this.current && !this.fits(this.current, this.current.x, this.current.y + 1); }
    // 落地后留 450ms 调整时间；最多重置 15 次，避免一直左右移动拖延落锁。
    resetLock(wasGrounded) {
      if (wasGrounded && this.lockResets < 15) { this.lockTime = 0; this.lockResets++; }
    }
    move(dx) {
      if (this.state !== 'running') return false;
      const p = this.current, grounded = this.grounded();
      if (!this.fits(p, p.x + dx, p.y)) return false;
      p.x += dx; this.resetLock(grounded); return true;
    }
    rotate(direction = 1) {
      if (this.state !== 'running' || this.current.type === 'O') return false;
      const p = this.current, n = p.cells.length, grounded = this.grounded();
      const rotated = Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) =>
        direction === 1 ? p.cells[n - 1 - x][y] : p.cells[x][n - 1 - y]));
      // 简化墙踢：旋转受阻时尝试左右挪动或上移两格，不宣称完整 SRS 规则。
      for (const [dx, dy] of [[0,0],[-1,0],[1,0],[-2,0],[2,0],[0,-1],[-1,-1],[1,-1],[0,-2]]) {
        if (this.fits(p, p.x + dx, p.y + dy, rotated)) {
          p.cells = rotated; p.x += dx; p.y += dy; this.resetLock(grounded); return true;
        }
      }
      return false;
    }
    softDrop() {
      if (this.state !== 'running') return false;
      const p = this.current;
      if (!this.fits(p, p.x, p.y + 1)) return false;
      p.y++; this.score++; this.fallTime = 0; return true;
    }
    ghostY() {
      if (!this.current) return 0;
      let y = this.current.y;
      while (this.fits(this.current, this.current.x, y + 1)) y++;
      return y;
    }
    hardDrop() {
      if (this.state !== 'running') return false;
      const y = this.ghostY(); this.score += (y - this.current.y) * 2;
      this.current.y = y; this.lock(); return true;
    }
    hold() {
      if (this.state !== 'running' || !this.canHold) return false;
      const type = this.current.type, previous = this.held;
      this.held = type; this.spawn(previous); this.canHold = false; return true;
    }
    lock() {
      const p = this.current;
      // 有方块留在棋盘上边界之外时结束，避免负行索引和覆盖已有方块。
      if (p.cells.some((row, dy) => row.some(filled => filled && p.y + dy < 0))) {
        this.state = 'over'; return;
      }
      p.cells.forEach((row, dy) => row.forEach((filled, dx) => {
        if (filled) this.board[p.y + dy][p.x + dx] = p.type;
      }));
      const remaining = this.board.filter(row => row.some(cell => !cell));
      const cleared = 20 - remaining.length;
      this.board = [...Array.from({ length: cleared }, () => Array(10).fill(null)), ...remaining];
      this.score += [0,100,300,500,800][cleared] * this.level;
      this.lines += cleared; this.level = 1 + Math.floor(this.lines / 10);
      this.lastClear = cleared; this.pieces++; this.canHold = true; this.spawn();
    }
    pause() { if (this.state === 'running') this.state = 'paused'; }
    resume() { if (this.state === 'paused') this.state = 'running'; }
    tick(elapsed) {
      if (this.state !== 'running') return;
      // 限制单帧时间差，切换标签页或电脑卡顿后不会瞬间补落很多格。
      const dt = Math.min(Math.max(elapsed, 0), 100);
      this.fallTime += dt;
      const interval = Math.max(80, 850 * Math.pow(.8, this.level - 1));
      while (this.fallTime >= interval) {
        this.fallTime -= interval;
        if (this.fits(this.current, this.current.x, this.current.y + 1)) this.current.y++;
      }
      if (this.grounded()) { this.lockTime += dt; if (this.lockTime >= 450) this.lock(); }
      else this.lockTime = 0;
    }
  }
  const api = { Game, SHAPES, TYPES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CatrixBlocks = api;
})(globalThis);
