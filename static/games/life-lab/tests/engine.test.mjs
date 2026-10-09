// 只用 node:test / node:assert，不依赖浏览器、时钟或网络：
//   node --test static/games/life/tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PATTERNS, VIEWS, SPEEDS, parsePattern, createGrid, population, step,
  randomFill, stamp, toggleCell, bounds
} from '../engine.mjs';

const byEn = (en) => PATTERNS.find((p) => p.en === en);
const state = (grid) => grid.cells.join('');

// 把图案放在一块足够大的空地中央演化，返回 { grid, pop(), period }
function isolate(en, cols = 80, rows = 80, wrap = true) {
  const pattern = parsePattern(byEn(en));
  const grid = createGrid(cols, rows);
  stamp(grid.cells, cols, rows, pattern, Math.floor(cols / 2), Math.floor(rows / 2));
  return grid;
}
function period(en, maxGen = 60) {
  let grid = isolate(en);
  const seen = new Map();
  seen.set(state(grid), 0);
  for (let gen = 1; gen <= maxGen; gen++) {
    grid = step(grid).grid;
    const s = state(grid);
    if (seen.has(s)) return { period: gen - seen.get(s), grid };
    seen.set(s, gen);
  }
  return { period: 0, grid };
}
function lifespan(en, maxGen = 400) {
  let grid = isolate(en, 120, 120, false);
  for (let gen = 1; gen <= maxGen; gen++) {
    grid = step(grid, false).grid;
    if (population(grid.cells) === 0) return gen;
  }
  return -1;
}

test('预设图案清单齐全，每份都能解析出正确的细胞数', () => {
  const expected = {
    glider: 5, block: 4, blinker: 3, toad: 6, beacon: 8, pulsar: 48,
    pentadecathlon: 12, 'pi-heptomino': 7, acorn: 7, 'r-pentomino': 5,
    diehard: 7, 'gosper-glider-gun': 36
  };
  for (const [en, n] of Object.entries(expected)) {
    const p = byEn(en);
    assert.ok(p, `缺少图案 ${en}`);
    assert.equal(parsePattern(p).cells.length, n, `${en} 细胞数不对`);
  }
  assert.equal(PATTERNS.length, Object.keys(expected).length);
});

test('三档以上视图大小、四档速度', () => {
  assert.ok(VIEWS.length >= 3);
  for (const v of VIEWS) assert.ok(v.cols > 0 && v.rows > 0, `${v.key} 尺寸非法`);
  assert.equal(new Set(VIEWS.map((v) => `${v.cols}x${v.rows}`)).size, VIEWS.length);
  assert.equal(SPEEDS.length, 4);
  const gps = SPEEDS.map((s) => s.gps);
  assert.deepEqual(gps, [...gps].sort((a, b) => a - b), '速度应当递增');
});

test('静物永远不变', () => {
  const p = period('block', 10);
  assert.equal(p.period, 1);
  assert.equal(population(p.grid.cells), 4);
});

test('闪烁灯 / 蟾蜍 / 信标周期 2，脉冲星周期 3，十五周期振荡器周期 15', () => {
  assert.equal(period('blinker').period, 2);
  assert.equal(period('toad').period, 2);
  assert.equal(period('beacon').period, 2);
  assert.equal(period('pulsar').period, 3);
  assert.equal(period('pentadecathlon').period, 15);
});

test('滑翔机每 4 代斜着走一格，细胞数不变', () => {
  let grid = isolate('glider', 60, 60, false);
  const before = bounds({ ascii: [] , cells: [] });
  void before;
  const cellsOf = (g) => {
    const out = [];
    for (let y = 0; y < g.rows; y++) for (let x = 0; x < g.cols; x++) if (g.cells[y * g.cols + x]) out.push([x, y]);
    return out;
  };
  const box = (g) => {
    const cs = cellsOf(g);
    return [Math.min(...cs.map((c) => c[0])), Math.min(...cs.map((c) => c[1]))];
  };
  const [x0, y0] = box(grid);
  for (let i = 0; i < 4; i++) grid = step(grid, false).grid;
  assert.equal(population(grid.cells), 5);
  const [x1, y1] = box(grid);
  assert.equal(x1 - x0, 1, '横向应当走一格');
  assert.equal(y1 - y0, 1, '纵向应当走一格');
});

test('顽固者第 130 代灭绝', () => {
  assert.equal(lifespan('diehard'), 130);
});

