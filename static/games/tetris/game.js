/* 浏览器层负责绘图、操作和本机最高分；规则计算交给 engine.js。 */
(() => {
  'use strict';
  const { Game, SHAPES } = window.CatrixBlocks;
  const game = new Game(), $ = id => document.getElementById(id);
  const canvas = $('board'), context = canvas.getContext('2d');
  const COLORS = { I:'#82bdc5', O:'#e4c870', T:'#b4a0ca', S:'#a4bc80', Z:'#d98272', J:'#819fc9', L:'#dfaa73' };
  const NAMES = { I:'长条', O:'正方形', T:'T形', S:'S形', Z:'Z形', J:'J形', L:'L形' };
  const STORAGE = 'catrix.blocks.best.v1';
  let best = 0, storedBest = 0, previousState = '', previousPieces = 0, restartPending = false;
  let lastTime = performance.now(), dirty = true, repeats = new Map();
  try { const saved = Number(localStorage.getItem(STORAGE)); if (Number.isSafeInteger(saved) && saved > 0) best = saved; } catch { /* 隐私模式下仍允许游戏，最高分只保留在本次页面中。 */ }
  storedBest = best;
  const announce = message => { $('announcement').textContent = message; };

  function tile(ctx, x, y, size, type, ghost = false) {
    const inset = Math.max(1, size * .065);
    if (ghost) {
      ctx.strokeStyle = COLORS[type]; ctx.globalAlpha = .5; ctx.lineWidth = 1.5;
      ctx.strokeRect(x + inset, y + inset, size - 2 * inset, size - 2 * inset); ctx.globalAlpha = 1; return;
    }
    ctx.fillStyle = COLORS[type]; ctx.fillRect(x + inset, y + inset, size - 2 * inset, size - 2 * inset);
    ctx.fillStyle = '#ffffff38'; ctx.fillRect(x + inset, y + inset, size - 2 * inset, Math.max(2, size * .1));
    ctx.fillStyle = '#17292224'; ctx.fillRect(x + inset, y + size - inset - 3, size - 2 * inset, 3);
  }
  // 按设备像素比绘制棋盘，CSS 决定实际大小，避免手机高分屏上的模糊。
  function drawBoard() {
    const width = canvas.clientWidth, dpr = Math.min(devicePixelRatio || 1, 3);
    const w = Math.round(width * dpr), h = Math.round(width * 2 * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, width * 2);
    const cell = width / 10;
    context.strokeStyle = '#ffffff07'; context.lineWidth = 1;
    for (let x = 0; x <= 10; x++) { context.beginPath(); context.moveTo(x * cell,0); context.lineTo(x * cell,width * 2); context.stroke(); }
    for (let y = 0; y <= 20; y++) { context.beginPath(); context.moveTo(0,y * cell); context.lineTo(width,y * cell); context.stroke(); }
    game.board.forEach((row, y) => row.forEach((type, x) => { if (type) tile(context, x * cell, y * cell, cell, type); }));
    if (game.current) {
      const p = game.current, ghost = game.ghostY();
      for (const [y, isGhost] of [[ghost, true], [p.y, false]]) {
        p.cells.forEach((row, dy) => row.forEach((filled, dx) => {
          if (filled && y + dy >= 0) tile(context, (p.x + dx) * cell, (y + dy) * cell, cell, p.type, isGhost);
        }));
      }
    }
  }
  function preview(id, types) {
    const target = $(id), ctx = target.getContext('2d');
    ctx.clearRect(0, 0, target.width, target.height);
    types.forEach((type, index) => {
      if (!type) return;
      const cells = SHAPES[type], filled = [];
      cells.forEach((row,y) => row.forEach((value,x) => { if (value) filled.push([x,y]); }));
      const minX = Math.min(...filled.map(c => c[0])), maxX = Math.max(...filled.map(c => c[0]));
      const minY = Math.min(...filled.map(c => c[1])), maxY = Math.max(...filled.map(c => c[1]));
      const size = id === 'next' && index > 0 ? 19 : 23;
      const x = (120 - (maxX - minX + 1) * size) / 2;
      const y = id === 'next' ? index * 70 + (70 - (maxY - minY + 1) * size) / 2 : (76 - (maxY - minY + 1) * size) / 2;
      filled.forEach(([dx,dy]) => tile(ctx, x + (dx-minX)*size, y + (dy-minY)*size, size, type));
    });
    target.setAttribute('aria-label', types.filter(Boolean).map(t => NAMES[t]).join('、') || '尚未暂存方块');
  }
  function render() {
    drawBoard(); preview('next', game.queue.slice(0,3)); preview('hold', [game.held]);
    best = Math.max(best, game.score);
    if (best > storedBest) { try { localStorage.setItem(STORAGE, String(best)); } catch { /* 存储失败不影响计分。 */ } storedBest = best; }
    for (const [id,value] of [['score',game.score],['lines',game.lines],['level',String(game.level).padStart(2,'0')],['best',best]]) $(id).textContent = value;
    const active = game.state === 'running';
    document.querySelectorAll('[data-action]').forEach(button => { button.disabled = !active; });
    $('hold-button').disabled = !active || !game.canHold;
    $('pause').disabled = !['running','paused'].includes(game.state);
    $('pause').textContent = game.state === 'paused' ? '继续游戏 P' : '暂停 P';
    $('state-label').textContent = { ready:'准备开始',running:'正在游戏',paused:'已暂停',over:'本局结束' }[game.state];
    $('overlay').hidden = active;
    if (game.state !== previousState || restartPending) {
      if (game.state === 'paused') {
        $('overlay-kicker').textContent = 'TAKE YOUR TIME'; $('overlay-title').textContent = restartPending ? '再来一局？' : '休息一下。';
        $('overlay-description').textContent = restartPending ? '再次点击“重新开始”将清空本局；也可以继续。' : '方块会在这里等你。'; $('start').textContent = '继续游戏 ↗';
      } else if (game.state === 'over') {
        $('overlay-kicker').textContent = 'ONE MORE TRY'; $('overlay-title').textContent = '这一局，很不错。';
        $('overlay-description').textContent = `获得 ${game.score} 分，消除 ${game.lines} 行。`; $('start').textContent = '再来一局 ↗';
        announce(`游戏结束，得分 ${game.score}，消除 ${game.lines} 行。`);
      }
      previousState = game.state;
    }
    if (game.pieces !== previousPieces) {
      previousPieces = game.pieces;
      if (game.lastClear) announce(`消除了 ${game.lastClear} 行！当前等级 ${game.level}。`);
    }
    dirty = false;
  }
  function clearRepeats() { repeats.clear(); }
  function begin() {
    restartPending = false; clearRepeats(); game.start(); previousPieces = 0;
    announce('游戏开始。用方向键或下方按钮操作。'); dirty = true; canvas.focus({preventScroll:true});
  }
  function pause() {
    if (game.state !== 'running') return;
    game.pause(); clearRepeats(); dirty = true; announce('已暂停，点击继续或按 P 恢复。');
  }
  function resume() { game.resume(); restartPending = false; dirty = true; announce('继续游戏。'); canvas.focus({preventScroll:true}); }
  function act(action) {
    if (game.state !== 'running') return;
    ({ left:() => game.move(-1), right:() => game.move(1), down:() => game.softDrop(),
      rotate:() => game.rotate(), reverse:() => game.rotate(-1), drop:() => game.hardDrop(), hold:() => game.hold() })[action]?.();
    dirty = true;
  }
  $('start').addEventListener('click', () => game.state === 'paused' ? resume() : begin());
  $('pause').addEventListener('click', () => game.state === 'paused' ? resume() : pause());
  $('restart').addEventListener('click', () => {
    // 游戏进行中第一次点击只暂停并提示，第二次才真正重置，避免误触丢失成绩。
    if (['running','paused'].includes(game.state) && !restartPending) { pause(); restartPending = true; dirty = true; }
    else begin();
  });
  $('hold-button').addEventListener('click', () => act('hold'));
  const KEYS = { ArrowLeft:'left',ArrowRight:'right',ArrowDown:'down',ArrowUp:'rotate',KeyX:'rotate',KeyZ:'reverse',Space:'drop',KeyC:'hold' };
  document.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input,textarea,select,summary')) return;
    if (event.target.closest('button') && ['Space','Enter'].includes(event.code)) return;
    if (['KeyP','Escape'].includes(event.code)) {
      event.preventDefault(); if (!event.repeat) game.state === 'paused' ? resume() : pause(); return;
    }
    if (event.code === 'Enter' && ['ready','over'].includes(game.state)) { event.preventDefault(); begin(); return; }
    const action = KEYS[event.code];
    if (!action || game.state !== 'running') return;
    event.preventDefault(); if (event.repeat) return;
    act(action);
    if (['left','right','down'].includes(action)) repeats.set(event.code, {action,next:performance.now()+170});
  });
  document.addEventListener('keyup', event => repeats.delete(event.code));
  document.querySelectorAll('[data-action]').forEach(button => {
    button.addEventListener('pointerdown', event => {
      if (button.disabled || event.button !== 0) return;
      event.preventDefault(); button.setPointerCapture(event.pointerId); act(button.dataset.action);
      if (['left','right','down'].includes(button.dataset.action)) repeats.set('pointer'+event.pointerId, {action:button.dataset.action,next:performance.now()+170});
    });
    for (const type of ['pointerup','pointercancel','lostpointercapture']) button.addEventListener(type, event => repeats.delete('pointer'+event.pointerId));
    // 原生键盘触发的 click 不会经过 pointerdown；单独处理，避免鼠标双执行。
    button.addEventListener('click', event => { if (event.detail === 0) act(button.dataset.action); });
  });
  window.addEventListener('blur', pause);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  // 嵌入页在游戏滚出视野时通知暂停；只接受同源父页面的消息。
  window.addEventListener('message', event => { if (event.source === parent && event.origin === location.origin && event.data?.type === 'catrix-game-pause') pause(); });
  function resized() {
    dirty = true;
    // 测量内容而非 iframe 视口高度，窄屏切换时父页面也能正确缩短 iframe。
    if (parent !== window) parent.postMessage({type:'catrix-game-size',height:Math.ceil(document.body.getBoundingClientRect().height)}, location.origin);
  }
  new ResizeObserver(resized).observe(document.querySelector('.game-shell'));
  function frame(now) {
    if (game.state === 'running') {
      for (const entry of repeats.values()) if (now >= entry.next) { act(entry.action); entry.next = now + 65; }
      game.tick(now - lastTime); dirty = true;
    } else clearRepeats();
    lastTime = now; if (dirty) render(); requestAnimationFrame(frame);
  }
  render(); requestAnimationFrame(frame);
})();
