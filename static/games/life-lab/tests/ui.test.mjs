// 界面层的冒烟测试：用一套最小 DOM 桩把 game.mjs 真正跑起来。
// 不依赖浏览器，也不联网；主要盯住「元素 id 有没有写错」「按钮有没有生成」
// 「点图案再点棋盘能不能落子」「开始之后代数有没有涨」。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, '..');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const source = fs.readFileSync(path.join(dir, 'game.mjs'), 'utf8');

/* ---------------- 最小 DOM 桩 ---------------- */

class FakeEventTarget {
  constructor() { this.handlers = new Map(); }
  addEventListener(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type).push(fn);
  }
  fire(type, event = {}) {
    for (const fn of this.handlers.get(type) || []) fn({ type, preventDefault() {}, stopPropagation() {}, ...event });
  }
}

function makeCtx() {
  const calls = { fillRect: 0, stroke: 0, fillStyles: [] };
  return {
    calls,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    setTransform() {},
    fillRect() { calls.fillRect++; },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() { calls.stroke++; }
  };
}

function makeElement(tag = 'div', id = '') {
  const el = new FakeEventTarget();
  el.tagName = tag.toUpperCase();
  el.id = id;
  el.children = [];
  el.dataset = {};
  el.style = {};
  el.attrs = {};
  el.textContent = '';
  el.title = '';
  el.className = '';
  el.clientWidth = id === 'board-scroll' ? 900 : 0;
  el.width = 0;
  el.height = 0;
  el.ctx = null;
  el.getContext = () => (el.ctx ||= makeCtx());
  el.setAttribute = (k, v) => { el.attrs[k] = String(v); };
  el.getAttribute = (k) => el.attrs[k];
  el.appendChild = (child) => { el.children.push(child); return child; };
  el.append = (...nodes) => { for (const n of nodes) el.children.push(n); };
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: el.width, height: el.height });
  el.setPointerCapture = () => {};
  el.releasePointerCapture = () => {};
  el.hasPointerCapture = () => false;
  el.remove = () => {};
  return el;
}

const idsInHtml = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
const elements = new Map();
for (const id of idsInHtml) elements.set('#' + id, makeElement(id === 'board' ? 'canvas' : 'div', id));

const documentStub = new FakeEventTarget();
documentStub.hidden = false;
documentStub.querySelector = (sel) => elements.get(sel) || null;
documentStub.createElement = (tag) => makeElement(tag);
documentStub.documentElement = makeElement('html');

const store = new Map();
const windowStub = new FakeEventTarget();
windowStub.devicePixelRatio = 1;

globalThis.document = documentStub;
globalThis.window = windowStub;
globalThis.HTMLInputElement = class HTMLInputElement {};
globalThis.HTMLSelectElement = class HTMLSelectElement {};
globalThis.getComputedStyle = () => ({ paddingLeft: '4px', paddingRight: '4px' });
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k)
};
const frames = [];
globalThis.requestAnimationFrame = (cb) => { frames.push(cb); return frames.length; };
globalThis.cancelAnimationFrame = () => {};
const realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn, ms) => { const t = realSetTimeout(fn, ms); if (t.unref) t.unref(); return t; };

// 真正加载界面层（它一加载就会初始化）
await import(pathToFileURL(path.join(dir, 'game.mjs')).href);

const el = (id) => elements.get('#' + id);
const num = (id) => Number(el(id).textContent);
const runFrames = (times, stepMs = 1000) => {
  let ts = 0;
  for (let i = 0; i < times; i++) {
    const cb = frames.shift();
    if (!cb) return i;
    ts += stepMs;
    cb(ts);
  }
  return times;
};

/* ---------------- 测试 ---------------- */

