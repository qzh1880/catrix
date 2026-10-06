/*!
 * game.js —— 康威生命游戏 · 细胞推演
 * Catrix Play / 04
 *
 * 功能：
 * 1. 自定义速度与网格视图大小；
 * 2. 丰富初始化（随机密度播种、精选经典图案库、自由涂鸦绘制）；
 * 3. 返回上级网页按钮；
 * 4. 细胞阵列 Code 自动生成、一键分享、导入与 URL 直达链接。
 */
(function (global) {
  'use strict';

  var doc = global.document;
  if (!doc) { return; }

  // ---------------------------------------------------------------------------
  // 1. 经典特殊图案库
  // ---------------------------------------------------------------------------
  var PATTERNS = [
    {
      id: 'glider',
      name: '滑翔机',
      kind: '飞船',
      desc: '最著名的飞船，每4代向右下移动一格',
      ascii: [
        '.O.',
        '..O',
        'OOO'
      ]
    },
    {
      id: 'lwss',
      name: '轻量飞船',
      kind: '飞船',
      desc: '以 1/2 光速向右飞行的正交飞船',
      ascii: [
        '.O..O',
        '....O',
        '.O..O',
        '..OOO'
      ]
    },
    {
      id: 'pulsar',
      name: '脉冲星',
      kind: '振荡子 (周期3)',
      desc: '周期为 3 的大型美观振荡器',
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
      id: 'pentadecathlon',
      name: '十五连环',
      kind: '振荡子 (周期15)',
      desc: '长周期经典振荡子，能反弹滑翔机',
      ascii: [
        'OOOOOOOOOO'
      ]
    },
    {
      id: 'blinker',
      name: '闪烁子',
      kind: '振荡子 (周期2)',
      desc: '最基础的振荡子，三格横竖交替',
      ascii: [
        'OOO'
      ]
    },
    {
      id: 'beacon',
      name: '信标',
      kind: '振荡子 (周期2)',
      desc: '两块方块轻微接触的闪烁信标',
      ascii: [
        'OO..',
        'OO..',
        '..OO',
        '..OO'
      ]
    },
    {
      id: 'acorn',
      name: '橡子 (Acorn)',
      kind: '长寿种子',
      desc: '仅7个细胞，经过5206代爆炸出浩瀚星河',
      ascii: [
        '.O.....',
        '...O...',
        'OO..OOO'
      ]
    },
    {
      id: 'r-pentomino',
      name: 'R-五连块',
      kind: '长寿种子',
      desc: '著名的多米诺结构，演化1103代才平息',
      ascii: [
        '.OO',
        'OO.',
        '.O.'
      ]
    },
    {
      id: 'pi-heptomino',
      name: '皮七连块',
      kind: '长寿种子',
      desc: '外形如圆周率 π，剧烈向外炸开',
      ascii: [
        'OOO',
        'O.O',
        'O.O'
      ]
    },
    {
      id: 'diehard',
      name: '顽固者 (Diehard)',
      kind: '长寿种子',
      desc: '能持续存活 130 代最终全部消亡',
      ascii: [
        '......O.',
        'OO......',
        '.O...OOO'
      ]
    },
    {
      id: 'gosper-gun',
      name: '高斯帕滑翔机枪',
      kind: '发生器',
      desc: '人类发现的首个永动滑翔机制造工厂',
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
      id: 'beehive',
      name: '蜂巢',
      kind: '静物',
      desc: '六角对称的永恒静物',
      ascii: [
        '.OO.',
        'O..O',
        '.OO.'
      ]
    },
    {
      id: 'block',
      name: '方块',
      kind: '静物',
      desc: '最稳固的 2×2 静物方块',
      ascii: [
        'OO',
        'OO'
      ]
    }
  ];

  // ---------------------------------------------------------------------------
  // 2. 状态变量
  // ---------------------------------------------------------------------------
  var cols = 50;
  var rows = 35;
  var cellSize = 14;
  var stepMs = 60;
  var toroidal = true;
  var showGridLines = true;
  var currentTool = 'draw';          // 'draw' | 'erase' | 'stamp'
  var selectedPattern = PATTERNS[0];  // 默认选中滑翔机

  var cur = new Uint8Array(cols * rows);
  var buf = new Uint8Array(cols * rows);

  var running = false;
  var rafId = 0;
  var lastStepTime = 0;
  var generation = 0;
  var peakPop = 0;
  var pop = 0;

  // 鼠标与手势交互
  var isPointerDown = false;
  var pointerValue = 1;
  var hoverCellX = -1;
  var hoverCellY = -1;

  // DOM 元素引用
  var canvas = doc.getElementById('game-canvas');
  var ctx = canvas ? canvas.getContext('2d') : null;
  var canvasWrapper = doc.getElementById('canvas-wrapper');

  var statPop = doc.getElementById('stat-pop');
  var statGen = doc.getElementById('stat-gen');
  var statPeak = doc.getElementById('stat-peak');
  var statSpeed = doc.getElementById('stat-speed');

  var btnPlayPause = doc.getElementById('btn-play-pause');
  var playIcon = doc.getElementById('play-icon');
  var playText = doc.getElementById('play-text');
  var statusPill = doc.getElementById('status-pill');
  var btnStep = doc.getElementById('btn-step');
  var btnClear = doc.getElementById('btn-clear');
  var btnBack = doc.getElementById('btn-back');

  var speedSelect = doc.getElementById('speed-select');
  var gridSizeSelect = doc.getElementById('grid-size-select');
  var cellSizeSelect = doc.getElementById('cell-size-select');
  var randomSelect = doc.getElementById('random-select');

  var toolDraw = doc.getElementById('tool-draw');
  var toolErase = doc.getElementById('tool-erase');
  var patternList = doc.getElementById('pattern-list');
  var btnPlaceCenter = doc.getElementById('btn-place-center');
  var btnStampMode = doc.getElementById('btn-stamp-mode');

  var chkGrid = doc.getElementById('chk-grid');
  var chkTorus = doc.getElementById('chk-torus');

  var shareModal = doc.getElementById('share-modal');
  var importModal = doc.getElementById('import-modal');
  var btnOpenShare = doc.getElementById('btn-open-share');
  var btnOpenImport = doc.getElementById('btn-open-import');
  var btnCloseShare = doc.getElementById('btn-close-share');
  var btnCloseImport = doc.getElementById('btn-close-import');
  var btnCancelImport = doc.getElementById('btn-cancel-import');
  var btnConfirmImport = doc.getElementById('btn-confirm-import');
  var btnCopyAll = doc.getElementById('btn-copy-all');
  var btnCopyCode = doc.getElementById('btn-copy-code');
  var shareText = doc.getElementById('share-text');
  var importText = doc.getElementById('import-text');
  var importError = doc.getElementById('import-error');
  var toast = doc.getElementById('toast');

  if (!canvas || !ctx) { return; }

  // ---------------------------------------------------------------------------
  // 3. 辅助功能与 Toast
  // ---------------------------------------------------------------------------
  var toastTimer = 0;
  function showToast(msg) {
    if (!toast) { return; }
    toast.textContent = msg;
    toast.classList.add('show');
    if (toastTimer) { global.clearTimeout(toastTimer); }
    toastTimer = global.setTimeout(function () {
      toast.classList.remove('show');
    }, 2400);
  }

  function countPop() {
    var c = 0;
    for (var i = 0; i < cur.length; i++) {
      if (cur[i]) { c++; }
    }
    pop = c;
    if (pop > peakPop) { peakPop = pop; }
    updateStats();
    return pop;
  }

  function updateStats() {
    if (statPop) { statPop.textContent = pop; }
    if (statGen) { statGen.textContent = generation; }
    if (statPeak) { statPeak.textContent = peakPop; }
    if (statSpeed) {
      var fps = Math.round(1000 / stepMs);
      statSpeed.textContent = fps + ' fps';
    }
  }

  // ---------------------------------------------------------------------------
  // 4. 网格尺寸重设与演化计算
  // ---------------------------------------------------------------------------
  function resizeGrid(newCols, newRows) {
    var oldCols = cols;
    var oldRows = rows;
    var oldCur = cur;

    cols = newCols;
    rows = newRows;
    cur = new Uint8Array(cols * rows);
    buf = new Uint8Array(cols * rows);

    // 将旧网格居中复制到新网格
    var ox = Math.floor((cols - oldCols) / 2);
    var oy = Math.floor((rows - oldRows) / 2);
    for (var y = 0; y < oldRows; y++) {
      for (var x = 0; x < oldCols; x++) {
        if (oldCur[y * oldCols + x]) {
          var nx = x + ox;
          var ny = y + oy;
          if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
            cur[ny * cols + nx] = 1;
          }
        }
      }
    }

    updateCanvasSize();
    countPop();
    render();
  }

  function updateCanvasSize() {
    var w = cols * cellSize;
    var h = rows * cellSize;
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
  }

  /* 经典 B3/S23 单步演化 */
  function step() {
    var hasLife = false;
    for (var y = 0; y < rows; y++) {
      var yMid = y * cols;
      var yUp, yDn;
      if (toroidal) {
        yUp = ((y + rows - 1) % rows) * cols;
        yDn = ((y + 1) % rows) * cols;
      } else {
        yUp = (y > 0) ? (y - 1) * cols : -1;
        yDn = (y < rows - 1) ? (y + 1) * cols : -1;
      }

      for (var x = 0; x < cols; x++) {
        var nb = 0;
        var xL, xR;
        if (toroidal) {
          xL = (x + cols - 1) % cols;
          xR = (x + 1) % cols;
        } else {
          xL = x - 1;
          xR = x + 1;
        }

        // 统计 8 个邻居
        if (yUp !== -1) {
          if (xL >= 0) { nb += cur[yUp + xL]; }
          nb += cur[yUp + x];
          if (xR < cols) { nb += cur[yUp + xR]; }
        }
        if (xL >= 0) { nb += cur[yMid + xL]; }
        if (xR < cols) { nb += cur[yMid + xR]; }
        if (yDn !== -1) {
          if (xL >= 0) { nb += cur[yDn + xL]; }
          nb += cur[yDn + x];
          if (xR < cols) { nb += cur[yDn + xR]; }
        }

        var alive = cur[yMid + x];
        if (alive) {
          buf[yMid + x] = (nb === 2 || nb === 3) ? 1 : 0;
        } else {
          buf[yMid + x] = (nb === 3) ? 1 : 0;
        }
        if (buf[yMid + x]) { hasLife = true; }
      }
    }

    var t = cur; cur = buf; buf = t;
    generation++;
    countPop();
    return hasLife;
  }

  // ---------------------------------------------------------------------------
  // 5. 绘制逻辑
  // ---------------------------------------------------------------------------
  function render() {
    ctx.fillStyle = '#182a26';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 绘制活细胞
    ctx.fillStyle = '#8ee4af';
    var gap = (cellSize >= 10 && showGridLines) ? 1 : 0;
    var drawSize = cellSize - gap;

    for (var y = 0; y < rows; y++) {
      var rowOffset = y * cols;
      var py = y * cellSize;
      for (var x = 0; x < cols; x++) {
        if (cur[rowOffset + x]) {
          var px = x * cellSize;
          ctx.fillRect(px, py, drawSize, drawSize);
        }
      }
    }

    // 绘制网格线
    if (showGridLines && cellSize >= 8) {
      ctx.strokeStyle = '#223832';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (var gx = 0; gx <= cols; gx++) {
        var xCoord = gx * cellSize - 0.5;
        ctx.moveTo(xCoord, 0);
        ctx.lineTo(xCoord, rows * cellSize);
      }
      for (var gy = 0; gy <= rows; gy++) {
        var yCoord = gy * cellSize - 0.5;
        ctx.moveTo(0, yCoord);
        ctx.lineTo(cols * cellSize, yCoord);
      }
      ctx.stroke();
    }

    // 若在印章放置模式下，绘制悬浮半透明预览
    if (currentTool === 'stamp' && selectedPattern && hoverCellX >= 0 && hoverCellY >= 0) {
      renderGhostPattern(selectedPattern, hoverCellX, hoverCellY);
    }
  }

  function renderGhostPattern(p, ox, oy) {
    var pw = p.ascii[0].length;
    var ph = p.ascii.length;
    var startX = ox - Math.floor(pw / 2);
    var startY = oy - Math.floor(ph / 2);

    ctx.fillStyle = 'rgba(237, 242, 133, 0.55)'; // 淡黄高亮预览
    for (var y = 0; y < ph; y++) {
      var rowStr = p.ascii[y];
      for (var x = 0; x < pw; x++) {
        if (rowStr.charAt(x) === 'O') {
          var gx = toroidal ? ((startX + x) % cols + cols) % cols : startX + x;
          var gy = toroidal ? ((startY + y) % rows + rows) % rows : startY + y;
          if (gx >= 0 && gx < cols && gy >= 0 && gy < rows) {
            ctx.fillRect(gx * cellSize, gy * cellSize, cellSize - 1, cellSize - 1);
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 6. 动画主循环
  // ---------------------------------------------------------------------------
  function loop(now) {
    if (!running) { return; }
    if (!lastStepTime) { lastStepTime = now; }

    if (now - lastStepTime >= stepMs) {
      lastStepTime = now;
      step();
      render();
    }
    rafId = global.requestAnimationFrame(loop);
  }

  function play() {
    if (running) { return; }
    running = true;
    lastStepTime = 0;
    btnPlayPause.classList.add('paused');
    playIcon.textContent = '⏸';
    playText.textContent = '暂停';
    statusPill.textContent = '推演中';
    statusPill.className = 'status-pill running';
    rafId = global.requestAnimationFrame(loop);
  }

  function pause() {
    if (!running) { return; }
    running = false;
    if (rafId) { global.cancelAnimationFrame(rafId); }
    rafId = 0;
    btnPlayPause.classList.remove('paused');
    playIcon.textContent = '▶';
    playText.textContent = '播放';
    statusPill.textContent = '已暂停';
    statusPill.className = 'status-pill paused';
  }

  function togglePlay() {
    if (running) { pause(); } else { play(); }
  }

  // ---------------------------------------------------------------------------
  // 7. 图案放置与初始化逻辑
  // ---------------------------------------------------------------------------
  function placePattern(p, ox, oy) {
    var pw = p.ascii[0].length;
    var ph = p.ascii.length;
    var startX = ox - Math.floor(pw / 2);
    var startY = oy - Math.floor(ph / 2);

    for (var y = 0; y < ph; y++) {
      var rowStr = p.ascii[y];
      for (var x = 0; x < pw; x++) {
        if (rowStr.charAt(x) === 'O') {
          var gx = toroidal ? ((startX + x) % cols + cols) % cols : startX + x;
          var gy = toroidal ? ((startY + y) % rows + rows) % rows : startY + y;
          if (gx >= 0 && gx < cols && gy >= 0 && gy < rows) {
            cur[gy * cols + gx] = 1;
          }
        }
      }
    }
    countPop();
    render();
  }

  function seedRandom(density) {
    for (var i = 0; i < cur.length; i++) {
      cur[i] = Math.random() < density ? 1 : 0;
    }
    generation = 0;
    peakPop = 0;
    countPop();
    render();
    showToast('已随机生成 ' + Math.round(density * 100) + '% 密度的细胞阵列');
  }

  function clearBoard() {
    for (var i = 0; i < cur.length; i++) { cur[i] = 0; }
    generation = 0;
    peakPop = 0;
    pause();
    countPop();
    render();
    showToast('棋盘已清空');
  }

  // ---------------------------------------------------------------------------
  // 8. 阵列 Code 编码与解码 (基于标准 RLE)
  // ---------------------------------------------------------------------------
  /* 将当前活细胞编码为紧凑的 CGL1 RLE 代码 */
  function encodeToCode() {
    // 计算活细胞外接矩形边界
    var minX = cols, maxX = -1, minY = rows, maxY = -1;
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        if (cur[y * cols + x]) {
          if (x < minX) { minX = x; }
          if (x > maxX) { maxX = x; }
          if (y < minY) { minY = y; }
          if (y > maxY) { maxY = y; }
        }
      }
    }

    if (maxX === -1) {
      return 'CGL1:' + cols + 'x' + rows + ':empty!';
    }

    var rle = '';
    var emptyLines = 0;

    for (var py = minY; py <= maxY; py++) {
      var lineStr = '';
      var lastChar = '';
      var count = 0;
      var hasCellInRow = false;

      for (var px = minX; px <= maxX; px++) {
        var isAlive = cur[py * cols + px];
        var ch = isAlive ? 'o' : 'b';
        if (isAlive) { hasCellInRow = true; }

        if (ch === lastChar) {
          count++;
        } else {
          if (count > 0) {
            lineStr += (count > 1 ? count : '') + lastChar;
          }
          lastChar = ch;
          count = 1;
        }
      }

      if (count > 0) {
        // 如果末尾是 dead 细胞 'b'，在 RLE 中通常可以省略
        if (lastChar === 'b' && hasCellInRow) {
          // 省略行末尾无用的 b
        } else {
          lineStr += (count > 1 ? count : '') + lastChar;
        }
      }

      if (!hasCellInRow) {
        emptyLines++;
      } else {
        if (emptyLines > 0) {
          rle += (emptyLines > 1 ? emptyLines : '') + '$';
          emptyLines = 0;
        }
        rle += lineStr + '$';
      }
    }

    // 去掉最后一个多余的 '$'，并补上 '!'
    if (rle.charAt(rle.length - 1) === '$') {
      rle = rle.slice(0, -1);
    }
    rle += '!';

    return 'CGL1:' + cols + 'x' + rows + ':' + minX + ',' + minY + ':' + rle;
  }

  /* 解析导入 Code */
  function decodeFromCode(codeStr) {
    if (!codeStr || typeof codeStr !== 'string') {
      throw new Error('代码不能为空');
    }
    var cleaned = codeStr.trim();

    // 如果粘贴的是完整分享文本，提取其中的 CGL1:... 字段
    var match = cleaned.match(/CGL1:([0-9]+)x([0-9]+):([0-9]+),([0-9]+):([^!\s]+!)/i) ||
                cleaned.match(/CGL1:([0-9]+)x([0-9]+):([^!\s]+!)/i);

    if (match) {
      var targetCols = parseInt(match[1], 10);
      var targetRows = parseInt(match[2], 10);
      var originX = 0, originY = 0, rleData = '';

      if (match.length >= 6) {
        originX = parseInt(match[3], 10);
        originY = parseInt(match[4], 10);
        rleData = match[5];
      } else {
        rleData = match[3];
      }

      if (rleData.indexOf('empty') !== -1) {
        clearBoard();
        return;
      }

      // 如果网格尺寸需要调整，自动切换尺寸
      if (targetCols > 0 && targetRows > 0 && (targetCols !== cols || targetRows !== rows)) {
        cols = targetCols;
        rows = targetRows;
        cur = new Uint8Array(cols * rows);
        buf = new Uint8Array(cols * rows);
        var sizeVal = targetCols + 'x' + targetRows;
        if (gridSizeSelect) {
          gridSizeSelect.value = sizeVal;
        }
        updateCanvasSize();
      } else {
        for (var k = 0; k < cur.length; k++) { cur[k] = 0; }
      }

      // 解析 RLE
      parseRleIntoGrid(rleData, originX, originY);
      generation = 0;
      peakPop = 0;
      countPop();
      render();
      return;
    }

    // 备用：尝试解析普通标准 RLE
    if (cleaned.indexOf('o') !== -1 || cleaned.indexOf('b') !== -1) {
      for (var j = 0; j < cur.length; j++) { cur[j] = 0; }
      var rleClean = cleaned.replace(/^[^\$o!b]*/i, '');
      parseRleIntoGrid(rleClean, Math.floor(cols / 4), Math.floor(rows / 4));
      generation = 0;
      peakPop = 0;
      countPop();
      render();
      return;
    }

    throw new Error('未能识别有效的生命游戏阵列代码');
  }

  function parseRleIntoGrid(rle, startX, startY) {
    var curX = startX;
    var curY = startY;
    var countStr = '';

    for (var i = 0; i < rle.length; i++) {
      var ch = rle.charAt(i);
      if (ch >= '0' && ch <= '9') {
        countStr += ch;
      } else if (ch === 'b' || ch === '.') {
        var deadCount = countStr ? parseInt(countStr, 10) : 1;
        curX += deadCount;
        countStr = '';
      } else if (ch === 'o' || ch === 'O') {
        var liveCount = countStr ? parseInt(countStr, 10) : 1;
        for (var c = 0; c < liveCount; c++) {
          if (curX >= 0 && curX < cols && curY >= 0 && curY < rows) {
            cur[curY * cols + curX] = 1;
          }
          curX++;
        }
        countStr = '';
      } else if (ch === '$') {
        var linesDown = countStr ? parseInt(countStr, 10) : 1;
        curY += linesDown;
        curX = startX;
        countStr = '';
      } else if (ch === '!') {
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 9. 分享交互与链接生成
  // ---------------------------------------------------------------------------
  function generateSharePayload() {
    var code = encodeToCode();
    var currentUrl = global.location.origin + global.location.pathname;
    var directLink = currentUrl + '#code=' + encodeURIComponent(code);
    var playroomUrl = 'https://catrix.net/games/';

    var text = [
      '【Catrix 生命游戏 · 细胞阵列分享】',
      '网格规格：' + cols + ' × ' + rows + ' | 存活细胞：' + pop + ' | 演化代数：' + generation,
      '阵列代码：',
      code,
      '',
      '直接在浏览器载入推演：',
      directLink,
      '',
      '更多好玩的游戏尽在游乐场：' + playroomUrl
    ].join('\n');

    return {
      code: code,
      fullText: text,
      directLink: directLink
    };
  }

  function copyTextToClipboard(text, successTip) {
    if (global.navigator && global.navigator.clipboard && global.navigator.clipboard.writeText) {
      global.navigator.clipboard.writeText(text).then(function () {
        showToast(successTip || '已复制到剪贴板！');
      }).catch(function () {
        fallbackCopy(text, successTip);
      });
    } else {
      fallbackCopy(text, successTip);
    }
  }

  function fallbackCopy(text, successTip) {
    var ta = doc.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    doc.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      doc.execCommand('copy');
      showToast(successTip || '已复制到剪贴板！');
    } catch (e) {
      showToast('复制失败，请手动选择复制');
    }
    doc.body.removeChild(ta);
  }

  function openShareDialog() {
    var payload = generateSharePayload();
    if (shareText) {
      shareText.value = payload.fullText;
    }
    if (shareModal) {
      shareModal.removeAttribute('hidden');
    }
    // 自动复制完整内容到剪贴板
    copyTextToClipboard(payload.fullText, '已生成阵列代码并复制分享文本！');
  }

  function closeShareDialog() {
    if (shareModal) { shareModal.setAttribute('hidden', ''); }
  }

  function openImportDialog() {
    if (importError) { importError.style.display = 'none'; }
    if (importText) { importText.value = ''; }
    if (importModal) { importModal.removeAttribute('hidden'); }
    if (importText) { importText.focus(); }
  }

  function closeImportDialog() {
    if (importModal) { importModal.setAttribute('hidden', ''); }
  }

  function executeImport() {
    var val = importText ? importText.value : '';
    try {
      decodeFromCode(val);
      closeImportDialog();
      showToast('阵列代码导入成功！');
    } catch (err) {
      if (importError) {
        importError.textContent = err.message || '导入格式错误';
        importError.style.display = 'block';
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 10. 画布事件交互 (鼠标点击、拖拽涂色、图案盖章)
  // ---------------------------------------------------------------------------
  function getCanvasCoords(e) {
    var rect = canvas.getBoundingClientRect();
    var clientX = e.clientX;
    var clientY = e.clientY;
    if (e.touches && e.touches[0]) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    }
    var scaleX = canvas.width / rect.width;
    var scaleY = canvas.height / rect.height;
    var canvasX = (clientX - rect.left) * scaleX;
    var canvasY = (clientY - rect.top) * scaleY;
    var cellX = Math.floor(canvasX / cellSize);
    var cellY = Math.floor(canvasY / cellSize);
    return { x: cellX, y: cellY };
  }

  function onPointerDown(e) {
    var coords = getCanvasCoords(e);
    if (coords.x < 0 || coords.x >= cols || coords.y < 0 || coords.y >= rows) { return; }

    if (currentTool === 'stamp') {
      placePattern(selectedPattern, coords.x, coords.y);
      showToast('已放置「' + selectedPattern.name + '」');
      return;
    }

    isPointerDown = true;
    var isRightClick = (e.button === 2);
    if (isRightClick || currentTool === 'erase') {
      pointerValue = 0;
    } else {
      // 若点击已存活格子，取反擦除；若点击空白格子，点亮
      pointerValue = cur[coords.y * cols + coords.x] ? 0 : 1;
    }

    cur[coords.y * cols + coords.x] = pointerValue;
    countPop();
    render();
  }

  function onPointerMove(e) {
    var coords = getCanvasCoords(e);
    hoverCellX = coords.x;
    hoverCellY = coords.y;

    if (isPointerDown) {
      if (coords.x >= 0 && coords.x < cols && coords.y >= 0 && coords.y < rows) {
        if (cur[coords.y * cols + coords.x] !== pointerValue) {
          cur[coords.y * cols + coords.x] = pointerValue;
          countPop();
          render();
        }
      }
    } else if (currentTool === 'stamp') {
      // 印章悬停预览
      render();
    }
  }

  function onPointerUp() {
    isPointerDown = false;
  }

  // ---------------------------------------------------------------------------
  // 11. 初始化与绑定事件
  // ---------------------------------------------------------------------------
  function populatePatterns() {
    if (!patternList) { return; }
    patternList.innerHTML = '';

    PATTERNS.forEach(function (p, idx) {
      var btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'pattern-item' + (idx === 0 ? ' selected' : '');
      btn.setAttribute('role', 'option');
      btn.setAttribute('data-id', p.id);

      var nameEl = doc.createElement('strong');
      nameEl.textContent = p.name;
      var kindEl = doc.createElement('span');
      kindEl.className = 'p-kind';
      kindEl.textContent = p.kind;

      btn.appendChild(nameEl);
      btn.appendChild(kindEl);

      btn.addEventListener('click', function () {
        var items = patternList.querySelectorAll('.pattern-item');
        items.forEach(function (el) { el.classList.remove('selected'); });
        btn.classList.add('selected');
        selectedPattern = p;
        showToast('已选择「' + p.name + '」，可点击“居中置入”或“印章放置”');
      });

      patternList.appendChild(btn);
    });
  }

  function initEvents() {
    // 播放与暂停
    btnPlayPause.addEventListener('click', togglePlay);

    // 单步执行
    btnStep.addEventListener('click', function () {
      pause();
      step();
      render();
    });

    // 清空画板
    btnClear.addEventListener('click', clearBoard);

    // 返回上级网页按钮
    if (btnBack) {
      btnBack.addEventListener('click', function (e) {
        if (global.history && global.history.length > 1) {
          e.preventDefault();
          global.history.back();
        }
      });
    }

    // 速度切换
    speedSelect.addEventListener('change', function () {
      stepMs = parseInt(speedSelect.value, 10) || 60;
      updateStats();
    });

    // 规格切换
    gridSizeSelect.addEventListener('change', function () {
      var parts = gridSizeSelect.value.split('x');
      var nc = parseInt(parts[0], 10);
      var nr = parseInt(parts[1], 10);
      if (nc > 0 && nr > 0) {
        resizeGrid(nc, nr);
      }
    });

    // 缩放尺寸
    cellSizeSelect.addEventListener('change', function () {
      cellSize = parseInt(cellSizeSelect.value, 10) || 14;
      updateCanvasSize();
      render();
    });

    // 随机播种
    randomSelect.addEventListener('change', function () {
      var d = parseFloat(randomSelect.value);
      if (!isNaN(d)) {
        seedRandom(d);
        randomSelect.value = '';
      }
    });

    // 工具切换 (绘制 / 擦除)
    toolDraw.addEventListener('click', function () {
      currentTool = 'draw';
      toolDraw.classList.add('active');
      toolErase.classList.remove('active');
      btnStampMode.classList.remove('btn-primary');
    });

    toolErase.addEventListener('click', function () {
      currentTool = 'erase';
      toolErase.classList.add('active');
      toolDraw.classList.remove('active');
      btnStampMode.classList.remove('btn-primary');
    });

    // 图案放置
    btnPlaceCenter.addEventListener('click', function () {
      if (!selectedPattern) { return; }
      placePattern(selectedPattern, Math.floor(cols / 2), Math.floor(rows / 2));
      showToast('已在画布居中置入「' + selectedPattern.name + '」');
    });

    btnStampMode.addEventListener('click', function () {
      currentTool = 'stamp';
      toolDraw.classList.remove('active');
      toolErase.classList.remove('active');
      btnStampMode.classList.add('btn-primary');
      showToast('印章模式：请在画布上点击任意位置印下图案');
    });

    // 视图选项
    chkGrid.addEventListener('change', function () {
      showGridLines = chkGrid.checked;
      render();
    });
    chkTorus.addEventListener('change', function () {
      toroidal = chkTorus.checked;
    });

    // 弹窗与分享
    btnOpenShare.addEventListener('click', openShareDialog);
    btnCloseShare.addEventListener('click', closeShareDialog);
    shareModal.addEventListener('click', function (e) {
      if (e.target === shareModal) { closeShareDialog(); }
    });

    btnCopyAll.addEventListener('click', function () {
      var payload = generateSharePayload();
      copyTextToClipboard(payload.fullText, '已复制完整分享文本到剪贴板！');
    });

    btnCopyCode.addEventListener('click', function () {
      var code = encodeToCode();
      copyTextToClipboard(code, '已复制阵列 Code 到剪贴板！');
    });

    btnOpenImport.addEventListener('click', openImportDialog);
    btnCloseImport.addEventListener('click', closeImportDialog);
    btnCancelImport.addEventListener('click', closeImportDialog);
    btnConfirmImport.addEventListener('click', executeImport);
    importModal.addEventListener('click', function (e) {
      if (e.target === importModal) { closeImportDialog(); }
    });

    // 画布鼠标事件
    canvas.addEventListener('mousedown', onPointerDown);
    canvas.addEventListener('mousemove', onPointerMove);
    global.addEventListener('mouseup', onPointerUp);
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    // 画布触屏事件
    canvas.addEventListener('touchstart', function (e) {
      onPointerDown(e);
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', function (e) {
      onPointerMove(e);
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchend', onPointerUp);

    // 全局快捷键
    global.addEventListener('keydown', function (e) {
      var tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') { return; }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'KeyS') {
        pause();
        step();
        render();
      } else if (e.code === 'KeyC') {
        clearBoard();
      } else if (e.code === 'KeyR') {
        seedRandom(0.2);
      }
    });

    // 检查 URL 中是否有分享的代码参数 (#code=... 或 ?code=...)
    checkUrlCode();
  }

  function checkUrlCode() {
    var hash = global.location.hash || '';
    var search = global.location.search || '';
    var codeParam = '';

    if (hash.indexOf('code=') !== -1) {
      codeParam = decodeURIComponent(hash.split('code=')[1].split('&')[0]);
    } else if (search.indexOf('code=') !== -1) {
      codeParam = decodeURIComponent(search.split('code=')[1].split('&')[0]);
    }

    if (codeParam) {
      try {
        decodeFromCode(codeParam);
        showToast('已成功通过链接载入细胞阵列！');
      } catch (e) {
        // 忽略无效链接
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 12. 页面就绪启动
  // ---------------------------------------------------------------------------
  populatePatterns();
  initEvents();
  updateCanvasSize();

  // 默认置入滑翔机枪作为初始图案
  placePattern(PATTERNS[10], Math.floor(cols / 2), Math.floor(rows / 2));
  render();

  // 暴露调试接口
  global.__catrixLifeGame = {
    step: step,
    play: play,
    pause: pause,
    clear: clearBoard,
    seedRandom: seedRandom,
    encode: encodeToCode,
    decode: decodeFromCode
  };

})(typeof window !== 'undefined' ? window : this);
