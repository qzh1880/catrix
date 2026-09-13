/* ============================================
   Blank Magazine Theme - Main JavaScript
   ============================================ */

(function () {
  'use strict';

  // ---------- Client-side Search ----------
  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');

  if (searchInput && searchResults) {
    let searchIndex = null;

    async function loadSearchIndex() {
      if (searchIndex) return searchIndex;
      try {
        const response = await fetch('/index.json');
        if (response.ok) {
          searchIndex = await response.json();
        }
      } catch (e) {
        searchIndex = [];
      }
      return searchIndex;
    }

    let searchTimeout = null;
    searchInput.addEventListener('input', async function () {
      const query = this.value.trim().toLowerCase();
      if (query.length < 2) {
        searchResults.innerHTML = '';
        return;
      }

      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(async function () {
        const index = await loadSearchIndex();
        const results = index.filter(function (item) {
          return (
            item.title.toLowerCase().includes(query) ||
            (item.content && item.content.toLowerCase().includes(query)) ||
            (item.tags && item.tags.some(function (t) { return t.toLowerCase().includes(query); }))
          );
        }).slice(0, 8);

        if (results.length === 0) {
          searchResults.innerHTML = '<p style="text-align:center;color:#888;padding:32px 0;font-family:var(--font-sans);font-size:0.85rem;">未找到相关文章</p>';
          return;
        }

        searchResults.innerHTML = results.map(function (item) {
          return '<a href="' + item.permalink + '" style="display:block;padding:16px 0;border-bottom:1px solid #f0eee9;transition:padding-left 0.2s;" onmouseover="this.style.paddingLeft=\'8px\'" onmouseout="this.style.paddingLeft=\'0\'">' +
            '<span style="font-family:var(--font-sans);font-size:0.65rem;letter-spacing:1px;text-transform:uppercase;color:#c9a96e;">' + (item.section || '') + '</span>' +
            '<h4 style="font-family:var(--font-serif);font-size:1.05rem;font-weight:500;margin:4px 0;">' + item.title + '</h4>' +
            (item.summary ? '<p style="font-size:0.85rem;color:#666;line-height:1.6;">' + item.summary.substring(0, 100) + '...</p>' : '') +
            '</a>';
        }).join('');
      }, 200);
    });
  }

  // ---------- Image Fade-in on Load ----------
  document.querySelectorAll('img').forEach(function (img) {
    if (img.complete) {
      img.style.opacity = '1';
    } else {
      img.style.opacity = '0';
      img.style.transition = 'opacity 0.6s ease';
      img.addEventListener('load', function () {
        img.style.opacity = '1';
      });
    }
  });

  // ---------- Smooth Scroll for Anchor Links ----------
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ---------- Header Shadow on Scroll ----------
  const header = document.querySelector('.site-header');
  if (header) {
    window.addEventListener('scroll', function () {
      if (window.pageYOffset > 50) {
        header.style.boxShadow = '0 1px 12px rgba(0,0,0,0.06)';
      } else {
        header.style.boxShadow = 'none';
      }
    }, { passive: true });
  }

  // ---------- Reading Progress Bar (single post) ----------
  const singlePost = document.querySelector('.single-post');
  if (singlePost) {
    const progressBar = document.createElement('div');
    progressBar.style.cssText = 'position:fixed;top:0;left:0;height:2px;background:var(--color-accent);z-index:200;transition:width 0.1s;width:0;';
    document.body.appendChild(progressBar);

    window.addEventListener('scroll', function () {
      const scrollTop = window.pageYOffset;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = (scrollTop / docHeight) * 100;
      progressBar.style.width = progress + '%';
    }, { passive: true });
  }

  console.log('%c Blank Magazine Theme loaded ', 'background:#1a1a1a;color:#c9a96e;padding:4px 8px;font-family:serif;');
})();
