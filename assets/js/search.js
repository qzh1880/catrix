(() => {
  const input = document.getElementById('search-input');
  if (!input) return;
  const results = document.getElementById('search-results'), overlay = document.getElementById('search-overlay');
  const tag = document.getElementById('search-tag'), category = document.getElementById('search-category');
  const status = document.getElementById('search-status'), retry = document.getElementById('search-retry');
  let index = null, pending = null, revision = 0, timeout = null;
  // 共享正在加载的请求；失败不缓存空索引，以便用户重试。
  async function loadIndex() {
    if (index) return index;
    if (pending) return pending;
    pending = (async () => {
      const response = await fetch(overlay.dataset.index, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('index unavailable');
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('invalid index');
      index = data;
      for (const [select, field] of [[tag, 'tags'], [category, 'categories']]) {
        for (const value of [...new Set(index.flatMap(item => item[field] || []))].sort()) {
          const option = document.createElement('option'); option.value = value; option.textContent = value; select.append(option);
        }
      }
      return index;
    })();
    try { return await pending; } finally { pending = null; }
  }
  async function render() {
    const current = ++revision;
    retry.hidden = true; status.textContent = '正在读取搜索索引…';
    try {
      const data = await loadIndex();
      if (current !== revision) return;
      const matches = window.CatrixSearch.search(data, input.value, tag.value, category.value);
      results.replaceChildren();
      status.textContent = matches.length ? '找到 ' + matches.length + ' 篇内容' + (matches.length > 30 ? '，显示前 30 篇，请增加关键词。' : '。') : '没有找到相关内容，请更换关键词或清除筛选。';
      for (const item of matches.slice(0, 30)) {
        // 索引中的文本也不能当作 HTML 执行；链接只接受本站地址。
        const url = new URL(item.permalink, location.href);
        if (url.origin !== location.origin || !['https:', 'http:'].includes(url.protocol)) continue;
        const link = document.createElement('a'); link.href = url.href;
        const heading = document.createElement('h4'); heading.textContent = item.title;
        const meta = document.createElement('small'); meta.textContent = [item.author, item.date, ...(item.tags || []), ...(item.categories || [])].filter(Boolean).join(' · ');
        const summary = document.createElement('p'); summary.textContent = String(item.summary || item.content || '').slice(0, 120);
        link.append(heading, meta, summary); results.append(link);
      }
    } catch (error) {
      if (current !== revision) return;
      results.replaceChildren(); status.textContent = '搜索索引加载失败，请检查网络后重试。'; retry.hidden = false;
    }
  }
  // 版本号阻止旧异步结果覆盖刚输入的新查询。
  input.addEventListener('input', () => { ++revision; clearTimeout(timeout); timeout = setTimeout(render, 180); });
  input.addEventListener('search-open', render);
  tag.addEventListener('change', render); category.addEventListener('change', render); retry.addEventListener('click', render);
  overlay.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const nodes = [...overlay.querySelectorAll('button:not([hidden]),input,select,a[href]')];
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
})();
