/* ============================================================
 * 集成测试：用最小 DOM 桩把 index.html + physics.js + game.js
 * 真跑一遍，验证初始化、选校、分档规则、投球、合成、结束/重开。
 * 用法：node tests/dom.test.mjs
 * ============================================================ */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(HERE, '..');
const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(DIR, 'style.css'), 'utf8');

let fails = 0;
const expect = (c, m) => { console.log((c ? '  \u2713 ' : '  \u2717 FAIL: ') + m); if (!c) fails++; };

const realIds = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));

/* ---------------- 极简 DOM ---------------- */
const missingIds = [];

function makeCtx2D() {
  const grad = { addColorStop() {} };
  const noop = () => {};
  return {
    canvas: null,
    save: noop, restore: noop, translate: noop, rotate: noop, scale: noop,
    setTransform: noop, beginPath: noop, closePath: noop, arc: noop, ellipse: noop,
    moveTo: noop, lineTo: noop, rect: noop, fill: noop, stroke: noop, clip: noop,
    fillRect: noop, clearRect: noop, strokeRect: noop,
    fillText: noop, strokeText: noop, measureText: () => ({ width: 10 }),
    drawImage: noop, setLineDash: noop,
    createLinearGradient: () => grad, createRadialGradient: () => grad,
    globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1,
    font: '', textAlign: '', shadowColor: '', shadowBlur: 0, shadowOffsetY: 0
  };
}

function makeEl(tag, id) {
  const listeners = {};
  const el = {
    tagName: String(tag).toUpperCase(),
    id: id || '',
    children: [],
    dataset: {},
    style: { setProperty(k, v) { this[k] = String(v); } },
    attrs: {},
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
    parentNode: null,
    width: 0, height: 0,
    textContent: '', title: '', src: '', alt: '', type: '',
    disabled: false, hidden: false, checked: false,
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
      contains(c) { return this._s.has(c); },
      toggle(c, on) { if (on === undefined) on = !this._s.has(c); on ? this._s.add(c) : this._s.delete(c); return on; }
    },
    addEventListener(t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
    removeEventListener() {},
    dispatch(t, ev) { (listeners[t] || []).forEach(fn => fn(ev || {})); },
    appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
    getContext() { const c = makeCtx2D(); c.canvas = this; return c; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 520, height: 760, right: 520, bottom: 760 }; },
    querySelector() { return null; },
    focus() {}
  };
  let _html = '';
  Object.defineProperty(el, 'innerHTML', {
    get() { return _html; },
    set(v) { _html = v; if (v === '') el.children.length = 0; }
  });
  return el;
}

const byId = new Map();
for (const id of realIds) byId.set(id, makeEl('div', id));
// 按 index.html 里真实的 hidden 属性初始化，别让桩的默认值骗过测试
for (const m of html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)) {
  if (/\shidden(\s|>|$)/.test(m[0])) {
    const el = byId.get(m[1]);
    if (el) el.hidden = true;
  }
}

const document = {
  _listeners: {},
  getElementById(id) {
    if (!byId.has(id)) { missingIds.push(id); return null; }
    return byId.get(id);
  },
  createElement(tag) { return makeEl(tag); },
  addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); },
  dispatch(t, ev) { (this._listeners[t] || []).forEach(fn => fn(ev || {})); },
  body: makeEl('body')
};

class FakeImage {
  constructor() { this.complete = false; this.naturalWidth = 0; this.onload = null; this.onerror = null; this._src = ''; }
  set src(v) {
    this._src = v;
    setTimeout(() => {
      if (!/\.png$/.test(v)) { this.onerror && this.onerror(); return; }
      this.complete = true; this.naturalWidth = 256; this.naturalHeight = 256;
      this.onload && this.onload();
    }, 0);
  }
  get src() { return this._src; }
}

/* ---------------- 全局环境 ---------------- */
let rafQueue = [];
let rafId = 1;
const store = {};

const sandbox = {
  console,
  setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask,
  Promise, Math, Date, JSON, Object, Array, String, Number, Boolean, Error,
  isFinite, isNaN, parseInt, parseFloat, Set, Map, Symbol,
  document,
  Image: FakeImage,
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  },
  requestAnimationFrame(fn) { const id = rafId++; rafQueue.push({ id, fn }); return id; },
  cancelAnimationFrame(id) { rafQueue = rafQueue.filter(j => j.id !== id); },
  devicePixelRatio: 2,
  navigator: {
    userAgent: 'node',
    share(d) { sandbox.__shared.push(d); return Promise.resolve(); }
  },
  performance: { now: () => Date.now() },
  AudioContext: undefined,
  webkitAudioContext: undefined
};
const winListeners = {};
sandbox.__opened = [];
sandbox.__shared = [];
sandbox.open = (u) => { sandbox.__opened.push(u); };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
sandbox.addEventListener = (t, fn) => { (winListeners[t] = winListeners[t] || []).push(fn); };
sandbox.dispatchWindow = (t, ev) => { (winListeners[t] || []).forEach(fn => fn(ev || {})); };

