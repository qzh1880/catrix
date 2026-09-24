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
    style: {},
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
expect(grid.children.length === 14, 'renders 14 selectable schools (got ' + grid.children.length + ')');
const ids = grid.children.map(c => c.dataset.id);
expect(ids.includes('ses'), 'Shanghai Experimental School is in the list');
expect(!ids.includes('caoyang') && !ids.includes('weiyu'), 'the dropped 新五虎 schools are gone');

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

function checkTiers(label, chosenId, expectFour, expectSes) {
  const t = api().tiers;
  const schools = t.map(x => x.school);
  const four = schools.filter(s => s.group === '四校');
  const sesCount = schools.filter(s => s.id === 'ses').length;
  const names = schools.map(s => s.name).join(' ');
  console.log('  [' + label + '] ' + names);
  expect(t.length === 11, label + ': exactly 11 types');
  expect(schools[0].id === chosenId, label + ': chosen school is tier 0 (the biggest)');
  expect(four.length === expectFour, label + ': ' + expectFour + ' 四校 in play (got ' + four.length + ')');
  expect(sesCount === expectSes, label + ': 上海实验学校 count=' + expectSes + ' (got ' + sesCount + ')');
  expect(schools.some(s => s.id === 'jincai'), label + ': 进才中学 always present');
  const ba = schools.filter(s => s.group === '八大');
  expect(ba.length === 8 || ba.length === 7, label + ': 八大 filled in (got ' + ba.length + ')');
  // 进才默认排在建平前面（比建平大一档）
  const iJin = schools.findIndex(s => s.id === 'jincai');
  const iJian = schools.findIndex(s => s.id === 'jianping');
  if (iJin >= 0 && iJian >= 0) {
    expect(iJin < iJian, label + ': 进才中学 ranks above 建平中学 (#' + (iJin + 1) + ' vs #' + (iJian + 1) + ')');
  }
  // 尺寸
  const pct = t.map(x => x.r * 200 / 420);
  expect(Math.abs(pct[0] - 54.4) < 0.01 && Math.abs(pct[10] - 7.0) < 0.01,
    label + ': sizes follow the table (' + pct.map(v => v.toFixed(1)).join(' ') + ')');
}

// 选中的是四校 -> 2 所四校（选中的 + 随机 1 所），不需要上实
await startWith('shanghai-high');
checkTiers('chosen=上中', 'shanghai-high', 2, 0);
expect(api().tiers[0].school.id !== api().tiers[1].school.id, 'tier1 is a different 四校');
expect(api().tiers[1].school.group === '四校', 'tier1 is a 四校');

// 选中的不是四校 -> 1 所随机四校 + 上海实验学校补足 11 档
byId.get('backBtn').dispatch('click');
await startWith('qibao');
checkTiers('chosen=七宝', 'qibao', 1, 1);
expect(api().tiers[1].school.group === '四校', 'tier1 is the random 四校');
expect(api().tiers[2].school.id === 'ses', '上海实验学校 sits right after the 四校');

// 选中上实自己
byId.get('backBtn').dispatch('click');
await startWith('ses');
checkTiers('chosen=上实', 'ses', 1, 1);

// 选中进才
byId.get('backBtn').dispatch('click');
await startWith('jincai');
checkTiers('chosen=进才', 'jincai', 1, 1);

/* ---------------- 玩法 ---------------- */
console.log('\n--- dropping & playing ---');
await startWith('jincai');
const cvs = byId.get('canvas');
expect(cvs.width > 0 && cvs.height > 0, 'canvas sized by resize() (' + cvs.width + 'x' + cvs.height + ')');
expect(byId.get('chain').children.length > 11, 'merge chain strip populated');

const W = api().W, H = api().H, DANGER = api().DANGER_Y;
expect(W === 420 && H === 700, 'board is 420x700');

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
expect(w.bodies.every(b => b.x >= b.r - 0.5 && b.x <= W - b.r + 0.5 && b.y + b.r <= H + 0.5), 'all bodies inside the board');
expect(w.bodies.every(b => b.sq >= 0 && b.sq <= 0.1601), 'squash stays in range');

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

console.log('\n' + (fails === 0 ? 'ALL PASS' : fails + ' FAILURES'));
process.exit(fails === 0 ? 0 : 1);
