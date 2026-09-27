const PAGE = `<!DOCTYPE html>
<html lang="zh-cn">
<head>
  <meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>投稿预览 · [catrix]</title>
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"><\/script>
<script src="https://cdn.jsdelivr.net/npm/dompurify@3/dist/purify.min.js"><\/script>

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;0,8..60,700;1,8..60,400&family=Noto+Serif+SC:wght@400;500;600;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
<link rel="stylesheet" href="https://catrix.net/css/style.css">
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>✦</text></svg>">
</head>
<body>
  <header class="site-header">
  <div class="header-inner">
    <a class="site-logo" href="https://catrix.net/">[catrix]</a>
    <nav class="header-nav">
      <a href="https://catrix.net/" class="header-nav-link"><span>首页</span></a>
      <a href="https://catrix.net/posts/" class="header-nav-link active"><span>文章</span></a>
      <a href="https://catrix.net/categories/" class="header-nav-link"><span>往期</span></a>
      <a href="https://catrix.net/gallery/" class="header-nav-link"><span>相册</span></a>
      <a href="https://catrix.net/tags/" class="header-nav-link"><span>标签</span></a>
      <div class="header-nav-item has-dropdown">
        <a href="javascript:void(0);" class="header-nav-link" onclick="togglePinDropdown(this, event)">
          <span>更多</span>
          <svg class="dropdown-arrow" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </a>
        <div class="dropdown-menu">
          <a href="https://www.jcleague.win/" class="dropdown-link">球员身价榜</a>
          <a href="https://catrix.net/games/" class="dropdown-link">小游戏</a>
          <a href="https://catrix.net/joinus/" class="dropdown-link">加入CATRIX</a>
        </div>
      </div>
    </nav>
    <div class="header-actions">
      <button class="search-toggle icon-link" aria-label="搜索" onclick="openSearch()">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg>
      </button>
      <button class="menu-toggle" aria-label="打开菜单" aria-expanded="false" onclick="toggleMenu()">
        <span></span><span></span><span></span>
      </button>
    </div>
  </div>
</header>

<div class="menu-overlay" id="menu-overlay">
  <div class="menu-panel">
    <button class="menu-close" aria-label="关闭菜单" onclick="toggleMenu()">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
    <nav class="menu-nav">
      <a href="https://catrix.net/" class="menu-link" onclick="toggleMenu()"><span class="menu-link-num">01</span><span class="menu-link-text">首页</span></a>
      <a href="https://catrix.net/posts/" class="menu-link" onclick="toggleMenu()"><span class="menu-link-num">02</span><span class="menu-link-text">文章</span></a>
      <a href="https://catrix.net/categories/" class="menu-link" onclick="toggleMenu()"><span class="menu-link-num">03</span><span class="menu-link-text">往期</span></a>
      <a href="https://catrix.net/gallery/" class="menu-link" onclick="toggleMenu()"><span class="menu-link-num">04</span><span class="menu-link-text">相册</span></a>
      <a href="https://catrix.net/tags/" class="menu-link" onclick="toggleMenu()"><span class="menu-link-num">05</span><span class="menu-link-text">标签</span></a>
      <div class="menu-group">
        <div class="menu-group-title">
          <span class="menu-link-num">67</span>
          <span class="menu-link-text">更多</span>
        </div>
        <div class="menu-sub-links">
          <a href="https://www.jcleague.win/" class="menu-sub-link" onclick="toggleMenu()">球员身价榜</a>
          <a href="https://catrix.net/games/" class="menu-sub-link" onclick="toggleMenu()">小游戏</a>
          <a href="https://catrix.net/joinus/" class="menu-sub-link" onclick="toggleMenu()">加入CATRIX</a>
        </div>
      </div>
    </nav>
    <div class="menu-footer">
      <div class="menu-social"><a href="mailto:contact@catrix.net">Email</a></div>
      <p class="menu-copyright">&copy; 2026 </p>
    </div>
  </div>
</div>

<div class="search-overlay" id="search-overlay">
  <div class="search-inner">
    <button class="search-close" aria-label="关闭搜索" onclick="closeSearch()">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
    <input type="text" class="search-input" placeholder="搜索文章..." id="search-input" autocomplete="off">
    <div class="search-results" id="search-results"></div>
  </div>
</div>

<script>
  function toggleMenu() {
    const overlay = document.getElementById('menu-overlay');
    const toggle = document.querySelector('.menu-toggle');
    const isOpen = overlay.classList.toggle('open');
    document.body.style.overflow = isOpen ? 'hidden' : '';
    if (toggle) toggle.setAttribute('aria-expanded', isOpen);
  }
  function openSearch() {
    document.getElementById('search-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(function() { document.getElementById('search-input').focus(); }, 100);
  }
  function closeSearch() {
    document.getElementById('search-overlay').classList.remove('open');
    document.body.style.overflow = '';
  }
  function togglePinDropdown(element, event) {
    event.preventDefault();
    event.stopPropagation();
    const parent = element.closest('.has-dropdown');
    if (parent) parent.classList.toggle('is-pinned');
  }
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.has-dropdown')) {
      document.querySelectorAll('.has-dropdown.is-pinned').forEach(el => el.classList.remove('is-pinned'));
    }
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      if (document.getElementById('menu-overlay').classList.contains('open')) toggleMenu();
      if (document.getElementById('search-overlay').classList.contains('open')) closeSearch();
      document.querySelectorAll('.has-dropdown.is-pinned').forEach(el => el.classList.remove('is-pinned'));
    }
  });
<\/script>
  <main class="site-main">
<article class="single-post">
  <header class="single-header">
    <p class="single-date"></p>
    <h1 class="single-title"></h1>
    <p class="single-author" style="margin-top: 12px; margin-bottom: 8px; font-size: 1.15rem; opacity: 0.9;">
      <span class="by-line" style="font-weight: 400;">By </span>
      <a class="author-link" style="color: inherit; text-decoration: underline; font-weight: 600; letter-spacing: 0.01em;"></a>
    </p>
    <p class="single-excerpt"></p>
  </header>

  <div class="single-cover">
    <div class="container">
      <img alt="">
    </div>
  </div>

  <div class="single-body">
    <aside class="single-share-side">
      <span class="share-side-label">Share</span>
      <button type="button" class="share-side-btn" aria-label="分享" onclick="doShare()">
  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/></svg>
</button>
<a href="https://www.facebook.com/sharer/sharer.php?u=" target="_blank" rel="noopener" class="share-side-btn" aria-label="Share on Facebook">
  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>
</a>
<a href="https://twitter.com/intent/tweet?url=" target="_blank" rel="noopener" class="share-side-btn" aria-label="Share on Twitter">
  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z"/></svg>
</a>
<a href="https://pinterest.com/pin/create/button/?url=" target="_blank" rel="noopener" class="share-side-btn" aria-label="Share on Pinterest">
  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12c0 4.24 2.65 7.86 6.39 9.29-.09-.78-.17-1.98.04-2.83.19-.77 1.25-5.28 1.25-5.28s-.31-.62-.31-1.54c0-1.44.83-2.52 1.87-2.52.88 0 1.31.66 1.31 1.45 0 .89-.57 2.22-.86 3.45-.24 1.03.52 1.87 1.54 1.87 1.85 0 3.27-1.95 3.27-4.76 0-2.49-1.79-4.23-4.35-4.23-2.96 0-4.7 2.22-4.7 4.52 0 .89.34 1.85.77 2.37.08.1.09.18.07.28l-.28 1.15c-.04.18-.14.22-.33.13-1.22-.57-1.98-2.35-1.98-3.78 0-3.08 2.24-5.9 6.45-5.9 3.39 0 6.02 2.41 6.02 5.64 0 3.37-2.12 6.07-5.07 6.07-.99 0-1.92-.51-2.24-1.12l-.61 2.33c-.22.85-.82 1.92-1.22 2.57.92.28 1.89.44 2.9.44 5.52 0 10-4.48 10-10S17.52 2 12 2z"/></svg>
</a>
    </aside>

    <div class="post-content"></div>
  </div>

  <div class="single-share-bottom">
  <span class="share-label">Share</span>
  <button type="button" class="share-side-btn" aria-label="分享" onclick="doShare()">
  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/></svg>
</button>
<a href="https://www.facebook.com/sharer/sharer.php?u=" target="_blank" rel="noopener" class="share-side-btn" aria-label="Share on Facebook">
  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>
</a>
<a href="https://twitter.com/intent/tweet?url=" target="_blank" rel="noopener" class="share-side-btn" aria-label="Share on Twitter">
  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z"/></svg>
</a>
<a href="https://pinterest.com/pin/create/button/?url=" target="_blank" rel="noopener" class="share-side-btn" aria-label="Share on Pinterest">
  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12c0 4.24 2.65 7.86 6.39 9.29-.09-.78-.17-1.98.04-2.83.19-.77 1.25-5.28 1.25-5.28s-.31-.62-.31-1.54c0-1.44.83-2.52 1.87-2.52.88 0 1.31.66 1.31 1.45 0 .89-.57 2.22-.86 3.45-.24 1.03.52 1.87 1.54 1.87 1.85 0 3.27-1.95 3.27-4.76 0-2.49-1.79-4.23-4.35-4.23-2.96 0-4.7 2.22-4.7 4.52 0 .89.34 1.85.77 2.37.08.1.09.18.07.28l-.28 1.15c-.04.18-.14.22-.33.13-1.22-.57-1.98-2.35-1.98-3.78 0-3.08 2.24-5.9 6.45-5.9 3.39 0 6.02 2.41 6.02 5.64 0 3.37-2.12 6.07-5.07 6.07-.99 0-1.92-.51-2.24-1.12l-.61 2.33c-.22.85-.82 1.92-1.22 2.57.92.28 1.89.44 2.9.44 5.52 0 10-4.48 10-10S17.52 2 12 2z"/></svg>
</a>
  </div>

  <div class="container-narrow"></div>
</article>
<style>
  .single-share-bottom { display: none; justify-content: center; }
  @media (max-width: 1024px) {
    .single-share-bottom { display: flex; flex-direction: row; }
  }
  @media (min-width: 1025px) { .single-share-bottom { display: none; } }
</style>
<script>
function doShare(){
  if (navigator.share) {
    navigator.share({ title: document.title, url: location.href }).catch(function(){});
  } else {
    alert('当前浏览器不支持系统分享，已为你复制链接');
    if (navigator.clipboard) navigator.clipboard.writeText(location.href);
  }
}
<\/script>
  </main>
  <footer class="site-footer">
  <div class="footer-bottom">
    <p>&copy; 2026  CATRIX 杂志社</p>
    <p class="footer-credit">Crafted with <span style="color:#c9a96e">✦</span> · Blank Magazine Theme</p>
  </div>
</footer>
  <script src="https://catrix.net/js/main.js"><\/script>
</body>
</html>`;

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