const ctxObj = vm.createContext(sandbox);

function run(file) {
  vm.runInContext(fs.readFileSync(path.join(DIR, file), 'utf8'), ctxObj, { filename: file });
}

console.log('--- loading ---');
try {
  run('physics.js');
  expect(!!sandbox.SuikaPhysics, 'physics.js exposes SuikaPhysics');
  run('game.js');
  expect(true, 'game.js executed without throwing');
} catch (e) {
  expect(false, 'script load threw: ' + e.message + '\n' + e.stack);
  process.exit(1);
}
expect(missingIds.length === 0, 'every getElementById id exists in index.html' +
  (missingIds.length ? ' (missing: ' + [...new Set(missingIds)].join(', ') + ')' : ''));

/* ---------------- 驱动 ---------------- */
let now = 0;
function frame(steps = 1, ms = 16.7) {
  for (let i = 0; i < steps; i++) {
    now += ms;
    const q = rafQueue; rafQueue = [];
    for (const j of q) j.fn(now);
  }
}
// 注意：图片预加载用的是 setTimeout(0)（Node 里会被钳到 ~1ms），
// 而 setImmediate 可能跑得更快，所以这里必须真的等够时间。
const tick = () => new Promise(r => setTimeout(r, 6));

console.log('\n--- school selection ---');
const grid = byId.get('schoolGrid');
const api = () => sandbox.window.__bigschool;
const ALL = api().SCHOOLS;
expect(grid.children.length === ALL.length, 'renders every selectable school (got ' + grid.children.length + ')');
expect(grid.children.length === 31, '31 selectable schools：14 原有 + 17 新增市重点');
const ids = grid.children.map(c => c.dataset.id);
expect(ids.includes('ses'), 'Shanghai Experimental School is in the list');
expect(['sfls', 'shnu', 'weiyu', 'caoyang', 'songjiang', 'fengxian', 'shixi', 'shibei',
  'yucai', 'xiangming', 'xingzhi', 'jinyuan', 'jiading', 'shisan', 'yangjing',
  'chuansha', 'gaoqiao'].every(id => ids.includes(id)), '新增的 17 所市重点都在列表里');
expect(ALL.filter(s => s.group === '市重点').length === 17, '市重点恰好 17 所');
expect(ALL.filter(s => s.group === '四校').length === 4, '四校还是 4 所');

/* ---------------- 难度功能已移除 ---------------- */
{
  const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
  expect(!/diffEasy|diffNormal|diffHard|diffTip/.test(html), '选校界面已经没有难度按钮');
  expect(api().DIFFICULTY === undefined && api().selectDifficulty === undefined,
    'window.__bigschool 上已经没有难度相关的 API');
}

// 每所学校的校徽文件都得真实存在，而且和 SCHOOLS 顺序一一对应
{
  const missing = ALL.filter(s => !fs.existsSync(path.join(DIR, 'logos', s.id + '.png')));
  expect(missing.length === 0, '每所学校都有本地校徽 PNG' +
    (missing.length ? ' (missing: ' + missing.map(s => s.id).join(', ') + ')' : ''));
}

// 选校界面每个「页面」都要有返回上一级
{
  const anchor = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
  expect(/id="selectScreen"[\s\S]*?id="upBtn"[^>]*>⇦ 返回上一级/.test(anchor),
    '选校界面有「返回上一级」按钮（指回上一级目录）');
  expect(/id="gameScreen"[\s\S]*?id="backBtn"[^>]*>⇦ 返回上一级/.test(anchor),
    '游戏界面有「返回上一级」按钮（回选校界面）');
  expect(/id="upBtn"[^>]*href="\.\.\/"/.test(anchor), '选校界面的返回按钮指向 ../');
}

const startBtn = byId.get('startBtn');
expect(startBtn.disabled === true, 'start button disabled before choosing');

/* ---------------- 分档规则 ---------------- */
console.log('\n--- tier composition (11 types) ---');
const stage = byId.get('stage');

async function startWith(id) {
  const card = grid.children.find(c => c.dataset.id === id);
  card.dispatch('click');
  startBtn.dispatch('click');
  await tick(); await tick(); await tick();
  frame(1);
}

const LEGACY = ['实验', '八大', '新五虎'];

