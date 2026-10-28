// 康威生命游戏的纯逻辑：网格、演化、预设图案。不依赖 DOM，可用 node --test 直接跑。
// 规则 B3/S23：活细胞有 2~3 个活邻居则继续存活，死细胞恰好有 3 个活邻居则诞生。

export const VIEWS = [
  { key: 's', name: '小', cols: 40, rows: 30 },
  { key: 'm', name: '中', cols: 64, rows: 48 },
  { key: 'l', name: '大', cols: 96, rows: 72 },
  { key: 'xl', name: '特大', cols: 128, rows: 96 }
];

export const SPEEDS = [
  { key: 'slow', name: '慢', gps: 4 },
  { key: 'mid', name: '中', gps: 10 },
  { key: 'fast', name: '快', gps: 20 },
  { key: 'turbo', name: '极快', gps: 40 }
];

// 'O' 是活细胞。这里每一份都经过 tests/engine.test.mjs 校验（细胞数 / 周期 / 结局）。
export const PATTERNS = [
  { name: '滑翔机', en: 'glider', note: '每 4 代斜着走一格', ascii: ['.O.', '..O', 'OOO'] },
  { name: '方块', en: 'block', note: '最稳的静物', ascii: ['OO', 'OO'] },
  { name: '闪烁灯', en: 'blinker', note: '周期 2', ascii: ['OOO'] },
  { name: '蟾蜍', en: 'toad', note: '周期 2', ascii: ['.OOO', 'OOO.'] },
  { name: '信标', en: 'beacon', note: '周期 2', ascii: ['OO..', 'OO..', '..OO', '..OO'] },
  {
    name: '脉冲星', en: 'pulsar', note: '周期 3，48 个细胞', ascii: [
      '..OOO...OOO..',
      '.............',
      'O....O.O....O',
      'O....O.O....O',
      'O....O.O....O',
      '..OOO...OOO..',
      '.............',
      '..OOO...OOO..',
      'O....O.O....O',
      'O....O.O....O',
      'O....O.O....O',
      '.............',
      '..OOO...OOO..'
    ]
  },
  { name: '十五周期', en: 'pentadecathlon', note: '周期 15', ascii: ['..O....O..', 'OO.OOOO.OO', '..O....O..'] },
  { name: 'π 七连块', en: 'pi-heptomino', note: '长寿：一路炸到 173 代', ascii: ['OOO', 'O.O', 'O.O'] },
  { name: '橡果', en: 'acorn', note: '7 个细胞，折腾 5206 代', ascii: ['.O.....', '...O...', 'OO..OOO'] },
  { name: 'R 五连块', en: 'r-pentomino', note: '5 个细胞，1103 代才安分', ascii: ['.OO', 'OO.', '.O.'] },
  { name: '顽固者', en: 'diehard', note: '死撑 130 代后全灭', ascii: ['......O.', 'OO......', '.O...OOO'] },
  {
    name: '滑翔机枪', en: 'gosper-glider-gun', note: '每 30 代吐一架滑翔机', ascii: [
      '........................O...........',
      '......................O.O...........',
      '............OO......OO............OO',
      '...........O...O....OO............OO',
      'OO........O.....O...OO..............',
      'OO........O...O.OO....O.O...........',
      '..........O.....O.......O...........',
      '...........O...O....................',
      '............OO......................'
    ]
  }
];

export function parsePattern(pattern) {
  if (pattern.cells) return pattern;
  const cells = [];
  const h = pattern.ascii.length;
  let w = 0;
  for (let y = 0; y < h; y++) {
    const row = pattern.ascii[y];
    if (row.length > w) w = row.length;
    for (let x = 0; x < row.length; x++) {
      if (row[x] === 'O') cells.push([x, y]);
    }
  }
  pattern.cells = cells;
  pattern.w = w;
  pattern.h = h;
  return pattern;
}

export function createGrid(cols, rows) {
  return { cols, rows, cells: new Uint8Array(cols * rows) };
}

export function population(cells) {
  let n = 0;
  for (let i = 0; i < cells.length; i++) n += cells[i] ? 1 : 0;
  return n;
}

// 演化一代；wrap 为真时上下左右相接（滑翔机可以绕回来），否则出了边界就当死。
export function step(grid, wrap = true) {
  const cols = grid.cols;
  const rows = grid.rows;
  const cells = grid.cells;
  const next = new Uint8Array(cells.length);
  let changed = 0;
  let pop = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          let nx = x + dx;
          let ny = y + dy;
          if (wrap) {
            nx = (nx + cols) % cols;
            ny = (ny + rows) % rows;
          } else if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) {
            continue;
          }
          n += cells[ny * cols + nx];
        }
      }
      const i = y * cols + x;
      const alive = cells[i] ? 1 : 0;
      const live = alive ? (n === 2 || n === 3 ? 1 : 0) : (n === 3 ? 1 : 0);
      next[i] = live;
      pop += live;
      if (live !== alive) changed++;
    }
  }
  return { grid: { cols, rows, cells: next }, changed, population: pop };
}

export function randomFill(cols, rows, density = 0.28, rng = Math.random) {
  const cells = new Uint8Array(cols * rows);
  for (let i = 0; i < cells.length; i++) cells[i] = rng() < density ? 1 : 0;
  return { cols, rows, cells };
}

// 以 (cx, cy) 为中心盖一份图案；wrap 为假时超出边界的部分直接丢掉。
export function stamp(cells, cols, rows, pattern, cx, cy, wrap = false) {
  const p = parsePattern(pattern);
  const ox = cx - Math.floor(p.w / 2);
  const oy = cy - Math.floor(p.h / 2);
  let placed = 0;
  for (let k = 0; k < p.cells.length; k++) {
    let x = ox + p.cells[k][0];
    let y = oy + p.cells[k][1];
    if (wrap) {
      x = ((x % cols) + cols) % cols;
      y = ((y % rows) + rows) % rows;
    } else if (x < 0 || y < 0 || x >= cols || y >= rows) {
      continue;
    }
    cells[y * cols + x] = 1;
    placed++;
  }
  return placed;
}

// value 省略时是取反，给了就按值写。
export function toggleCell(cells, cols, rows, x, y, value) {
  if (x < 0 || y < 0 || x >= cols || y >= rows) return false;
  const i = y * cols + x;
  cells[i] = value === undefined ? (cells[i] ? 0 : 1) : (value ? 1 : 0);
  return true;
}

// 图案的紧包围盒，画缩略图时把空白裁掉。
export function bounds(pattern) {
  const p = parsePattern(pattern);
  if (!p.cells.length) return { w: 1, h: 1, cells: [] };
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  for (const [x, y] of p.cells) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return {
    w: x1 - x0 + 1,
    h: y1 - y0 + 1,
    cells: p.cells.map(([x, y]) => [x - x0, y - y0])
  };
}