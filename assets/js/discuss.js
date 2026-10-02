(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const app = $('discuss-app');
  if (!app) return;

  const community = window.CatrixCommunity;
  if (community) {
    community.configure(app.dataset.api);
  }

  const form = $('discuss-form');
  const fields = $('discuss-fields');
  const body = $('discuss-body');
  const nickname = $('discuss-name');
  const parentIdInput = $('parent-id');
  const replyIndicator = $('reply-indicator');
  const replyTargetName = $('reply-target-name');
  const cancelReplyBtn = $('cancel-reply-btn');
  const list = $('discuss-list');
  const statusEl = $('discuss-status');
  const countBadge = $('discuss-count-badge');
  const prevBtn = $('discuss-prev');
  const nextBtn = $('discuss-next');
  const pageEl = $('discuss-page');
  const refreshBtn = $('discuss-refresh');

  const adminKeyInput = $('discuss-key');
  const adminLoginBtn = $('discuss-admin-login');
  const adminLogoutBtn = $('discuss-admin-logout');

  const articlePath = app.dataset.article || '/discuss/';

  let page = 1;
  let revision = 0;
  let adminKey = '';
  let busy = false;
  let lastPayload = '';
  let requestId = '';

  function notice(message) {
    if (statusEl) {
      statusEl.textContent = message;
    }
  }

  // 统一的 API 请求处理
  async function api(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const baseUrl = (app.dataset.api || '').replace(/\/+$/, '');
      const cleanPath = path ? path.replace(/^\/+/, '') : '';
      const url = cleanPath ? `\({baseUrl}/\){cleanPath}` : baseUrl;

      const response = await fetch(url, {
        ...options,
        credentials: 'omit',
        cache: 'no-store',
        signal: controller.signal
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) {
        throw new Error(data?.error || '服务暂时不可用，请稍后再试。');
      }
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  function setReplyTarget(id, targetNickname) {
    parentIdInput.value = id;
    replyTargetName.textContent = targetNickname;
    replyIndicator.style.display = 'flex';
    body.focus();
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function clearReplyTarget() {
    parentIdInput.value = '';
    replyIndicator.style.display = 'none';
    replyTargetName.textContent = '';
  }

  function createFloorItem(item) {
    const floorDiv = document.createElement('article');
    floorDiv.className = 'feedback-item comment-floor';
    floorDiv.id = `discuss-${item.id}`;

    const header = document.createElement('header');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.gap = '8px';

    const name = document.createElement('strong');
    name.textContent = item.nickname || '匿名';

    const time = document.createElement('time');
    time.textContent = new Date(item.created_at || item.createdAt).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    header.append(name, time);

    const text = document.createElement('p');
    text.textContent = item.body || item.content;

    floorDiv.append(header);

    if (item.parent_id) {
      const context = document.createElement('p');
      context.className = 'comment-reply-context';
      context.style.fontSize = '0.85rem';
      context.style.color = 'var(--color-text-secondary, #666)';
      context.style.margin = '4px 0 8px 0';
      context.textContent = item.parent_nickname 
        ? `回复 \({item.parent_nickname}：\){item.parent_body}` 
        : '回复的原留言已删除或不可见';
      floorDiv.append(context);
    }

    floorDiv.append(text);

    const actions = document.createElement('div');
    actions.className = 'feedback-actions';
    actions.style.display = 'flex';
    actions.style.gap = '12px';
    actions.style.alignItems = 'center';
    actions.style.marginTop = '8px';

    if (community) {
      actions.append(community.likeButton('comment', item.id, () => load()));
    }

    const replyBtn = document.createElement('button');
    replyBtn.type = 'button';
    replyBtn.style.borderRadius = '0';
    replyBtn.textContent = '回复';
    replyBtn.addEventListener('click', () => {
      if (busy) return;
      setReplyTarget(item.id, item.nickname || '匿名');
    });
    actions.append(replyBtn);

    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = '举报';
    const reportForm = document.createElement('form');
    reportForm.className = 'comment-report-form';

    const label = document.createElement('label');
    label.textContent = '举报原因 ';
    const reason = document.createElement('select');
    reason.setAttribute('aria-label', '举报原因');

    [
      ['spam', '广告刷屏'],
      ['abuse', '辱骂攻击'],
      ['privacy', '泄露隐私'],
      ['other', '其他不当内容']
    ].forEach(([val, title]) => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = title;
      reason.append(opt);
    });

    label.append(reason);
    const reportSubmit = document.createElement('button');
    reportSubmit.type = 'submit';
    reportSubmit.style.borderRadius = '0';
    reportSubmit.textContent = '提交举报';
    const reportResult = document.createElement('p');
    reportResult.setAttribute('role', 'status');

    let reporting = false;
    reportForm.addEventListener('submit', async ev => {
      ev.preventDefault();
      if (reporting) return;
      reporting = true;
      reportSubmit.disabled = true;
      reportResult.textContent = '正在提交举报…';
      try {
        const res = await api('', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'report',
            id: item.id,
            article: articlePath,
            reason: reason.value
          })
        });
        reportResult.textContent = res.message || '举报已收到，等待管理员处理。';
      } catch (err) {
        reportResult.textContent = err.message;
      } finally {
        reporting = false;
        reportSubmit.disabled = false;
      }
    });

    reportForm.append(label, reportSubmit, reportResult);
    details.append(summary, reportForm);
    actions.append(details);

    if (adminKey) {
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.style.borderRadius = '0';
      removeBtn.textContent = '删除讨论';
      removeBtn.addEventListener('click', async () => {
        if (!confirm('确定删除这条讨论？正文及关联回复将一并清除。')) return;
        removeBtn.disabled = true;
        try {
          await api('admin/delete-comment', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'X-Comments-Key': adminKey 
            },
            body: JSON.stringify({ id: item.id, article: articlePath })
          });
          await load();
        } catch (err) {
          notice(err.message);
          removeBtn.disabled = false;
        }
      });
      actions.append(removeBtn);
    }

    floorDiv.append(actions);
    return floorDiv;
  }

  async function load() {
    const current = ++revision;
    notice('正在读取讨论内容…');

    try {
      // 通过 comments 接口读取特定 article (/discuss/) 的留言列表
      const endpoint = `comments?article=\({encodeURIComponent(articlePath)}&page=\){page}`;
      const data = await api(endpoint);

      if (current !== revision) return;

      list.replaceChildren();

      const items = data.comments || data.items || [];
      for (const item of items) {
        list.append(createFloorItem(item));
      }

      prevBtn.disabled = page === 1;
      nextBtn.disabled = !data.more && !data.next;
      pageEl.textContent = `第 ${page} 页`;
      countBadge.textContent = `${data.total || items.length} 条讨论`;
      notice(items.length ? '' : '还没有讨论，欢迎留下第一个想法。');
    } catch (err) {
      if (current === revision) {
        notice(err.message + ' 可点击刷新重试。');
      }
    }
  }

  cancelReplyBtn.addEventListener('click', clearReplyTarget);

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !form.reportValidity()) return;

    const payload = {
      article: articlePath,
      nickname: nickname.value.trim(),
      body: body.value.trim(),
      parentId: parentIdInput.value || null
    };

    if (!payload.nickname || payload.body.length < 2) {
      notice('请填写称呼与至少 2 个字符的想法。');
      return;
    }

    const serialized = JSON.stringify(payload);
    if (lastPayload !== serialized) {
      lastPayload = serialized;
      requestId = crypto.randomUUID();
    }

    busy = true;
    fields.disabled = true;
    notice('正在发布讨论…');

    try {
      // 提交到根 API Endpoint (文章/讨论通用 POST 接口)
      await api('', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, requestId })
      });

      body.value = '';
      lastPayload = '';
      requestId = '';
      clearReplyTarget();
      page = 1;
      await load();
      notice('讨论已发布，感谢你的参与。');
    } catch (err) {
      notice(err.message);
    } finally {
      busy = false;
      fields.disabled = false;
    }
  });

  prevBtn.addEventListener('click', () => {
    if (page > 1) {
      page--;
      load();
    }
  });

  nextBtn.addEventListener('click', () => {
    page++;
    load();
  });

  refreshBtn.addEventListener('click', load);

  adminLoginBtn.addEventListener('click', async () => {
    const key = adminKeyInput.value.trim();
    adminKeyInput.value = '';
    try {
      await api('admin/check', {
        headers: { 'X-Comments-Key': key }
      });
      adminKey = key;
      adminLogoutBtn.hidden = false;
      await load();
      notice('已进入管理员模式');
    } catch (err) {
      notice(err.message);
    }
  });

  adminLogoutBtn.addEventListener('click', () => {
    adminKey = '';
    adminLogoutBtn.hidden = true;
    load();
    notice('已退出管理员模式');
  });

  load();
})();