/*!
 * life-bg.js —— 首页背景：康威生命游戏 (Conway's Game of Life)
 *
 * 行为：
 *   1. 每次刷新页面都会重新随机挑选一种预设图案作为初始状态；
 *   2. 之后以固定节奏（约 16 代/秒）在环形网格上演化，纯黑底 + 纯白像素点，
 *      没有任何中间色；网格按屏幕分辨率自适应，桌面端约 320×180 个像素点；
 *   3. 右下角按钮可一键切回原有纯白背景，选择记在 localStorage 里。
 *
 * 无第三方依赖；在文件末尾暴露 window.__catrixLife 方便调试。
 */
(function (global) {
  'use strict';

  var doc = global.document;
  if (!doc) { return; }

  var canvas = doc.getElementById('life-canvas');
  if (!canvas || !canvas.getContext) { return; }
  var ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) { return; }

  var toggle = doc.getElementById('bg-toggle');
  var ROOT = doc.documentElement;
  var STORAGE_KEY = 'catrix-bg';
  var MODE_LIFE = 'life';
  var MODE_WHITE = 'white';

  /* ------------------------------------------------------------------ *
   * 只有黑白两色：先把网格写进 cols×rows 的 ImageData，再用最近邻放大到整屏，
   * 所以每个细胞就是一个边缘锐利的纯白/纯黑像素块，不做任何混色。
   * ------------------------------------------------------------------ */
  var LITTLE_ENDIAN = (function () {
    var buf = new ArrayBuffer(4);
    new Uint32Array(buf)[0] = 1;
    return new Uint8Array(buf)[0] === 1;
  })();
  var PX_WHITE = 0xffffffff;
  var PX_BLACK = LITTLE_ENDIAN ? 0xff000000 : 0x000000ff;

  var off = null;          // 网格分辨率的离屏画布
  var offCtx = null;
  var imgData = null;
  var pixels = null;       // imgData 的 32 位视图

  /* ------------------------------------------------------------------ *
   * 预设图案：'O' 表示活细胞。weight 越大越容易被随机选中；
   * fill 是图案块希望占屏幕宽度的比例，maxCols / maxRows 是硬上限。
   * ------------------------------------------------------------------ */
  var PATTERNS = [
    {
      name: 'gosper-glider-gun',
      weight: 3,
      fill: 0.5, maxCols: 3, maxRows: 1,
      ascii: [
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
    },
    {
      name: 'pulsar',
      weight: 3,
      fill: 0.45, maxCols: 8, maxRows: 2,
      ascii: [
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
    {
      name: 'pentadecathlon',
      weight: 3,
      fill: 0.5, maxCols: 10, maxRows: 3,
      ascii: [
        '..O....O..',
        'OO.OOOO.OO',
        '..O....O..'
      ]
    },
    {
      name: 'pi-heptomino',
      weight: 3,
      fill: 0.5, maxCols: 16, maxRows: 3,
      ascii: [
        'OOO',
        'O.O',
        'O.O'
      ]
    },
    {
      name: 'acorn',
      weight: 3,
      fill: 0.5, maxCols: 12, maxRows: 3,
      ascii: [
        '.O.....',
        '...O...',
        'OO..OOO'
      ]
    },
    {
      name: 'r-pentomino',
      weight: 3,
      fill: 0.5, maxCols: 16, maxRows: 3,
      ascii: [
        '.OO',
        'OO.',
        '.O.'
      ]
    },
    {
      name: 'diehard',
      weight: 1,
      fill: 0.5, maxCols: 12, maxRows: 3,
      ascii: [
        '......O.',
        'OO......',
        '.O...OOO'
      ]
    },
    { name: 'random-soup', kind: 'soup', weight: 4, density: 0.22 },
    { name: 'mirror-soup', kind: 'mirror-soup', weight: 3, density: 0.28 },
    { name: 'glider-fleet', kind: 'gliders', weight: 3 }
  ];

  /* 滑翔机的四个朝向 */
  var GLIDERS = {
    dr: ['.O.', '..O', 'OOO'],
    dl: ['.O.', 'O..', 'OOO'],
    ur: ['OOO', '..O', '.O.'],
    ul: ['OOO', 'O..', '.O.']
  };

  /* ------------------------------------------------------------------ *
   * 网格状态
   * ------------------------------------------------------------------ */
  var STEP_MS = 60;                 // 每代间隔（约 16 代/秒）
  var cell = 6, cols = 0, rows = 0, viewW = 0, viewH = 0;
  var cur = null, buf = null;
  var pop = 0, changed = 0, still = 0;
  var running = false, rafId = 0, lastStep = 0, lastPick = null;
  var resizeTimer = 0;

  /* ------------------------------------------------------------------ *
   * 工具
   * ------------------------------------------------------------------ */
  /* 让不同分辨率下屏幕上大约都有 5~6 万个像素点：
     1920×1080 → cell 6（320×180），4K → cell 12（320×180），手机 → cell 3。 */
  function computeCellSize(w, h) {
    var s = Math.round(Math.sqrt(w * h) / 245);
    if (s < 3) { s = 3; }
    if (s > 14) { s = 14; }
    return s;
  }

  function readMode() {
    try {
      var v = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
      return v === MODE_WHITE ? MODE_WHITE : MODE_LIFE;
    } catch (e) {
      return MODE_LIFE;
    }
  }

  function saveMode(mode) {
    try {
      if (global.localStorage) { global.localStorage.setItem(STORAGE_KEY, mode); }
    } catch (e) { /* 隐私模式下忽略 */ }
  }

  function parsePattern(p) {
    if (p._cells) { return p; }
    var cells = [], w = 0, h = p.ascii.length;
    for (var y = 0; y < h; y++) {
      var row = p.ascii[y];
      if (row.length > w) { w = row.length; }
      for (var x = 0; x < row.length; x++) {
        if (row.charAt(x) === 'O') { cells.push([x, y]); }
      }
    }
    p._cells = cells;
    p.w = w;
    p.h = h;
    return p;
  }

  function pickPattern() {
    var total = 0, i, p;
    for (i = 0; i < PATTERNS.length; i++) { total += PATTERNS[i].weight || 1; }
    for (var attempt = 0; attempt < 2; attempt++) {
      var r = Math.random() * total;
      for (i = 0; i < PATTERNS.length; i++) {
        r -= (PATTERNS[i].weight || 1);
        if (r <= 0) { p = PATTERNS[i]; break; }
      }
      if (p && (p !== lastPick || PATTERNS.length < 2)) { break; }
      p = null;
    }
    if (!p) {
      p = PATTERNS[Math.floor(Math.random() * PATTERNS.length)];
    }
    lastPick = p;
    return p;
  }

  /* ------------------------------------------------------------------ *
   * 播种
   * ------------------------------------------------------------------ */
  function putGlider(ox, oy, dir) {
    var shape = GLIDERS[dir] || GLIDERS.dr;
    for (var y = 0; y < shape.length; y++) {
      for (var x = 0; x < shape[y].length; x++) {
        if (shape[y].charAt(x) !== 'O') { continue; }
        var gx = (ox + x) % cols; if (gx < 0) { gx += cols; }
        var gy = (oy + y) % rows; if (gy < 0) { gy += rows; }
        cur[gy * cols + gx] = 1;
      }
    }
  }

  function drawPattern(p, ox, oy, flipX, flipY) {
    parsePattern(p);
    for (var i = 0; i < p._cells.length; i++) {
      var cx = p._cells[i][0], cy = p._cells[i][1];
      if (flipX) { cx = p.w - 1 - cx; }
      if (flipY) { cy = p.h - 1 - cy; }
      var x = (ox + cx) % cols; if (x < 0) { x += cols; }
      var y = (oy + cy) % rows; if (y < 0) { y += rows; }
      cur[y * cols + x] = 1;
    }
  }

  function fillSoup(x0, y0, w, h, density) {
    for (var y = y0; y < y0 + h; y++) {
      if (y < 0 || y >= rows) { continue; }
      for (var x = x0; x < x0 + w; x++) {
        if (x < 0 || x >= cols) { continue; }
        if (Math.random() < density) { cur[y * cols + x] = 1; }
      }
    }
  }

  /* 四象限镜像的“对称汤”，比随机汤更耐看也更长寿 */
  function fillMirrorSoup(density) {
    var hw = Math.ceil(cols / 2), hh = Math.ceil(rows / 2);
    for (var y = 0; y < hh; y++) {
      for (var x = 0; x < hw; x++) {
        if (Math.random() >= density) { continue; }
        var xs = [x, cols - 1 - x], ys = [y, rows - 1 - y];
        for (var a = 0; a < 2; a++) {
          for (var b = 0; b < 2; b++) {
            cur[ys[b] * cols + xs[a]] = 1;
          }
        }
      }
    }
  }

  /* 一队朝同一方向行军的滑翔机 + 少量随机朝向，靠碰撞不断产生新结构 */
  function seedGliders() {
    var step = Math.max(9, Math.round(cols / 14));
    var margin = 3, dir = 'dr';
    var nx = Math.max(1, Math.floor((cols - margin * 2) / step));
    var ny = Math.max(1, Math.floor((rows - margin * 2) / step));
    var x, y;
    for (y = 0; y < ny; y++) {
      for (x = 0; x < nx; x++) {
        putGlider(margin + x * step, margin + y * step, dir);
      }
    }
    var extra = Math.min(14, Math.round((cols * rows) / 12000));
    for (var i = 0; i < extra; i++) {
      putGlider(
        Math.floor(Math.random() * cols),
        Math.floor(Math.random() * rows),
        ['dr', 'dl', 'ur', 'ul'][Math.floor(Math.random() * 4)]
      );
    }
  }

  function scatterPattern(p) {
    parsePattern(p);
    var gapX = Math.max(4, Math.round(cols * 0.04));
    var gapY = Math.max(4, Math.round(rows * 0.1));
    /* 按“图案块占屏幕宽度的比例”决定铺几份，换分辨率时观感一致 */
    var wantX = Math.floor((cols * (p.fill || 0.45) + gapX) / (p.w + gapX));
    var fitsX = Math.max(1, Math.floor((cols + gapX) / (p.w + gapX)));
    var fitsY = Math.max(1, Math.floor((rows + gapY) / (p.h + gapY)));
    var nx = Math.max(1, Math.min(p.maxCols || 1, wantX, fitsX));
    var ny = Math.min(p.maxRows || 1, fitsY);
    var blockW = nx * p.w + (nx - 1) * gapX;
    var blockH = ny * p.h + (ny - 1) * gapY;
    var ox = Math.floor((cols - blockW) / 2) + Math.round((Math.random() - 0.5) * 4);
    var oy = Math.floor((rows - blockH) / 2) + Math.round((Math.random() - 0.5) * 4);
    for (var r = 0; r < ny; r++) {
      for (var c = 0; c < nx; c++) {
        drawPattern(
          p,
          ox + c * (p.w + gapX),
          oy + r * (p.h + gapY),
          (r + c) % 2 === 1,
          false
        );
      }
    }
  }

  function seed() {
    var n = cols * rows, i;
    for (i = 0; i < n; i++) { cur[i] = 0; buf[i] = 0; }

    var p = pickPattern();
    if (p.kind === 'soup') {
      fillSoup(0, 0, cols, rows, p.density);
    } else if (p.kind === 'mirror-soup') {
      fillMirrorSoup(p.density);
    } else if (p.kind === 'gliders') {
      seedGliders();
    } else {
      scatterPattern(p);
    }
    if (ROOT.setAttribute) { ROOT.setAttribute('data-life-preset', p.name); }
    countPopulation();
    return p.name;
  }

  function seedPreset(name) {
    for (var i = 0; i < PATTERNS.length; i++) {
      if (PATTERNS[i].name === name) {
        var n = cols * rows;
        for (var k = 0; k < n; k++) { cur[k] = 0; buf[k] = 0; }
        var p = PATTERNS[i];
        if (p.kind === 'soup') { fillSoup(0, 0, cols, rows, p.density); }
        else if (p.kind === 'mirror-soup') { fillMirrorSoup(p.density); }
        else if (p.kind === 'gliders') { seedGliders(); }
        else { scatterPattern(p); }
        countPopulation();
        return true;
      }
    }
    return false;
  }

  function injectSoup() {
    var w = Math.min(cols, Math.max(12, Math.round(cols * 0.25)));
    var h = Math.min(rows, Math.max(10, Math.round(rows * 0.28)));
    fillSoup(
      Math.floor(Math.random() * Math.max(1, cols - w + 1)),
      Math.floor(Math.random() * Math.max(1, rows - h + 1)),
      w, h, 0.34
    );
  }

  function countPopulation() {
    pop = 0;
    for (var i = 0; i < cur.length; i++) { if (cur[i]) { pop++; } }
    return pop;
  }

  /* ------------------------------------------------------------------ *
   * 演化 + 绘制
   * ------------------------------------------------------------------ */
  function stepOnce() {
    pop = 0;
    changed = 0;
    for (var y = 0; y < rows; y++) {
      var yUp = ((y + rows - 1) % rows) * cols;
      var yDn = ((y + 1) % rows) * cols;
      var yMid = y * cols;
      for (var x = 0; x < cols; x++) {
        var xL = (x + cols - 1) % cols;
        var xR = (x + 1) % cols;
        var nb = cur[yUp + xL] + cur[yUp + x] + cur[yUp + xR] +
                 cur[yMid + xL] + cur[yMid + xR] +
                 cur[yDn + xL] + cur[yDn + x] + cur[yDn + xR];
        var i = yMid + x;
        var alive = cur[i];
        var live = alive ? (nb === 2 || nb === 3) : (nb === 3);
        if (live) {
          buf[i] = 1;
          pop++;
          if (!alive) { changed++; }
        } else {
          buf[i] = 0;
          if (alive) { changed++; }
        }
      }
    }
    var t = cur; cur = buf; buf = t;
    return pop;
  }

  /* 把网格写进 cols×rows 的位图，再整块最近邻放大铺满屏幕：
     一次 drawImage 搞定，且每个细胞都是纯白或纯黑的正方块。 */
  function render() {
    if (!cur || !pixels) { return; }
    var n = cols * rows;
    for (var i = 0; i < n; i++) {
      pixels[i] = cur[i] ? PX_WHITE : PX_BLACK;
    }
    offCtx.putImageData(imgData, 0, 0);
    ctx.drawImage(off, 0, 0, cols, rows, 0, 0, cols * cell, rows * cell);
  }

  function frame(ts) {
    if (!running) { return; }
    if (!lastStep) { lastStep = ts; }
    if (ts - lastStep < STEP_MS) {
      rafId = global.requestAnimationFrame(frame);
      return;
    }
    lastStep = ts;
    stepOnce();
    render();

    if (pop === 0) {
      seed();
      render();
    } else if (changed === 0) {
      still++;
      if (still > 2) { injectSoup(); still = 0; }
    } else {
      still = 0;
    }
    rafId = global.requestAnimationFrame(frame);
  }

  function start() {
    if (running) { return; }
    running = true;
    lastStep = 0;
    if (global.requestAnimationFrame) {
      rafId = global.requestAnimationFrame(frame);
    }
  }

  function stop() {
    running = false;
    if (rafId && global.cancelAnimationFrame) { global.cancelAnimationFrame(rafId); }
    rafId = 0;
  }

  /* ------------------------------------------------------------------ *
   * 尺寸与模式
   * ------------------------------------------------------------------ */
  function resize() {
    var w = global.innerWidth || 1024;
    var h = global.innerHeight || 768;
    var dpr = Math.min(global.devicePixelRatio || 1, 2);

    cell = computeCellSize(w, h);
    viewW = w;
    viewH = h;
    /* 用 floor 保证放大倍率是整数，像素块大小完全均匀（右侧/底部残留的窄条本来就是黑的） */
    cols = Math.max(1, Math.floor(w / cell));
    rows = Math.max(1, Math.floor(h / cell));
    var n = cols * rows;
    STEP_MS = n > 90000 ? 80 : (n > 30000 ? 60 : 70);

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    if (ctx.setTransform) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    ctx.imageSmoothingEnabled = false;
    if ('webkitImageSmoothingEnabled' in ctx) { ctx.webkitImageSmoothingEnabled = false; }
    if ('mozImageSmoothingEnabled' in ctx) { ctx.mozImageSmoothingEnabled = false; }
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, viewW, viewH);

    /* 网格分辨率的离屏位图 */
    if (!off) {
      off = doc.createElement('canvas');
      offCtx = off.getContext('2d');
    }
    off.width = cols;
    off.height = rows;
    imgData = offCtx.createImageData(cols, rows);
    pixels = new Uint32Array(imgData.data.buffer);

    cur = new Uint8Array(n);
    buf = new Uint8Array(n);
    seed();
  }

  function updateToggle(life) {
    if (!toggle) { return; }
    var text = toggle.querySelector ? toggle.querySelector('.bg-toggle-text') : null;
    var label = life ? '纯白背景' : '生命游戏';
    if (text) { text.textContent = label; } else { toggle.textContent = label; }
    var tip = life ? '切换回主页原有的纯白背景' : '切换为康威生命游戏背景';
    toggle.setAttribute('title', tip);
    toggle.setAttribute('aria-label', tip);
    toggle.setAttribute('aria-pressed', life ? 'true' : 'false');
    toggle.setAttribute('data-mode', life ? MODE_LIFE : MODE_WHITE);
  }

  function applyMode(mode, opts) {
    opts = opts || {};
    var life = mode === MODE_LIFE;
    if (life) {
      ROOT.classList.add('life-mode');
      if (!cur) {
        resize();                       // 首次：建网格 + 随机播种
      } else if (opts.reseed) {
        seed();
      }
      render();
      start();
    } else {
      ROOT.classList.remove('life-mode');
      stop();
    }
    updateToggle(life);
    if (opts.persist) { saveMode(mode); }
  }

  function onResize() {
    if (resizeTimer) { global.clearTimeout(resizeTimer); }
    resizeTimer = global.setTimeout(function () {
      resizeTimer = 0;
      if (!running) { return; }
      resize();
      render();
    }, 200);
  }

  /* ------------------------------------------------------------------ *
   * 启动
   * ------------------------------------------------------------------ */
  if (toggle) {
    toggle.addEventListener('click', function () {
      var life = ROOT.classList.contains('life-mode');
      applyMode(life ? MODE_WHITE : MODE_LIFE, { persist: true, reseed: true });
    });
  }

  global.addEventListener('resize', onResize);
  doc.addEventListener('visibilitychange', function () {
    if (doc.hidden) {
      stop();
    } else if (ROOT.classList.contains('life-mode')) {
      lastStep = 0;
      start();
    }
  });

  applyMode(readMode(), { reseed: true });

  /* 调试接口：控制台里 __catrixLife.seedPreset('pulsar') 之类可以用 */
  global.__catrixLife = {
    version: '1.0.0',
    patterns: (function () {
      var a = [];
      for (var i = 0; i < PATTERNS.length; i++) { a.push(PATTERNS[i].name); }
      return a;
    })(),
    colors: { dead: '#000000', alive: '#ffffff' },
    parse: parsePattern,
    seed: seed,
    seedPreset: seedPreset,
    step: stepOnce,
    render: render,
    setMode: function (m) { applyMode(m === MODE_WHITE ? MODE_WHITE : MODE_LIFE, { reseed: true, persist: true }); },
    stats: function () {
      return { cols: cols, rows: rows, cell: cell, stepMs: STEP_MS, pop: pop, changed: changed, running: running };
    },
    debug: {
      resize: resize,
      getCells: function () {
        var out = new Array(cols * rows);
        for (var i = 0; i < out.length; i++) { out[i] = cur[i]; }
        return out;
      },
      setCells: function (arr) {
        for (var i = 0; i < cur.length; i++) { cur[i] = arr[i] ? 1 : 0; }
        countPopulation();
        return pop;
      },
      place: function (name, ox, oy, flipX) {
        for (var i = 0; i < PATTERNS.length; i++) {
          if (PATTERNS[i].name === name) {
            drawPattern(PATTERNS[i], ox, oy, !!flipX, false);
            countPopulation();
            return pop;
          }
        }
        return -1;
      },
      clear: function () {
        for (var i = 0; i < cur.length; i++) { cur[i] = 0; buf[i] = 0; }
        pop = 0;
      }
    }
  };
})(typeof window !== 'undefined' ? window : this);