function checkTiers(label, chosenId) {
  const t = api().tiers;
  const schools = t.map(x => x.school);
  const chosen = ALL.filter(s => s.id === chosenId)[0];
  console.log('  [' + label + '] ' + schools.map(s => s.group + ':' + s.name).join(' '));
  expect(t.length === 11, label + ': exactly 11 types');
  expect(schools[0].id === chosenId, label + ': chosen school is tier 0 (the biggest)');
  expect(new Set(schools.map(s => s.id)).size === 11, label + ': 11 schools are all distinct');

  const others = schools.slice(1);
  const four = others.filter(s => s.group === '四校');
  const legacy = others.filter(s => LEGACY.indexOf(s.group) >= 0);
  const fresh = others.filter(s => s.group === '市重点');
  expect(four.length === 1, label + ': 其余 10 档里有且只有 1 所四校 (got ' + four.length + ')');
  expect(legacy.length === 4, label + ': 现有球（上实 / 八大 / 进才）恰好 4 所 (got ' + legacy.length + ')');
  expect(fresh.length === 5, label + ': 新增市重点恰好 5 所 (got ' + fresh.length + ')');
  // 只可能是「选中的那所」所在的组少一个
  const totalFour = schools.filter(s => s.group === '四校').length;
  const totalLegacy = schools.filter(s => LEGACY.indexOf(s.group) >= 0).length;
  const totalFresh = schools.filter(s => s.group === '市重点').length;
  expect(totalFour === (chosen.group === '四校' ? 2 : 1), label + ': 四校总数 ' + totalFour);
  expect(totalLegacy === (LEGACY.indexOf(chosen.group) >= 0 ? 5 : 4), label + ': 现有球总数 ' + totalLegacy);
  expect(totalFresh === (chosen.group === '市重点' ? 6 : 5), label + ': 市重点总数 ' + totalFresh);

  // 除球王外按默认大小顺序排
  const ranks = others.map(s => ALL.indexOf(s));
  expect(ranks.every((v, i) => i === 0 || ranks[i - 1] < v), label + ': 其余 10 档按默认大小顺序排列');
  // 进才默认排在建平前面（两者同时在场时）
  const iJin = schools.findIndex(s => s.id === 'jincai');
  const iJian = schools.findIndex(s => s.id === 'jianping');
  if (iJin >= 0 && iJian >= 0) {
    expect(iJin < iJian, label + ': 进才中学 ranks above 建平中学 (#' + (iJin + 1) + ' vs #' + (iJian + 1) + ')');
  }
  // 尺寸
  const pct = t.map(x => x.r * 200 / api().W);
  expect(Math.abs(pct[0] - 54.4) < 0.01 && Math.abs(pct[10] - 7.0) < 0.01,
    label + ': sizes follow the table (' + pct.map(v => v.toFixed(1)).join(' ') + ')');
}

// 四种情况各跑一遍（选的学校分属不同组）
for (const pick of [['shanghai-high', 'chosen=上中（四校）'], ['qibao', 'chosen=七宝（八大）'],
  ['ses', 'chosen=上实（实验）'], ['jincai', 'chosen=进才（新五虎）'],
  ['caoyang', 'chosen=曹杨二中（市重点）'], ['sfls', 'chosen=上外附中（市重点）']]) {
  if (pick[0] !== 'shanghai-high') { byId.get('backBtn').dispatch('click'); }
  await startWith(pick[0]);
  checkTiers(pick[1], pick[0]);
}
expect(api().tiers[1].school.group === '四校', 'tier1 位置上是那一所随机四校（本轮排序结果）');