// 预览页 = 模板 + 一段取数填充脚本（数据全在要密码的接口后面，壳本身无内容）
export const PREVIEW_HTML = PAGE.replace("</body>", `<script>
(function(){
  var id = new URLSearchParams(location.search).get("id");
  var KEY = localStorage.getItem("catrixAdmin") || "";
  var back = document.createElement("button");
  back.textContent = "← 返回";
  back.className = "btn ghost";
  back.style.cssText = "position:fixed;top:14px;right:14px;z-index:9999;cursor:pointer;";
  back.onclick = function(){ location.href = "/admin"; };
  document.body.appendChild(back);

  fetch("/admin/post?id=" + id, { headers: { "X-Admin-Key": KEY } }).then(function(r){
    if (!r.ok) {
      document.body.innerHTML = '<p style="text-align:center;padding-top:40vh;font-size:.9rem;">预览需要先在后台登录。</p>';
      return null;
    }
    return r.json();
  }).then(function(d){
    if (!d) return;
    var MON = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    var bj = new Date(Date.parse(d.meta.date.replace(" ", "T") + "Z") + 8 * 3600 * 1000);
    var cat = MON[bj.getUTCMonth()].slice(0, 3) + "." + bj.getUTCFullYear();
    document.title = d.meta.title + " · [catrix]";
    document.querySelector(".single-date").innerHTML =
      '<time datetime="' + bj.toISOString().slice(0, 10) + '">' + MON[bj.getUTCMonth()] + " " + bj.getUTCDate() + ", " + bj.getUTCFullYear() + '</time>' +
      '<span class="meta-sep">·</span>' +
      '<a href="https://catrix.net/categories/' + encodeURIComponent(cat.toLowerCase()) + '/">' + cat.toUpperCase() + '</a>';
    document.querySelector(".single-title").textContent = d.meta.title;
    document.querySelector(".author-link").textContent = d.meta.author;
    document.querySelector(".author-link").href = "https://catrix.net/author/" + encodeURIComponent(d.meta.author) + "/";
    var ex = document.querySelector(".single-excerpt");
    if (d.meta.desc) ex.textContent = d.meta.desc; else ex.remove();
    var coverFile = (d.files || []).find(function(f){ return f.filename.toLowerCase() === "cover.png"; });
    if (coverFile) document.querySelector(".single-cover img").src = coverFile.filename;
    else document.querySelector(".single-cover").remove();
    document.querySelector(".post-content").innerHTML = DOMPurify.sanitize(marked.parse(d.body));
    var cn = document.querySelector(".container-narrow");
    if (d.meta.tags && d.meta.tags.length) {
      var wrap = document.createElement("div");
      wrap.className = "single-tags";
      var label = document.createElement("span");
      label.className = "tags-label";
      label.textContent = "Tags";
      wrap.append(label);
      d.meta.tags.forEach(function(t){
        var a = document.createElement("a");
        a.className = "tag-link";
        a.textContent = t;
        wrap.append(a);
      });
      cn.replaceChildren(wrap);
    } else cn.replaceChildren();
    document.querySelectorAll("img").forEach(function(img){
      var src = img.getAttribute("src") || "";
      if (/^(https?:|data:)/i.test(src)) return;
      fetch("/admin/file?id=" + id + "&name=" + encodeURIComponent(src), { headers: { "X-Admin-Key": KEY } })
        .then(function(r){ return r.ok ? r.blob() : null; })
        .then(function(b){ if (b) img.src = URL.createObjectURL(b); });
    });
  });
})();
<\/script>
</body>`);

