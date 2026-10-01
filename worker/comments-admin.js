// Worker 直接返回的审核页面；不依赖 Hugo 构建，也不在页面中嵌入正式凭证。
export const COMMENTS_ADMIN_HTML = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>评论管理 · Catrix</title><style>
*{box-sizing:border-box}body{margin:0;background:#faf9f6;color:#242623;font:16px/1.7 system-ui,sans-serif}main{max-width:860px;margin:48px auto;padding:0 24px}h1{font-size:28px}label{display:block;margin:12px 0}input,select,button{font:inherit;padding:10px 14px;border:1px solid #b9bcb4;background:#fff;border-radius:4px}input{max-width:100%;width:400px}button{cursor:pointer}button:disabled{opacity:.5;cursor:wait}button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #597655;outline-offset:3px}article{padding:24px 0;border-top:1px solid #d9dcd3}article p{white-space:pre-wrap;overflow-wrap:anywhere}small{display:block;color:#555b50;overflow-wrap:anywhere}.actions{display:flex;gap:10px;flex-wrap:wrap}.muted{color:#62685c}#status{min-height:28px}#status[data-error=true]{color:#98291f}[hidden]{display:none!important}
</style></head><body><main>
<p class="muted">CATRIX / 编辑工作台</p><h1>评论管理</h1>
<p>新评论直接公开。删除会清除昵称和正文，无法恢复。旧版待审核或已隐藏留言可在相应列表处理。</p>
<form id="login"><label for="key">评论管理凭证</label><input id="key" type="password" required autocomplete="off"><button type="submit">进入管理</button></form>
<div id="controls" hidden><label for="filter">显示状态</label><select id="filter"><option value="approved">已公开</option><option value="reported">待处理举报</option><option value="pending">旧版待审核</option><option value="rejected">旧版已隐藏</option></select> <button id="refresh" type="button">刷新</button> <button id="logout" type="button">退出</button></div>
<p id="status" role="status" aria-live="polite"></p><div id="list"></div><button id="more" type="button" hidden>加载更多</button>
</main><script>
(() => {
  const $ = id => document.getElementById(id);
  // 凭证仅保存在当前页面内存中；退出或刷新后需要重新输入。
  let key = '', next = null, busy = false;
  function notice(text, error = false) { $('status').textContent = text; $('status').dataset.error = String(error); }
  async function api(path, options = {}) {
    // 审核页面与接口同源，通过请求头传递凭证，避免凭证出现在地址栏中。
    const response = await fetch('/admin/comments/' + path, {
      ...options, headers: { 'X-Comments-Key': key, 'Content-Type': 'application/json' },
      cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(15000)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '请求未成功。');
    return result;
  }
  function lock(value) { busy = value; document.querySelectorAll('button,select').forEach(el => el.disabled = value); }
  // 同样以纯文本显示待审核内容，恶意 HTML 在管理员查看时也不能执行。
  function append(comment) {
    const row = document.createElement('article');
    const title = document.createElement('strong'); title.textContent = comment.nickname;
    const meta = document.createElement('small'); meta.textContent = comment.article + ' · ' + new Date(comment.created_at).toLocaleString('zh-CN');
    const body = document.createElement('p'); body.textContent = comment.body;
    if (comment.report_count) {
      const report = document.createElement('p');
      const reasons = { spam: '广告刷屏', abuse: '辱骂攻击', privacy: '泄露隐私', other: '其他不当内容' };
      report.textContent = '待处理举报 ' + comment.report_count + ' 条：' + comment.report_reasons.split(',').map(r => reasons[r] || r).join('、');
      row.append(report);
    }
    const actions = document.createElement('div'); actions.className = 'actions';
    for (const [status, label] of [['approved', '公开'], ['delete', '删除'], ...(comment.report_count ? [['resolve-reports', '保留评论并结案']] : [])]) {
      if (status === comment.status) continue;
      const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
      button.addEventListener('click', async () => {
        if (busy) return;
        if (status === 'delete' && !confirm('删除这条评论？昵称和正文将被清除，无法恢复。')) return;
        lock(true);
        try {
          await api(status === 'delete' || status === 'resolve-reports' ? status : 'moderate', { method: 'POST', body: JSON.stringify({ id: comment.id, status }) });
          // 服务器确认成功后才从当前状态队列移除；失败时保留原记录以便重试。
          row.remove(); notice(status === 'delete' ? '评论已删除。' : status === 'resolve-reports' ? '举报已处理，评论保留。' : '评论已公开。'); $('refresh').focus();
        } catch (error) { notice(error.message, true); }
        finally { lock(false); }
      });
      actions.append(button);
    }
    row.append(title, meta, body, actions); $('list').append(row);
  }
  async function load(appendRows = false) {
    // 切换状态或刷新会替换列表；“加载更多”则使用 next 游标追加较早的留言。
    if (busy) return; lock(true); notice('正在读取评论…');
    try {
      const query = new URLSearchParams({ status: $('filter').value });
      if (appendRows && next) query.set('before', next);
      const result = await api('list?' + query);
      if (!appendRows) $('list').replaceChildren();
      result.comments.forEach(append); next = result.next; $('more').hidden = !next;
      $('login').hidden = true; $('controls').hidden = false;
      notice($('list').children.length ? '按提交时间倒序显示。' : '当前没有这一状态的评论。');
    } catch (error) { notice(error.message, true); }
    finally { lock(false); }
  }
  $('login').addEventListener('submit', event => { event.preventDefault(); key = $('key').value; $('key').value = ''; load(); });
  $('filter').addEventListener('change', () => load()); $('refresh').addEventListener('click', () => load()); $('more').addEventListener('click', () => load(true));
  $('logout').addEventListener('click', () => { key = ''; next = null; $('list').replaceChildren(); $('controls').hidden = true; $('more').hidden = true; $('login').hidden = false; notice('已退出。'); $('key').focus(); });
})();
</script></body></html>`;