test('长寿图案 100 代之后还在折腾', () => {
  for (const en of ['pi-heptomino', 'acorn', 'r-pentomino']) {
    let grid = isolate(en);
    const first = state(grid);
    for (let i = 0; i < 100; i++) grid = step(grid).grid;
    assert.notEqual(state(grid), first, `${en} 不该 100 代就静止`);
    assert.ok(population(grid.cells) > 10, `${en} 应该已经炸开`);
  }
});

test('滑翔机枪会持续增产', () => {
  let grid = isolate('gosper-glider-gun', 200, 200, false);
  const start = population(grid.cells);
  for (let i = 0; i < 120; i++) grid = step(grid, false).grid;
  assert.equal(start, 36);
  assert.ok(population(grid.cells) > start, '枪口应当不断吐出新细胞');
});

test('演化返回值给出存活数与变化数', () => {
  const grid = createGrid(10, 10);
  stamp(grid.cells, 10, 10, byEn('blinker'), 5, 5);
  const r = step(grid);
  assert.equal(r.population, population(r.grid.cells));
  assert.equal(r.changed, 4, '横着的闪烁灯变竖：2 个死去 + 2 个新生，中间那格不动');
  assert.equal(r.grid.cells.length, 100);
});

test('边界：环面会把对面接起来，死边界则不然', () => {
  // 横向排三个细胞，一个贴着左边界：环面下它会从右边借到邻居
  const wrapGrid = createGrid(8, 8);
  toggleCell(wrapGrid.cells, 8, 8, 0, 3, 1);
  toggleCell(wrapGrid.cells, 8, 8, 7, 3, 1);
  toggleCell(wrapGrid.cells, 8, 8, 1, 3, 1);
  const wrapped = step(wrapGrid, true).grid;
  // (0,3) 在环面下有 (7,3)(1,3) 两个邻居 → 存活
  assert.equal(wrapped.cells[3 * 8 + 0], 1, '环面下贴边的细胞应当活下来');

  const deadGrid = createGrid(8, 8);
  toggleCell(deadGrid.cells, 8, 8, 0, 3, 1);
  toggleCell(deadGrid.cells, 8, 8, 1, 3, 1);
  const dead = step(deadGrid, false).grid;
  const live = [...dead.cells].filter(Boolean).length;
  assert.ok(live <= 2, '死边界下边缘细胞不该凭空变多');
});

test('随机填充：密度可控且可复现', () => {
  let n = 0;
  const rng = () => ((n++ * 37) % 100) / 100;
  const g = randomFill(50, 50, 0.3, rng);
  assert.equal(g.cells.length, 2500);
  const ratio = population(g.cells) / 2500;
  assert.ok(ratio > 0.2 && ratio < 0.4, `密度应在 0.3 附近，实际 ${ratio}`);
  const g2 = randomFill(50, 50, 0.3, () => 0.5);
  assert.equal(population(g2.cells), 0, 'rng 全给 0.5 时不该有细胞');
});

test('图案落子：居中放置、贴边裁掉、环面时绕回', () => {
  const glider = byEn('glider');
  const g1 = createGrid(20, 20);
  assert.equal(stamp(g1.cells, 20, 20, glider, 10, 10), 5);
  assert.equal(population(g1.cells), 5);
  // 紧贴左上角：wrap=false 只放下能放的部分
  const g2 = createGrid(20, 20);
  const placed = stamp(g2.cells, 20, 20, glider, 0, 0, false);
  assert.ok(placed < 5 && placed > 0, `贴边应当被裁掉一部分，实际 ${placed}`);
  // wrap=true 时全部放下
  const g3 = createGrid(20, 20);
  assert.equal(stamp(g3.cells, 20, 20, glider, 0, 0, true), 5);
  assert.equal(population(g3.cells), 5);
});

test('单格取反与越界保护', () => {
  const g = createGrid(5, 5);
  assert.equal(toggleCell(g.cells, 5, 5, 2, 2), true);
  assert.equal(g.cells[2 * 5 + 2], 1);
  assert.equal(toggleCell(g.cells, 5, 5, 2, 2), true);
  assert.equal(g.cells[2 * 5 + 2], 0);
  toggleCell(g.cells, 5, 5, 1, 1, 1);
  assert.equal(g.cells[1 * 5 + 1], 1);
  assert.equal(toggleCell(g.cells, 5, 5, -1, 0), false);
  assert.equal(toggleCell(g.cells, 5, 5, 5, 0), false);
});

test('bounds 会把图案的空白裁掉（缩略图要用）', () => {
  const b = bounds(byEn('glider'));
  assert.equal(b.w, 3);
  assert.equal(b.h, 3);
  assert.equal(b.cells.length, 5);
  const acorn = bounds(byEn('acorn'));
  assert.equal(acorn.w, 7);
  assert.equal(acorn.h, 3);
});