/* ---------------- 基础落球概率 ---------------- */
console.log('\n--- base P(k) = (e^(2k-1)+e^(2k)) / Σ_{i=1..22} e^i ---');
{
  const E = Math.E;
  const denom = Array.from({ length: 22 }, (_, i) => Math.exp(i + 1)).reduce((a, b) => a + b, 0);
  const ref = Array.from({ length: 11 }, (_, i) => (Math.exp(2 * (i + 1) - 1) + Math.exp(2 * (i + 1))) / denom);
  const prob = api().TIER_PROB;

  expect(prob.length === 11, '11 档各有一个概率');
  expect(Math.abs(prob.reduce((a, b) => a + b, 0) - 1) < 1e-15, '概率之和为 1');
  expect(prob.every((p, i) => Math.abs(p - ref[i]) < 1e-18),
    'P(k) = (e^(2k-1) + e^(2k)) / Σ_{i=1..22} e^i，k = 索引+1');
  expect(prob.every((p, i) => i === 0 || prob[i - 1] < p), '概率随档位（越小越大）单调上升');
  // 不看公式本身、只看数列形状：相邻两项的比恒为 e²
  const want = E * E;
  const ratios = prob.slice(1).map((p, i) => p / prob[i]);
  const worst = Math.max(...ratios.map(r => Math.abs(r - want)));
  expect(worst < 1e-12 * want, '相邻概率之比恒为 e²=' + want.toFixed(6) + '（最大误差 ' + worst.toExponential(2) + '）');
  // 11 对分子加起来正好把分母的 22 项分完
  const numSum = Array.from({ length: 11 }, (_, i) => Math.exp(2 * (i + 1) - 1) + Math.exp(2 * (i + 1))).reduce((a, b) => a + b, 0);
  expect(Math.abs(numSum - denom) / denom < 1e-15, 'Σ(11 对分子) 正好等于分母 Σ_{i=1..22} e^i');
  console.log('  ' + ref.map((p, i) => '#' + (i + 1) + '=' + (p * 100).toFixed(4) + '%').join(' '));
  expect(ref.slice(8).reduce((a, b) => a + b, 0) > 0.99, '最小的 3 档占 99% 以上');

  /* 逆累积分布：11 个区间的中点/下边界逐个钉死随机数核对（每次都先清空连出状态） */
  const realRandom = Math.random;
  const at = (u) => {
    api().resetAntiRepeat();
    Math.random = () => u;
    const r = api().randTier();
    Math.random = realRandom;
    return r;
  };
  const cum = []; ref.reduce((a, p) => (cum.push(a + p), a + p), 0);
  let boundaryOk = true, bad = '';
  for (let i = 0; i < 11; i++) {
    const lo = i === 0 ? 0 : cum[i - 1];
    const mid = lo + (cum[i] - lo) / 2;
    if (at(mid) !== i) { boundaryOk = false; bad = '区间中点 u=' + mid + ' 应得索引 ' + i; break; }
    // 边界处 randTier 会乘一个 total（≈1 但不是刚好 1），所以用 1e-9 的相对余量跨过边界
    if (at(lo * (1 + 1e-9)) !== i) { boundaryOk = false; bad = '刚过下边界 u=' + lo * (1 + 1e-9) + ' 应得索引 ' + i; break; }
    if (i > 0 && at(lo * (1 - 1e-9)) !== i - 1) {
      boundaryOk = false; bad = 'u 刚好在 cum[' + (i - 1) + '] 之前应得索引 ' + (i - 1); break;
    }
  }
  expect(boundaryOk, 'u 落在哪个累积区间就返回哪一档' + (boundaryOk ? '' : '（' + bad + '）'));

  /* 卡方：每抽一次之前都清空连出状态，于是每一次都是按基础分布抽的。
     新公式下 #1~#7 的期望次数 < 1（#1 只有 0.0007 次），不能各占一格，
     所以把最小的 7 档并成一个桶，剩下 #8~#11 各一格，共 5 格（df=4）。 */
  const N = 400000;
  const hits = new Array(11).fill(0);
  for (let k = 0; k < N; k++) { api().resetAntiRepeat(); hits[api().randTier()]++; }
  const bins = [
    { name: '#1~#7', obs: hits.slice(0, 7).reduce((a, b) => a + b, 0), exp: N * ref.slice(0, 7).reduce((a, b) => a + b, 0) },
    { name: '#8', obs: hits[7], exp: N * ref[7] },
    { name: '#9', obs: hits[8], exp: N * ref[8] },
    { name: '#10', obs: hits[9], exp: N * ref[9] },
    { name: '#11', obs: hits[10], exp: N * ref[10] }
  ];
  let chi2 = 0;
  for (const b of bins) chi2 += (b.obs - b.exp) * (b.obs - b.exp) / b.exp;
  const maxDev = Math.max(...bins.map(b => Math.abs(b.obs - b.exp) / Math.sqrt(b.exp)));
  console.log('  ' + bins.map(b => b.name + ' 期望 ' + b.exp.toFixed(0) + ' 实测 ' + b.obs).join(' | '));
  console.log('  抽 ' + N + ' 次：卡方 = ' + chi2.toFixed(2) + '（df=4，α=1e-6 临界 26.28），最大偏差 ' + maxDev.toFixed(2) + 'σ');
  expect(chi2 < 26.28, '基础分布抽样符合公式（卡方 ' + chi2.toFixed(2) + '）');
  expect(maxDev < 5, '每桶抽样偏差都在 5σ 以内（最大 ' + maxDev.toFixed(2) + 'σ）');
}

