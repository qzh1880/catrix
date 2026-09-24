/* ============================================================
 * 物理引擎离线测试
 * 覆盖：尺寸 / 摩擦 / 挤压 / 接触合成 / 稳定性 / 合成阶梯 / 玩法模拟
 * 用法：node tests/physics.test.mjs
 * ============================================================ */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const P = require(path.join(HERE, '..', 'physics.js'));

const W = 420, H = 700;
const TIER_PCT = [54.4, 41.0, 41.0, 34.4, 28.2, 24.5, 20.2, 15.7, 14.4, 10.6, 7.0];
const N = TIER_PCT.length;
const radiusFor = (i) => W * TIER_PCT[i] / 200;

let fails = 0;
const expect = (c, m) => { console.log((c ? '  \u2713 ' : '  \u2717 FAIL: ') + m); if (!c) fails++; };

/* ---------------- 1. 尺寸表 ---------------- */
console.log('--- size table ---');
{
  const d = TIER_PCT.map(p => W * p / 100);
  console.log('  diameters:', d.map(v => v.toFixed(1)).join(' '));
  console.log('  % of width:', TIER_PCT.join(' '));
  let mono = true;
  for (let i = 1; i < N; i++) if (TIER_PCT[i] > TIER_PCT[i - 1]) mono = false;
  expect(N === 11, 'exactly 11 tiers');
  expect(mono, 'tier sizes are non-increasing');
  expect(Math.abs(TIER_PCT[0] / TIER_PCT[N - 1] - 7.8) < 0.05, 'largest / smallest = 7.8x (got ' + (TIER_PCT[0] / TIER_PCT[N - 1]).toFixed(2) + ')');
  expect(TIER_PCT[0] === 54.4 && TIER_PCT[N - 1] === 7.0, 'top = 54.4% of width, bottom = 7.0%');
}

/* ---------------- 2. 摩擦：球在地上不该滑 ---------------- */
console.log('\n--- ground friction ---');
{
  const w = new P.World(W, H);
  const b = w.add(new P.Body({ x: 80, y: H - 40, r: 40, tier: 4, tag: 'ball' }));
  b.vx = 320;
  for (let s = 0; s < 240; s++) w.step(1 / 120);      // 2 秒
  const travel = b.x - 80;
  console.log('  start vx=320 -> after 2s: x=+' + travel.toFixed(1) + 'px, vx=' + b.vx.toFixed(2) + ', omega=' + b.omega.toFixed(3));
  expect(Math.abs(b.vx) < 25, 'horizontal velocity decays (vx=' + b.vx.toFixed(2) + ')');
  expect(travel < 70, 'ball barely slides (' + travel.toFixed(1) + 'px in 2s)');
}

/* ---------------- 3. 挤压：撞击时压扁，静置时回弹 ---------------- */
console.log('\n--- squash ---');
{
  const w = new P.World(W, H);
  const r = radiusFor(6);                              // 42.4
  const a = w.add(new P.Body({ x: W / 2, y: H - r - 1, r, tier: 6, tag: 'ball' }));
  const b = new P.Body({ x: W / 2, y: H - r - 1 - 260, r, tier: 7, tag: 'ball' });  // 不同档，不会合成
  b.vy = 400;
  w.add(b);
  let peak = 0;
  for (let s = 0; s < 240; s++) {
    w.step(1 / 120);
    w.drainMerges();
    peak = Math.max(peak, a.sq, b.sq);
  }
  console.log('  peak squash=' + peak.toFixed(3) + '  settled a.sq=' + a.sq.toFixed(3) + ' b.sq=' + b.sq.toFixed(3));
  expect(peak > 0.09, 'impact squashes the balls (peak ' + peak.toFixed(3) + ')');
  expect(peak <= 0.161, 'squash stays within the cap');
  expect(a.sq < 0.08, 'squash relaxes after the impact');
  const bottom = a.y + a.r;
  expect(Math.abs(bottom - H) < 0.6, 'squashed ball still sits exactly on the floor (gap ' + (H - bottom).toFixed(3) + ')');
}

