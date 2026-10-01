/* ============================================
   Blank Magazine Theme - Main JavaScript
   ============================================ */

(function () {
  'use strict';

  // 搜索交互由 Hugo 指纹资源 search.js 提供。

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
