(() => {
  const init = () => {
    const $ = id => document.getElementById(id);
    const app = $('home-feedback') || $('feedback-app');
    if (!app) return;
    const api = window.CatrixCommunity;
    if (!api) return;
    api.configure(app.dataset.api);

    let page = 1, revision = 0, adminKey = '', requestId = '', last = '', busy = false;
    const form = $('feedback-form');
    const bodyEl = $('feedback-body');
    const nameEl = $('feedback-name');
    const fieldsEl = $('feedback-fields');
    const submitBtn = $('feedback-submit');
    const statusEl = $('feedback-status');
    const listEl = $('feedback-list');

    async function load() {
      if (!listEl) return;
      const current = ++revision;
      if (statusEl) {
        statusEl.textContent = '正在读取建议…';
        statusEl.dataset.state = '';
      }
      try {
        const data = await api.request('feedback?page=' + page);
        if (current !== revision) return;
        listEl.replaceChildren();
        for (const item of data.items) {
          const article = document.createElement('article');
          article.className = 'feedback-item';
          const name = document.createElement('strong');
          name.textContent = item.nickname;
          const time = document.createElement('time');
          time.textContent = new Date(item.created_at).toLocaleDateString('zh-CN');
          const body = document.createElement('p');
          body.textContent = item.body;
          const actions = document.createElement('div');
          actions.className = 'feedback-actions';
          actions.append(api.likeButton('feedback', item.id, () => { page = 1; load(); }));
          if (adminKey) {
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.textContent = '删除建议';
            remove.addEventListener('click', async () => {
              if (!confirm('删除这条建议？正文及昵称将清除，无法恢复。')) return;
              remove.disabled = true;
              try {
                await api.request('admin/delete-feedback', { id: item.id }, { 'X-Comments-Key': adminKey });
                await load();
              } catch (error) {
                if (statusEl) {
                  statusEl.textContent = error.message;
                  statusEl.dataset.state = 'error';
                }
                remove.disabled = false;
              }
            });
            actions.append(remove);
          }
          article.append(name, time, body, actions);
          listEl.append(article);
        }
        if ($('feedback-prev')) $('feedback-prev').disabled = page === 1;
        if ($('feedback-next')) $('feedback-next').disabled = !data.more;
        if ($('feedback-page')) $('feedback-page').textContent = '第 ' + page + ' 页';
        if (statusEl) statusEl.textContent = data.items.length ? '' : '还没有建议，欢迎留下第一个想法。';
      } catch (error) {
        if (current === revision && statusEl) {
          statusEl.textContent = error.message + ' 可点击刷新重试。';
          statusEl.dataset.state = 'error';
        }
      }
    }

    if (form && bodyEl) {
      form.addEventListener('submit', async event => {
        event.preventDefault();
        if (busy) return;
        const body = bodyEl.value.trim();
        if (body.length < 2) {
          if (statusEl) {
            statusEl.textContent = '建议内容至少需 2 个字。';
            statusEl.dataset.state = 'error';
          }
          bodyEl.focus();
          return;
        }
        if (body.length > 2000) {
          if (statusEl) {
            statusEl.textContent = '建议内容不能超过 2000 个字。';
            statusEl.dataset.state = 'error';
          }
          bodyEl.focus();
          return;
        }

        // 如果未提供昵称输入框或内容为空，自动填写为“访客”
        const nickname = (nameEl && nameEl.value.trim()) ? nameEl.value.trim() : '访客';
        const payload = { nickname, body };
        const serialized = JSON.stringify(payload);
        if (last !== serialized) {
          last = serialized;
          requestId = crypto.randomUUID();
        }
        busy = true;
        if (fieldsEl) fieldsEl.disabled = true;
        if (submitBtn) submitBtn.disabled = true;
        if (statusEl) {
          statusEl.textContent = '正在提交…';
          statusEl.dataset.state = '';
        }
        try {
          await api.request('feedback', { ...payload, requestId });
          bodyEl.value = '';
          last = '';
          requestId = '';
          if (statusEl) {
            statusEl.textContent = '建议已提交，感谢你的反馈！';
            statusEl.dataset.state = 'success';
          }
          if (listEl) {
            page = 1;
            await load();
          }
        } catch (error) {
          if (statusEl) {
            statusEl.textContent = error.message || '提交失败，请稍后重试。';
            statusEl.dataset.state = 'error';
          }
        } finally {
          busy = false;
          if (fieldsEl) fieldsEl.disabled = false;
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }

    if ($('feedback-prev')) $('feedback-prev').addEventListener('click', () => { if (page > 1) { page--; load(); } });
    if ($('feedback-next')) $('feedback-next').addEventListener('click', () => { page++; load(); });
    if ($('feedback-refresh')) $('feedback-refresh').addEventListener('click', load);
    if ($('feedback-admin-login')) {
      $('feedback-admin-login').addEventListener('click', async () => {
        const key = $('feedback-key').value;
        $('feedback-key').value = '';
        try {
          await api.request('admin/check', {}, { 'X-Comments-Key': key });
          adminKey = key;
          if ($('feedback-admin-logout')) $('feedback-admin-logout').hidden = false;
          await load();
        } catch (error) {
          if (statusEl) {
            statusEl.textContent = error.message;
            statusEl.dataset.state = 'error';
          }
        }
      });
    }
    if ($('feedback-admin-logout')) {
      $('feedback-admin-logout').addEventListener('click', () => {
        adminKey = '';
        $('feedback-admin-logout').hidden = true;
        load();
      });
    }

    if (listEl) load();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