/* ---------------- 避免连出 ---------------- */
console.log('\n--- anti-repeat: P\'(k)=P(k)·T^(-n)，T = ' + api().ANTI_REPEAT_T + ' ---');
{
  const realRandom = Math.random;
  const B = api().TIER_PROB;
  const T = api().ANTI_REPEAT_T;
  expect(T === 1.8, '避免连出强度是固定常数 T = 1.8（不再跟难度绑定）');

  // 钉死随机数 => 一直取最后一档，连出计数 n 应该一路涨
  api().resetAntiRepeat();
  Math.random = () => 0.999999;
  const seq = [];
  for (let i = 0; i < 4; i++) seq.push(api().randTier());
  Math.random = realRandom;
  expect(seq.every(x => x === 10), '钉死随机数后连续抽到同一档（索引 10）');
  expect(api().antiRepeat.n === 4 && api().antiRepeat.last === 10, '连出计数 n=4、last=10');

  const p = api().dropProb();
  const damp = Math.pow(T, -4);
  const freed = B[10] * (1 - damp);
  const restW = 1 - B[10];
  expect(Math.abs(p[10] - B[10] * damp) < 1e-15,
    'P\'(k) = P(k)·T^(-n)：' + (B[10] * damp * 100).toFixed(4) + '%（未修正 ' + (B[10] * 100).toFixed(4) + '%）');
  expect(p.every((x, i) => i === 10 || Math.abs(x - B[i] * (1 + freed / restW)) < 1e-15),
    '让出的概率按 e^i 的比例分给其余所有球');
  expect(Math.abs(p.reduce((a, b) => a + b, 0) - 1) < 1e-14, '修正后仍是概率分布（和为 1）');
  expect(p.every(x => x > 0), '修正后没有任何一档被压成 0');
  console.log('  n=4 时 #11=' + (p[10] * 100).toFixed(4) + '%  #10=' + (p[9] * 100).toFixed(4) +
    '%  #9=' + (p[8] * 100).toFixed(4) + '%（基础分别是 ' +
    (B[10] * 100).toFixed(4) + '% / ' + (B[9] * 100).toFixed(4) + '% / ' + (B[8] * 100).toFixed(4) + '%）');

  // n=1 压到 1/T、n=2 压到 1/T²
  api().resetAntiRepeat();
  Math.random = () => 0.999999;
  const p1 = (api().randTier(), api().dropProb().slice());
  const p2 = (api().randTier(), api().dropProb().slice());
  Math.random = realRandom;
  expect(Math.abs(p1[10] - B[10] / T) < 1e-15 && Math.abs(p2[10] - B[10] / (T * T)) < 1e-15,
    'n=1 压到 1/T、n=2 压到 1/T²');

  api().resetAntiRepeat();
  expect(api().dropProb().every((x, i) => Math.abs(x - B[i]) < 1e-15), '清空连出状态后 dropProb() 就等于基础分布');

  // 经验验证：连出率应该明显低于「完全不开」的 ΣP(k)²
  const rBase = B.reduce((a, q) => a + q * q, 0);
  api().resetAntiRepeat();
  let reps = 0, last = -1;
  const RN = 200000;
  for (let i = 0; i < RN; i++) { const t = api().randTier(); if (t === last) reps++; last = t; }
  const rObs = reps / RN;
  console.log('  连出率：理论「无修正」= ' + (rBase * 100).toFixed(1) + '%，实测开了避免连出 = ' + (rObs * 100).toFixed(1) + '%');
  expect(rObs < rBase - 0.05, '避免连出把连出率压下来了');

  if (gameRunning()) {
    const chips = byId.get('chain').children.filter(c => String(c.className).indexOf('drop') >= 0);
    console.log('  合成链高亮档位数 = ' + chips.length);
    expect(chips.length === api().TIER_PROB.filter(q => q >= api().DROP_P_MIN).length,
      '合成链高亮的档位数和基础概率表一致');
  }
}

function gameRunning() { return byId.get('gameScreen').hidden === false; }

/* ---------------- 玩法 ---------------- */
console.log('\n--- dropping & playing ---');
await startWith('jincai');
const cvs = byId.get('canvas');
expect(cvs.width > 0 && cvs.height > 0, 'canvas sized by resize() (' + cvs.width + 'x' + cvs.height + ')');
expect(byId.get('chain').children.length > 11, 'merge chain strip populated');

const W = api().W, H = api().H, DANGER = api().DANGER_Y;
expect(W === 514 && H === 700, '把框顶挪到虚线处再等比放大后，框是 514x700（纵向仍是 700）');
expect(DANGER === 52, '警戒线固定在框顶往下 52px（不再跟难度绑定）');
expect(Math.abs((W / H) - (514 / 700)) < 1e-9, '框的宽高比 = 514/700');

// 鼠标：在 stage 上按下即投
for (let i = 0; i < 40; i++) {
  const x = 40 + (i * 37) % 340;
  stage.dispatch('pointerdown', { clientX: x, pointerType: 'mouse', preventDefault() {} });
  sandbox.dispatchWindow('pointermove', { clientX: x, pointerType: 'mouse' });
  frame(14);
}
const w = api().world;
expect(w.bodies.length > 5, 'balls exist on the board (' + w.bodies.length + ')');
expect(api().score > 0, 'score increased from merges (' + api().score + ')');
expect(store.bigschool_best !== undefined, 'best score persisted (' + store.bigschool_best + ')');
expect(w.bodies.every(b => isFinite(b.x) && isFinite(b.y) && isFinite(b.sq)), 'no NaN bodies');
expect(w.bodies.every(b => b.x >= b.r - 0.5 && b.x <= W - b.r + 0.5 && b.y + b.r <= H + 0.5 && b.y - b.r >= -0.5), 'all bodies inside the board (含天花板)');
expect(w.bodies.every(b => b.sq >= 0 && b.sq <= 0.1601), 'squash stays in range');

