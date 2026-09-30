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
   * 第 k 大球（k 从 1 数起，即 TIERS 索引 k-1）的出现概率：
   *     P(k) = exp(k) / Σ_{i=1..11} exp(i)
   * 概率随 k 指数上升，所以实际能掉下来的基本是最小的几档：
   * 7~11 档（索引 6~10）合计约 99.3%，1~6 档合计只有 0.67%。
   */
  var TIER_PROB = (function () {
    var raw = [], sum = 0, k, w;
    for (k = 1; k <= TIER_COUNT; k++) { w = Math.exp(k); raw.push(w); sum += w; }
    return raw.map(function (x) { return x / sum; });
  })();
  var DROP_P_MIN = 0.01;      // 概率 ≥1% 的档位在合成链里高亮成「可投放」

  /* ---------------- 场地参数 ---------------- */
  var W = 420, H = 700;
  var DROP_Y = 64;
  var DANGER_Y = 128;
  var COOLDOWN = 0.34;
  var FIXED = 1 / 120;

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
  var shake = 0;
  var acc = 0;
  var last = 0;
  var rafId = 0;
  var viewScale = 1;
  var soundOn = true;

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

  function selectSchool(id) {
    chosenId = id;
    Array.prototype.forEach.call(gridEl.children, function (c) {
      c.classList.toggle('selected', c.dataset.id === id);
    });
    updateStartBtn();
  }

  function updateStartBtn() {
    var s = SCHOOLS.filter(function (x) { return x.id === chosenId; })[0];
    if (!s) {
      startBtn.disabled = true;
      startBtn.textContent = '先选一所学校';
    } else {
      startBtn.disabled = false;
      startBtn.textContent = '开始游戏 · ' + s.name + ' 当球王';
    }
  }

  function updateHint() {
    poolHint.textContent = '每局 11 档：你选的学校当最大球，再随机配 1 所四校、4 所现有学校' +
      '（上实 / 八大 / 进才）和 5 所市重点。落球概率按 exp(k)/Σexp(i) 给，越大的球越难掉出来。';
  }

  function refreshBest() {
    bestScoreEl.textContent = best;
    bestVal.textContent = best;
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
    var chosen = SCHOOLS.filter(function (s) { return s.id === chosenId; })[0];
    if (!chosen) return [];

    // 1 所四校（选中的是四校就换一所）
    var four = pickRandom(SCHOOLS.filter(function (s) {
      return s.group === '四校' && s.id !== chosenId;
    }), 1);

    // 现有球里 4 所（四校以外的老名单：上海实验学校 / 八大 / 进才）
    var legacy = pickRandom(SCHOOLS.filter(function (s) {
      return s.group !== '四校' && s.group !== '市重点' && s.id !== chosenId;
    }), 4);

    // 新增市重点里 5 所
    var fresh = pickRandom(SCHOOLS.filter(function (s) {
      return s.group === '市重点' && s.id !== chosenId;
    }), 5);

    var rest = four.concat(legacy, fresh);
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
        r: W * TIER_PCT[i] / 200,          // 直径占池宽 pct% -> 半径
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
    if (!chosenId) return;
    ready.then(function () { reallyStart(); });
  }

  function reallyStart() {
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
    shake = 0;
    dragging = false;
    particles = [];
    popups = [];
    heldX = W / 2;
    heldTier = randTier();

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

  /* 按 P(k) = exp(k) / Σ exp(i) 抽下一颗要投放的球（返回 TIERS 索引） */
  function randTier() {
    var r = Math.random(), acc = 0;
    for (var i = 0; i < TIER_PROB.length; i++) {
      acc += TIER_PROB[i];
      if (r < acc) return i;
    }
    return TIER_PROB.length - 1;
  }

  function isDroppable(i) {
    return (TIER_PROB[i] || 0) >= DROP_P_MIN;
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
      chip.title = t.school.name;
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
    var b = new P.Body({ x: x, y: DROP_Y, r: t.r, tier: heldTier, tag: 'ball' });
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
        shake = Math.max(shake, 13);
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
      shake = Math.max(shake, Math.min(9, 1.5 + info.r * 0.07));
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
        p.vx *= 0.98;
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

    if (shake > 0) shake = Math.max(0, shake - dt * 42);
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
    if (shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
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

  function drawDanger() {
    var a = 0.2 + warnLevel * 0.65;
    ctx.save();
    ctx.setLineDash([8, 7]);
    ctx.lineWidth = 1 + warnLevel * 1.2;
    ctx.strokeStyle = 'rgba(224,49,49,' + a + ')';
    ctx.beginPath();
    ctx.moveTo(0, DANGER_Y);
    ctx.lineTo(W, DANGER_Y);
    ctx.stroke();
    ctx.restore();

    if (warnLevel > 0.05) {
      ctx.save();
      var g = ctx.createLinearGradient(0, 0, 0, DANGER_Y + 26);
      g.addColorStop(0, 'rgba(224,49,49,' + (warnLevel * 0.14) + ')');
      g.addColorStop(1, 'rgba(224,49,49,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, DANGER_Y + 26);
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

    var gy = guideY(x);
    ctx.save();
    ctx.setLineDash([5, 8]);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = hexA(t.color, 0.45);
    ctx.beginPath();
    ctx.moveTo(x, DROP_Y + t.r);
    ctx.lineTo(x, gy);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = cooldown > 0 ? 0.3 : 1;
    var s = t.spriteSize;
    ctx.drawImage(t.sprite, x - s / 2, DROP_Y - s / 2, s, s);
    ctx.restore();
  }

  function guideY(x) {
    var y = H;
    var bodies = world.bodies;
    for (var i = 0; i < bodies.length; i++) {
      var b = bodies[i];
      var dx = b.x - x;
      if (Math.abs(dx) < b.r) {
        var top = b.y - Math.sqrt(Math.max(0, b.r * b.r - dx * dx));
        if (top < y) y = top;
      }
    }
    return y;
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
    viewScale = s;
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
    return clamp((e.clientX - r.left) / (viewScale || 1), 0, W);
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
  startBtn.addEventListener('click', startGame);
  $('restartBtn').addEventListener('click', function () { startGame(); });
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
  $('shQQ').addEventListener('click', function () { shareTo('qq'); });
  $('shQzone').addEventListener('click', function () { shareTo('qzone'); });
  $('shWeibo').addEventListener('click', function () { shareTo('weibo'); });
  $('shBili').addEventListener('click', function () { shareTo('bili'); });

  /* ============================================================
   * 分享
   * 说明：这是个本地 HTML，没有可分享的网址，所以分享的是「文案」。
   * 手机上「系统分享」会调起系统面板（里面有微信、朋友圈、QQ、B站）；
   * 桌面端走各家的网页分享入口，微信/朋友圈只能复制文案自己粘。
   * ============================================================ */
  var toastTimer = 0;
  var paused = false;

  function shareText() {
    var goal = TIERS.length ? TIERS[0].school.name : '学校';
    var head = won
      ? '我在《合成大 · 学校》里把【' + goal + '】合出来了！'
      : '我在《合成大 · 学校》里拿了 ';
    var tail = won ? '' : '本局球王是' + goal + '，';
    return head + score + ' 分（最高 ' + best + ' 分）。' + tail + '你能合到哪一所？';
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

  function shareTo(kind) {
    var t = shareText();
    var url = '';
    try { url = location.href; } catch (e) { url = ''; }
    var enc = encodeURIComponent;
    var title = enc('合成大 · 学校');
    if (kind === 'qq') {
      openUrl('https://connect.qq.com/widget/shareqq/index.html?title=' + title + '&summary=' + enc(t) + '&url=' + enc(url));
    } else if (kind === 'qzone') {
      openUrl('https://sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshare_onekey?title=' + title + '&summary=' + enc(t) + '&url=' + enc(url));
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
  var ready = preload();

  window.__bigschool = {
    get tiers() { return TIERS; },
    get world() { return world; },
    get score() { return score; },
    SCHOOLS: SCHOOLS,
    TIER_PCT: TIER_PCT,
    TIER_PROB: TIER_PROB,
    DROP_P_MIN: DROP_P_MIN,
    W: W, H: H, DANGER_Y: DANGER_Y, DROP_Y: DROP_Y
  };
})();
