(() => {
  'use strict';
  // 文章页只负责交互；评论的持久化和审核由 Worker 完成。
  // API 地址和文章路径由 Hugo 模板写入 data-* 属性。
  const root = document.getElementById('comments');
  if (!root) return;
  const $ = id => document.getElementById(id);
  const form = $('comment-form'), fields = $('comment-fields'), send = $('comment-send');
  const body = $('comment-body'), nickname = $('comment-nickname');
  const list = $('comment-list'), more = $('comment-more'), retry = $('comment-retry');
  let next = null, loading = false, submitting = false, lastPayload = '', requestId = '';
  const shown = new Set();
  // 状态区域带有 aria-live，使辅助阅读工具也能获知提交结果。
  function notice(id, message, state = '') { $(id).textContent = message; $(id).dataset.state = state; }
  async function api(url, options = {}) {
    // 限制等待时间；超时只表示前端停止等待，不代表后端没有保存成功。
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, { ...options, credentials: 'omit', cache: 'no-store', signal: controller.signal });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) throw new Error(data?.error || '服务暂时不可用，请稍后再试。');
      return data;
    } finally { clearTimeout(timeout); }
  }
  function append(comment) {
    // 用 ID 去重，并用 textContent 展示用户输入，避免把留言当成 HTML 执行。
    if (shown.has(comment.id)) return;
    shown.add(comment.id);
    const item = document.createElement('li'); item.className = 'comment-item';
    const header = document.createElement('header');
    const name = document.createElement('strong'); name.textContent = comment.nickname;
    const date = document.createElement('time'); date.dateTime = comment.created_at;
    date.textContent = new Date(comment.created_at).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
    const text = document.createElement('p'); text.textContent = comment.body;
    header.append(name, date); item.append(header, text); list.append(item);
  }
  async function load() {
    // loading 防止重复点击造成并发加载；请求失败时保留游标，重试当前页。
    if (loading) return;
    loading = true; more.disabled = true; retry.hidden = true;
    notice('comment-load-status', '正在读取留言…');
    try {
      const url = new URL(root.dataset.api, location.href);
      url.searchParams.set('article', root.dataset.article);
      if (next) url.searchParams.set('before', next);
      const data = await api(url);
      if (!Array.isArray(data.comments)) throw new Error('留言暂时无法读取，请重试。');
      data.comments.forEach(append); next = data.next; more.hidden = !next;
      notice('comment-load-status', list.children.length ? '' : '还没有公开留言，欢迎留下你的第一条想法。');
    } catch (error) {
      notice('comment-load-status', error.name === 'AbortError' ? '读取超时，请重试。' : error instanceof TypeError ? '连接中断，请检查网络后重试。' : error.message, 'error'); retry.hidden = false;
    } finally { loading = false; more.disabled = false; }
  }
  body.addEventListener('input', () => { $('comment-counter').textContent = body.value.length + ' / 2000'; });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting || !form.reportValidity()) return;
    const payload = { article: root.dataset.article, nickname: nickname.value.trim(), body: body.value.trim() };
    if (!payload.nickname || payload.body.length < 2) {
      notice('comment-submit-status', '请填写昵称和至少 2 个字符的留言，不能只有空格。', 'error'); return;
    }
    const serialized = JSON.stringify(payload);
    // 内容未变的重试沿用同一个 UUID；编辑内容后才生成新的提交标识。
    // 标识仅存在当前页面内存中，刷新页面后不会继续保留。
    if (lastPayload !== serialized) { requestId = crypto.randomUUID(); lastPayload = serialized; }
    submitting = true; fields.disabled = true; form.setAttribute('aria-busy', 'true'); $('comment-send-label').textContent = '正在提交…';
    notice('comment-submit-status', '正在提交留言…');
    try {
      const data = await api(root.dataset.api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, requestId }) });
      if (data.ok !== true) throw new Error('暂时无法确认留言是否收到，请稍后重试。');
      // 收到明确回执后才清空正文。此时仍在待审核阶段，不直接加入公开列表。
      body.value = ''; $('comment-counter').textContent = '0 / 2000'; lastPayload = ''; requestId = '';
      notice('comment-submit-status', '留言已收到。编辑审核通过后，会显示在这篇文章下方。', 'success');
    } catch (error) {
      // 失败时保留输入和提交标识，让读者能够安全重试。
      notice('comment-submit-status', error.name === 'AbortError' || error instanceof TypeError ? '暂时无法确认是否收到，内容已保留。可以重试，重复请求不会生成多条留言。' : error.message, 'error');
    } finally {
      submitting = false; fields.disabled = false; form.removeAttribute('aria-busy'); $('comment-send-label').textContent = '提交留言';
    }
  });
  more.addEventListener('click', load); retry.addEventListener('click', load);
  // HTML 默认禁用提交按钮，脚本初始化完成后再开放提交并读取第一页留言。
  send.disabled = false; load();
})();