console.log('\n--- 新球出现在框顶 ---');
{
  frame(30);   // 等冷却
  const t = api().tiers[api().tiers.length - 1];   // 不管随机到哪档，都是贴着框顶出生
  const before = w.bodies.length;
  stage.dispatch('pointerdown', { clientX: 260, pointerType: 'mouse', preventDefault() {} });
  const fresh = w.bodies[w.bodies.length - 1];
  expect(w.bodies.length === before + 1, 'drop fired');
  expect(Math.abs((fresh.y - fresh.r) - api().DROP_PAD) < 0.001,
    '新球贴在框顶出现（顶到边距 ' + (fresh.y - fresh.r).toFixed(2) + 'px = DROP_PAD）');
  expect(Math.abs(fresh.y - api().dropY(fresh)) < 0.001, 'dropY(tier) = r + DROP_PAD');
  frame(30);
}

console.log('\n--- 拖出边界点击 ---');
{
  // 往棋盘左边很远的地方拖，再点击 —— 球必须从边界落下
  const before = api().world.bodies.length;
  sandbox.dispatchWindow('pointermove', { clientX: -5000, pointerType: 'mouse' });
  stage.dispatch('pointerdown', { clientX: -5000, pointerType: 'mouse', preventDefault() {} });
  const fresh = api().world.bodies[api().world.bodies.length - 1];
  expect(api().world.bodies.length === before + 1, 'drop still fired outside the board');
  expect(fresh.x <= fresh.r + 2.001 && fresh.x >= fresh.r - 0.001,
    'ball released at the left edge (x=' + fresh.x.toFixed(2) + ', r=' + fresh.r.toFixed(2) + ')');

  frame(30);   // 等冷却
  sandbox.dispatchWindow('pointermove', { clientX: 99999, pointerType: 'mouse' });
  stage.dispatch('pointerdown', { clientX: 99999, pointerType: 'mouse', preventDefault() {} });
  const fresh2 = api().world.bodies[api().world.bodies.length - 1];
  expect(fresh2 !== fresh, 'second drop fired');
  expect(fresh2.x >= W - fresh2.r - 2.001 && fresh2.x <= W - fresh2.r + 0.001,
    'ball released at the right edge (x=' + fresh2.x.toFixed(2) + ')');
  frame(30);
}

console.log('\n--- 触摸：先瞄准后松手 ---');
{
  const before = api().world.bodies.length;
  stage.dispatch('pointerdown', { clientX: 300, pointerType: 'touch', preventDefault() {} });
  expect(api().world.bodies.length === before, 'touch pointerdown does not drop immediately');
  sandbox.dispatchWindow('pointermove', { clientX: 120, pointerType: 'touch' });
  sandbox.dispatchWindow('pointerup', { clientX: 120, pointerType: 'touch' });
  expect(api().world.bodies.length === before + 1, 'touch pointerup drops the ball');
  frame(30);
}

console.log('\n--- 分享 ---');
{
  const shareModal = byId.get('shareModal');
  expect(shareModal.hidden === true, 'share panel starts hidden');
  byId.get('shareBtn').dispatch('click');
  expect(shareModal.hidden === false, 'HUD share button opens the panel');
  const txt = byId.get('sharePreview').textContent;
  expect(txt.includes('分') && txt.includes(api().tiers[0].school.name), 'preview shows score + goal school: "' + txt + '"');
  expect(txt.includes('catrix.net/games/big-school'), '分享文案里带上了网址 catrix.net/games/big-school');
  expect(txt.trim().endsWith(api().SHARE_URL), '网址收在文案最后');
  expect(api().SHARE_URL === 'https://catrix.net/games/big-school', '分享网址是 https://catrix.net/games/big-school');
  expect(byId.get('shSystem').hidden === false, 'system share is offered (navigator.share exists)');

  const nBodies = api().world.bodies.length;
  frame(20);
  expect(api().world.bodies.length === nBodies, 'game is paused while the panel is open');

  sandbox.__shared.length = 0;
  byId.get('shSystem').dispatch('click');
  expect(sandbox.__shared.length === 1 && sandbox.__shared[0].text === txt, 'system share sends the same text');

  sandbox.__opened.length = 0;
  byId.get('shQQ').dispatch('click');
  expect(sandbox.__opened.length === 1 && sandbox.__opened[0].includes('connect.qq.com'), 'QQ 好友 opens the QQ widget');
  expect(sandbox.__opened[0].includes(encodeURIComponent(api().SHARE_URL)),
    'QQ 分享带上的是站点网址（不是本地 file:// 路径）');
  expect(!/url=file/i.test(sandbox.__opened[0]), 'QQ 分享的 url 不是本地路径');
  sandbox.__opened.length = 0;
  byId.get('shQzone').dispatch('click');
  expect(sandbox.__opened[0].includes('qzone.qq.com'), 'QQ 空间 opens the Qzone widget');
  sandbox.__opened.length = 0;
  byId.get('shWeibo').dispatch('click');
  expect(sandbox.__opened[0].includes('weibo.com'), '微博 opens the Weibo widget');
  sandbox.__opened.length = 0;
  byId.get('shBili').dispatch('click');
  expect(sandbox.__opened[0].includes('bilibili.com'), 'B站 opens the dynamic composer');

  byId.get('shCopy').dispatch('click');
  expect(byId.get('toast').textContent.length > 0, 'copy shows a toast: "' + byId.get('toast').textContent + '"');

  byId.get('shareClose').dispatch('click');
  expect(shareModal.hidden === true, 'close hides the panel');
  frame(20);
  const before = api().world.bodies.length;
  stage.dispatch('pointerdown', { clientX: 200, pointerType: 'mouse', preventDefault() {} });
  expect(api().world.bodies.length === before + 1, 'game resumes after closing the panel');

  byId.get('shareBtn').dispatch('click');
  shareModal.dispatch('click', { target: shareModal });
  expect(shareModal.hidden === true, 'clicking the backdrop closes it');
  frame(30);
}

