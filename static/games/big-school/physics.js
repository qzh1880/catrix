/* ============================================================
 * physics.js —— 极简 2D 圆盘物理引擎
 * 无依赖，浏览器 / Node 通用（UMD）。
 *
 * 特性：
 *  - 重力 + 圆-圆 / 圆-墙碰撞 + 切向摩擦 + 转动
 *  - 滚动阻力：贴地的球很快就停下来，不会一直滑
 *  - 软接触（挤压）：每个球记录受压程度 sq 与受压方向 sqAngle。
 *    碰撞本身永远是刚性的（半径就是 r），挤压只体现在渲染上：
 *    把球心朝接触点挪 r*sq、并沿法线压扁 (1-sq)。
 *    这样「被压扁的球」表面正好落在接触点上，既不悬空也不穿模，
 *    而且几何与挤压解耦，不会出现「压扁→悬空→砸得更狠」的正反馈。
 *  - 合成判定：两个同类球**只要真正接触上**就合成（不做重叠量要求）。
 *    接触记录与合成结算在同一步内完成，避免高速撞击时漏判。
 * ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SuikaPhysics = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var POS_PERCENT = 0.85;    // 位置修正比例
  var SLOP = 0.25;           // 允许的穿透容差，避免抖动
  var TOUCH_EPS = 0.05;      // 判定「实接触」的额外容差
  var SQ_MAX = 0.16;         // 最大挤压比例
  var SQ_K = 0.0008;         // 接触载荷 -> 挤压 的换算系数
  var SQ_IN = 0.85;          // 压下去的速度
  var SQ_OUT = 0.14;         // 弹回来的速度

  function Body(o) {
    this.x = o.x;
    this.y = o.y;
    this.vx = 0;
    this.vy = 0;
    this.angle = 0;
    this.omega = 0;
    this.r = o.r;
    this.tier = o.tier === undefined ? 0 : o.tier;
    this.restitution = o.restitution === undefined ? 0.08 : o.restitution;
    this.friction = o.friction === undefined ? 0.72 : o.friction;
    this.density = o.density === undefined ? 0.0012 : o.density;
    this.isStatic = !!o.isStatic;
    this.age = 0;
    this.dead = false;
    this.tag = o.tag || null;

    this.sq = 0;             // 当前挤压比例 0..1
    this.sqAngle = 0;        // 从球心指向接触点的方向
    this._load = 0;          // 本步最大接触载荷（法向冲量 / 质量）
    this._loadAngle = 0;
    this._grounded = false;

    this.recomputeMass();
  }

  Body.prototype.recomputeMass = function () {
    if (this.isStatic) {
      this.m = Infinity;
      this.invM = 0;
      this.invI = 0;
      return;
    }
    this.m = Math.PI * this.r * this.r * this.density;
    this.invM = 1 / this.m;
    var I = 0.5 * this.m * this.r * this.r;   // 实心圆盘转动惯量
    this.invI = 1 / I;
  };

  function World(w, h) {
    this.w = w;
    this.h = h;
    this.gravity = 2600;
    this.iterations = 7;
    this.bodies = [];
    this.merges = [];
    this._pairs = [];
    this.sqMax = SQ_MAX;
    this.sqK = SQ_K;
    this.wallFriction = 0.92;      // 地面 / 侧壁摩擦比球球之间更大
    this.rollDamp = 0.045;         // 滚动阻力
    this.linearDamping = 0.9988;
    this.angularDamping = 0.993;
  }

  World.prototype.add = function (body) { this.bodies.push(body); return body; };

  World.prototype.remove = function (body) {
    var i = this.bodies.indexOf(body);
    if (i >= 0) this.bodies.splice(i, 1);
    body.dead = true;
  };

  World.prototype.clear = function () {
    this.bodies.length = 0;
    this.merges.length = 0;
    this._pairs.length = 0;
  };

  World.prototype.drainMerges = function () {
    if (!this.merges.length) return [];
    var out = this.merges;
    this.merges = [];
    return out;
  };

  /* ---------------- 单步 ---------------- */
  World.prototype.step = function (dt) {
    var bodies = this.bodies;
    var i, b;

    for (i = 0; i < bodies.length; i++) {
      b = bodies[i];
      if (b.isStatic) continue;
      b.vy += this.gravity * dt;
      b.vx *= this.linearDamping;
      b.vy *= this.linearDamping;
      b.omega *= this.angularDamping;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.angle += b.omega * dt;
      b.age += dt;
      b._load = 0;
      if (!isFinite(b.x) || !isFinite(b.y)) {   // 保险：数值爆炸时归位
        b.x = this.w / 2; b.y = this.h / 2; b.vx = 0; b.vy = 0; b.omega = 0;
      }
    }

    for (var it = 0; it < this.iterations; it++) {
      this.solveWalls();
      this.solveContacts(it === 0);
    }

    this.updateSquash();
    this.checkMerges();
    this.applyRollingResistance();
    this.clampToBounds();
    return dt;
  };

  /* ---------------- 挤压 ---------------- */
  World.prototype.updateSquash = function () {
    var bodies = this.bodies;
    for (var i = 0; i < bodies.length; i++) {
      var b = bodies[i];
      if (b.isStatic) continue;
      var target = Math.min(this.sqMax, b._load * this.sqK);
      b.sq += (target - b.sq) * (target > b.sq ? SQ_IN : SQ_OUT);
      if (b._load > 0) b.sqAngle = b._loadAngle;
      b._load = 0;
    }
  };

  /* 同类球合成：只要真正接触上就合成（不做重叠量要求） */
  World.prototype.checkMerges = function () {
    var pairs = this._pairs;
    for (var i = 0; i < pairs.length; i++) {
      var a = pairs[i][0], b = pairs[i][1];
      if (a.dead || b.dead) continue;
      this.merges.push([a, b]);
    }
    pairs.length = 0;
  };

  /* 滚动阻力：压在地面上的球额外衰减水平速度和自转 */
  World.prototype.applyRollingResistance = function () {
    var bodies = this.bodies;
    for (var i = 0; i < bodies.length; i++) {
      var b = bodies[i];
      if (b.isStatic) continue;
      if (b._grounded) {
        var k = 1 - this.rollDamp;
        b.vx *= k;
        b.omega *= k;
        b._grounded = false;
      }
    }
  };

  /* ---------------- 圆-墙（始终用真实半径） ---------------- */
  World.prototype.solveWalls = function () {
    var bodies = this.bodies;
    for (var i = 0; i < bodies.length; i++) {
      var b = bodies[i];
      if (b.isStatic) continue;
      var r = b.r;
      if (b.y + r > this.h) this.resolveWall(b, 0, -1, b.y + r - this.h);
      if (b.x - r < 0) this.resolveWall(b, 1, 0, r - b.x);
      if (b.x + r > this.w) this.resolveWall(b, -1, 0, b.x + r - this.w);
    }
  };

  /* n 为「从墙指向球」的单位法线，pen 为穿透深度 */
  World.prototype.resolveWall = function (b, nx, ny, pen) {
    if (pen <= 0) return;
    b.x += nx * pen;
    b.y += ny * pen;
    if (ny < 0) b._grounded = true;

    var r = b.r;
    var rax = -nx * r, ray = -ny * r;          // 接触点相对球心
    var vpx = b.vx - b.omega * ray;            // 接触点速度 = v + ω×r
    var vpy = b.vy + b.omega * rax;
    var vn = vpx * nx + vpy * ny;
    if (vn >= 0) return;

    var jn = -(1 + b.restitution) * vn / b.invM;
    b.vx += jn * nx * b.invM;
    b.vy += jn * ny * b.invM;

    var load = jn * b.invM;
    if (load > b._load) { b._load = load; b._loadAngle = Math.atan2(-ny, -nx); }

    // 切向摩擦（墙面比球球更涩，底部不容易滑）
    var tx = -ny, ty = nx;
    var vt = vpx * tx + vpy * ty;
    var raCrossT = rax * ty - ray * tx;
    var denom = b.invM + b.invI * raCrossT * raCrossT;
    var jt = -vt / denom;
    var maxJt = this.wallFriction * jn;
    if (jt > maxJt) jt = maxJt; else if (jt < -maxJt) jt = -maxJt;
    var jtx = jt * tx, jty = jt * ty;
    b.vx += jtx * b.invM;
    b.vy += jty * b.invM;
    b.omega += (rax * jty - ray * jtx) * b.invI;
  };

  /* ---------------- 圆-圆 ---------------- */
  World.prototype.solveContacts = function (first) {
    var bodies = this.bodies;
    var order = bodies.slice().sort(function (a, b) { return (a.x - a.r) - (b.x - b.r); });
    for (var i = 0; i < order.length; i++) {
      var a = order[i];
      var aMax = a.x + a.r;
      for (var j = i + 1; j < order.length; j++) {
        var b = order[j];
        if (b.x - b.r > aMax) break;
        if (a.isStatic && b.isStatic) continue;
        this.resolvePair(a, b, first);
      }
    }
  };

  World.prototype.resolvePair = function (a, b, first) {
    var ra = a.r, rb = b.r;
    var dx = b.x - a.x, dy = b.y - a.y;
    var d2 = dx * dx + dy * dy;
    var rsum = ra + rb;
    if (d2 > (rsum + TOUCH_EPS) * (rsum + TOUCH_EPS)) return;

    var d = Math.sqrt(d2);
    var nx, ny;
    if (d < 1e-6) { nx = 0; ny = -1; d = 1e-6; } else { nx = dx / d; ny = dy / d; }

    // 记录同类球接触对，稍后统一结算成合成事件
    if (first && !a.dead && !b.dead && a.tier === b.tier && a.tag === 'ball' && b.tag === 'ball') {
      this._pairs.push([a, b]);
    }

    var pen = rsum - d;
    if (pen <= 0) return;
    var invSum = a.invM + b.invM;
    if (invSum === 0) return;

    if (pen > SLOP) {
      var corr = ((pen - SLOP) * POS_PERCENT) / invSum;
      a.x -= nx * corr * a.invM; a.y -= ny * corr * a.invM;
      b.x += nx * corr * b.invM; b.y += ny * corr * b.invM;
    }

    var rax = nx * ra, ray = ny * ra;
    var rbx = -nx * rb, rby = -ny * rb;
    var rvx = (b.vx - b.omega * rby) - (a.vx - a.omega * ray);
    var rvy = (b.vy + b.omega * rbx) - (a.vy + a.omega * rax);
    var vn = rvx * nx + rvy * ny;
    if (vn >= 0) return;

    var e = Math.min(a.restitution, b.restitution);
    var jn = -(1 + e) * vn / invSum;
    a.vx -= jn * nx * a.invM; a.vy -= jn * ny * a.invM;
    b.vx += jn * nx * b.invM; b.vy += jn * ny * b.invM;

    var la = jn * a.invM, lb = jn * b.invM;
    if (la > a._load) { a._load = la; a._loadAngle = Math.atan2(ny, nx); }
    if (lb > b._load) { b._load = lb; b._loadAngle = Math.atan2(-ny, -nx); }

    var tx = -ny, ty = nx;
    var vt = rvx * tx + rvy * ty;
    var raCrossT = rax * ty - ray * tx;
    var rbCrossT = rbx * ty - rby * tx;
    var denom = invSum + a.invI * raCrossT * raCrossT + b.invI * rbCrossT * rbCrossT;
    var jt = -vt / denom;
    var mu = (a.friction + b.friction) * 0.5;
    var maxJt = mu * jn;
    if (jt > maxJt) jt = maxJt; else if (jt < -maxJt) jt = -maxJt;
    var jtx = jt * tx, jty = jt * ty;
    a.vx -= jtx * a.invM; a.vy -= jty * a.invM;
    b.vx += jtx * b.invM; b.vy += jty * b.invM;
    a.omega -= (rax * jty - ray * jtx) * a.invI;
    b.omega += (rbx * jty - rby * jtx) * b.invI;
  };

  /* 兜底：把球硬夹回场地内，杜绝贴墙穿透 */
  World.prototype.clampToBounds = function () {
    var bodies = this.bodies;
    for (var i = 0; i < bodies.length; i++) {
      var b = bodies[i];
      if (b.isStatic) continue;
      var r = b.r;
      if (b.x - r < 0) b.x = r;
      else if (b.x + r > this.w) b.x = this.w - r;
      if (b.y + r > this.h) b.y = this.h - r;
    }
  };

  World.prototype.stats = function () {
    var maxSpeed = 0, minY = Infinity, maxSq = 0;
    for (var i = 0; i < this.bodies.length; i++) {
      var b = this.bodies[i];
      var s = Math.hypot(b.vx, b.vy);
      if (s > maxSpeed) maxSpeed = s;
      if (b.y - b.r < minY) minY = b.y - b.r;
      if (b.sq > maxSq) maxSq = b.sq;
    }
    return { count: this.bodies.length, maxSpeed: maxSpeed, minY: minY, maxSq: maxSq };
  };

  return { Body: Body, World: World, SQ_MAX: SQ_MAX };
});
