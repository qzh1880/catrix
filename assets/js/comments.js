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
  let parentId = null;
  const shown = new Set();
  let refreshRequested = false;
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
    header.append(name, date); item.append(header);
    if (comment.parent_id) {
      const context = document.createElement('p'); context.className = 'comment-reply-context';
      // 原留言删除或隐藏后，服务端不再返回其昵称和正文。
      context.textContent = comment.parent_nickname ? '回复 ' + comment.parent_nickname + '：' + comment.parent_body : '回复的原留言已删除或不可见';
      item.append(context);
    }
    item.append(text);
    const actions = document.createElement('div'); actions.className = 'comment-actions';
    if (!comment.parent_id) {
      const answer = document.createElement('button'); answer.type = 'button'; answer.textContent = '回复';
      answer.addEventListener('click', () => {
        if (submitting) return;
        parentId = comment.id; $('comment-reply').hidden = false;
        $('comment-reply-label').textContent = '正在回复 ' + comment.nickname;
        body.focus(); form.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      actions.append(answer);
    }
    // 举报采用固定类别，不收集举报者身份；只向管理员发送，不自动隐藏评论。
    const details = document.createElement('details');
    const summary = document.createElement('summary'); summary.textContent = '举报';
    const reportForm = document.createElement('form'); reportForm.className = 'comment-report-form';
    const label = document.createElement('label'); label.textContent = '举报原因';
    const reason = document.createElement('select'); reason.setAttribute('aria-label', '举报原因');
    for (const [value, title] of [['spam', '广告刷屏'], ['abuse', '辱骂攻击'], ['privacy', '泄露隐私'], ['other', '其他不当内容']]) {
      const option = document.createElement('option'); option.value = value; option.textContent = title; reason.append(option);
    }
    label.append(reason);
    const report = document.createElement('button'); report.type = 'submit'; report.textContent = '提交举报';
    const result = document.createElement('p'); result.setAttribute('role', 'status');
    let reporting = false;
    reportForm.addEventListener('submit', async event => {
      event.preventDefault(); if (reporting) return;
      reporting = true; report.disabled = true; result.textContent = '正在提交举报…';
      try {
        const data = await api(root.dataset.api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'report', id: comment.id, article: root.dataset.article, reason: reason.value }) });
        result.textContent = data.message || '举报已收到，等待管理员处理。';
      } catch (error) { result.textContent = error.name === 'AbortError' || error instanceof TypeError ? '举报未成功，请检查网络后重试。' : error.message; }
      finally { reporting = false; report.disabled = false; }
    });
    reportForm.append(label, report, result); details.append(summary, reportForm); actions.append(details);
    item.append(actions); list.append(item);
  }
  async function load(reset = false) {
    // 提交与读取可能同时进行；当前读取结束后再刷新，避免旧响应覆盖新留言。
    if (reset) refreshRequested = true;
    // loading 防止重复点击造成并发加载；请求失败时保留游标，重试当前页。
    if (loading) return;
    if (refreshRequested) { next = null; shown.clear(); list.replaceChildren(); refreshRequested = false; }
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
    } finally { loading = false; more.disabled = false; if (refreshRequested) await load(); }
  }
  $('comment-cancel-reply').addEventListener('click', () => { parentId = null; $('comment-reply').hidden = true; body.focus(); });
  body.addEventListener('input', () => { $('comment-counter').textContent = body.value.length + ' / 2000'; });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting || !form.reportValidity()) return;
    const payload = { article: root.dataset.article, nickname: nickname.value.trim(), body: body.value.trim(), parentId };
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
      // 收到明确回执后才清空正文。随后重新读取公开列表，以服务器结果为准。
      parentId = null; $('comment-reply').hidden = true;
      body.value = ''; $('comment-counter').textContent = '0 / 2000'; lastPayload = ''; requestId = '';
      notice('comment-submit-status', '留言已提交，正在更新列表。', 'success');
      await load(true);
      notice('comment-submit-status', '留言已提交。若列表未更新，请点击重新加载。', 'success');
    } catch (error) {
      // 失败时保留输入和提交标识，让读者能够安全重试。
      notice('comment-submit-status', error.name === 'AbortError' || error instanceof TypeError ? '暂时无法确认是否收到，内容已保留。可以重试，重复请求不会生成多条留言。' : error.message, 'error');
    } finally {
      submitting = false; fields.disabled = false; form.removeAttribute('aria-busy'); $('comment-send-label').textContent = '提交留言';
    }
  });
  more.addEventListener('click', () => load()); retry.addEventListener('click', () => load());
  // HTML 默认禁用提交按钮，脚本初始化完成后再开放提交并读取第一页留言。
  send.disabled = false; load();
})();