console.log('\n--- game over path ---');
{
  const r = 66;   // 静态球不受重力，等价于「已经堆到警戒线以上」
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 3; col++) {
      const b = new sandbox.SuikaPhysics.Body({
        x: 70 + col * 140, y: 640 - row * 132, r, tier: 0, tag: 'ball', isStatic: true
      });
      b.age = 5;
      w.add(b);
    }
  }
}
frame(160);
expect(byId.get('overlay').hidden === false, 'game-over overlay shown');
expect(byId.get('ovTitle').textContent.length > 0, 'overlay title: "' + byId.get('ovTitle').textContent + '"');
expect(byId.get('ovAgain').textContent === '再来一局', 'overlay offers restart');
{
  const before = api().world.bodies.length;
  stage.dispatch('pointerdown', { clientX: 200, pointerType: 'mouse', preventDefault() {} });
  expect(api().world.bodies.length === before, 'clicks on the overlay do not drop balls');
}

console.log('\n--- restart & back ---');
byId.get('restartBtn').dispatch('click');
await tick(); await tick(); await tick();
frame(1);
expect(api().world.bodies.length === 0, 'restart clears the board');
expect(byId.get('overlay').hidden === true, 'restart hides overlay');
expect(api().score === 0, 'restart resets score');

byId.get('backBtn').dispatch('click');
expect(byId.get('selectScreen').hidden === false, 'back returns to school selection');
expect(byId.get('gameScreen').hidden === true, 'game screen hidden after back');

/* ---------------- 开局选项 ---------------- */
console.log('\n--- 多一所四校 ---');
{
  byId.get('extraFourBtn').dispatch('click');
  await startWith('shanghai-high');
  const t = api().tiers;
  const fours = t.filter(x => x.school.group === '四校').map(x => x.school.id);
  expect(t.length === 11, 'extraFour: still 11 types');
  expect(fours.length === 3, 'extraFour: chosen + 2 random 四校 (got ' + fours.length + ')');
  expect(new Set(fours).size === 3, 'extraFour: the two picks are different schools');
  expect(t[1].school.group === '四校' && t[2].school.group === '四校', 'extraFour: tier 1 & 2 are both 四校');
  expect(t.filter(x => LEGACY.indexOf(x.school.group) >= 0).length === 4 &&
    t.filter(x => x.school.group === '市重点').length === 4, 'extraFour: 4 所现有 + 4 所市重点（让出一个市重点名额）');
  byId.get('extraFourBtn').dispatch('click');
}

