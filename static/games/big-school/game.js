/* ============================================================
 * 合成大·学校 —— 游戏主逻辑
 * 依赖 physics.js（window.SuikaPhysics）
 * ============================================================ */
(function () {
  'use strict';

  var P = window.SuikaPhysics;

  /* ---------------- 学校数据 ----------------
   * 数组顺序 = 默认大小顺序（索引越小越大）。
   * 前 14 所是原有的「四校 + 上海实验学校 + 八大 + 进才」，
   * 后面是新加的 17 所市重点（上外附中、上师大附中、位育、曹杨二中……）。
   * 进才中学默认排在建平中学前面（比建平大一档）。
   */
  var SCHOOLS = [
    { id: 'shanghai-high', name: '上海中学',     group: '四校',   color: '#c0392b' },
    { id: 'huaer',         name: '华二附中',     group: '四校',   color: '#c8102e' },
    { id: 'fudan',         name: '复旦附中',     group: '四校',   color: '#1a4fa0' },
    { id: 'jiaoda',        name: '交大附中',     group: '四校',   color: '#a8202a' },
    { id: 'ses',           name: '上海实验学校', group: '实验',   color: '#6aa84f' },
    { id: 'sfls',          name: '上外附中',     group: '市重点', color: '#1a3e8c' },
    { id: 'qibao',         name: '七宝中学',     group: '八大',   color: '#2f8f4e' },
    { id: 'nanmo',         name: '南洋模范中学', group: '八大',   color: '#8c1f2b' },
    { id: 'weiyu',         name: '位育中学',     group: '市重点', color: '#b08d57' },
    { id: 'jincai',        name: '进才中学',     group: '新五虎', color: '#a01820' },
    { id: 'jianping',      name: '建平中学',     group: '八大',   color: '#1a8fd1' },
    { id: 'kongjiang',     name: '控江中学',     group: '八大',   color: '#c0392b' },
    { id: 'shnu',          name: '上师大附中',   group: '市重点', color: '#1a6b3c' },
    { id: 'yanan',         name: '延安中学',     group: '八大',   color: '#2f8f4e' },
    { id: 'gezhi',         name: '格致中学',     group: '八大',   color: '#6b4226' },
    { id: 'datong',        name: '大同中学',     group: '八大',   color: '#1b4f9c' },
    { id: 'fuxing',        name: '复兴中学',     group: '八大',   color: '#1f4e9c' },
    { id: 'caoyang',       name: '曹杨二中',     group: '市重点', color: '#2a6fb5' },
    { id: 'songjiang',     name: '松江二中',     group: '市重点', color: '#8c1f2b' },
    { id: 'fengxian',      name: '奉贤中学',     group: '市重点', color: '#c0392b' },
    { id: 'shixi',         name: '市西中学',     group: '市重点', color: '#d95f18' },
    { id: 'shibei',        name: '市北中学',     group: '市重点', color: '#2f6b3c' },
    { id: 'yucai',         name: '育才中学',     group: '市重点', color: '#1b6b4a' },
    { id: 'xiangming',     name: '向明中学',     group: '市重点', color: '#d92b1f' },
    { id: 'xingzhi',       name: '行知中学',     group: '市重点', color: '#c8102e' },
    { id: 'jinyuan',       name: '晋元高级中学', group: '市重点', color: '#8c1a17' },
    { id: 'jiading',       name: '嘉定一中',     group: '市重点', color: '#14535f' },
    { id: 'shisan',        name: '市三女中',     group: '市重点', color: '#2f5d94' },
    { id: 'yangjing',      name: '洋泾中学',     group: '市重点', color: '#5b3d8c' },
    { id: 'chuansha',      name: '川沙中学',     group: '市重点', color: '#1f3a63' },
    { id: 'gaoqiao',       name: '高桥中学',     group: '市重点', color: '#b8912f' }
  ];

  /* 每局固定 11 档。尺寸按「直径占游戏池宽度的百分比」给（最大 -> 最小）。 */
  var TIER_PCT = [54.4, 41.0, 41.0, 34.4, 28.2, 24.5, 20.2, 15.7, 14.4, 10.6, 7.0];
  var TIER_COUNT = 11;

  /* ---------------- 落球概率 ----------------
   * 第 k 大球（k 从 1 数起，即 TIERS 索引 k-1）的基础概率：
   *     q_k = e^(4.0k - 0.15k²) / Σ_{j=1..11} e^(4.0j - 0.15j²)
   * 指数是条开口向下的抛物线（顶点在 k≈13.3），所以在 1..11 上单调递增、但越来越平：
   * 相邻两档之比 = e^(3.85 - 0.3k)，从 34.8 一路降到 2.34 —— 小球占多数、大球也不会彻底绝迹。
   * 实测分布：第 11 档 62.47%、第 10 档 26.70%、第 9 档 8.45%、第 8 档 1.98%，第 1 档只有 2e-10。
   */
  var TIER_PROB = (function () {
    var raw = [], k, i, denom = 0;
    for (k = 1; k <= TIER_COUNT; k++) {
      var x = 4.0 * k - 0.15 * k * k;
      raw.push(Math.exp(x));
      denom += Math.exp(x);
    }
    return raw.map(function (w) { return w / denom; });
  })();
  var DROP_P_MIN = 0.01;      // 概率 ≥1% 的档位在合成链里高亮成「可投放」

  /* ---------------- 避免连出 ----------------
   * 设上一颗掉的是第 k 大球、而且已经连续掉了 n 颗，那么这一颗还是它的概率变成
   *     P'(k) = P(k) · T^(-n)
   * 让出来的 P(k)·(1 - T^(-n)) 按 e^i 的权重比例（也就是基础概率的比例）
   * 分给其余所有球 i ≠ k：
   *     P'(i) = P(i) + P(k)(1 - T^(-n)) · e^i / Σ_{j≠k} e^j
   * 于是 P' 仍然是一个概率分布（和为 1），而且越连出越难再抽到它。
   * T 是个固定常数（现在是 1.8）；T = 1 就退化成没开这个机制。
   */
  var ANTI_REPEAT_T = 1.8;
  var ANTI_REPEAT = { last: -1, n: 0 };

  function resetAntiRepeat() { ANTI_REPEAT.last = -1; ANTI_REPEAT.n = 0; }

  /* 把「避免连出」叠在任意权重函数 base 上，返回一个新的权重函数 */
  function withAntiRepeat(base, last) {
    var prev = ANTI_REPEAT.last, n = ANTI_REPEAT.n;
    if (prev < 0 || n <= 0 || ANTI_REPEAT_T === 1) return base;
    var wPrev = base(prev);
    if (!(wPrev > 0)) return base;
    var total = 0;
    for (var i = 0; i <= last; i++) total += base(i);
    var restW = total - wPrev;
    if (!(restW > 0)) return base;
    var damp = Math.pow(ANTI_REPEAT_T, -n);
    var factor = 1 + wPrev * (1 - damp) / restW;
    return function (i) { return i === prev ? wPrev * damp : base(i) * factor; };
  }

  /* 当前这一颗的实际分布（基础权重 + 避免连出修正，已归一化；给测试用） */
  function dropProb() {
    var last = TIERS.length - 1;
    if (last < 0) return [];
    var base = spanTop < 0
      ? function (i) { return TIER_PROB[i]; }
      : function (i) { return i < spanTop ? 0 : Math.pow(DROP_RARE, last - i); };
    var w = withAntiRepeat(base, last);
    var total = 0, out = [];
    for (var i = 0; i <= last; i++) total += w(i);
    for (var j = 0; j <= last; j++) out.push(w(j) / total);
    return out;
  }

  /* ---------------- 场地参数 ----------------
   * 以前是 420 × 700 的框，警戒虚线画在 y=128，上面 128px 是纯死区。
   * 现在把框顶挪到那条虚线上（虚线就是框顶），再去掉死区、整体等比放大
   * 700/572 ≈ 1.2238 倍，让纵向长度仍然保持 700：
   *     宽 420 × 700/572 ≈ 514，高 700
   * 球的大小是按「池宽的百分比」算的，所以框变宽时球跟着一起等比放大。
   */
  var H = 700;
  var BOX_SCALE = 700 / 572;           // 572 = 原来 700 高的框减去 128 的死区
  var W = Math.round(420 * BOX_SCALE); // 514
  /* 警戒线：框顶往下 52px（约等于最大的可投放球的半径）。
     之前贴着框顶（2px）时，刚性天花板会让球堆顶停在离顶几像素的地方，
     永远进不了那 2px 的判定带，于是「看着顶到顶了却死不了」。 */
  var DANGER_Y = 52;
  var DROP_PAD = 4;                   // 球出现时贴着框顶：y = r + DROP_PAD
  var COOLDOWN = 0.34;
  var DROP_RARE = 0.62;       // 三击放宽上限后每往上一档的概率衰减系数
  var TAP_GAP = 600;          // 连点三下的最大间隔（毫秒）
  var FIXED = 1 / 120;

  /* 某一档球「待投放」时的球心 y：贴着框顶 */
  function dropY(tier) { return tier.r + DROP_PAD; }

  /* ---------------- 开局选项 ----------------
   * 球大小：离散 3 档（标准 / 大 10% / 特大 20%），整体缩放全部球的半径。
   * 多一所四校：第二大、第三大各随机抽一所四校（默认只抽一所当次大球）。
   */
  var SIZES = [
    { scale: 1,   name: '标准',     short: '标准' },
    { scale: 1.1, name: '大 10%',   short: '大' },
    { scale: 1.2, name: '特大 20%', short: '特大' }
  ];

  /* ---------------- DOM ---------------- */
  var $ = function (id) { return document.getElementById(id); };
  var selectScreen = $('selectScreen'), gameScreen = $('gameScreen');
  var gridEl = $('schoolGrid'), startBtn = $('startBtn');
  var poolHint = $('poolHint'), bestScoreEl = $('bestScore');
  var stageEl = $('stage'), cvs = $('canvas'), ctx = cvs.getContext('2d');
  var scoreVal = $('scoreVal'), bestVal = $('bestVal');
  var goalLogo = $('goalLogo'), goalName = $('goalName'), goalTip = $('goalTip');
  var chainEl = $('chain'), overlay = $('overlay');
  var ovTitle = $('ovTitle'), ovText = $('ovText');
  var shareModal = $('shareModal'), sharePreview = $('sharePreview'), toastEl = $('toast');
  var sizeSeg = $('sizeSeg'), sizeLabel = $('sizeLabel');
  var extraFourBtn = $('extraFourBtn');

  /* ---------------- 状态 ---------------- */
  var IMAGES = {};
  var TIERS = [];
  var SCORE = [];
  var world = null;
  var chosenId = null;
  var running = false;
  var gameOver = false;
  var won = false;
  var score = 0;
  var best = 0;
  var overTimer = 0;
  var warnLevel = 0;
  var cooldown = 0;
  var heldX = W / 2;
  var heldTier = 0;
  var dragging = false;
  var particles = [];
  var popups = [];
  var acc = 0;
  var last = 0;
  var rafId = 0;
  var starting = false;
  var sizeStep = 0;
  var extraFour = false;
  var spanTop = -1;
  var taps = { i: -1, n: 0, t: 0 };
  var soundOn = true;
  var paused = false;
  var toastTimer = 0;

  try { best = parseInt(localStorage.getItem('bigschool_best') || '0', 10) || 0; } catch (e) { best = 0; }

  /* ============================================================
   * 图片预加载
   * ============================================================ */
  function preload() {
    return Promise.all(SCHOOLS.map(function (s) {
      return new Promise(function (res) {
        var im = new Image();
        im.onload = im.onerror = function () { IMAGES[s.id] = im; res(); };
        im.src = 'logos/' + s.id + '.png';
      });
    }));
  }

  /* ============================================================
   * 选校界面
   * ============================================================ */
  function renderGrid() {
    gridEl.innerHTML = '';
    SCHOOLS.forEach(function (s, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'card' + (s.id === chosenId ? ' selected' : '');
      btn.dataset.id = s.id;
      btn.dataset.group = s.group;
      btn.innerHTML =
        '<span class="rank">' + s.group + '</span>' +
        '<span class="idx">#' + (i + 1) + '</span>' +
        '<img src="logos/' + s.id + '.png" alt="' + s.name + '" draggable="false">' +
        '<span class="name">' + s.name + '</span>';
      btn.addEventListener('click', function () { selectSchool(s.id); });
      gridEl.appendChild(btn);
    });
    updateStartBtn();
  }

  function findSchool(id) {
    for (var i = 0; i < SCHOOLS.length; i++) if (SCHOOLS[i].id === id) return SCHOOLS[i];
    return null;
  }

  function selectSchool(id) {
    chosenId = id;
    Array.prototype.forEach.call(gridEl.children, function (c) {
      c.classList.toggle('selected', c.dataset.id === id);
    });
    updateStartBtn();
  }

  function updateStartBtn() {
    var s = findSchool(chosenId);
    if (!s) {
      startBtn.disabled = true;
      startBtn.textContent = '先选一所学校';
    } else {
      startBtn.disabled = false;
      startBtn.textContent = '开始游戏 · ' + s.name + ' 当球王';
    }
  }

  function updateHint() {
    poolHint.textContent = '每局 11 档：你选的学校当最大球，再随机配 ' +
      (extraFour ? '2 所四校、4 所现有学校（上实 / 八大 / 进才）和 4 所市重点' :
        '1 所四校、4 所现有学校（上实 / 八大 / 进才）和 5 所市重点') +
      '。基础落球概率 q(k) = e^(4k-0.15k²) / Σ_{j=1..11} e^(4j-0.15j²)，越大的球越难掉出来' +
      '（概率 ≥1% 的只有最小的 4 档）；另外开了「避免连出」：连着出同一颗球时，' +
      '下一颗还是它的概率乘 T^(-n)（T = ' + ANTI_REPEAT_T + '），' +
      '让出来的概率在其余档位里按基础权重成比例分掉。';
  }

  function refreshBest() {
    bestScoreEl.textContent = best;
    bestVal.textContent = best;
  }

  /* ---------------- 球大小：离散滑块 ----------------
   * 轨道和标签行左右都内缩半个旋钮；停靠点、旋钮、填色、标签全按同一个百分比 k/(n-1) 定位，
   * 所以任何宽度下都对得齐，不需要额外的补丁。
   */
  var sizeUi = null;

  function stopPct(k) { return k / (SIZES.length - 1) * 100 + '%'; }

  function renderSizeSlider() {
    var el = function (tag, cls, parent) {
      var e = document.createElement(tag);
      e.className = cls;
      parent.appendChild(e);
      return e;
    };
    var rail = el('div', 'range-rail', sizeSeg);
    var labels = el('div', 'range-labels', sizeSeg);
    sizeUi = { rail: rail, fill: el('span', 'range-fill', rail), dots: [], names: [] };
    SIZES.forEach(function (s, i) {
      var dot = el('i', 'range-dot', rail);
      var name = el('span', 'range-name', labels);
      dot.style.left = name.style.left = stopPct(i);
      name.textContent = s.short;
      sizeUi.dots.push(dot);
      sizeUi.names.push(name);
    });
    sizeUi.knob = el('span', 'range-knob', rail);
    sizeSeg.setAttribute('aria-valuemin', 0);
    sizeSeg.setAttribute('aria-valuemax', SIZES.length - 1);
    setSizeStep(sizeStep);
  }

  function setSizeStep(k) {
    sizeStep = clamp(k, 0, SIZES.length - 1);
    sizeUi.fill.style.width = sizeUi.knob.style.left = stopPct(sizeStep);
    sizeUi.dots.forEach(function (d, i) { d.classList.toggle('on', i <= sizeStep); });
    sizeUi.names.forEach(function (n, i) { n.classList.toggle('cur', i === sizeStep); });
    sizeLabel.textContent = SIZES[sizeStep].name;
    sizeSeg.setAttribute('aria-valuenow', sizeStep);
    sizeSeg.setAttribute('aria-valuetext', SIZES[sizeStep].name);
  }

  /* 吸附到最近的停靠点 */
  function pickSizeStep(e) {
    var r = sizeUi.rail.getBoundingClientRect();
    setSizeStep(Math.round(clamp((e.clientX - r.left) / r.width, 0, 1) * (SIZES.length - 1)));
  }

  /* ============================================================
   * 分档 & 精灵图
   * ============================================================ */
  /* 从数组里随机抽 n 个不重复的元素 */
  function pickRandom(list, n) {
    var pool = list.slice(), out = [];
    while (out.length < n && pool.length) {
      out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    return out;
  }

  /* 凑出本局的 11 所学校（索引 0 最大）
   *   选中的学校 + 1 所四校 + 现有球（上实 / 八大 / 进才）里 4 所 + 市重点里 5 所
   * 除选中的球王固定占第 0 档外，其余 10 所按 SCHOOLS 的默认大小顺序排列。
   */
  function buildTierSchools() {
    var chosen = findSchool(chosenId);
    if (!chosen) return [];
    var from = function (test) {
      return SCHOOLS.filter(function (s) { return s.id !== chosenId && test(s.group); });
    };
    var fourN = extraFour ? 2 : 1;             // 开了「多一所四校」就多抽一所，名额从市重点里让

    var rest = [].concat(
      pickRandom(from(function (g) { return g === '四校'; }), fourN),
      // 现有球：四校以外的老名单（上海实验学校 / 八大 / 进才）
      pickRandom(from(function (g) { return g !== '四校' && g !== '市重点'; }), 4),
      pickRandom(from(function (g) { return g === '市重点'; }), 6 - fourN)
    );
    // 除球王外按默认大小排，四校在 SCHOOLS 最前，所以抽到的四校正好是第二、第三大
    rest.sort(function (a, b) { return SCHOOLS.indexOf(a) - SCHOOLS.indexOf(b); });
    return [chosen].concat(rest);
  }

  function buildTiers() {
    var ordered = buildTierSchools();
    var n = ordered.length;

    TIERS = ordered.map(function (s, i) {
      return {
        school: s,
        index: i,
        r: W * TIER_PCT[i] / 200 * SIZES[sizeStep].scale,   // 直径占池宽 pct% -> 半径
        color: s.color,
        img: IMAGES[s.id]
      };
    });

    SCORE = TIERS.map(function (_, t) { return (n - t) * (n - t + 1) / 2; });
    SCORE[0] = 0;

    TIERS.forEach(makeSprite);
  }

  function makeSprite(tier) {
    var r = tier.r;
    var size = Math.ceil(r * 2 + 6);
    var ss = 2;
    var c = document.createElement('canvas');
    c.width = c.height = size * ss;
    var g = c.getContext('2d');
    g.scale(ss, ss);
    var cx = size / 2, cy = size / 2;

    // 底盘
    g.save();
    g.beginPath(); g.arc(cx, cy, r - 0.5, 0, Math.PI * 2);
    g.fillStyle = '#ffffff';
    g.fill();
    g.restore();

    // 校徽（裁圆）
    g.save();
    g.beginPath(); g.arc(cx, cy, r - 1.2, 0, Math.PI * 2); g.clip();
    var im = tier.img;
    if (im && im.complete && im.naturalWidth) {
      var d = r * 2 * 0.93;
      g.drawImage(im, cx - d / 2, cy - d / 2, d, d);
    } else {
      g.fillStyle = '#eef1f5'; g.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    g.restore();

    // 边缘：暗描边把相邻的球分开，细彩环标识学校
    g.beginPath(); g.arc(cx, cy, r - 0.9, 0, Math.PI * 2);
    g.strokeStyle = 'rgba(0,0,0,.30)'; g.lineWidth = 1.6; g.stroke();
    g.beginPath(); g.arc(cx, cy, r - 2.5, 0, Math.PI * 2);
    g.strokeStyle = hexA(tier.color, 0.5); g.lineWidth = 1; g.stroke();

    tier.sprite = c;
    tier.spriteSize = size;
  }

  function hexA(hex, a) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var num = parseInt(h, 16);
    return 'rgba(' + ((num >> 16) & 255) + ',' + ((num >> 8) & 255) + ',' + (num & 255) + ',' + a + ')';
  }

  /* ============================================================
   * 开局
   * ============================================================ */
  function startGame() {
    if (!chosenId || starting) return;
    starting = true;
    enableMotion();                 // 留在点击的同步栈里（iOS 要用户手势）
    ready.then(function () {
      starting = false;
      beginRound();
    });
  }

  function beginRound() {
    buildTiers();

    world = new P.World(W, H);

    score = 0;
    gameOver = false;
    won = false;
    overTimer = 0;
    warnLevel = 0;
    cooldown = 0;
    acc = 0;
    last = 0;
    dragging = false;
    particles = [];
    popups = [];
    cam.x = cam.y = cam.vx = cam.vy = cam.r = cam.vr = 0;
    M.tilt = M.sx = M.sy = M.smx = M.smy = M.dcx = M.dcy = 0;
    M.bi = 0;                                       // 重新校准「什么叫水平」
    heldX = W / 2;
    resetAntiRepeat();
    heldTier = randTier();
    spanTop = -1;
    taps.i = -1;
    taps.n = 0;

    selectScreen.hidden = true;
    gameScreen.hidden = false;
    overlay.hidden = true;

    scoreVal.textContent = '0';
    goalLogo.src = 'logos/' + TIERS[0].school.id + '.png';
    goalName.textContent = TIERS[0].school.name;
    goalTip.textContent = '合出它即通关';

    renderChain();
    resize();
    requestAnimationFrame(function () { resize(); });

    running = true;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(frame);
  }

  /* 可投放的上限档位：默认是概率 ≥ DROP_P_MIN 的最大一档；三击某校后放宽到它那一档 */
  function dropTop() {
    if (spanTop >= 0) return spanTop;
    for (var i = 0; i < TIER_PROB.length; i++) if (TIER_PROB[i] >= DROP_P_MIN) return i;
    return TIER_PROB.length - 1;
  }

  /* 默认按 q(k) = e^(4k-0.15k²) / Σ_{j=1..11} e^(4j-0.15j²) 抽；三击放宽后只在 [上限, 最小档] 里抽，
   * 越大越稀有（按 DROP_RARE 几何衰减）。两种情况都再叠一层「避免连出」。 */
  function randTier() {
    var last = TIERS.length - 1, k;
    var base = spanTop < 0
      ? function (i) { return TIER_PROB[i]; }
      : function (i) { return i < spanTop ? 0 : Math.pow(DROP_RARE, last - i); };
    var w = withAntiRepeat(base, last);
    var total = 0;
    for (k = 0; k <= last; k++) total += w(k);
    var r = Math.random() * total, acc = 0, pick = last;
    for (k = 0; k < last; k++) {
      acc += w(k);
      if (r < acc) { pick = k; break; }
    }
    if (pick === ANTI_REPEAT.last) ANTI_REPEAT.n++;
    else { ANTI_REPEAT.last = pick; ANTI_REPEAT.n = 1; }
    return pick;
  }

  function isDroppable(i) {
    return i >= dropTop();
  }

  /* 连点三下链条上的某所学校：把它的档位设成投放上限，再点三下还原 */
  function chipTap(i) {
    var now = Date.now();
    if (taps.i === i && now - taps.t < TAP_GAP) taps.n++;
    else { taps.i = i; taps.n = 1; }
    taps.t = now;
    if (taps.n < 3) return;
    taps.n = 0;
    if (i < (extraFour ? 3 : 2)) return;      // 球王和四校不给放宽
    spanTop = spanTop === i ? -1 : i;
    renderChain();
  }

  function renderChain() {
    chainEl.innerHTML = '';
    TIERS.forEach(function (t, i) {
      if (i > 0) {
        var a = document.createElement('span');
        a.className = 'arrow';
        a.textContent = '›';
        chainEl.appendChild(a);
      }
      var chip = document.createElement('div');
      chip.className = 'chip' + (isDroppable(i) ? ' drop' : '');
      var sz = Math.round(14 + 16 * (1 - i / (TIERS.length - 1)));
      chip.innerHTML = '<img src="logos/' + t.school.id + '.png" width="' + sz + '" height="' + sz + '" alt="">' +
        '<span class="cn">' + t.school.name + '</span>';
      chip.title = t.school.name + '（连点三下调整投放上限）';
      chip.addEventListener('click', function () { chipTap(i); });
      chainEl.appendChild(chip);
    });
  }

  function backToSelect() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    gameScreen.hidden = true;
    selectScreen.hidden = false;
    overlay.hidden = true;
    refreshBest();
  }

  /* ============================================================
   * 投放
   * ============================================================ */
  function tryDrop() {
    if (!running || gameOver || paused || cooldown > 0) return;
    var t = TIERS[heldTier];
    var x = clamp(heldX, t.r + 2, W - t.r - 2);
    var b = new P.Body({ x: x, y: dropY(t), r: t.r, tier: heldTier, tag: 'ball' });
    b.vy = 120;
    world.add(b);
    heldTier = randTier();
    cooldown = COOLDOWN;
  }

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* ============================================================
   * 合成
   * ============================================================ */
  function handleMerges(events) {
    if (!events.length) return;
    var done = new Set();
    for (var k = 0; k < events.length; k++) {
      var a = events[k][0], b = events[k][1];
      if (a.dead || b.dead || done.has(a) || done.has(b)) continue;
      done.add(a); done.add(b);

      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      var t = a.tier;
      var vx = (a.vx + b.vx) / 2, vy = (a.vy + b.vy) / 2;

      world.remove(a);
      world.remove(b);

      if (t === 0) {
        // 两颗球王相撞 → 一起消失，大额奖励
        addScore(300, mx, my);
        burst(mx, my, TIERS[0].color, 34, 420);
        ring(mx, my, TIERS[0].r * 0.8, TIERS[0].color);
        kick(13);
        sfx(0, 0.5);
        continue;
      }

      var nt = t - 1;
      var info = TIERS[nt];
      var nb = new P.Body({ x: mx, y: my, r: info.r, tier: nt, tag: 'ball' });
      nb.vx = vx * 0.5;
      nb.vy = vy * 0.5 - 55;
      nb.omega = (a.omega + b.omega) * 0.3;
      nb.sq = 0.13;                                   // 出生时带一点挤压，看起来更弹
      nb.sqAngle = Math.random() * Math.PI;
      world.add(nb);

      addScore(SCORE[t], mx, my);
      burst(mx, my, info.color, Math.min(26, 8 + nt * 1.6), 150 + info.r * 5);
      ring(mx, my, info.r * 0.6, info.color);
      kick(Math.min(9, 1.5 + info.r * 0.07));
      sfx(t, Math.min(0.4, 0.08 + (TIERS.length - t) * 0.02));

      if (nt === 0 && !won) {
        won = true;
        showWin();
      }
    }
  }

  function addScore(v, x, y) {
    score += v;
    scoreVal.textContent = score;
    if (score > best) {
      best = score;
      bestVal.textContent = best;
      try { localStorage.setItem('bigschool_best', String(best)); } catch (e) { }
    }
    popups.push({ x: x, y: y, life: 0.9, max: 0.9, text: '+' + v });
  }

  function burst(x, y, color, n, speed) {
    for (var i = 0; i < n; i++) {
      var ang = Math.random() * Math.PI * 2;
      var sp = speed * (0.35 + Math.random() * 0.75);
      particles.push({
        x: x, y: y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 60,
        r: 1.5 + Math.random() * 3.5,
        life: 0.45 + Math.random() * 0.45,
        max: 0.9,
        color: color,
        kind: 'dot'
      });
    }
  }

  function ring(x, y, r, color) {
    particles.push({ x: x, y: y, r: r, r0: r, r1: r * 2.4, life: 0.42, max: 0.42, color: color, kind: 'ring' });
  }

  /* ============================================================
   * 音效（WebAudio 合成，无需素材）
   * ============================================================ */
  var actx = null;
  function audio() {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }

  function sfx(tier, vol) {
    if (!soundOn) return;
    try {
      var a = audio(), now = a.currentTime;
      var base = 200 + (TIERS.length - tier) * 34;
      var o = a.createOscillator(), g = a.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(base, now);
      o.frequency.exponentialRampToValueAtTime(base * 1.9, now + 0.09);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(vol || 0.2, now + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      o.connect(g); g.connect(a.destination);
      o.start(now); o.stop(now + 0.24);
    } catch (e) { /* 忽略 */ }
  }

  /* ============================================================
   * 体感：手机不是惯性系，球除了重力还受一个惯性力 -a（a = 手机加速度）。
   * 所以「重力歪了」和「球被甩出去」是同一个 g_eff = 重力 - a 的两张脸：
   * 低频（姿态）-> 重力方向，高频（线性加速度）-> 甩动。
   * 估出 g_eff 整块交给物理引擎当重力；镜头抖动也由同一个力驱动一根弹簧，
   * 不单独写一套（合成冲击踢的也是这根弹簧）。
   * ============================================================ */
  var G0 = 2600, DEG = Math.PI / 180;
  var M = {
    on: 0, gcx: 0, acx: 0, acy: 0, dcx: 0, dcy: 0, smx: 0, smy: 0,
    lpx: 0, lpy: 0, lpi: 0, base: 0, bi: 0, tilt: 0, tx: 0, ty: G0, sx: 0, sy: 0
  };
  var cam = { x: 0, y: 0, vx: 0, vy: 0, r: 0, vr: 0 };

  function lp(c, t, tau, dt) { return c + (t - c) * (1 - Math.exp(-dt / tau)); }

  /* 软膝：小输入迟钝、大输入饱和 */
  function knee(v, d, s) {
    var m = Math.abs(v) - d;
    if (m <= 0) return 0;
    var t = Math.min(1, m / s);
    return (v < 0 ? -1 : 1) * t * t;
  }

  /* 设备坐标（x 右、y 上）-> 画布坐标（y 下），按屏幕旋转重映射 */
  function scrRad() {
    var a = (screen.orientation && typeof screen.orientation.angle === 'number') ? screen.orientation.angle
      : (typeof window.orientation === 'number' ? window.orientation : 0);
    return a * DEG;
  }
  function toCX(x, y) { var a = scrRad(); return x * Math.cos(a) - y * Math.sin(a); }
  function toCY(x, y) { var a = scrRad(); return -(x * Math.sin(a) + y * Math.cos(a)); }

  function onOrient(e) {                            // 低频：重力方向
    if (e.beta == null && e.gamma == null) return;
    var b = (e.beta || 0) * DEG, g = (e.gamma || 0) * DEG;
    M.gcx = toCX(Math.cos(b) * Math.sin(g), -Math.sin(b));
  }

  function onMotion(e) {                            // 高频：线性加速度（m/s²）
    var a = e.acceleration, ix, iy;
    if (a && a.x != null && a.y != null) { ix = a.x; iy = a.y; }
    else {
      var g = e.accelerationIncludingGravity;       // 系统没给就自己减重力
      if (!g || g.x == null || g.y == null) return;
      if (!M.lpi) { M.lpx = g.x; M.lpy = g.y; M.lpi = 1; }
      ix = g.x - M.lpx; iy = g.y - M.lpy;
      M.lpx += (g.x - M.lpx) * 0.06; M.lpy += (g.y - M.lpy) * 0.06;
    }
    M.acx = toCX(ix, iy); M.acy = toCY(ix, iy);
  }

  /* iOS 13+ 必须在用户手势里要权限，所以挂在「开始游戏」的点击上 */
  function enableMotion() {
    if (M.on) return;
    var OE = window.DeviceOrientationEvent, ME = window.DeviceMotionEvent;
    if (!OE && !ME) return;
    var go = function () {
      if (M.on) return;
      M.on = 1;
      window.addEventListener('deviceorientation', onOrient);
      window.addEventListener('devicemotion', onMotion);
    };
    if (!(OE && OE.requestPermission) && !(ME && ME.requestPermission)) { go(); return; }
    var ask = function (C) {
      try { return C && C.requestPermission ? C.requestPermission() : Promise.resolve('na'); }
      catch (x) { return Promise.resolve('na'); }
    };
    Promise.all([ask(OE), ask(ME)]).then(function (r) {
      if (r.indexOf('granted') >= 0) go();
    })['catch'](function () { });
  }

  /* 传感器 -> g_eff（画布坐标，y 向下） */
  function motionUpdate(dt) {
    if (!M.bi) { M.base = M.gcx; M.bi = 1; }        // 开局把当前握持姿势当水平
    else M.base = lp(M.base, M.gcx, 3, dt);
    M.tilt = lp(M.tilt, knee(M.gcx - M.base, 0.04, 0.45) * 15 * DEG, 0.09, dt);
    M.tx = G0 * Math.sin(M.tilt);
    M.ty = G0 * Math.cos(M.tilt);

    M.dcx = lp(M.dcx, M.acx, 1.2, dt);              // 去直流：零偏不会把球慢慢推走
    M.dcy = lp(M.dcy, M.acy, 1.2, dt);
    var rx = M.acx - M.dcx, ry = M.acy - M.dcy, mag = Math.sqrt(rx * rx + ry * ry);
    var amp = mag > 0.35 ? Math.pow(Math.min(1, (mag - 0.35) / 14), 1.1) * 9000 / mag : 0;
    M.smx = lp(M.smx, -rx * amp, 0.035, dt);        // 惯性力 = -a
    M.smy = lp(M.smy, -ry * amp, 0.035, dt);
    M.sx = M.smx; M.sy = M.smy;
  }

  /* 镜头：一根弹簧，被同一个惯性力驱动 */
  function camStep(dt) {
    var dx = (-M.sx + M.tx * 0.25) / G0, dy = (-M.sy + (M.ty - G0) * 0.25) / G0;
    spring('x', 'vx', dx * 42000, 31.4, 0.42, 28, dt);
    spring('y', 'vy', dy * 42000, 31.4, 0.42, 28, dt);
    spring('r', 'vr', dx * 40, 25.1, 0.5, 0.045, dt);
  }
  function spring(pk, vk, drive, w, z, max, dt) {
    cam[vk] += (-w * w * cam[pk] - 2 * z * w * cam[vk] + drive) * dt;
    cam[pk] += cam[vk] * dt;
    if (cam[pk] > max) { cam[pk] = max; cam[vk] *= 0.5; }
    else if (cam[pk] < -max) { cam[pk] = -max; cam[vk] *= 0.5; }
  }
  function kick(m) {                                // 合成冲击踢同一根弹簧
    var a = Math.random() * Math.PI * 2;
    cam.vx += Math.cos(a) * m * 26;
    cam.vy += Math.sin(a) * m * 22 - m * 6;
    cam.vr += (Math.random() - 0.5) * m * 0.004;
  }

  /* ============================================================
   * 主循环
   * ============================================================ */
  function frame(t) {
    if (!running) return;
    rafId = requestAnimationFrame(frame);
    if (!last) last = t;
    var dt = (t - last) / 1000;
    last = t;
    if (dt > 0.06) dt = 0.06;
    update(dt);
    render();
  }

  function update(dt) {
    if (!paused) {
      motionUpdate(dt);
      camStep(dt);
      // 有效重力 = 重力 - 手机加速度；往上最多托到 -1000，别把球甩出池子
      world.gravity = Math.max(-1000, M.ty + M.sy);
      world.gravityX = M.tx + M.sx;
      // 流化：滚阻随有效重量走。失重时法向力为 0，球才滑得动、堆才会重新码放
      world.rollDamp = 0.045 * clamp(world.gravity / G0, 0, 1);
    }

    if (cooldown > 0) cooldown = Math.max(0, cooldown - dt);

    if (!gameOver && !paused) {
      acc += dt;
      var steps = 0;
      while (acc >= FIXED && steps < 8) {
        world.step(FIXED);
        handleMerges(world.drainMerges());
        acc -= FIXED;
        steps++;
      }
      if (steps >= 8) acc = 0;
      checkOver(dt);
    }

    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      if (p.kind === 'dot') {
        p.vy += 900 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= Math.pow(0.98, dt * 60);
      } else {
        p.r = p.r0 + (p.r1 - p.r0) * (1 - p.life / p.max);
      }
    }

    for (var j = popups.length - 1; j >= 0; j--) {
      var q = popups[j];
      q.life -= dt;
      q.y -= 42 * dt;
      if (q.life <= 0) popups.splice(j, 1);
    }
  }

  function checkOver(dt) {
    var danger = false;
    for (var i = 0; i < world.bodies.length; i++) {
      var b = world.bodies[i];
      if (b.age > 1.1 && b.y - b.r < DANGER_Y) { danger = true; break; }
    }
    if (danger) {
      overTimer += dt;
      if (overTimer > 1.3) endGame();
    } else {
      overTimer = Math.max(0, overTimer - dt * 2.2);
    }
    warnLevel = Math.min(1, overTimer / 1.3);
  }

  function endGame() {
    if (gameOver) return;
    gameOver = true;
    warnLevel = 1;
    showOverlay('装不下了', '本局得分 ' + score + '　最高 ' + best, true);
  }

  function showWin() {
    showOverlay('合出「' + TIERS[0].school.name + '」！',
      '你已经合出了本局最大的球王。继续冲分，或者重新开一局。', false);
  }

  function showOverlay(title, text, isOver) {
    ovTitle.textContent = title;
    ovText.textContent = text;
    $('ovAgain').textContent = isOver ? '再来一局' : '继续游戏';
    overlay.hidden = false;
  }

  /* ============================================================
   * 渲染
   * ============================================================ */
  function render() {
    ctx.save();
    if (Math.abs(cam.x) > 0.05 || Math.abs(cam.y) > 0.05 || Math.abs(cam.r) > 2e-4) {
      ctx.translate(cam.x, cam.y);
      if (Math.abs(cam.r) > 2e-4) {
        ctx.translate(W / 2, H / 2);
        ctx.rotate(cam.r);
        ctx.translate(-W / 2, -H / 2);
      }
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-20, -20, W + 40, H + 40);

    drawDanger();
    drawBalls();
    if (!gameOver) drawHeld();
    drawParticles();
    drawPopups();

    ctx.restore();
  }

  /* 警戒线 = DANGER_Y，线以上到框顶这一条是溢出区 */
  var WARN_H = DANGER_Y + 46;

  function drawDanger() {
    var a = 0.2 + warnLevel * 0.65;
    ctx.save();
    ctx.setLineDash([8, 7]);
    ctx.lineWidth = 1 + warnLevel * 1.2;
    ctx.strokeStyle = 'rgba(224,49,49,' + a + ')';
    ctx.beginPath();
    ctx.moveTo(0, DANGER_Y + 0.5);
    ctx.lineTo(W, DANGER_Y + 0.5);
    ctx.stroke();
    ctx.restore();

    if (warnLevel > 0.05) {
      ctx.save();
      var g = ctx.createLinearGradient(0, 0, 0, WARN_H);
      g.addColorStop(0, 'rgba(224,49,49,' + (warnLevel * 0.14) + ')');
      g.addColorStop(1, 'rgba(224,49,49,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, WARN_H);
      ctx.restore();
    }
  }

  function drawBalls() {
    var bodies = world.bodies;
    for (var i = 0; i < bodies.length; i++) {
      var b = bodies[i];
      var t = TIERS[b.tier];
      if (!t || !t.sprite) continue;
      var s = t.spriteSize;
      ctx.save();
      // 挤压：球心朝接触点挪 r*sq，再沿法线压扁 —— 压扁后的表面正好落在接触点上
      if (b.sq > 0.002) {
        var off = b.r * b.sq;
        ctx.translate(b.x + Math.cos(b.sqAngle) * off, b.y + Math.sin(b.sqAngle) * off);
        ctx.rotate(b.sqAngle);
        ctx.scale(1 + b.sq * 0.15, 1 - b.sq);
        ctx.rotate(-b.sqAngle);
      } else {
        ctx.translate(b.x, b.y);
      }
      ctx.rotate(b.angle);
      ctx.drawImage(t.sprite, -s / 2, -s / 2, s, s);
      ctx.restore();
    }
  }

  function drawHeld() {
    var t = TIERS[heldTier];
    if (!t) return;
    var x = clamp(heldX, t.r + 2, W - t.r - 2);
    var y = dropY(t);                 // 贴着框顶

    ctx.save();
    ctx.globalAlpha = cooldown > 0 ? 0.3 : 1;
    var s = t.spriteSize;
    ctx.drawImage(t.sprite, x - s / 2, y - s / 2, s, s);
    ctx.restore();
  }

  function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var k = Math.max(0, p.life / p.max);
      ctx.save();
      ctx.globalAlpha = k;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      if (p.kind === 'dot') {
        ctx.fillStyle = p.color;
        ctx.fill();
      } else {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.4 * k + 0.6;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawPopups() {
    ctx.save();
    ctx.textAlign = 'center';
    for (var i = 0; i < popups.length; i++) {
      var q = popups[i];
      var k = Math.max(0, q.life / q.max);
      ctx.globalAlpha = Math.min(1, k * 1.6);
      ctx.font = '700 17px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.fillStyle = '#e03131';
      ctx.fillText(q.text, q.x, q.y);
    }
    ctx.restore();
  }

  /* ============================================================
   * 尺寸
   * ============================================================ */
  function resize() {
    if (gameScreen.hidden) return;
    var rect = stageEl.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;
    var s = Math.min((rect.width - 4) / W, (rect.height - 4) / H);
    var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cvs.style.width = (W * s) + 'px';
    cvs.style.height = (H * s) + 'px';
    cvs.width = Math.max(1, Math.round(W * s * dpr));
    cvs.height = Math.max(1, Math.round(H * s * dpr));
    ctx.setTransform(s * dpr, 0, 0, s * dpr, 0, 0);
  }

  /* ============================================================
   * 输入
   * ============================================================ */
  /* 把任意指针位置映射到棋盘坐标；超出边界就夹到边界 */
  function boardX(e) {
    var r = cvs.getBoundingClientRect();
    return clamp((e.clientX - r.left) / r.width * W, 0, W);
  }

  function isUiTarget(e) {
    var t = e.target;
    while (t) {
      if (t.tagName === 'BUTTON' || t.tagName === 'INPUT' || t.tagName === 'A') return true;
      t = t.parentNode;
    }
    return false;
  }

  stageEl.addEventListener('pointerdown', function (e) {
    if (gameScreen.hidden || !overlay.hidden || isUiTarget(e)) return;
    e.preventDefault();
    heldX = boardX(e);
    dragging = true;
    if (e.pointerType !== 'touch') tryDrop();     // 鼠标：按下即投
  });

  window.addEventListener('pointermove', function (e) {
    if (gameScreen.hidden) return;
    if (e.pointerType === 'touch' && !dragging) return;
    heldX = boardX(e);
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    if (gameScreen.hidden || !overlay.hidden) return;
    if (e.pointerType === 'touch') {              // 触摸：松手才投
      heldX = boardX(e);
      tryDrop();
    }
  }
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', function () { dragging = false; });

  stageEl.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  document.addEventListener('keydown', function (e) {
    if (gameScreen.hidden) return;
    if (e.key === 'ArrowLeft') { heldX = clamp(heldX - 18, 0, W); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { heldX = clamp(heldX + 18, 0, W); e.preventDefault(); }
    else if (e.key === ' ' || e.key === 'ArrowDown' || e.key === 'Enter') { tryDrop(); e.preventDefault(); }
  });

  window.addEventListener('resize', function () { resize(); });
  window.addEventListener('orientationchange', function () { setTimeout(resize, 120); });
  document.addEventListener('visibilitychange', function () { last = 0; });

  /* ============================================================
   * 绑定
   * ============================================================ */
  /* 档位条：按下即选，按住左右拖也跟手（指针捕获保证拖出条外也收得到 move） */
  sizeSeg.addEventListener('pointerdown', function (e) {
    sizeSeg.classList.add('drag');
    if (sizeSeg.setPointerCapture) sizeSeg.setPointerCapture(e.pointerId);
    pickSizeStep(e);
  });
  sizeSeg.addEventListener('pointermove', function (e) {
    if (sizeSeg.classList.contains('drag')) pickSizeStep(e);
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (t) {
    sizeSeg.addEventListener(t, function () { sizeSeg.classList.remove('drag'); });
  });
  sizeSeg.addEventListener('keydown', function (e) {
    var d = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key];
    if (e.key === 'Home') d = -sizeStep;
    if (e.key === 'End') d = SIZES.length - 1 - sizeStep;
    if (d === undefined) return;
    e.preventDefault();
    setSizeStep(sizeStep + d);
  });
  extraFourBtn.addEventListener('click', function () {
    extraFour = !extraFour;
    extraFourBtn.classList.toggle('on', extraFour);
    updateHint();
  });
  startBtn.addEventListener('click', startGame);
  $('restartBtn').addEventListener('click', startGame);
  $('backBtn').addEventListener('click', backToSelect);
  $('ovAgain').addEventListener('click', function () {
    if (gameOver) { startGame(); } else { overlay.hidden = true; }
  });
  $('ovChange').addEventListener('click', backToSelect);
  $('soundBtn').addEventListener('click', function () {
    soundOn = !soundOn;
    this.textContent = soundOn ? '🔊' : '🔇';
  });

  $('shareBtn').addEventListener('click', openShare);
  $('ovShare').addEventListener('click', openShare);
  $('shareClose').addEventListener('click', closeShare);
  shareModal.addEventListener('click', function (e) { if (e.target === shareModal) closeShare(); });
  $('shSystem').addEventListener('click', systemShare);
  $('shCopy').addEventListener('click', copyShare);
  [['shQQ', 'qq'], ['shQzone', 'qzone'], ['shWeibo', 'weibo'], ['shBili', 'bili']].forEach(function (p) {
    $(p[0]).addEventListener('click', function () { shareTo(p[1]); });
  });

  /* ============================================================
   * 分享
   * 说明：游戏挂在站点上，分享文案里带上固定网址；
   * 手机上「系统分享」会调起系统面板（里面有微信、朋友圈、QQ、B站）；
   * 桌面端走各家的网页分享入口，微信/朋友圈只能复制文案自己粘。
   * ============================================================ */
  var SHARE_URL = 'https://catrix.net/games/big-school';

  function shareText() {
    var goal = TIERS.length ? TIERS[0].school.name : '学校';
    var head = won
      ? '我在《合成大 · 学校》里把【' + goal + '】合出来了！'
      : '我在《合成大 · 学校》里拿了 ';
    var tail = won ? '' : '本局球王是' + goal + '，';
    return head + score + ' 分（最高 ' + best + ' 分）。' + tail +
      '你能合到哪一所？来玩：' + SHARE_URL;
  }

  function openShare() {
    if (!shareModal) return;
    sharePreview.textContent = shareText();
    shareModal.hidden = false;
    paused = true;
    var sys = $('shSystem');
    if (sys) sys.hidden = !(navigator.share || navigator.canShare);
  }

  function closeShare() {
    if (!shareModal) return;
    shareModal.hidden = true;
    paused = false;
    last = 0;
  }

  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('on'); }, 1700);
  }

  function legacyCopy(t) {
    try {
      var ta = document.createElement('textarea');
      ta.value = t;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }

  function copyShare() {
    var t = shareText();
    var done = function (ok) { toast(ok ? '已复制，去粘贴吧' : '复制失败，请手动选中文字'); };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(t).then(function () { done(true); }, function () { done(legacyCopy(t)); });
        return;
      }
    } catch (e) { /* 落到兜底 */ }
    done(legacyCopy(t));
  }

  function openUrl(u) {
    try { window.open(u, '_blank', 'noopener,noreferrer'); } catch (e) { /* 被拦就算了 */ }
  }

  function systemShare() {
    var t = shareText();
    try {
      if (navigator.share) {
        navigator.share({ title: '合成大 · 学校', text: t })['catch'](function () { });
        return;
      }
    } catch (e) { /* 落到复制 */ }
    copyShare();
  }

  var SHARE_ENDPOINT = {
    qq: 'https://connect.qq.com/widget/shareqq/index.html',
    qzone: 'https://sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshare_onekey'
  };

  function shareTo(kind) {
    var t = shareText();
    var url = SHARE_URL;          // 用站点上的固定地址，file:// 打开时也分享得出去
    var enc = encodeURIComponent;
    if (SHARE_ENDPOINT[kind]) {
      openUrl(SHARE_ENDPOINT[kind] + '?title=' + enc('合成大 · 学校') + '&summary=' + enc(t) + '&url=' + enc(url));
    } else if (kind === 'weibo') {
      openUrl('https://service.weibo.com/share/share.php?title=' + enc(t));
    } else if (kind === 'bili') {
      copyShare();
      openUrl('https://t.bilibili.com/');
      toast('文案已复制，粘贴到 B站动态就行');
    }
  }

  /* ============================================================
   * 启动
   * ============================================================ */
  refreshBest();
  updateHint();
  renderGrid();
  renderSizeSlider();
  var ready = preload();

  window.__bigschool = {
    get tiers() { return TIERS; },
    get world() { return world; },
    get score() { return score; },
    SCHOOLS: SCHOOLS,
    TIER_PCT: TIER_PCT,
    TIER_PROB: TIER_PROB,
    DROP_P_MIN: DROP_P_MIN,
    SHARE_URL: SHARE_URL,
    shareText: shareText,
    randTier: randTier,            // 暴露出来给测试做分布抽样
    dropProb: dropProb,
    ANTI_REPEAT_T: ANTI_REPEAT_T,
    get antiRepeat() { return { last: ANTI_REPEAT.last, n: ANTI_REPEAT.n }; },
    resetAntiRepeat: resetAntiRepeat,
    W: W, H: H, DANGER_Y: DANGER_Y, DROP_PAD: DROP_PAD, dropY: dropY,
    get dropTop() { return dropTop(); },
    motion: M, cam: cam, kick: kick
  };
})();
