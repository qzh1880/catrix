// 生命游戏的界面层：画布渲染、设置、图案调色板、鼠标/触摸绘制。
// 规则、图案、演化都在 engine.mjs 里，本文件只负责 DOM。
import {
  VIEWS, SPEEDS, PATTERNS, parsePattern, createGrid, population, step,
  randomFill, stamp, toggleCell, bounds
} from './engine.mjs';

const $ = (sel) => document.querySelector(sel);
const STORE_KEY = 'catrix-life-settings';
const COLORS = { board: '#fdfcf7', cell: '#375a45', grid: '#edece2', ghost: '#8aa394' };

const canvas = $('#board');
const ctx = canvas.getContext('2d');
const scroller = $('#board-scroll');
const els = {
  views: $('#views'),
  speeds: $('#speeds'),
  borders: $('#borders'),
  palette: $('#palette'),
  play: $('#play'),
  stepBtn: $('#step'),
  clearBtn: $('#clear'),
  randomBtn: $('#random'),
  draw: $('#tool-draw'),
  erase: $('#tool-erase'),
  gen: $('#gen'),
  alive: $('#alive'),
  density: $('#density'),
  status: $('#status')
};

const state = {
  view: VIEWS[1],
  speed: SPEEDS[1],
  wrap: true,
  tool: 'draw',
  pattern: null,
  grid: createGrid(VIEWS[1].cols, VIEWS[1].rows),
  gen: 0,
  peak: 0,
  running: false,
  cell: 8,
  dpr: 1,
  hover: null,
  quiet: false
};

/* ---------------- 设置持久化 ---------------- */

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    const v = VIEWS.find((x) => x.key === saved.view);
    const s = SPEEDS.find((x) => x.key === saved.speed);
    if (v) state.view = v;
    if (s) state.speed = s;
    if (typeof saved.wrap === 'boolean') state.wrap = saved.wrap;
  } catch (e) { /* 隐私模式下就当没有设置 */ }
}

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      view: state.view.key, speed: state.speed.key, wrap: state.wrap
    }));
  } catch (e) { /* 忽略 */ }
}

/* ---------------- 设置面板 ---------------- */

function segment(host, items, isActive, onPick) {
  host.textContent = '';
  for (const item of items) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = item.name;
    btn.dataset.key = item.key;
    btn.setAttribute('aria-pressed', String(isActive(item)));
    btn.addEventListener('click', () => {
      onPick(item);
      for (const other of host.children) other.setAttribute('aria-pressed', String(other === btn));
    });
    host.appendChild(btn);
  }
}

function syncSegments() {
  const mark = (host, active) => {
    for (const btn of host.children) btn.setAttribute('aria-pressed', String(btn.dataset.key === active));
  };
  mark(els.views, state.view.key);
  mark(els.speeds, state.speed.key);
  mark(els.borders, state.wrap ? 'wrap' : 'edge');
}

function buildControls() {
  segment(els.views, VIEWS.map((v) => ({ ...v, name: `${v.name} ${v.cols}×${v.rows}` })), (v) => v.key === state.view.key, (v) => {
    state.view = v;
    save();
    resize(true);
  });
  segment(els.speeds, SPEEDS.map((s) => ({ ...s, name: `${s.name} ${s.gps}/秒` })), (s) => s.key === state.speed.key, (s) => {
    state.speed = s;
    save();
  });
  segment(els.borders, [{ key: 'wrap', name: '环面（绕回来）' }, { key: 'edge', name: '死边界' }], (b) => (state.wrap ? b.key === 'wrap' : b.key === 'edge'), (b) => {
    state.wrap = b.key === 'wrap';
    save();
    draw();
  });
  syncSegments();
}

/* 图案调色板：每份画一张缩略图，点一下就用它当图章 */
function buildPalette() {
  els.palette.textContent = '';
  for (const pattern of PATTERNS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pattern';
    btn.setAttribute('aria-pressed', 'false');
    btn.title = `${pattern.en} · ${pattern.note}`;

    const preview = document.createElement('canvas');
    preview.width = 104;
    preview.height = 60;
    drawPreview(preview, pattern);
    const name = document.createElement('span');
    name.textContent = pattern.name;

    btn.append(preview, name);
    btn.addEventListener('click', () => selectPattern(pattern, btn));
    els.palette.appendChild(btn);
  }
}

function drawPreview(canvasEl, pattern) {
  const b = bounds(pattern);
  const c = canvasEl.getContext('2d');
  const pad = 6;
  const cell = Math.max(1, Math.floor(Math.min((canvasEl.width - pad * 2) / b.w, (canvasEl.height - pad * 2) / b.h)));
  const w = cell * b.w;
  const h = cell * b.h;
  const ox = Math.round((canvasEl.width - w) / 2);
  const oy = Math.round((canvasEl.height - h) / 2);
  c.fillStyle = COLORS.board;
  c.fillRect(0, 0, canvasEl.width, canvasEl.height);
  c.fillStyle = COLORS.cell;
  const gap = cell >= 5 ? 1 : 0;
  for (const [x, y] of b.cells) {
    c.fillRect(ox + x * cell, oy + y * cell, cell - gap, cell - gap);
  }
}