const shell = (title, body) => `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · catrix</title>
<link rel="stylesheet" href="https://catrix.net/css/style.css">
<style>
  body { background: var(--color-bg); color: var(--color-text); }
  .wrap { max-width: 860px; margin: 0 auto; padding: 48px 20px 80px; }
  .card { border: 1px solid var(--color-border); padding: 20px 22px; margin-bottom: 18px; }
  .card h3 { margin: 0 0 6px; font-size: 1.05rem; }
  .meta { font-size: .78rem; color: var(--color-text-muted); }
  .row { display: flex; gap: 12px; margin-top: 14px; flex-wrap: wrap; }
  .btn { display: inline-block; padding: 9px 18px; background: var(--color-text); color: var(--color-bg); font-size: .82rem; cursor: pointer; border: 0; text-decoration: none; }
  .btn.ghost { background: none; color: var(--color-text); border: 1px solid var(--color-border); }
  .ok { color: #356148; }
  #gate { text-align: center; padding-top: 16vh; }
  #gate input { width: 280px; max-width: 80%; margin: 0 auto; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text); padding: 12px 14px; font: inherit; font-size: .875rem; text-align: center; }
  #gate input:focus { outline: none; border-color: var(--color-text); }
  #gate .row { justify-content: center; }
  #enter { font-size: 1.6rem; padding: 8px 16px; border: 0; background: none; color: inherit; cursor: pointer; border-radius: 12px; }
  #enter:hover { background: var(--color-bg-alt); }
</style>
</head>
<body>${body}</body>
</html>`;

