"""
Update catrix-logo-showcase.html to inline all SVGs for standalone perfection.
"""
import os

ARTIFACT_FILE = r"C:\Users\Tallcat\.gemini\antigravity\brain\fa87f1ea-1706-4605-b042-8bad7d87a0e7\catrix-logo-showcase.html"
STATIC_DIR = r"D:\BLOG\catrix\static\images"

badge_svg = open(os.path.join(STATIC_DIR, "catrix-logo-badge.svg"), "r", encoding="utf-8").read()
glyph_svg = open(os.path.join(STATIC_DIR, "catrix-logo-glyph.svg"), "r", encoding="utf-8").read()
origami_svg = open(os.path.join(STATIC_DIR, "catrix-logo-origami.svg"), "r", encoding="utf-8").read()
horizontal_svg = open(os.path.join(STATIC_DIR, "catrix-logo-horizontal.svg"), "r", encoding="utf-8").read()
favicon_svg = open(os.path.join(STATIC_DIR, "catrix-favicon.svg"), "r", encoding="utf-8").read()

html_content = f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Catrix 电子杂志 - 品牌矢量 Logo 设计提案</title>
  <script src="https://www.gstatic.com/antigravity/web/dev/tailwindcss.min.js"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@500;700;900&family=Inter:wght@400;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');
    .font-serif-sc {{ font-family: 'Noto Serif SC', Georgia, serif; }}
    .font-mono-code {{ font-family: 'JetBrains Mono', monospace; }}
    
    .bg-grid-pattern {{
      background-size: 24px 24px;
      background-image: linear-gradient(to right, rgba(148, 163, 184, 0.08) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(148, 163, 184, 0.08) 1px, transparent 1px);
    }}
  </style>