/* ---------------- 4. 合成规则：接触即合成 ---------------- */
console.log('\n--- merge on contact ---');
{
  // 并排贴着放
  const w = new P.World(W, H);
  const r = radiusFor(8);
  w.add(new P.Body({ x: W / 2 - r, y: H - r, r, tier: 8, tag: 'ball' }));
  w.add(new P.Body({ x: W / 2 + r, y: H - r, r, tier: 8, tag: 'ball' }));
  let firstStep = -1;
  for (let s = 0; s < 240; s++) {
    w.step(1 / 120);
    if (firstStep < 0 && w.drainMerges().length) firstStep = s;
  }
  console.log('  two same-tier balls placed touching -> first merge at step ' + firstStep);
  expect(firstStep >= 0 && firstStep < 5, 'touching same-tier balls merge right away');
}
{
  // 不同档挨着永远不合
  const w = new P.World(W, H);
  const r8 = radiusFor(8), r9 = radiusFor(9);
  w.add(new P.Body({ x: W / 2 - r8, y: H - r8, r: r8, tier: 8, tag: 'ball' }));
  w.add(new P.Body({ x: W / 2 + r9, y: H - r9, r: r9, tier: 9, tag: 'ball' }));
  let merges = 0;
  for (let s = 0; s < 360; s++) { w.step(1 / 120); merges += w.drainMerges().length; }
  console.log('  two different-tier balls touching -> merges=' + merges);
  expect(merges === 0, 'different tiers never merge');
}
{
  const w = new P.World(W, H);
  const r = radiusFor(8);
  w.add(new P.Body({ x: W / 2, y: H - r, r, tier: 8, tag: 'ball' }));
  const b = new P.Body({ x: W / 2, y: H - r - 2 * r - 300, r, tier: 8, tag: 'ball' });
  b.vy = 300;
  w.add(b);
  let hit = false;
  for (let s = 0; s < 600 && !hit; s++) {
    w.step(1 / 120);
    if (w.drainMerges().length) hit = true;
  }
  console.log('  same-tier ball dropped onto its twin -> merged=' + hit);
  expect(hit, 'a drop merges too');
}

/* ---------------- 5. 稳定性 / 边界 ---------------- */
console.log('\n--- stability & bounds ---');
function makeWorld(count) {
  const w = new P.World(W, H);
  for (let k = 0; k < count; k++) {
    const tier = N - 1 - Math.floor(Math.random() * 5);
    const r = radiusFor(tier);
    const b = new P.Body({
      x: r + Math.random() * (W - 2 * r),
      y: 70 + Math.random() * 140,
      r, tier, tag: 'ball'
    });
    b.vy = 200 + Math.random() * 200;
    b.vx = (Math.random() - 0.5) * 200;
    w.add(b);
  }
  return w;
}
function audit(w, label) {
  let worstOverlap = 0, worstX = 0, worstY = 0, bad = 0, maxSpeed = 0;
  for (const b of w.bodies) {
    if (!isFinite(b.x) || !isFinite(b.y) || !isFinite(b.vx) || !isFinite(b.vy) || !isFinite(b.angle) || !isFinite(b.sq)) bad++;
    worstX = Math.max(worstX, Math.max(0, b.r - b.x), Math.max(0, b.x + b.r - W));
    worstY = Math.max(worstY, Math.max(0, b.y + b.r - H));
    maxSpeed = Math.max(maxSpeed, Math.hypot(b.vx, b.vy));
  }
  for (let i = 0; i < w.bodies.length; i++) {
    for (let j = i + 1; j < w.bodies.length; j++) {
      const a = w.bodies[i], b = w.bodies[j];
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      worstOverlap = Math.max(worstOverlap, (a.r + b.r) - d);
    }
  }
  console.log(label.padEnd(22), 'n=' + String(w.bodies.length).padStart(4), 'NaN=' + bad,
    'maxSpeed=' + maxSpeed.toFixed(1).padStart(8),
    'wallEscape=' + Math.max(worstX, worstY).toFixed(2),
    'maxOverlap=' + worstOverlap.toFixed(2));
  return { bad, escape: Math.max(worstX, worstY), maxSpeed };
}
for (const count of [60, 110, 150]) {
  const w = makeWorld(count);
  let merges = 0;
  const t0 = Date.now();
  for (let s = 0; s < 2400; s++) { w.step(1 / 120); merges += w.drainMerges().length; }
  const ms = Date.now() - t0;
  const r = audit(w, 'spawn=' + count);
  console.log('  merges=' + merges, ' wallTime=' + ms + 'ms', ' (' + (ms / 2400).toFixed(3) + ' ms/step)');
  expect(r.bad === 0, 'no NaN/Infinity');
  expect(r.escape < 0.01, 'balls stay inside walls');
  expect(r.maxSpeed < 6000, 'no energy explosion');
}

/* 单球静止 */
{
  const w = new P.World(W, H);
  const b = w.add(new P.Body({ x: W / 2, y: 100, r: 50, tier: 4, tag: 'ball' }));
  for (let s = 0; s < 600; s++) w.step(1 / 120);
  console.log('\nresting ball: y=' + b.y.toFixed(3), 'floor=' + (H - b.r).toFixed(3), 'vy=' + b.vy.toFixed(4));
  expect(Math.abs(b.y - (H - b.r)) < 1.0, 'single ball rests on the floor');
  expect(Math.abs(b.vy) < 5, 'vertical velocity settles');
}

/* 堆叠 */
{
  const w = new P.World(W, H);
  const r = 34;
  const balls = [];
  for (let i = 0; i < 6; i++) balls.push(w.add(new P.Body({ x: W / 2, y: H - r - i * 2 * r, r, tier: 5, tag: 'ball' })));
  for (let s = 0; s < 900; s++) w.step(1 / 120);
  const top = Math.min(...balls.map(b => b.y - b.r));
  const drift = Math.max(...balls.map(b => Math.abs(b.x - W / 2)));
  console.log('stack: topY=' + top.toFixed(1), '(ideal ' + (H - 12 * r).toFixed(1) + ')', 'xDrift=' + drift.toFixed(2));
  expect(top > H - 12 * r - 12, 'stack does not sink into itself');
  expect(drift < 8, 'stack stays roughly vertical');
}