function selectPattern(pattern, btn) {
  state.pattern = pattern;
  state.tool = 'stamp';
  for (const other of els.palette.children) other.setAttribute('aria-pressed', String(other === btn));
  setToolButtons();
  status(`图章：${pattern.name} —— 点棋盘落子（可反复点）。想画单个细胞就切回「画笔」。`);
}

function setToolButtons() {
  els.draw.setAttribute('aria-pressed', String(state.tool === 'draw'));
  els.erase.setAttribute('aria-pressed', String(state.tool === 'erase'));
  if (state.tool !== 'stamp') {
    for (const other of els.palette.children) other.setAttribute('aria-pressed', 'false');
  }
}

function useTool(tool) {
  state.tool = tool;
  state.pattern = null;
  setToolButtons();
  status(tool === 'erase' ? '橡皮：点或拖着擦掉细胞。' : '画笔：点或拖着画细胞。');
}

/* ---------------- 画布 ---------------- */

function resize(resetBoard) {
  const styles = getComputedStyle(scroller);
  const avail = scroller.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight) - 2;
  const cols = state.view.cols;
  const rows = state.view.rows;
  state.dpr = Math.min(window.devicePixelRatio || 1, 2);
  state.cell = Math.max(3, Math.min(26, Math.floor((avail || cols * 8) / cols)));

  canvas.width = Math.round(cols * state.cell * state.dpr);
  canvas.height = Math.round(rows * state.cell * state.dpr);
  canvas.style.width = `${cols * state.cell}px`;
  canvas.style.height = `${rows * state.cell}px`;
  // 棋盘比容器宽时，让单指横扫去滚棋盘（点一下照样落子）；不溢出时全交给绘制
  canvas.style.touchAction = cols * state.cell > scroller.clientWidth ? 'pan-x' : 'none';
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

  if (resetBoard) reset();
  draw();
}

function reset(random) {
  state.grid = random
    ? randomFill(state.view.cols, state.view.rows, 0.26 + Math.random() * 0.08)
    : createGrid(state.view.cols, state.view.rows);
  state.gen = 0;
  state.peak = population(state.grid.cells);
  updateStats();
}

function draw() {
  const { cols, rows, cells } = state.grid;
  const cell = state.cell;
  const gap = cell >= 6 ? 1 : 0;
  ctx.fillStyle = COLORS.board;
  ctx.fillRect(0, 0, cols * cell, rows * cell);

  if (cell >= 7) {
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 1; x < cols; x++) {
      ctx.moveTo(x * cell + 0.5, 0);
      ctx.lineTo(x * cell + 0.5, rows * cell);
    }
    for (let y = 1; y < rows; y++) {
      ctx.moveTo(0, y * cell + 0.5);
      ctx.lineTo(cols * cell, y * cell + 0.5);
    }
    ctx.stroke();
  }

  ctx.fillStyle = COLORS.cell;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!cells[y * cols + x]) continue;
      ctx.fillRect(x * cell, y * cell, cell - gap, cell - gap);
    }
  }

  // 图章工具时给鼠标位置一个淡淡的落点预览
  if (state.tool === 'stamp' && state.pattern && state.hover) {
    const b = bounds(state.pattern);
    const ox = state.hover.x - Math.floor(b.w / 2);
    const oy = state.hover.y - Math.floor(b.h / 2);
    ctx.fillStyle = 'rgba(55, 90, 69, 0.28)';
    for (const [x, y] of b.cells) {
      const px = ox + x;
      const py = oy + y;
      if (px < 0 || py < 0 || px >= cols || py >= rows) continue;
      ctx.fillRect(px * cell, py * cell, cell - gap, cell - gap);
    }
  }
}

/* ---------------- 演化 ---------------- */

let rafId = 0;
let lastStep = 0;

function loop(ts) {
  if (!state.running) return;
  const interval = 1000 / state.speed.gps;
  if (!lastStep) lastStep = ts;
  if (ts - lastStep >= interval) {
    // 一帧里最多补 4 代，切后台再回来不至于一次跳几百代
    let steps = 0;
    while (ts - lastStep >= interval && steps < 4) {
      advance();
      lastStep += interval;
      steps++;
    }
    if (steps === 4) lastStep = ts;
  }
  rafId = requestAnimationFrame(loop);
}

function advance() {
  const r = step(state.grid, state.wrap);
  state.grid = r.grid;
  state.gen++;
  const pop = r.population;
  if (pop > state.peak) state.peak = pop;
  updateStats(pop, r.changed);
  draw();
  if (pop === 0 && state.running) {
    pause();
    status('棋盘空了 —— 点「随机」或选个图章接着玩。');
  }
}