</head>
<body class="bg-[#0b0f19] text-[#f1f5f9] antialiased p-4 sm:p-8 min-h-screen">

  <!-- Header Banner -->
  <div class="max-w-6xl mx-auto mb-8">
    <div class="flex flex-col md:flex-row md:items-end justify-between border-b border-slate-800 pb-6 gap-4">
      <div>
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-3">
          <span class="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
          Brand Identity & Vector Design System
        </div>
        <h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight font-serif-sc">
          <span class="text-indigo-400">[</span>catrix<span class="text-indigo-400">]</span> 杂志 官方矢量 Logo
        </h1>
        <p class="text-sm sm:text-base text-slate-400 mt-2 max-w-2xl">
          “代码与媒体并列（纳瓦尔）· 立志成为全浦东最有影响力的高中生电子杂志”。以“Cat（猫）+ Matrix（矩阵与代码方括号）+ ✦ 智性星芒”为核心概念打造的极客人文矢量标识。
        </p>
      </div>

      <!-- Quick Actions -->
      <div class="flex items-center gap-3">
        <span class="text-xs text-slate-400">画布背景切换：</span>
        <div class="inline-flex rounded-lg bg-slate-800/80 p-1 border border-slate-700">
          <button onclick="setThemeBg('dark')" class="px-2.5 py-1 text-xs rounded-md bg-slate-700 text-white font-medium transition" id="btn-dark">暗夜黑</button>
          <button onclick="setThemeBg('light')" class="px-2.5 py-1 text-xs rounded-md text-slate-400 hover:text-white transition" id="btn-light">经典白</button>
          <button onclick="setThemeBg('grid')" class="px-2.5 py-1 text-xs rounded-md text-slate-400 hover:text-white transition" id="btn-grid">矩阵网格</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Main Showcase Grid -->
  <div class="max-w-6xl mx-auto space-y-10">

    <!-- Section 1: Core Marks -->
    <div>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-bold flex items-center gap-2 text-slate-200">
          <span class="text-indigo-400">01 /</span> 核心图形标识 (Core Icons)
        </h2>
        <span class="text-xs text-slate-400">纯矢量 SVG · 支持无损缩放</span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">

        <!-- Card 1: Matrix Cat (Badge) -->
        <div class="bg-[#131a29] border border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-indigo-500/40 transition shadow-lg">
          <div>
            <div class="flex justify-between items-start mb-3">
              <div>
                <span class="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">主推旗舰款</span>
                <h3 class="text-base font-bold mt-1 text-white">「极客矩阵猫」The Matrix Cat</h3>
              </div>
              <span class="text-xs text-slate-400 font-mono-code">512×512</span>
            </div>
            <p class="text-xs text-slate-400 leading-relaxed mb-4">
              以代码方括号 <code class="text-indigo-300">[ ]</code> 构筑猫耳与脸部脊柱，额头凝聚 ✦ 智性灵光星芒，下颌融入 3×3 康威生命游戏点阵。
            </p>
          </div>

          <!-- SVG Container -->
          <div id="preview-box-1" class="w-full aspect-square rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-center p-6 relative overflow-hidden transition-all duration-300">
            <div class="w-4/5 h-4/5 flex items-center justify-center filter drop-shadow-xl" id="svg-wrap-badge">
              {badge_svg}
            </div>
          </div>

          <!-- Bottom Action Buttons -->
          <div class="flex items-center gap-2 mt-4">
            <button onclick="downloadRaw('catrix-logo-badge.svg', 'svg-wrap-badge')" class="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 shadow">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              下载 SVG
            </button>
            <button onclick="copyRaw('svg-wrap-badge', this)" class="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition flex items-center gap-1 border border-slate-700">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
              复制
            </button>
          </div>
        </div>

        <!-- Card 2: Editorial Monochrome Glyph -->
        <div class="bg-[#131a29] border border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-indigo-500/40 transition shadow-lg">
          <div>
            <div class="flex justify-between items-start mb-3">
              <div>
                <span class="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">纯净透明矢量</span>
                <h3 class="text-base font-bold mt-1 text-white">「人文墨印猫」Editorial Glyph</h3>
              </div>
              <span class="text-xs text-slate-400 font-mono-code">512×512</span>
            </div>
            <p class="text-xs text-slate-400 leading-relaxed mb-4">
              透明背景单色矢量，可自由填色，完美自适应白天/黑夜主题，纯正编辑杂志质感。
            </p>
          </div>

          <!-- SVG Container -->
          <div id="preview-box-2" class="w-full aspect-square rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-center p-6 relative overflow-hidden transition-all duration-300 text-slate-100">
            <div class="w-4/5 h-4/5 flex items-center justify-center transition-colors" id="svg-wrap-glyph">
              {glyph_svg}
            </div>
          </div>

          <div class="flex items-center gap-2 mt-4">
            <button onclick="downloadRaw('catrix-logo-glyph.svg', 'svg-wrap-glyph')" class="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 shadow">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              下载 SVG
            </button>
            <button onclick="copyRaw('svg-wrap-glyph', this)" class="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition flex items-center gap-1 border border-slate-700">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
              复制
            </button>
          </div>
        </div>

        <!-- Card 3: Geometric Origami Cat -->
        <div class="bg-[#131a29] border border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-indigo-500/40 transition shadow-lg">
          <div>
            <div class="flex justify-between items-start mb-3">
              <div>
                <span class="text-xs font-semibold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">先锋折线款</span>
                <h3 class="text-base font-bold mt-1 text-white">「拓扑折纸猫」Geometric Origami</h3>
              </div>
              <span class="text-xs text-slate-400 font-mono-code">512×512</span>
            </div>
            <p class="text-xs text-slate-400 leading-relaxed mb-4">
              蒙德里安与空间拓扑折纸艺术交融，45°/90° 精准几何切角与晶格节点，极具青年先锋艺术张力。
            </p>
          </div>

          <!-- SVG Container -->
          <div id="preview-box-3" class="w-full aspect-square rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-center p-6 relative overflow-hidden transition-all duration-300">
            <div class="w-4/5 h-4/5 flex items-center justify-center" id="svg-wrap-origami">
              {origami_svg}
            </div>
          </div>

          <div class="flex items-center gap-2 mt-4">
            <button onclick="downloadRaw('catrix-logo-origami.svg', 'svg-wrap-origami')" class="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 shadow">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              下载 SVG
            </button>
            <button onclick="copyRaw('svg-wrap-origami', this)" class="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition flex items-center gap-1 border border-slate-700">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
              复制
            </button>
          </div>
        </div>

      </div>
    </div>

    <!-- Section 2: Horizontal Header Banner Lockup -->
    <div>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-bold flex items-center gap-2 text-slate-200">
          <span class="text-indigo-400">02 /</span> 网站顶栏横版组合 (Horizontal Lockup)
        </h2>
        <span class="text-xs text-slate-400">用于 Header 替换纯文本标题</span>
      </div>

      <div class="bg-[#131a29] border border-slate-800 rounded-2xl p-6 shadow-lg">
        <div id="preview-box-lockup" class="w-full bg-white rounded-xl p-8 border border-slate-200 flex items-center justify-center transition-all duration-300 overflow-x-auto">
          <div class="max-h-28 w-auto min-w-[500px]" id="svg-wrap-horizontal">
            {horizontal_svg}
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-4 mt-4 pt-4 border-t border-slate-800">
          <div class="text-xs text-slate-400">
            包含完整品牌组合：<code class="text-indigo-300">[ 极客矩阵猫标识 + 括号衬线字标 [catrix] + 电子杂志双语标牌 ]</code>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="downloadRaw('catrix-logo-horizontal.svg', 'svg-wrap-horizontal')" class="py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition flex items-center gap-1.5 shadow">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              下载横版矢量 SVG
            </button>
            <button onclick="copyRaw('svg-wrap-horizontal', this)" class="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition flex items-center gap-1.5 border border-slate-700">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
              复制 SVG 源码
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Section 3: Live Real-World Mockups -->
    <div>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-bold flex items-center gap-2 text-slate-200">
          <span class="text-indigo-400">03 /</span> 真实场景实机模拟 (Live Mockups)
        </h2>
        <span class="text-xs text-slate-400">实机预览顶栏、标签页与多尺度缩放</span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

        <!-- Mockup 1: Website Header Nav Mockup -->
        <div class="bg-[#131a29] border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div class="flex items-center justify-between mb-3">
            <h4 class="text-sm font-semibold text-white">Catrix 网站顶栏实装效果预览</h4>
            <span class="text-xs text-indigo-400 font-mono-code">&lt;header class="site-header"&gt;</span>
          </div>

          <div class="border border-slate-700/60 rounded-xl overflow-hidden bg-white shadow">
            <!-- Simulated Browser Tab -->
            <div class="bg-slate-100 border-b border-slate-200 px-3 py-1.5 flex items-center gap-2">
              <div class="flex gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block"></span>
                <span class="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span>
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"></span>
              </div>
              <div class="ml-2 bg-white px-3 py-1 rounded-t-md text-xs font-medium text-slate-700 flex items-center gap-1.5 border-t border-x border-slate-200 shadow-sm">
                <div class="w-3.5 h-3.5">{favicon_svg}</div>
                <span>[catrix] 杂志</span>
              </div>
            </div>

            <!-- Simulated Catrix Navbar -->
            <div class="px-5 py-3 flex items-center justify-between border-b border-slate-100 bg-white">
              <div class="flex items-center gap-2.5">
                <div class="w-7 h-7">{favicon_svg}</div>
                <span class="font-serif-sc font-bold text-slate-900 tracking-tight text-base">[catrix] 杂志</span>
              </div>
              <div class="hidden sm:flex items-center gap-4 text-xs font-serif-sc text-slate-600">
                <span class="text-slate-900 font-semibold">首页</span>
                <span>往期</span>
                <span>标签</span>
                <span>小游戏</span>
                <span class="text-indigo-600 font-medium">投稿</span>
              </div>
              <div class="flex items-center gap-2 text-slate-400">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              </div>
            </div>

            <!-- Mini Magazine Body Preview -->
            <div class="p-6 bg-slate-50 flex items-center justify-center">
              <div class="text-center">
                <p class="text-xs text-indigo-500 font-semibold uppercase tracking-wider mb-1">Issue 02 · 青年先锋深度阅读</p>
                <h5 class="text-base font-serif-sc font-bold text-slate-800">立志成为全浦东最有影响力的高中生杂志</h5>
                <p class="text-xs text-slate-500 mt-1 max-w-sm">媒体是数字时代普通人可获取的核心杠杆之一，与代码并列。</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Mockup 2: Favicon & Multi-size Scaling Test -->
        <div class="bg-[#131a29] border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div class="flex items-center justify-between mb-3">
            <h4 class="text-sm font-semibold text-white">多尺度视网膜缩放清晰度 (Scalability)</h4>
            <span class="text-xs text-slate-400">16px ~ 64px</span>
          </div>

          <div class="border border-slate-800 rounded-xl p-5 bg-slate-950 flex flex-col justify-between h-[210px]">
            <div class="flex items-end justify-around gap-4 h-full pb-2">
              <!-- 64px -->
              <div class="flex flex-col items-center gap-1.5">
                <div class="w-16 h-16 shadow-xl">{badge_svg}</div>
                <span class="text-[11px] text-slate-400 font-mono-code">64px / App</span>
              </div>
              <!-- 48px -->
              <div class="flex flex-col items-center gap-1.5">
                <div class="w-12 h-12 shadow-lg">{favicon_svg}</div>
                <span class="text-[11px] text-slate-400 font-mono-code">48px / Widget</span>
              </div>
              <!-- 32px -->
              <div class="flex flex-col items-center gap-1.5">
                <div class="w-8 h-8 shadow">{favicon_svg}</div>
                <span class="text-[11px] text-slate-400 font-mono-code">32px / Retina</span>
              </div>
              <!-- 16px -->
              <div class="flex flex-col items-center gap-1.5">
                <div class="w-4 h-4">{favicon_svg}</div>
                <span class="text-[11px] text-slate-400 font-mono-code">16px / Tab</span>
              </div>
            </div>
            <div class="text-center text-xs text-slate-500 border-t border-slate-800 pt-2">
              极客几何轮廓即使缩小至 16×16px 浏览器标签页尺寸，猫耳形态与矩阵核心依然清晰可辨。
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- Section 4: Design Philosophy & Elements Breakdown -->
    <div class="bg-[#131a29] border border-slate-800 rounded-2xl p-6 shadow-lg">
      <h3 class="text-base font-bold text-white mb-4 flex items-center gap-2">
        <span class="text-indigo-400">✦</span> Catrix 品牌符号设计构想解析
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-300 leading-relaxed">
        <div class="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div class="font-bold text-indigo-400 text-sm mb-1.5">01. 代码方括号 [ ] 构筑猫耳</div>
          <p class="text-slate-400">
            直接提取站名 <code class="text-indigo-300">[catrix]</code> 中的关键符号。左右方括号上挑为警觉挺立的猫耳，下收为沉稳弧线，既是猫的轮廓，又是矩阵（Matrix）数学和代码数组的具象化。
          </p>
        </div>
        <div class="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div class="font-bold text-cyan-400 text-sm mb-1.5">02. ✦ 智性火花 (Editorial Spark)</div>
          <p class="text-slate-400">
            额头中轴线上升华出一枚四芒灵光，致敬 Catrix 现有 Favicon 元素，寓意青年探索者的思想碰撞、媒体灵感与科学好奇心。
          </p>
        </div>
        <div class="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div class="font-bold text-purple-400 text-sm mb-1.5">03. 3×3 康威生命游戏点阵</div>
          <p class="text-slate-400">
            口鼻与胡须区域融入由 9 颗微晶格构成的细胞自动机矩阵（Cellular Automata），与本站首页背景“生命游戏”遥相呼应，彰显深邃的极客科技美学。
          </p>
        </div>
      </div>
    </div>

  </div>

  <!-- Toast Notification -->
  <div id="toast" class="fixed bottom-6 right-6 px-4 py-2.5 bg-indigo-600 text-white text-xs font-semibold rounded-xl shadow-2xl transition transform translate-y-20 opacity-0 duration-200 flex items-center gap-2 pointer-events-none z-50">
    <svg class="w-4 h-4 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
    <span id="toast-text">已复制到剪贴板</span>
  </div>

  <script>
    function setThemeBg(mode) {{
      const b1 = document.getElementById('preview-box-1');
      const b2 = document.getElementById('preview-box-2');
      const b3 = document.getElementById('preview-box-3');
      const bl = document.getElementById('preview-box-lockup');
      const glyph = document.getElementById('preview-box-2');

      const btnDark = document.getElementById('btn-dark');
      const btnLight = document.getElementById('btn-light');
      const btnGrid = document.getElementById('btn-grid');

      [btnDark, btnLight, btnGrid].forEach(btn => {{
        btn.className = "px-2.5 py-1 text-xs rounded-md text-slate-400 hover:text-white transition";
      }});

      if (mode === 'dark') {{
        btnDark.className = "px-2.5 py-1 text-xs rounded-md bg-slate-700 text-white font-medium transition";
        [b1, b2, b3].forEach(b => {{
          b.className = "w-full aspect-square rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-center p-6 relative overflow-hidden transition-all duration-300";
        }});
        bl.className = "w-full bg-slate-950 rounded-xl p-8 border border-slate-800 flex items-center justify-center transition-all duration-300 overflow-x-auto";
        glyph.classList.remove('text-slate-900');
        glyph.classList.add('text-slate-100');
      }} else if (mode === 'light') {{
        btnLight.className = "px-2.5 py-1 text-xs rounded-md bg-slate-700 text-white font-medium transition";
        [b1, b2, b3].forEach(b => {{
          b.className = "w-full aspect-square rounded-xl bg-white border border-slate-200 flex items-center justify-center p-6 relative overflow-hidden transition-all duration-300 shadow-inner";
        }});
        bl.className = "w-full bg-white rounded-xl p-8 border border-slate-200 flex items-center justify-center transition-all duration-300 overflow-x-auto shadow-inner";
        glyph.classList.remove('text-slate-100');
        glyph.classList.add('text-slate-900');
      }} else if (mode === 'grid') {{
        btnGrid.className = "px-2.5 py-1 text-xs rounded-md bg-slate-700 text-white font-medium transition";
        [b1, b2, b3].forEach(b => {{
          b.className = "w-full aspect-square rounded-xl bg-[#0d121f] bg-grid-pattern border border-indigo-500/20 flex items-center justify-center p-6 relative overflow-hidden transition-all duration-300";
        }});
        bl.className = "w-full bg-[#0d121f] bg-grid-pattern rounded-xl p-8 border border-indigo-500/20 flex items-center justify-center transition-all duration-300 overflow-x-auto";
        glyph.classList.remove('text-slate-900');
        glyph.classList.add('text-slate-100');
      }}
    }}

    function copyRaw(containerId, btn) {{
      const el = document.getElementById(containerId);
      if (!el) return;
      const svg = el.innerHTML.trim();
      navigator.clipboard.writeText(svg).then(() => {{
        showToast("SVG 矢量代码已复制！");
      }}).catch(() => {{
        showToast("复制失败");
      }});
    }}

    function downloadRaw(filename, containerId) {{
      const el = document.getElementById(containerId);
      if (!el) return;
      const svg = el.innerHTML.trim();
      const blob = new Blob([svg], {{ type: 'image/svg+xml;charset=utf-8' }});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("已下载 " + filename);
    }}

    function showToast(msg) {{
      const t = document.getElementById('toast');
      const tt = document.getElementById('toast-text');
      tt.textContent = msg;
      t.classList.remove('translate-y-20', 'opacity-0');
      t.classList.add('translate-y-0', 'opacity-100');
      setTimeout(() => {{
        t.classList.remove('translate-y-0', 'opacity-100');
        t.classList.add('translate-y-20', 'opacity-0');
      }}, 2500);
    }}
  </script>
</body>
</html>
'''

with open(ARTIFACT_FILE, "w", encoding="utf-8") as f:
    f.write(html_content)

print(f"Showcase updated successfully at: {ARTIFACT_FILE}")