test('game.mjs 里用到的每个 #id 都能在 index.html 找到', () => {
  const used = new Set([...source.matchAll(/\$\('#([^']+)'\)/g)].map((m) => m[1]));
  assert.ok(used.size >= 12, `至少应该用到十几个元素，实际 ${used.size}`);
  for (const id of used) {
    assert.ok(idsInHtml.has(id), `index.html 里缺少 id="${id}"`);
  }
});

test('三组设置按钮和图案调色板都按数据生成出来了', async () => {
  const { VIEWS, SPEEDS, PATTERNS } = await import('../engine.mjs');
  assert.equal(el('views').children.length, VIEWS.length);
  assert.equal(el('speeds').children.length, SPEEDS.length);
  assert.equal(el('borders').children.length, 2);
  assert.equal(el('palette').children.length, PATTERNS.length);
  assert.equal(el('views').children[0].children.length, 0); // 文字直接写在按钮上
  assert.ok(el('views').children[0].textContent.includes('×'), '视图按钮应当带尺寸');
  assert.ok(el('speeds').children[0].textContent.includes('/秒'), '速度按钮应当带频率');
});

test('画布按视图大小开了正确尺寸，并且真的画过东西', () => {
  const board = el('board');
  assert.ok(board.width > 0 && board.height > 0, '画布应当被设置尺寸');
  assert.ok(board.ctx.calls.fillRect > 0, '初始化时应当绘制过棋盘');
  assert.ok(board.style.width.endsWith('px'), '画布 CSS 宽度应当被设置');
});

test('选图案后点棋盘能落子，存活数随之变化', () => {
  const palette = el('palette');
  const pattern = palette.children[0];
  pattern.fire('click');
  assert.equal(pattern.attrs['aria-pressed'], 'true', '图案按钮应当进入选中态');

  const board = el('board');
  assert.equal(num('alive'), 0);
  board.fire('pointerdown', { button: 0, pointerType: 'mouse', pointerId: 1, clientX: 60, clientY: 60 });
  assert.equal(num('alive'), 5, '滑翔机应当是 5 个细胞');
  board.fire('pointerup', { pointerId: 1 });
});

test('随机 → 开始，代数会随着帧推进增长', () => {
  el('random').fire('click');
  assert.ok(num('alive') > 100, '随机之后应当有一堆细胞');
  assert.equal(el('play').attrs['aria-pressed'], 'false');
  el('play').fire('click');
  assert.equal(el('play').attrs['aria-pressed'], 'true', '点开始后应当进入播放态');
  const gen0 = num('gen');
  runFrames(5);
  assert.ok(num('gen') > gen0, `代数应当增长（${gen0} → ${num('gen')}）`);
  el('play').fire('click');
  assert.equal(el('play').attrs['aria-pressed'], 'false', '再点一下应当暂停');
});

test('单步、清空、快捷键都工作', () => {
  el('random').fire('click');
  const before = num('gen');
  el('step').fire('click');
  assert.equal(num('gen'), before + 1, '单步只推一代');

  el('clear').fire('click');
  assert.equal(num('alive'), 0);

  // 空棋盘上按空格不该开始（没有细胞可演化），会给出提示
  documentStub.fire('keydown', { key: ' ', target: {} });
  assert.equal(el('play').attrs['aria-pressed'], 'false', '空棋盘不该开始');
  assert.ok(el('status').textContent.includes('随机'), '空棋盘应当提示先画或随机');

  documentStub.fire('keydown', { key: 'r', target: {} });
  assert.ok(num('alive') > 0, 'R 应当随机铺一版');
  documentStub.fire('keydown', { key: ' ', target: {} });
  assert.equal(el('play').attrs['aria-pressed'], 'true', '空格应当开始');
  documentStub.fire('keydown', { key: ' ', target: {} });
  assert.equal(el('play').attrs['aria-pressed'], 'false', '空格应当暂停');
  documentStub.fire('keydown', { key: 'c', target: {} });
  assert.equal(num('alive'), 0, 'C 应当清空');
});

test('切换视图会按新尺寸重建棋盘，设置写进 localStorage', () => {
  el('views').children[2].fire('click');   // 大 96×72
  assert.ok(el('board').width > 0);
  assert.equal(num('gen'), 0, '换尺寸应当重新开始');
  const saved = JSON.parse(store.get('catrix-life-settings'));
  assert.equal(saved.view, 'l');
  assert.equal(typeof saved.wrap, 'boolean');
});

test('环面 / 死边界按钮能切换', () => {
  const before = JSON.parse(store.get('catrix-life-settings')).wrap;
  el('borders').children[before ? 1 : 0].fire('click');
  assert.notEqual(JSON.parse(store.get('catrix-life-settings')).wrap, before);
});

test('橡皮能擦掉细胞', () => {
  el('clear').fire('click');
  el('tool-draw').fire('click');
  const board = el('board');
  board.fire('pointerdown', { button: 0, pointerType: 'mouse', pointerId: 2, clientX: 40, clientY: 40 });
  board.fire('pointerup', { pointerId: 2 });
  const painted = num('alive');
  assert.equal(painted, 1, '画笔画了一个细胞');
  el('tool-erase').fire('click');
  board.fire('pointerdown', { button: 0, pointerType: 'mouse', pointerId: 3, clientX: 40, clientY: 40 });
  board.fire('pointerup', { pointerId: 3 });
  assert.equal(num('alive'), 0, '橡皮应当把它擦掉');
});