function play() {
  if (state.running) return;
  if (population(state.grid.cells) === 0) {
    status('先画几个细胞，或者点「随机」。');
    return;
  }
  state.running = true;
  lastStep = 0;
  els.play.textContent = '⏸ 暂停';
  els.play.setAttribute('aria-pressed', 'true');
  rafId = requestAnimationFrame(loop);
}

function pause() {
  state.running = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
  els.play.textContent = '▶ 开始';
  els.play.setAttribute('aria-pressed', 'false');
}

function togglePlay() {
  if (state.running) pause();
  else play();
}

/* ---------------- 统计与提示 ---------------- */

function updateStats(pop, changed) {
  const live = pop === undefined ? population(state.grid.cells) : pop;
  const total = state.grid.cols * state.grid.rows;
  els.gen.textContent = state.gen;
  els.alive.textContent = live;
  els.density.textContent = `${((live / total) * 100).toFixed(1)}%`;
  if (changed === 0 && state.running && live > 0) {
    if (!state.quiet) {
      state.quiet = true;
      status('已经不再变化了：剩下的都是静物和振荡子 —— 换个图章或按 R 重来。');
    }
  } else if (changed) {
    state.quiet = false;
  }
}

let statusTimer = 0;
function status(text) {
  els.status.textContent = text;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { els.status.textContent = ''; }, 4000);
}

/* ---------------- 鼠标 / 触摸 ---------------- */

function cellAt(event) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((event.clientX - rect.left) / state.cell);
  const y = Math.floor((event.clientY - rect.top) / state.cell);
  if (x < 0 || y < 0 || x >= state.grid.cols || y >= state.grid.rows) return null;
  return { x, y };
}

let painting = false;

function applyAt(pos) {
  if (!pos) return;
  if (state.tool === 'stamp' && state.pattern) {
    stamp(state.grid.cells, state.grid.cols, state.grid.rows, state.pattern, pos.x, pos.y, state.wrap);
    state.peak = Math.max(state.peak, population(state.grid.cells));
  } else {
    toggleCell(state.grid.cells, state.grid.cols, state.grid.rows, pos.x, pos.y, state.tool === 'erase' ? 0 : 1);
  }
  updateStats();
  draw();
}

canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 && event.pointerType === 'mouse') return;
  if (state.running) pause();          // 动到手就先把演化停下，免得刚画的被吃掉
  canvas.setPointerCapture(event.pointerId);
  painting = true;
  applyAt(cellAt(event));
  event.preventDefault();
});

canvas.addEventListener('pointermove', (event) => {
  const pos = cellAt(event);
  const moved = pos && (!state.hover || pos.x !== state.hover.x || pos.y !== state.hover.y);
  state.hover = pos;
  if (painting && state.tool !== 'stamp') {
    applyAt(pos);
  } else if (moved && state.tool === 'stamp') {
    draw();                             // 刷新图章预览
  }
});

const endPaint = (event) => {
  painting = false;
  if (event && event.pointerId !== undefined && canvas.hasPointerCapture?.(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
};
canvas.addEventListener('pointerup', endPaint);
canvas.addEventListener('pointercancel', endPaint);
canvas.addEventListener('pointerleave', () => {
  state.hover = null;
  if (state.tool === 'stamp') draw();
});

/* ---------------- 按钮与快捷键 ---------------- */

els.play.addEventListener('click', togglePlay);
els.stepBtn.addEventListener('click', () => {
  pause();
  advance();
});
els.clearBtn.addEventListener('click', () => {
  pause();
  reset(false);
  draw();
  status('清空。');
});
els.randomBtn.addEventListener('click', () => {
  reset(true);
  draw();
  status('随机铺了一版，点「开始」看它演化。');
});
els.draw.addEventListener('click', () => useTool('draw'));
els.erase.addEventListener('click', () => useTool('erase'));

document.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
  const key = event.key;
  if (key === ' ' || key === 'Spacebar') {
    togglePlay();
    event.preventDefault();
  } else if (key === 'ArrowRight' || key === 'n' || key === 'N') {
    pause();
    advance();
    event.preventDefault();
  } else if (key === 'c' || key === 'C') {
    pause();
    reset(false);
    draw();
  } else if (key === 'r' || key === 'R') {
    reset(true);
    draw();
  } else if (key === 'Escape') {
    useTool('draw');
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
});

window.addEventListener('resize', () => {
  clearTimeout(resize.timer);
  resize.timer = setTimeout(() => resize(false), 200);
});

/* ---------------- 启动 ---------------- */

load();
buildControls();
buildPalette();
useTool('draw');
resize(true);
pause();
status('点棋盘画细胞，或者从下面挑一个图案盖上去；空格开始/暂停。');