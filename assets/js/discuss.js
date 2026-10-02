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

  // 使用 CatrixCommunity 统一的 request 方案（与 feedback.js 保持一致）
  async function apiRequest(path, options = {}, headers = {}) {
    if (community && typeof community.request === 'function') {
      return await community.request(path, options, headers);
    }

    const baseUrl = (app.dataset.api || '').replace(/\/+$/, '');
    const url = `\({baseUrl}/\){path.replace(/^\/+/, '')}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        method: options.method || (options.body ? 'POST' : 'GET'),
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
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
    floorDiv.className = 'feedback-item';
    floorDiv.id = `discuss-${item.id}`;

    const name = document.createElement('strong');
    name.textContent = item.nickname || '匿名';

    const time = document.createElement('time');
    time.textContent = new Date(item.created_at || item.createdAt).toLocaleDateString('zh-CN');

    const text = document.createElement('p');
    text.textContent = item.body || item.content;

    const actions = document.createElement('div');
    actions.className = 'feedback-actions';

    if (community) {
      actions.append(community.likeButton('feedback', item.id, () => load()));
    }

    if (adminKey) {
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.style.borderRadius = '0';
      removeBtn.textContent = '删除建议';
      removeBtn.addEventListener('click', async () => {
        if (!confirm('删除这条建议？正文及昵称将清除，无法恢复。')) return;
        removeBtn.disabled = true;
        try {
          await apiRequest('admin/delete-feedback', { id: item.id }, { 'X-Comments-Key': adminKey });
          await load();
        } catch (err) {
          notice(err.message);
          removeBtn.disabled = false;
        }
      });
      actions.append(removeBtn);
    }

    floorDiv.append(name, time, text, actions);
    return floorDiv;
  }

  async function load() {
    const current = ++revision;
    notice('正在读取建议…');

    try {
      // 访问 feedback 接口获取数据
      const data = await apiRequest(`feedback?page=${page}`);

      if (current !== revision) return;

      list.replaceChildren();

      const items = data.items || [];
      for (const item of items) {
        list.append(createFloorItem(item));
      }

      prevBtn.disabled = page === 1;
      nextBtn.disabled = !data.more;
      pageEl.textContent = `第 ${page} 页`;
      countBadge.textContent = `${items.length} 条`;
      notice(items.length ? '' : '还没有建议，欢迎留下第一个想法。');
    } catch (err) {
      if (current === revision) {
        notice(err.message + ' 可点击刷新重试。');
      }
    }
  }

  cancelReplyBtn.addEventListener('click', clearReplyTarget);

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;

    const payload = {
      nickname: nickname.value.trim(),
      body: body.value.trim()
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
    notice('正在发布…');

    try {
      // 提交到 feedback 端点
      await apiRequest('feedback', { ...payload, requestId });

      body.value = '';
      lastPayload = '';
      requestId = '';
      clearReplyTarget();
      page = 1;
      await load();
      notice('讨论已发布，感谢你的反馈。');
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
      await apiRequest('admin/check', {}, { 'X-Comments-Key': key });
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