(() => {
  const $ = id => document.getElementById(id);
  const app = $('discuss-app');
  if (!app) return;

  const api = window.CatrixCommunity;
  const base = (app.dataset.api || '').replace(/\/$/, '');
  if (api?.configure) api.configure(base);
  const article = app.dataset.article || '/discuss/';

  let sortMode = 'latest'; // 'latest' | 'hot'
  let mainPage = 1;
  const MAIN_PAGE_SIZE = 10;
  const SUB_PAGE_SIZE = 8;

  // 记录每个主楼的楼中楼展开与分页状态: floorId -> { expanded: boolean, page: number }
  const subthreadState = new Map();

  let cachedItems = [];
  let cachedLikeMap = new Map();
  let revision = 0;
  let adminKey = '';
  let requestId = '';
  let lastPayload = '';
  let busy = false;

  function notice(text) {
    const el = $('discuss-status');
    if (el) el.textContent = text;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // 相对时间转换：x分钟前、x小时前、x天前，超过7天显示 YYYY-MM-DD
  function parseDate(dateStr) {
    if (!dateStr) return new Date();
    let d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      d = new Date(String(dateStr).replace(' ', 'T') + 'Z');
    }
    return isNaN(d.getTime()) ? new Date() : d;
  }

  function formatRelativeTime(dateStr) {
    if (!dateStr) return '';
    const d = parseDate(dateStr);
    const now = Date.now();
    const diffMs = now - d.getTime();

    if (diffMs < 60 * 1000) {
      return '刚刚';
    }
    const diffMinutes = Math.floor(diffMs / (60 * 1000));
    if (diffMinutes < 60) {
      return `${diffMinutes}分钟前`;
    }
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    if (diffHours < 24) {
      return `${diffHours}小时前`;
    }
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    if (diffDays <= 7) {
      return `${diffDays}天前`;
    }
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function formatAbsoluteTime(dateStr) {
    if (!dateStr) return '';
    const d = parseDate(dateStr);
    return d.toLocaleString('zh-CN', { hour12: false });
  }

  // 设置回复目标（支持回复主楼或楼中楼任意发言）
  function setReplyTarget(parentId, nickname) {
    const parentInput = $('discuss-parent');
    const targetName = $('reply-target-name');
    const indicator = $('reply-indicator');
    const bodyInput = $('discuss-body');
    const form = $('discuss-form');

    if (parentInput) parentInput.value = parentId;
    if (targetName) targetName.textContent = '@' + nickname;
    if (indicator) indicator.hidden = false;
    if (bodyInput) {
      bodyInput.placeholder = `回复 @${nickname}：`;
      bodyInput.focus();
    }
    if (form) form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function clearReplyTarget() {
    const parentInput = $('discuss-parent');
    const targetName = $('reply-target-name');
    const indicator = $('reply-indicator');
    const bodyInput = $('discuss-body');

    if (parentInput) parentInput.value = '';
    if (targetName) targetName.textContent = '';
    if (indicator) indicator.hidden = true;
    if (bodyInput) bodyInput.placeholder = '写下你的想法、观点或问题……';
  }

  $('cancel-reply-btn')?.addEventListener('click', clearReplyTarget);

  // 批量获取点赞数（每次最多 20 个）
  async function fetchLikeCounts(ids) {
    const map = new Map();
    if (!ids.length || !api?.request) return map;
    const uniqueIds = Array.from(new Set(ids));
    const chunks = [];
    for (let i = 0; i < uniqueIds.length; i += 20) {
      chunks.push(uniqueIds.slice(i, i + 20));
    }
    const results = await Promise.allSettled(
      chunks.map(chunk =>
        api.request('likes?' + new URLSearchParams({
          kind: 'comment',
          ids: chunk.join(','),
          visitor: api.visitor || ''
        }))
      )
    );
    for (const res of results) {
      if (res.status === 'fulfilled' && Array.isArray(res.value?.items)) {
        for (const row of res.value.items) {
          map.set(row.target_id, row.likes || 0);
        }
      }
    }
    return map;
  }

  // 构建讨论树：主楼（parent_id 为空或其祖先为顶层）与平铺盖楼的楼中楼
  function buildThreadTree(items, likeMap) {
    const commentMap = new Map();
    for (const item of items) {
      commentMap.set(item.id, {
        ...item,
        likes: likeMap.get(item.id) || 0,
        replies: []
      });
    }

    const roots = [];
    const repliesByRootId = new Map();

    // 确定主楼与所属关系
    for (const [id, c] of commentMap) {
      if (c.parent_id === null) {
        roots.push(c);
      } else {
        // 向上溯源找到最顶层公开留言
        let ancestor = c;
        const visited = new Set([ancestor.id]);
        while (ancestor.parent_id !== null && commentMap.has(ancestor.parent_id)) {
          if (visited.has(ancestor.parent_id)) break;
          visited.add(ancestor.parent_id);
          ancestor = commentMap.get(ancestor.parent_id);
        }

        if (ancestor.parent_id === null) {
          if (!repliesByRootId.has(ancestor.id)) repliesByRootId.set(ancestor.id, []);
          repliesByRootId.get(ancestor.id).push(c);
        } else {
          // 孤儿留言（原主楼已删除），将其最高可见祖先提升为主楼
          if (!roots.some(r => r.id === ancestor.id)) {
            roots.push(ancestor);
          }
          if (c.id !== ancestor.id) {
            if (!repliesByRootId.has(ancestor.id)) repliesByRootId.set(ancestor.id, []);
            repliesByRootId.get(ancestor.id).push(c);
          }
        }
      }
    }

    for (const root of roots) {
      const rawReplies = repliesByRootId.get(root.id) || [];
      // 丰富回复中的目标昵称信息并按时间正序排序
      root.replies = rawReplies.map(reply => {
        let targetNickname = null;
        if (reply.parent_id !== root.id) {
          const directParent = commentMap.get(reply.parent_id);
          targetNickname = directParent ? directParent.nickname : (reply.parent_nickname || '已删除发言');
        }
        return {
          ...reply,
          targetNickname
        };
      }).sort((a, b) => parseDate(a.created_at).getTime() - parseDate(b.created_at).getTime());

      // 计算最后活跃时间（顶贴机制：主楼发帖或最新回复时间）
      const rootTime = parseDate(root.created_at).getTime();
      const replyTimes = root.replies.map(r => parseDate(r.created_at).getTime());
      root.lastActivity = Math.max(rootTime, ...replyTimes);

      // 计算最热得分（回复量 * 3 + 主楼及各楼中楼点赞总和）
      const subLikes = root.replies.reduce((sum, r) => sum + (r.likes || 0), 0);
      root.hotScore = (root.replies.length * 3) + (root.likes || 0) + subLikes;
    }

    // 排序主楼列表
    if (sortMode === 'hot') {
      roots.sort((a, b) => b.hotScore - a.hotScore || b.lastActivity - a.lastActivity || b.id - a.id);
    } else {
      roots.sort((a, b) => b.lastActivity - a.lastActivity || b.id - a.id);
    }

    return roots;
  }

  // 渲染楼中楼单条回复
  function renderSubreplyItem(reply, rootId) {
    const itemEl = document.createElement('div');
    itemEl.className = 'discuss-subreply-item';
    itemEl.id = 'discuss-' + reply.id;

    const header = document.createElement('div');
    header.className = 'subreply-header';

    const author = document.createElement('span');
    author.className = 'subreply-author';
    author.textContent = reply.nickname;
    header.append(author);

    if (reply.targetNickname) {
      const toTag = document.createElement('span');
      toTag.className = 'subreply-target-tag';
      toTag.textContent = ` 回复 @${reply.targetNickname}`;
      header.append(toTag);
    }

    const colon = document.createElement('span');
    colon.textContent = '：';
    header.append(colon);

    const text = document.createElement('span');
    text.className = 'subreply-text';
    text.textContent = reply.body;
    header.append(text);

    itemEl.append(header);

    const meta = document.createElement('div');
    meta.className = 'subreply-meta';

    const time = document.createElement('time');
    time.className = 'subreply-time';
    time.textContent = formatRelativeTime(reply.created_at);
    time.title = formatAbsoluteTime(reply.created_at);
    meta.append(time);

    const actions = document.createElement('div');
    actions.className = 'subreply-actions';

    if (api?.likeButton) {
      actions.append(api.likeButton('comment', reply.id));
    }

    const replyBtn = document.createElement('button');
    replyBtn.type = 'button';
    replyBtn.className = 'subreply-btn';
    replyBtn.textContent = '回复';
    replyBtn.addEventListener('click', () => {
      if (busy) return;
      setReplyTarget(reply.id, reply.nickname);
    });
    actions.append(replyBtn);

    const reportDetails = createReportDetails(reply.id);
    actions.append(reportDetails);

    if (adminKey) {
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'subreply-btn btn-delete-discuss';
      delBtn.textContent = '删除';
      delBtn.addEventListener('click', () => handleDelete(reply.id, delBtn));
      actions.append(delBtn);
    }

    meta.append(actions);
    itemEl.append(meta);

    return itemEl;
  }

  // 渲染主楼下盖楼的楼中楼区域（折叠、Top 2、分页及收起）
  function renderSubthread(rootFloor) {
    const container = document.createElement('div');
    container.className = 'discuss-subthread';

    const replies = rootFloor.replies;
    if (!replies || replies.length === 0) return container;

    let state = subthreadState.get(rootFloor.id);
    if (!state) {
      state = { expanded: false, page: 1 };
      subthreadState.set(rootFloor.id, state);
    }

    // 情况 1: 回复数不超过 2 条，直接显示全部，无需折叠或分页
    if (replies.length <= 2) {
      for (const reply of replies) {
        container.append(renderSubreplyItem(reply, rootFloor.id));
      }
      return container;
    }

    // 情况 2: 回复数 > 2 且处于默认折叠态：展示前两个互动量（点赞数）最高的楼中楼
    if (!state.expanded) {
      // 筛选互动量最高的前 2 条
      const sortedByLikes = [...replies].sort((a, b) => {
        const diff = (b.likes || 0) - (a.likes || 0);
        if (diff !== 0) return diff;
        return parseDate(a.created_at).getTime() - parseDate(b.created_at).getTime();
      });
      const top2 = sortedByLikes.slice(0, 2);
      // 保证渲染时依然保持时间自然顺序
      top2.sort((a, b) => parseDate(a.created_at).getTime() - parseDate(b.created_at).getTime());

      for (const reply of top2) {
        container.append(renderSubreplyItem(reply, rootFloor.id));
      }

      // 展开按钮：“共 n 条回复，点击查看 ▾”
      const expandBtn = document.createElement('button');
      expandBtn.type = 'button';
      expandBtn.className = 'discuss-subthread-expand';
      expandBtn.textContent = `共 ${replies.length} 条回复，点击查看 ▾`;
      expandBtn.addEventListener('click', () => {
        state.expanded = true;
        state.page = 1;
        updateSubthreadView(container, rootFloor);
      });
      container.append(expandBtn);
      return container;
    }

    // 情况 3: 展开态：按时间正序盖楼显示全部回复，每页 8 条
    const totalSubPages = Math.ceil(replies.length / SUB_PAGE_SIZE);
    state.page = Math.max(1, Math.min(state.page, totalSubPages));

    const startIndex = (state.page - 1) * SUB_PAGE_SIZE;
    const pageReplies = replies.slice(startIndex, startIndex + SUB_PAGE_SIZE);

    for (const reply of pageReplies) {
      container.append(renderSubreplyItem(reply, rootFloor.id));
    }

    // 展开状态导航栏（分页器与收起回复按钮）
    const navBar = document.createElement('div');
    navBar.className = 'discuss-subthread-nav';

    if (replies.length > SUB_PAGE_SIZE) {
      const pagesContainer = document.createElement('div');
      pagesContainer.className = 'subthread-pages';

      const prevBtn = document.createElement('button');
      prevBtn.type = 'button';
      prevBtn.className = 'subthread-page-btn';
      prevBtn.textContent = '‹';
      prevBtn.title = '上一页';
      prevBtn.disabled = state.page <= 1;
      prevBtn.addEventListener('click', () => {
        if (state.page > 1) {
          state.page--;
          updateSubthreadView(container, rootFloor);
        }
      });
      pagesContainer.append(prevBtn);

      for (let p = 1; p <= totalSubPages; p++) {
        const pageBtn = document.createElement('button');
        pageBtn.type = 'button';
        pageBtn.className = 'subthread-page-btn' + (p === state.page ? ' active' : '');
        pageBtn.textContent = String(p);
        if (p === state.page) {
          pageBtn.setAttribute('aria-current', 'page');
        } else {
          pageBtn.addEventListener('click', () => {
            state.page = p;
            updateSubthreadView(container, rootFloor);
          });
        }
        pagesContainer.append(pageBtn);
      }

      const nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.className = 'subthread-page-btn';
      nextBtn.textContent = '›';
      nextBtn.title = '下一页';
      nextBtn.disabled = state.page >= totalSubPages;
      nextBtn.addEventListener('click', () => {
        if (state.page < totalSubPages) {
          state.page++;
          updateSubthreadView(container, rootFloor);
        }
      });
      pagesContainer.append(nextBtn);

      navBar.append(pagesContainer);
    } else {
      const placeholder = document.createElement('span');
      navBar.append(placeholder);
    }

    const collapseBtn = document.createElement('button');
    collapseBtn.type = 'button';
    collapseBtn.className = 'discuss-subthread-collapse';
    collapseBtn.textContent = '收起回复 ▴';
    collapseBtn.addEventListener('click', () => {
      state.expanded = false;
      state.page = 1;
      updateSubthreadView(container, rootFloor);
      // 平滑滚动回主楼避免突兀跳动
      const floorEl = document.getElementById('discuss-' + rootFloor.id);
      if (floorEl) floorEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    navBar.append(collapseBtn);

    container.append(navBar);
    return container;
  }

  function updateSubthreadView(oldContainer, rootFloor) {
    const newContainer = renderSubthread(rootFloor);
    oldContainer.replaceWith(newContainer);
  }

  // 举报弹窗创建
  function createReportDetails(commentId) {
    const details = document.createElement('details');
    details.className = 'discuss-report';
    const summary = document.createElement('summary');
    summary.textContent = '举报';
    const form = document.createElement('form');
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
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.textContent = '确定';
    form.append(reasonSelect, submitBtn);

    let reporting = false;
    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      if (reporting) return;
      reporting = true;
      submitBtn.disabled = true;
      try {
        const res = await fetch(`${base}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'report',
            article,
            id: commentId,
            reason: reasonSelect.value
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '举报失败。');
        summary.textContent = '已举报';
        details.open = false;
        notice(data.message || '举报已收到，感谢你的反馈。');
      } catch (err) {
        notice(err.message);
        submitBtn.disabled = false;
      } finally {
        reporting = false;
      }
    });
    details.append(summary, form);
    return details;
  }

  // 管理员删除处理
  async function handleDelete(commentId, buttonEl) {
    if (!confirm('确定删除这条讨论？正文及昵称将清除，无法恢复。')) return;
    if (buttonEl) buttonEl.disabled = true;
    try {
      await api.request('admin/delete-comment', { id: commentId }, { 'X-Comments-Key': adminKey });
      notice('删除成功。');
      await load();
    } catch (err) {
      notice(err.message);
      if (buttonEl) buttonEl.disabled = false;
    }
  }

  // 渲染讨论列表
  function renderList(roots) {
    const listEl = $('discuss-list');
    if (!listEl) return;
    listEl.replaceChildren();

    const countEl = $('discuss-count');
    const totalCount = cachedItems.length;
    if (countEl) countEl.textContent = `${totalCount} 条讨论 · ${roots.length} 个主题`;

    if (roots.length === 0) {
      notice('还没有讨论，欢迎在上方留下第一个想法。');
      $('discuss-pagination').hidden = true;
      return;
    }

    notice('');
    $('discuss-pagination').hidden = false;

    // 主楼分页
    const totalMainPages = Math.ceil(roots.length / MAIN_PAGE_SIZE);
    mainPage = Math.max(1, Math.min(mainPage, totalMainPages));

    const startIndex = (mainPage - 1) * MAIN_PAGE_SIZE;
    const pageRoots = roots.slice(startIndex, startIndex + MAIN_PAGE_SIZE);

    for (const root of pageRoots) {
      const articleEl = document.createElement('article');
      articleEl.className = 'feedback-item';
      articleEl.id = 'discuss-' + root.id;

      const header = document.createElement('div');
      header.className = 'discuss-item-header';

      const author = document.createElement('strong');
      author.className = 'discuss-item-author';
      author.textContent = root.nickname;

      const time = document.createElement('time');
      time.className = 'discuss-item-time';
      time.textContent = formatRelativeTime(root.created_at);
      time.title = formatAbsoluteTime(root.created_at);

      header.append(author, time);
      articleEl.append(header);

      const body = document.createElement('p');
      body.className = 'discuss-item-body';
      body.textContent = root.body;
      articleEl.append(body);

      const actions = document.createElement('div');
      actions.className = 'feedback-actions';

      if (api?.likeButton) {
        actions.append(api.likeButton('comment', root.id));
      }

      const replyBtn = document.createElement('button');
      replyBtn.type = 'button';
      replyBtn.textContent = '回复';
      replyBtn.addEventListener('click', () => {
        if (busy) return;
        setReplyTarget(root.id, root.nickname);
      });
      actions.append(replyBtn);

      const reportDetails = createReportDetails(root.id);
      actions.append(reportDetails);

      if (adminKey) {
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'btn-delete-discuss';
        delBtn.textContent = '删除主题';
        delBtn.addEventListener('click', () => handleDelete(root.id, delBtn));
        actions.append(delBtn);
      }

      articleEl.append(actions);

      // 贴吧楼中楼展示
      if (root.replies && root.replies.length > 0) {
        articleEl.append(renderSubthread(root));
      }

      listEl.append(articleEl);
    }

    const prevBtn = $('discuss-prev');
    const nextBtn = $('discuss-next');
    const pageEl = $('discuss-page');

    if (prevBtn) prevBtn.disabled = mainPage <= 1;
    if (nextBtn) nextBtn.disabled = mainPage >= totalMainPages;
    if (pageEl) pageEl.textContent = `第 ${mainPage} / ${totalMainPages} 页`;
  }

  async function load() {
    const current = ++revision;
    notice('正在读取讨论内容…');
    try {
      // 一次性读取讨论区公开留言（limit 设置为 500）
      const res = await fetch(`${base}/comments?article=${encodeURIComponent(article)}&page=1&limit=500`, {
        cache: 'no-store'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '读取讨论失败。');
      if (current !== revision) return;

      cachedItems = data.comments || [];
      const ids = cachedItems.map(c => c.id);
      cachedLikeMap = await fetchLikeCounts(ids);

      const roots = buildThreadTree(cachedItems, cachedLikeMap);
      renderList(roots);
    } catch (err) {
      if (current === revision) notice(err.message + ' 可点击上方刷新重试。');
    }
  }

  // 排序切换
  $('sort-latest')?.addEventListener('click', () => {
    if (sortMode === 'latest') return;
    sortMode = 'latest';
    $('sort-latest')?.classList.add('active');
    $('sort-latest')?.setAttribute('aria-selected', 'true');
    $('sort-hot')?.classList.remove('active');
    $('sort-hot')?.setAttribute('aria-selected', 'false');
    mainPage = 1;
    const roots = buildThreadTree(cachedItems, cachedLikeMap);
    renderList(roots);
  });

  $('sort-hot')?.addEventListener('click', () => {
    if (sortMode === 'hot') return;
    sortMode = 'hot';
    $('sort-hot')?.classList.add('active');
    $('sort-hot')?.setAttribute('aria-selected', 'true');
    $('sort-latest')?.classList.remove('active');
    $('sort-latest')?.setAttribute('aria-selected', 'false');
    mainPage = 1;
    const roots = buildThreadTree(cachedItems, cachedLikeMap);
    renderList(roots);
  });

  // 主楼翻页
  $('discuss-prev')?.addEventListener('click', () => {
    if (mainPage > 1) {
      mainPage--;
      const roots = buildThreadTree(cachedItems, cachedLikeMap);
      renderList(roots);
      $('discuss-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  $('discuss-next')?.addEventListener('click', () => {
    const totalMainPages = Math.ceil(cachedItems.length / MAIN_PAGE_SIZE);
    if (mainPage < totalMainPages) {
      mainPage++;
      const roots = buildThreadTree(cachedItems, cachedLikeMap);
      renderList(roots);
      $('discuss-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  $('discuss-refresh')?.addEventListener('click', load);

  // 提交讨论（支持主楼或任意深度的楼中楼回复）
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

    if (!nickname || nickname.length > 40) {
      notice('请填写 1–40 字符的称呼。');
      return;
    }
    if (!body || body.length < 2 || body.length > 2000) {
      notice('请填写 2–2000 字符的讨论内容。');
      return;
    }

    const payload = { article, nickname, body, parentId };
    const serialized = JSON.stringify(payload);
    if (lastPayload !== serialized) {
      lastPayload = serialized;
      requestId = crypto.randomUUID();
    }

    busy = true;
    if (fields) fields.disabled = true;
    notice('正在提交讨论…');

    try {
      const res = await fetch(`${base}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, requestId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '发布讨论失败。');

      if (bodyInput) bodyInput.value = '';
      lastPayload = '';
      clearReplyTarget();
      mainPage = 1;
      notice('发言已发布，感谢你的参与。');
      await load();
    } catch (err) {
      notice(err.message);
    } finally {
      busy = false;
      if (fields) fields.disabled = false;
    }
  });

  // 管理员模式登录与注销
  $('discuss-admin-login')?.addEventListener('click', async () => {
    const keyInput = $('discuss-key');
    const key = keyInput ? keyInput.value.trim() : '';
    if (keyInput) keyInput.value = '';
    if (!key) {
      notice('请输入管理凭证。');
      return;
    }
    try {
      await api.request('admin/check', {}, { 'X-Comments-Key': key });
      adminKey = key;
      const logoutBtn = $('discuss-admin-logout');
      if (logoutBtn) logoutBtn.hidden = false;
      const loginBtn = $('discuss-admin-login');
      if (loginBtn) loginBtn.hidden = true;
      await load();
      notice('已进入管理员模式，可在讨论卡片上直接删除违规内容。');
    } catch (err) {
      notice(err.message);
    }
  });

  $('discuss-admin-logout')?.addEventListener('click', () => {
    adminKey = '';
    const logoutBtn = $('discuss-admin-logout');
    if (logoutBtn) logoutBtn.hidden = true;
    const loginBtn = $('discuss-admin-login');
    if (loginBtn) loginBtn.hidden = false;
    load();
    notice('已退出管理员模式。');
  });

  load();
})();