export const ADMIN_HTML = shell("Admin", `
<div id="gate" class="wrap">
  <div class="submission-field" style="max-width: 340px; margin: 0 auto;">
    <input id="pass" type="password">
  </div>
  <div class="row"><button id="enter">📮</button></div>
  <p class="submission-field-hint" id="hint"></p>
</div>
<div id="panel" class="wrap" style="display:none">
  <header class="page-header">
    <p class="page-eyebrow">Catrix · Admin</p>
    <div class="page-divider" aria-hidden="true"></div>
  </header>
  <div id="list">加载中……</div>
</div>
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/dompurify@3/dist/purify.min.js"></script>
<script>
const $ = id => document.getElementById(id);
const gate = $("gate"), panel = $("panel");
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const q = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let KEY = localStorage.getItem("catrixAdmin") || "";
const api = path => fetch(path, { headers: { "X-Admin-Key": KEY } });

async function tryKey(k) {
  const res = await fetch("/admin/list", { headers: { "X-Admin-Key": k } });
  if (!res.ok) return false;
  KEY = k;
  localStorage.setItem("catrixAdmin", k);
  gate.style.display = "none";
  panel.style.display = "";
  render(await res.json());
  return true;
}

function render(posts) {
  const box = $("list");
  box.replaceChildren();
  if (!posts.length) return box.append(el("p", "", "还没有投稿。"));
  posts.forEach(p => {
    let tags = "";
    try { tags = (JSON.parse(p.tags) || []).join("、"); } catch { tags = p.tags; }
    const meta = el("p", "meta", p.name + " · " + p.created_at + " UTC · " + (tags || "无标签"));
    if (p.approved) meta.append(el("span", "ok", " ✓ 已审核"));
    const row = el("div", "row");
    const add = (text, cls, fn) => {
      const b = el("button", cls ? "btn " + cls : "btn", text);
      b.addEventListener("click", fn);
      row.append(b);
    };
    add("成品", "ghost", () => { location.href = "/admin/preview?id=" + p.id; });
    add("zip", "ghost", () => download(p));
    if (!p.approved) add("通过", "ghost", async () => { await api("/admin/approve?id=" + p.id); load(); });
    const card = el("div", "card");
    card.append(el("h3", "", "#" + p.id + " " + p.title), meta, row);
    box.append(card);
  });
}

async function load() {
  const res = await api("/admin/list");
  if (res.ok) render(await res.json());
}

async function download(p) {
  const res = await api("/admin/post?id=" + p.id);
  if (!res.ok) return alert("读取失败 " + res.status);
  const d = await res.json();
  const enc = new TextEncoder();
  const entries = [{ name: d.dir + "/index.md", data: enc.encode(d.indexMd) }];
  for (const f of d.files) {
    if (f.filename.toLowerCase().endsWith(".md")) continue;
    const r = await api("/admin/file?id=" + p.id + "&name=" + encodeURIComponent(f.filename));
    if (!r.ok) return alert("打包失败 " + r.status);
    entries.push({ name: d.dir + "/" + f.filename, data: new Uint8Array(await r.arrayBuffer()) });
  }
  const url = URL.createObjectURL(makeZip(entries));
  const a = el("a");
  a.href = url;
  a.download = "catrix-" + p.id + ".zip";
  a.click();
  URL.revokeObjectURL(url);
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// STORE 模式（不压缩）+ UTF-8 文件名标志
function makeZip(entries) {
  const enc = new TextEncoder();
  const chunks = [], central = [];
  let offset = 0;
  for (const e of entries) {
    const nameBytes = enc.encode(e.name);
    const crc = crc32(e.data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, e.data.length, true);
    local.setUint32(22, e.data.length, true);
    local.setUint16(26, nameBytes.length, true);
    chunks.push(new Uint8Array(local.buffer), nameBytes, e.data);
    const head = new DataView(new ArrayBuffer(46));
    head.setUint32(0, 0x02014b50, true);
    head.setUint32(16, crc, true);
    head.setUint32(20, e.data.length, true);
    head.setUint32(24, e.data.length, true);
    head.setUint16(28, nameBytes.length, true);
    head.setUint32(42, offset, true);
    central.push(new Uint8Array(head.buffer), nameBytes);
    offset += 30 + nameBytes.length + e.data.length;
  }
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, central.reduce((s, c) => s + c.length, 0), true);
  end.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: "application/zip" });
}

$("enter").addEventListener("click", async () => {
  if (await tryKey($("pass").value)) return;
  $("hint").textContent = "暗号不对。";
});
$("pass").addEventListener("keydown", e => {
  if (e.key === "Enter") $("enter").click();
});

if (KEY) tryKey(KEY);
</script>`);
