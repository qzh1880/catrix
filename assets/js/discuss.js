(() => {
  const $ = id => document.getElementById(id);
  const app = $('discuss-app');
  if (!app) return;
  const api = window.CatrixCommunity;
  const base = (app.dataset.api || '').replace(/\/$/, '');
  if (api?.configure) api.configure(base);
  const article = app.dataset.article || '/discuss/';

  let page = 1;
  let revision = 0;
  let adminKey = '';
  let requestId = '';
  let last = '';
  let busy = false;

  function notice(text) {
    const el = $('discuss-status');
    if (el) el.textContent = text;
  }

  function setReplyTarget(parentId, nickname) {
    const parentInput = $('discuss-parent');
    const targetName = $('reply-target-name');
    const indicator = $('reply-indicator');
    const bodyInput = $('discuss-body');
    const form = $('discuss-form');

    if (parentInput) parentInput.value = parentId;
    if (targetName) targetName.textContent = nickname;
    if (indicator) indicator.hidden = false;
    if (bodyInput) bodyInput.focus();
    if (form) form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function clearReplyTarget() {
    const parentInput = $('discuss-parent');
    const targetName = $('reply-target-name');
    const indicator = $('reply-indicator');

    if (parentInput) parentInput.value = '';
    if (targetName) targetName.textContent = '';
    if (indicator) indicator.hidden = true;
  }

  $('cancel-reply-btn')?.addEventListener('click', clearReplyTarget);

  async function load() {
    const current = ++revision;
    notice('正在读取讨论内容…');
    try {
      const res = await fetch(`${base}/comments?article=${encodeURIComponent(article)}&page=${page}`, {
        cache: 'no-store'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '读取讨论失败。');
      if (current !== revision) return;

      const list = $('discuss-list');
      if (list) list.replaceChildren();
      const items = data.comments || [];

      for (const item of items) {
        const articleEl = document.createElement('article');
        articleEl.className = 'feedback-item';
        articleEl.id = 'discuss-' + item.id;

        const name = document.createElement('strong');
        name.textContent = item.nickname;

        const time = document.createElement('time');
        time.textContent = new Date(item.created_at).toLocaleDateString('zh-CN');

        articleEl.append(name, time);

        if (item.parent_id) {
          const context = document.createElement('p');
          context.className = 'comment-reply-context';
          context.textContent = item.parent_nickname
            ? `回复 @${item.parent_nickname}：${item.parent_body || ''}`
            : '回复的原留言已删除或不可见';
          articleEl.append(context);
        }

        const body = document.createElement('p');
        body.textContent = item.body;
        articleEl.append(body);

        const actions = document.createElement('div');
        actions.className = 'feedback-actions';

        if (api?.likeButton) {
          actions.append(api.likeButton('comment', item.id));
        }

        if (!item.parent_id) {
          const replyBtn = document.createElement('button');
          replyBtn.type = 'button';
          replyBtn.textContent = '回复';
          replyBtn.addEventListener('click', () => {
            if (busy) return;
            setReplyTarget(item.id, item.nickname);
          });
          actions.append(replyBtn);
        }

        const details = document.createElement('details');
        details.className = 'discuss-report';
        const summary = document.createElement('summary');
        summary.textContent = '举报';
        const reportForm = document.createElement('form');
        const reasonSelect = document.createElement('select');
        reasonSelect.setAttribute('aria-label', '举报原因');
        [
          ['spam', '广告刷屏'],
          ['abuse', '辱骂攻击'],
          ['privacy', '泄露隐私'],
          ['other', '其他不当内容']
        ].forEach(([val, label]) => {
          const opt = document.createElement('option');
          opt.value = val;
          opt.textContent = label;
          reasonSelect.append(opt);
        });
        const reportSubmit = document.createElement('button');
        reportSubmit.type = 'submit';
        reportSubmit.textContent = '确认举报';
        reportForm.append(reasonSelect, reportSubmit);

        let reporting = false;
        reportForm.addEventListener('submit', async ev => {
          ev.preventDefault();
          if (reporting) return;
          reporting = true;
          reportSubmit.disabled = true;
          try {
            const reportRes = await fetch(`${base}/comments`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'report',
                article,
                id: item.id,
                reason: reasonSelect.value
              })
            });
            const reportData = await reportRes.json();
            if (!reportRes.ok) throw new Error(reportData.error || '举报失败。');
            summary.textContent = '已举报';
            details.open = false;
            notice(reportData.message || '举报已收到，请等待管理员处理。');
          } catch (err) {
            notice(err.message);
            reportSubmit.disabled = false;
          } finally {
            reporting = false;
          }
        });
        details.append(summary, reportForm);
        actions.append(details);

        if (adminKey) {
          const removeBtn = document.createElement('button');
          removeBtn.type = 'button';
          removeBtn.textContent = '删除讨论';
          removeBtn.addEventListener('click', async () => {
            if (!confirm('确定删除这条讨论？正文及昵称将清除，无法恢复。')) return;
            removeBtn.disabled = true;
            try {
              await api.request('admin/delete-comment', { id: item.id }, { 'X-Comments-Key': adminKey });
              await load();
            } catch (err) {
              notice(err.message);
              removeBtn.disabled = false;
            }
          });
          actions.append(removeBtn);
        }

        articleEl.append(actions);
        if (list) list.append(articleEl);
      }

      const prevBtn = $('discuss-prev');
      const nextBtn = $('discuss-next');
      const pageEl = $('discuss-page');
      const countEl = $('discuss-count');

      if (prevBtn) prevBtn.disabled = page === 1;
      if (nextBtn) nextBtn.disabled = !data.more;
      if (pageEl) pageEl.textContent = '第 ' + page + ' 页';
      if (countEl) countEl.textContent = (typeof data.total === 'number' ? data.total : items.length) + ' 条讨论';
      notice(items.length ? '' : '还没有讨论，欢迎留下第一个想法。');
    } catch (err) {
      if (current === revision) notice(err.message + ' 可点击刷新重试。');
    }
  }

  $('discuss-form')?.addEventListener('submit', async ev => {
    ev.preventDefault();
    if (busy) return;
    const nameInput = $('discuss-name');
    const bodyInput = $('discuss-body');
    const parentInput = $('discuss-parent');
    const fields = $('discuss-fields');

    const nickname = nameInput ? nameInput.value.trim() : '';
    const body = bodyInput ? bodyInput.value.trim() : '';
    const parentIdVal = parentInput ? parentInput.value : '';
    const parentId = parentIdVal ? Number(parentIdVal) : null;

    const payload = { article, nickname, body, parentId };
    const serialized = JSON.stringify(payload);
    if (last !== serialized) {
      last = serialized;
      requestId = crypto.randomUUID();
    }
    busy = true;
    if (fields) fields.disabled = true;
    try {
      const res = await fetch(`${base}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, requestId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '发布讨论失败。');
      if (bodyInput) bodyInput.value = '';
      last = '';
      clearReplyTarget();
      page = 1;
      await load();
      notice('讨论已发布，感谢你的参与。');
    } catch (err) {
      notice(err.message);
    } finally {
      busy = false;
      if (fields) fields.disabled = false;
    }
  });

  $('discuss-prev')?.addEventListener('click', () => { if (page > 1) { page--; load(); } });
  $('discuss-next')?.addEventListener('click', () => { page++; load(); });
  $('discuss-refresh')?.addEventListener('click', load);

  $('discuss-admin-login')?.addEventListener('click', async () => {
    const keyInput = $('discuss-key');
    const key = keyInput ? keyInput.value : '';
    if (keyInput) keyInput.value = '';
    try {
      await api.request('admin/check', {}, { 'X-Comments-Key': key });
      adminKey = key;
      const logoutBtn = $('discuss-admin-logout');
      if (logoutBtn) logoutBtn.hidden = false;
      await load();
      notice('已进入管理员模式。');
    } catch (err) {
      notice(err.message);
    }
  });

  $('discuss-admin-logout')?.addEventListener('click', () => {
    adminKey = '';
    const logoutBtn = $('discuss-admin-logout');
    if (logoutBtn) logoutBtn.hidden = true;
    load();
    notice('已退出管理员模式。');
  });

  load();
})();