/* ---------------- 6. 合成阶梯：每一档都能合上去 ---------------- */
console.log('\n--- merge ladder (every tier t -> t-1) ---');
{
  let hit = 0;
  for (let t = N - 1; t >= 1; t--) {
    const w = new P.World(W, H);
    const rr = radiusFor(t);
    w.add(new P.Body({ x: W / 2, y: H - rr, r: rr, tier: t, tag: 'ball' }));
    const b = new P.Body({ x: W / 2, y: H - rr - 2 * rr - Math.max(3 * rr, 120), r: rr, tier: t, tag: 'ball' });
    b.vy = 300;
    w.add(b);
    let merged = false;
    for (let s = 0; s < 900 && !merged; s++) {
      w.step(1 / 120);
      for (const ev of w.drainMerges()) if (ev[0].tier === t) { merged = true; break; }
    }
    if (merged) hit++;
    else console.log('   tier', t, '(r=' + rr.toFixed(1) + ') did NOT merge');
  }
  console.log('  tiers that merged upward: ' + hit + '/' + (N - 1));
  expect(hit === N - 1, 'every one of the ' + (N - 1) + ' merge steps fires');
  // 尺寸表第 2/3 档都是 41.0%，所以这里只验证「不缩小」
  let nonShrink = true;
  for (let i = 1; i < N; i++) if (radiusFor(i) > radiusFor(i - 1) + 1e-9) nonShrink = false;
  expect(nonShrink, 'each tier is at least as big as the one below it');
}

/* ---------------- 7. 真实玩法模拟 ---------------- */
console.log('\n--- realistic play simulation ---');

function playSim(smart) {
  const w = new P.World(W, H);
  let merges = 0, dropped = 0, score = 0, over = false, overTimer = 0, overAt = 0;
  const randTier = () => N - 1 - Math.floor(Math.random() * 5);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  for (let f = 0; f < 60 * 300; f++) {
    if (!over && f % 24 === 0) {
      const tier = randTier();
      const r = radiusFor(tier);
      let x = clamp(r + Math.random() * (W - 2 * r), r + 2, W - r - 2);
      if (smart) {
        // 会玩的人：优先往同类球头上砸
        const same = w.bodies.filter(b => b.tier === tier && b.y > 200);
        if (same.length && Math.random() < 0.8) {
          x = clamp(same[Math.floor(Math.random() * same.length)].x, r + 2, W - r - 2);
        }
      }
      const b = new P.Body({ x, y: 64, r, tier, tag: 'ball' });
      b.vy = 120;
      w.add(b); dropped++;
    }
    for (let s = 0; s < 2; s++) {
      w.step(1 / 120);
      const done = new Set();
      for (const [a, b] of w.drainMerges()) {
        if (a.dead || b.dead || done.has(a) || done.has(b)) continue;
        done.add(a); done.add(b);
        const t = a.tier;
        w.remove(a); w.remove(b); merges++;
        if (t === 0) continue;
        const nt = t - 1;
        const nb = new P.Body({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, r: radiusFor(nt), tier: nt, tag: 'ball' });
        nb.vy = -55; nb.sq = 0.13;
        w.add(nb);
        score += (N - t) * (N - t + 1) / 2;
      }
    }
    let danger = false;
    for (const b of w.bodies) if (b.age > 1.1 && b.y - b.r < 128) { danger = true; break; }
    overTimer = danger ? overTimer + 1 / 60 : Math.max(0, overTimer - 2.2 / 60);
    if (!over && overTimer > 1.3) { over = true; overAt = f; }
    if (over) break;
  }
  return { w, merges, dropped, score, over, secs: overAt / 60 };
}

for (const smart of [false, true]) {
  const r = playSim(smart);
  const a = audit(r.w, (smart ? 'skilled' : 'random') + ' bot');
  const rate = r.merges / r.dropped;
  console.log('  dropped=' + r.dropped, 'merges=' + r.merges, 'rate=' + rate.toFixed(2),
    'score=' + r.score, 'survived=' + r.secs.toFixed(1) + 's', 'left=' + r.w.bodies.length);
  expect(a.bad === 0, 'no NaN (' + (smart ? 'skilled' : 'random') + ')');
  expect(rate > 0.4, 'merging keeps up (' + (rate * 100).toFixed(0) + '% of drops merge)');
  expect(r.secs > 40, 'a run lasts a reasonable while (' + r.secs.toFixed(1) + 's)');
}

console.log('\n' + (fails === 0 ? 'ALL PASS' : fails + ' FAILURES'));
process.exit(fails === 0 ? 0 : 1);