console.log('\n--- 球大小滑块 ---');
{
  const seg = byId.get('sizeSeg'), label = byId.get('sizeLabel');
  const [rail, labels] = seg.children;
  const part = cls => rail.children.filter(c => c.className === cls);
  const [fill] = part('range-fill'), [knob] = part('range-knob'), dots = part('range-dot');
  const names = labels.children;
  const on = () => dots.map(d => (d.classList.contains('on') ? 1 : 0)).join('');
  const cur = () => names.findIndex(n => n.classList.contains('cur'));
  const at = (l, k) => label.textContent === l && knob.style.left === fill.style.width && cur() === k;
  // 桩的 rect 一律 left 0 / 宽 520：0 -> 最左，260 -> 中间，9999 -> 最右
  const press = x => { seg.dispatch('pointerdown', { clientX: x }); seg.dispatch('pointerup', {}); };

  expect(dots.length === 3 && names.length === 3 && !!fill && !!knob, 'rail has fill, 3 stops, knob; 3 labels');
  expect(dots.map(d => d.style.left).join(' ') === '0% 50% 100%', 'stops spread evenly (' + dots.map(d => d.style.left) + ')');
  expect(names.every((n, i) => n.style.left === dots[i].style.left), 'each label sits under its stop');
  expect(at('标准', 0) && knob.style.left === '0%' && on() === '100', 'default: 标准, knob on the first stop');

  press(9999);
  await startWith('shanghai-high');
  const pct = api().tiers.map(x => x.r * 200 / api().W);
  expect(Math.abs(pct[0] - 54.4 * 1.2) < 0.01, 'rightmost stop = +20% (' + pct[0].toFixed(1) + '%)');
  expect(Math.abs(pct[10] - 7.0 * 1.2) < 0.01, 'smallest scaled too (' + pct[10].toFixed(1) + '%)');
  expect(at('特大 20%', 2) && knob.style.left === '100%' && on() === '111', 'knob + fill at the right end');
  expect(seg.getAttribute('aria-valuenow') === '2' && seg.getAttribute('aria-valuetext') === '特大 20%',
    'aria value tracks the stop');

  press(260);
  expect(at('大 10%', 1) && knob.style.left === '50%' && on() === '110', 'snaps to the middle stop');
  press(380);                       // 按分段算会落到第 3 段，按最近停靠点应是中间
  expect(at('大 10%', 1), 'snaps to the nearest stop, not the segment');

  press(0);
  await startWith('shanghai-high');
  expect(Math.abs(api().tiers[0].r * 200 / api().W - 54.4) < 0.01, 'leftmost stop = 标准');

  seg.dispatch('pointerdown', { clientX: 0 });
  expect(seg.classList.contains('drag'), 'dragging starts on press');
  seg.dispatch('pointermove', { clientX: 9999 });
  expect(label.textContent === '特大 20%', 'drag follows the finger to right');
  seg.dispatch('pointermove', { clientX: 0 });
  expect(label.textContent === '标准', 'drag follows the finger back to left');
  seg.dispatch('pointerup', {});
  expect(!seg.classList.contains('drag'), 'drag released');
  seg.dispatch('pointermove', { clientX: 9999 });
  expect(label.textContent === '标准', 'moving after release does nothing');

  const key = k => { let p = false; seg.dispatch('keydown', { key: k, preventDefault() { p = true; } }); return p; };
  expect(key('ArrowRight') && label.textContent === '大 10%', 'ArrowRight steps up');
  key('End');
  expect(label.textContent === '特大 20%', 'End jumps to max');
  key('ArrowRight');
  expect(label.textContent === '特大 20%', 'clamped at max');
  key('Home');
  expect(label.textContent === '标准', 'Home jumps to min');
  expect(!key('a'), 'other keys are ignored');
}

console.log('\n--- 三击调整投放上限 ---');
{
  const chipsNow = () => byId.get('chain').children.filter(c => (c.className || '').indexOf('chip') === 0);
  const tap = (chip, n) => { for (let k = 0; k < n; k++) chip.dispatch('click'); };

  await startWith('shanghai-high');
  expect(chipsNow().length === 11, 'one chip per tier (' + chipsNow().length + ')');
  expect(api().dropTop === 8, 'default cap = smallest 3 tiers (top=' + api().dropTop + ')');

  tap(chipsNow()[0], 3);
  expect(api().dropTop === 8, 'triple-tapping 球王 does nothing');
  tap(chipsNow()[1], 3);
  expect(api().dropTop === 8, 'triple-tapping a 四校 does nothing');
  tap(chipsNow()[3], 2);
  expect(api().dropTop === 8, 'two taps do nothing');

  tap(chipsNow()[3], 3);
  expect(api().dropTop === 3, 'triple tap raises the cap to that tier (top=' + api().dropTop + ')');
  const marks = chipsNow().map(c => (c.className || '').indexOf('drop') >= 0);
  expect(marks[3] && marks[10] && !marks[2], 'chain highlights tiers 3..10 only');

  tap(chipsNow()[3], 3);
  expect(api().dropTop === 8, 'triple tap again restores the default');
  expect(chipsNow()[3].className.indexOf('drop') < 0, 'highlight cleared after restore');
}

console.log('\n--- randTier 按公式取档 ---');
{
  await startWith('jincai');
  frame(30);
  const realRandom = Math.random;
  // 每投一颗都要先等冷却；返回刚掉下来的那颗球
  const dropOnce = () => {
    frame(30);
    stage.dispatch('pointerdown', { clientX: 210, pointerType: 'mouse', preventDefault() {} });
    const bodies = api().world.bodies;
    return bodies[bodies.length - 1];
  };
  Math.random = () => 0.999999;
  dropOnce();                       // 这一颗用的是改随机数之前的档位
  expect(dropOnce().tier === 10, 'Math.random→1 时掉最小档（索引 10 = 第 11 大球）');
  Math.random = () => 0;
  dropOnce();                       // 同上，先消化掉上一颗
  expect(dropOnce().tier === 0, 'Math.random→0 时掉最大档（索引 0 = 第 1 大球）');
  Math.random = realRandom;
}

console.log('\n' + (fails === 0 ? 'ALL PASS' : fails + ' FAILURES'));
process.exit(fails === 0 ? 0 : 1);
