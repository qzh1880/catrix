/*!
 * life-bg.js —— 首页背景：康威生命游戏 (Conway's Game of Life)
 *
 * 行为：
 *   1. 每次刷新页面都会重新随机挑选一种预设图案作为初始状态；
 *   2. 之后以固定节奏（约 16 代/秒）在环形网格上演化，纯黑底 + 纯白像素点，
 *      没有任何中间色；网格按屏幕分辨率自适应，桌面端约 320×180 个像素点；
 *   3. 规则 = 标准 B3/S23 + 一条「寿命上限」（见 MAX_AGE）：
 *      任何细胞连续存活超过 MAX_AGE 代就自然死亡。这一条专治生命游戏的老毛病——
 *      跑一阵子之后整片塌成静物（永久不动的方块/蜂巢）和原地抽搐的振荡子：
 *      它们的细胞是长期存活的，寿命一到就散架；而滑翔机、随机汤这类细胞寿命
 *      只有 1~3 代的动态结构基本不受影响；
 *   4. 活性过低（细胞太少 / 变化率太低）时自动补一块随机汤，画面永远不会死掉；
 *   5. 右下角按钮可一键切回原有纯白背景，选择记在 localStorage 里。
 *
 * 把 MAX_AGE 设成 0 就退回纯正的 B3/S23。
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
   * copies 是整屏大约播几份（最终会乘一个随机系数，位置/朝向全部随机，
   * 不做等距排布，免得看起来像壁纸）。
   * ------------------------------------------------------------------ */
  var PATTERNS = [
    {
      name: 'gosper-glider-gun',
      weight: 3,
      copies: 5,
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
      name: 'pi-heptomino',
      weight: 3,
      copies: 22,
      ascii: [
        'OOO',
        'O.O',
        'O.O'
      ]
    },
    {
      name: 'acorn',
      weight: 4,
      copies: 20,
      ascii: [
        '.O.....',
        '...O...',
        'OO..OOO'
      ]
    },
    {
      name: 'r-pentomino',
      weight: 4,
      copies: 24,
      ascii: [
        '.OO',
        'OO.',
        '.O.'
      ]
    },
    {
      name: 'diehard',
      weight: 1,
      copies: 20,
      ascii: [
        '......O.',
        'OO......',
        '.O...OOO'
      ]
    },
    { name: 'random-soup', kind: 'soup', weight: 4, density: 0.18 },
    { name: 'mirror-soup', kind: 'mirror-soup', weight: 2, density: 0.24 },
    { name: 'glider-swarm', kind: 'gliders', weight: 3 },
    { name: 'methuselah-mix', kind: 'mix', weight: 4 }
  ];

  /* 长寿种子库：混搭播撒用（都是经过验证的小图案，会各自炸开成一片混乱） */
  var MIX = ['pi-heptomino', 'r-pentomino', 'acorn', 'diehard'];

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
  var MAX_AGE = 18;                 // 细胞寿命上限（代）；0 = 关闭，退回纯 B3/S23
  var STEP_MS = 60;                 // 每代间隔（约 16 代/秒）
  var cell = 6, cols = 0, rows = 0, viewW = 0, viewH = 0;
  var cur = null, buf = null, age = null;
  var pop = 0, changed = 0, still = 0, stirs = 0, reseeds = 0;
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
   * 播种区域
   * 首页正文是一列 1020px 宽的玻璃面板，正中间从头到尾都被压住，
   * 所以初始状态只播在左右两条留白带里；窄屏实在避不开时退回整屏（只避开顶部导航）。
   * ------------------------------------------------------------------ */
  var CONTENT_W = 1020;      // 与主题 --container-width 一致
  var SAFE_TOP_PX = 76;      // 吸顶导航 64px + 余量
  var MIN_BAND = 6;          // 一侧留白少于 6 格就不再避让

  function bands() {
    var top = Math.max(0, Math.min(rows, Math.round(SAFE_TOP_PX / cell)));
    var left = Math.max(0, Math.min(cols, Math.round((viewW - CONTENT_W) / 2 / cell)));
    var right = Math.max(0, Math.min(cols, cols - Math.round((viewW + CONTENT_W) / 2 / cell)));
    if (left < MIN_BAND || right < MIN_BAND) {
      return [{ x0: 0, x1: cols, y0: top, y1: rows }];
    }
    return [
      { x0: 0, x1: left, y0: top, y1: rows },
      { x0: cols - right, x1: cols, y0: top, y1: rows }
    ];
  }

  /* 在留白带里按面积加权随机取一个左上角，保证 w×h 整个落在带内 */
  function pickSpot(zones, w, h) {
    var list = [], total = 0, i, b, aw, ah;
    for (i = 0; i < zones.length; i++) {
      b = zones[i];
      aw = b.x1 - b.x0 - w + 1;
      ah = b.y1 - b.y0 - h + 1;
      if (aw > 0 && ah > 0) { list.push({ b: b, aw: aw, ah: ah }); total += aw * ah; }
    }
    if (!list.length) { return null; }
    var r = Math.random() * total;
    for (i = 0; i < list.length; i++) {
      r -= list[i].aw * list[i].ah;
      if (r <= 0 || i === list.length - 1) {
        var z = list[i];
        return {
          x: z.b.x0 + Math.floor(Math.random() * z.aw),
          y: z.b.y0 + Math.floor(Math.random() * z.ah)
        };
      }
    }
    return null;
  }

  /* 两个矩形（含间距 gap）是否相交 */
  function overlaps(placed, x, y, w, h, gap) {
    for (var i = 0; i < placed.length; i++) {
      var r = placed[i];
      if (x - gap < r.x + r.w && r.x - gap < x + w &&
          y - gap < r.y + r.h && r.y - gap < y + h) {
        return true;
      }
    }
    return false;
  }

  function patternSize(p, rot) {
    parsePattern(p);
    return (rot % 2 === 0) ? { w: p.w, h: p.h } : { w: p.h, h: p.w };
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

  /* rot：顺时针 90° 的倍数；flip：左右镜像。合起来 8 种朝向 */
  function drawPattern(p, ox, oy, rot, flip) {
    parsePattern(p);
    var w = p.w, h = p.h;
    for (var i = 0; i < p._cells.length; i++) {
      var cx = p._cells[i][0], cy = p._cells[i][1];
      if (flip) { cx = w - 1 - cx; }
      var rx = cx, ry = cy;
      if (rot === 1) { rx = h - 1 - cy; ry = cx; }
      else if (rot === 2) { rx = w - 1 - cx; ry = h - 1 - cy; }
      else if (rot === 3) { rx = cy; ry = w - 1 - cx; }
      var x = (ox + rx) % cols; if (x < 0) { x += cols; }
      var y = (oy + ry) % rows; if (y < 0) { y += rows; }
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

  /* 左右镜像 + 上下镜像同时落子；镜像后仍必须落在允许的留白带内 */
  function inZones(zones, x, y) {
    for (var i = 0; i < zones.length; i++) {
      var b = zones[i];
      if (x >= b.x0 && x < b.x1 && y >= b.y0 && y < b.y1) { return true; }
    }
    return false;
  }

  function setMirrored(x, y, zones) {
    var xs = [x, cols - 1 - x], ys = [y, rows - 1 - y];
    for (var a = 0; a < 2; a++) {
      for (var b = 0; b < 2; b++) {
        var px = xs[a], py = ys[b];
        if (px < 0 || px >= cols || py < 0 || py >= rows) { continue; }
        if (!inZones(zones, px, py)) { continue; }
        cur[py * cols + px] = 1;
      }
    }
  }

  /* 随机汤：在留白带里铺均匀的混沌（不规整，但不会留下大片纯黑） */
  function fillSoupBands(density) {
    var zones = bands();
    for (var i = 0; i < zones.length; i++) {
      var b = zones[i];
      fillSoup(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0, density);
    }
  }

  /* 对称汤：只在基本域（左带的上半）铺，镜像到其余三块，密度才不会被翻倍 */
  function fillMirrorSoup(density) {
    var zones = bands();
    var z = zones[0];
    var xEnd = Math.min(z.x1, Math.ceil(cols / 2));
    var yEnd = Math.min(z.y1, Math.ceil(rows / 2));
    for (var y = z.y0; y < yEnd; y++) {
      for (var x = z.x0; x < xEnd; x++) {
        if (Math.random() >= density) { continue; }
        setMirrored(x, y, zones);
      }
    }
  }

  /* 随机散落的滑翔机群：位置、朝向都随机，互相撞出各种结构 */
  function seedGliders() {
    var zones = bands();
    var dirs = ['dr', 'dl', 'ur', 'ul'];
    var count = 30 + Math.floor(Math.random() * 16);
    var placed = [], done = 0, tries = 0;
    while (done < count && tries < count * 40) {
      tries++;
      var spot = pickSpot(zones, 3, 3);
      if (!spot) { break; }
      if (overlaps(placed, spot.x, spot.y, 3, 3, 5)) { continue; }
      putGlider(spot.x, spot.y, dirs[Math.floor(Math.random() * 4)]);
      placed.push({ x: spot.x, y: spot.y, w: 3, h: 3 });
      done++;
    }
  }

  /* 散落一份：随机取点、随机朝向、与已放置的保持间距；放成功返回 true */
  function scatterOne(p, zones, placed, gap) {
    parsePattern(p);
    var rot = Math.floor(Math.random() * 4);
    var flip = Math.random() < 0.5;
    var size = patternSize(p, rot);
    var spot = pickSpot(zones, size.w, size.h);
    if (!spot) { return false; }
    if (overlaps(placed, spot.x, spot.y, size.w, size.h, gap)) { return false; }
    drawPattern(p, spot.x, spot.y, rot, flip);
    placed.push({ x: spot.x, y: spot.y, w: size.w, h: size.h });
    return true;
  }

  function patternByName(name) {
    for (var i = 0; i < PATTERNS.length; i++) {
      if (PATTERNS[i].name === name && PATTERNS[i].ascii) { return PATTERNS[i]; }
    }
    return null;
  }

  /* 随机散落：份数带随机系数，位置按面积加权随机取，朝向 8 选 1，互不重叠 */
  function scatterPattern(p) {
    parsePattern(p);
    var zones = bands();
    var count = Math.max(1, Math.round((p.copies || 8) * (0.6 + Math.random() * 0.9)));
    var gap = Math.max(2, Math.round(Math.min(p.w, p.h) * 0.6));
    var placed = [], done = 0, tries = 0;
    while (done < count && tries < count * 40) {
      tries++;
      if (scatterOne(p, zones, placed, gap)) { done++; }
    }
    /* 极端窄屏下留白带塞不进这个图案：退化成整屏随便放一份，别留空网格 */
    if (done === 0) {
      var s0 = patternSize(p, 0);
      if (s0.w <= cols && s0.h <= rows) {
        drawPattern(
          p,
          Math.floor(Math.random() * (cols - s0.w + 1)),
          Math.max(1, Math.floor(Math.random() * (rows - s0.h))),
          0,
          Math.random() < 0.5
        );
      }
    }
  }

  /* 长寿种子混搭：每次随机挑一种，散落地播一批，谁炸成什么全看缘分 */
  function seedMix() {
    var zones = bands();
    var count = 22 + Math.floor(Math.random() * 14);
    var placed = [], done = 0, tries = 0;
    while (done < count && tries < count * 40) {
      tries++;
      var p = patternByName(MIX[Math.floor(Math.random() * MIX.length)]);
      if (p && scatterOne(p, zones, placed, 3)) { done++; }
    }
    if (done === 0) { scatterPattern(patternByName(MIX[0])); }
  }

  function seedKind(p) {
    if (p.kind === 'soup') { fillSoupBands(p.density); }
    else if (p.kind === 'mirror-soup') { fillMirrorSoup(p.density); }
    else if (p.kind === 'gliders') { seedGliders(); }
    else if (p.kind === 'mix') { seedMix(); }
    else { scatterPattern(p); }
  }

  function seed() {
    var n = cols * rows, i;
    for (i = 0; i < n; i++) { cur[i] = 0; buf[i] = 0; age[i] = 0; }

    var p = pickPattern();
    seedKind(p);
    if (ROOT.setAttribute) { ROOT.setAttribute('data-life-preset', p.name); }
    countPopulation();
    return p.name;
  }

  function seedPreset(name) {
    for (var i = 0; i < PATTERNS.length; i++) {
      if (PATTERNS[i].name === name) {
        var n = cols * rows;
        for (var k = 0; k < n; k++) { cur[k] = 0; buf[k] = 0; age[k] = 0; }
        seedKind(PATTERNS[i]);
        countPopulation();
        return true;
      }
    }
    return false;
  }

  /* 画面静止时补一小块随机汤，同样只补在留白带里 */
  function injectSoup() {
    var zones = bands();
    var z = zones[Math.floor(Math.random() * zones.length)];
    var bw = z.x1 - z.x0, bh = z.y1 - z.y0;
    var w = Math.min(bw, Math.max(10, Math.round(bw * 0.6)));
    var h = Math.min(bh, Math.max(10, Math.round(rows * 0.18)));
    fillSoup(
      z.x0 + Math.floor(Math.random() * Math.max(1, bw - w + 1)),
      z.y0 + Math.floor(Math.random() * Math.max(1, bh - h + 1)),
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
   * 规则：标准 B3/S23，外加寿命上限——连续存活超过 MAX_AGE 代的细胞自然死亡。
   * ------------------------------------------------------------------ */
  function stepOnce() {
    pop = 0;
    changed = 0;
    var aging = MAX_AGE > 0;
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
        var live;
        if (alive) {
          live = (nb === 2 || nb === 3) ? 1 : 0;
          if (live && aging && age[i] >= MAX_AGE) { live = 0; }   // 寿命到了
        } else {
          live = (nb === 3) ? 1 : 0;
        }
        if (live) {
          buf[i] = 1;
          age[i] = alive ? (age[i] + 1) : 0;
          pop++;
          if (!alive) { changed++; }
        } else {
          buf[i] = 0;
          age[i] = 0;
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

    /* 活性自检：细胞太少、或者变化率过低（基本只剩静止块和慢振荡子）就补一块随机汤，
       配合寿命上限，画面会一直在“乱 → 衰 → 补新乱”的循环里，不会定死 */
    var thin = pop < Math.max(30, Math.round(cols * rows * 0.004));
    var quiet = changed * 12 < pop;
    if (pop === 0) {
      seed();
      reseeds++;
      render();
    } else if (thin || quiet) {
      still++;
      if (still > 8) { injectSoup(); stirs++; still = 0; }
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
    age = new Uint16Array(n);
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
    version: '1.1.0',
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
      return {
        cols: cols, rows: rows, cell: cell, stepMs: STEP_MS,
        pop: pop, changed: changed, running: running, maxAge: MAX_AGE,
        stirs: stirs, reseeds: reseeds
      };
    },
    debug: {
      resize: resize,
      /* 关掉寿命上限就退回纯 B3/S23 */
      setMaxAge: function (n) { MAX_AGE = Math.max(0, n | 0); return MAX_AGE; },
      maxAge: function () { return MAX_AGE; },
      getCells: function () {
        var out = new Array(cols * rows);
        for (var i = 0; i < out.length; i++) { out[i] = cur[i]; }
        return out;
      },
      getAges: function () {
        var out = new Array(cols * rows);
        for (var i = 0; i < out.length; i++) { out[i] = age[i]; }
        return out;
      },
      setCells: function (arr) {
        for (var i = 0; i < cur.length; i++) { cur[i] = arr[i] ? 1 : 0; age[i] = 0; }
        countPopulation();
        return pop;
      },
      place: function (name, ox, oy, rot, flip) {
        for (var i = 0; i < PATTERNS.length; i++) {
          if (PATTERNS[i].name === name) {
            drawPattern(PATTERNS[i], ox, oy, rot || 0, !!flip);
            countPopulation();
            return pop;
          }
        }
        return -1;
      },
      bands: function () {
        return bands().map(function (b) { return { x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1 }; });
      },
      injectSoup: injectSoup,
      clear: function () {
        for (var i = 0; i < cur.length; i++) { cur[i] = 0; buf[i] = 0; age[i] = 0; }
        pop = 0;
      }
    }
  };
})(typeof window !== 'undefined' ? window : this);
