// 仅接受同源游戏 iframe 的尺寸消息，避免其他窗口任意修改页面高度。
(() => {
  const frame = document.getElementById('tetris-frame');
  if (!frame) return;
  window.addEventListener('message', event => {
    if (event.source !== frame.contentWindow || event.origin !== location.origin || event.data?.type !== 'catrix-game-size') return;
    const height = event.data.height;
    // iframe 使用 border-box；额外计入上下边框，避免内容刚好多出两像素出现内层滚动条。
    if (Number.isFinite(height) && height >= 300 && height <= 3000) frame.style.height = (Math.ceil(height) + 2) + 'px';
  });
  // 页面滚走后自动暂停，回到游戏时由读者主动继续，避免无意中结束一局。
  new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) frame.contentWindow?.postMessage({type:'catrix-game-pause'}, location.origin);
  }).observe(frame);
})();
