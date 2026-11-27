"""
Catrix Logo Vector Generator
Generates high-precision, production-ready SVGs for Catrix Magazine.
"""
import os

STATIC_IMG_DIR = r"D:\BLOG\catrix\static\images"
os.makedirs(STATIC_IMG_DIR, exist_ok=True)

# --------------------------------------------------------------------------
# 1. Flagship: The Matrix Cat (Icon Symbol - 512x512)
# Features:
# - Symmetrical square-bracket ear geometry (brackets [ and ])
# - Celestial 4-pointed editorial spark (✦) on forehead
# - Sleek geometric cat eyes (intelligent matrix slits)
# - 3x3 Conway's Game of Life matrix dot grid at chin/whisker
# - Available with both sleek dark gradient squircle badge and transparent pure vector
# --------------------------------------------------------------------------
svg_matrix_cat = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="catrixBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="50%" stop-color="#1e1b4b"/>
      <stop offset="100%" stop-color="#090d16"/>
    </linearGradient>

    <!-- Cyber / Editorial Accent Gradient -->
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="50%" stop-color="#818cf8"/>
      <stop offset="100%" stop-color="#c084fc"/>
    </linearGradient>

    <!-- Star Glow Gradient -->
    <linearGradient id="starGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#67e8f9"/>
    </linearGradient>

    <!-- Outer Glow Filter -->
    <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <!-- Squircle Outer Shell (iOS / Modern App Icon curvature) -->
  <rect x="16" y="16" width="480" height="480" rx="112" fill="url(#catrixBg)"/>
  
  <!-- Subtle Matrix Circuit Grid lines (faint background) -->
  <g opacity="0.08" stroke="#ffffff" stroke-width="1.5">
    <line x1="80" y1="120" x2="432" y2="120"/>
    <line x1="80" y1="200" x2="432" y2="200"/>
    <line x1="80" y1="280" x2="432" y2="280"/>
    <line x1="80" y1="360" x2="432" y2="360"/>
    <line x1="136" y1="80" x2="136" y2="432"/>
    <line x1="216" y1="80" x2="216" y2="432"/>
    <line x1="296" y1="80" x2="296" y2="432"/>
    <line x1="376" y1="80" x2="376" y2="432"/>
  </g>

  <!-- Left Bracket Ear [ Structure -->
  <path d="M 190 148 
           L 136 84 
           A 6 6 0 0 0 126 89 
           L 112 210 
           C 110 240 108 270 114 316 
           C 120 360 148 404 204 424 
           L 226 424
           C 232 424 236 419 236 413
           C 236 407 232 402 226 402
           L 208 402
           C 166 386 142 352 136 312
           C 132 276 134 246 136 214
           L 146 122
           L 182 166
           C 186 170 192 170 196 166
           C 200 162 198 156 190 148 Z" 
        fill="url(#accentGrad)"/>

  <!-- Right Bracket Ear ] Structure (Perfect Mirror) -->
  <path d="M 322 148 
           L 376 84 
           A 6 6 0 0 1 386 89 
           L 400 210 
           C 402 240 404 270 398 316 
           C 392 360 364 404 308 424 
           L 286 424
           C 280 424 276 419 276 413
           C 276 407 280 402 286 402
           L 294 402
           C 346 386 370 352 376 312
           C 380 276 378 246 376 214
           L 366 122
           L 330 166
           C 326 170 320 170 316 166
           C 312 162 314 156 322 148 Z" 
        fill="url(#accentGrad)"/>

  <!-- Top Crown Architectural Arc connecting the two brackets subtly -->
  <path d="M 192 168 Q 256 196 320 168" 
        fill="none" 
        stroke="url(#accentGrad)" 
        stroke-width="8" 
        stroke-linecap="round" 
        opacity="0.85"/>

  <!-- Forehead: Editorial Spark ✦ (The Catrix Spark of Insight) -->
  <path d="M 256 190 
           C 257 210 263 216 283 217 
           C 263 218 257 224 256 244 
           C 255 224 249 218 229 217 
           C 249 216 255 210 256 190 Z" 
        fill="url(#starGrad)" 
        filter="url(#softGlow)"/>

  <!-- Left Eye: Geometric Tech Slit / Alert Cat Eye -->
  <polygon points="172,258 226,268 220,282 178,274" fill="#ffffff" opacity="0.95"/>
  <circle cx="204" cy="271" r="3" fill="#38bdf8"/>

  <!-- Right Eye: Geometric Tech Slit / Alert Cat Eye -->
  <polygon points="340,258 286,268 292,282 334,274" fill="#ffffff" opacity="0.95"/>
  <circle cx="308" cy="271" r="3" fill="#38bdf8"/>

  <!-- Conway's Life Game: 3x3 Matrix Grid (Whisker / Nose constellation) -->
  <!-- Row 1 -->
  <rect x="252" y="296" width="8" height="8" rx="2" fill="#818cf8"/>
  <!-- Row 2 -->
  <rect x="232" y="320" width="8" height="8" rx="2" fill="#67e8f9" opacity="0.7"/>
  <rect x="252" y="320" width="8" height="8" rx="2" fill="#c084fc"/>
  <rect x="272" y="320" width="8" height="8" rx="2" fill="#67e8f9" opacity="0.7"/>
  <!-- Row 3 (Whisker spread) -->
  <rect x="212" y="344" width="8" height="8" rx="2" fill="#38bdf8" opacity="0.5"/>
  <rect x="252" y="344" width="8" height="8" rx="2" fill="#ffffff"/>
  <rect x="292" y="344" width="8" height="8" rx="2" fill="#38bdf8" opacity="0.5"/>
  <!-- Row 4 (Lower chin point) -->
  <rect x="252" y="368" width="8" height="8" rx="2" fill="#818cf8" opacity="0.8"/>

  <!-- Whisker Horizon Rays (Subtle minimalist vector beams) -->
  <line x1="152" y1="332" x2="204" y2="336" stroke="#818cf8" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/>
  <line x1="146" y1="352" x2="198" y2="350" stroke="#818cf8" stroke-width="2.5" stroke-linecap="round" opacity="0.4"/>
  <line x1="360" y1="332" x2="308" y2="336" stroke="#818cf8" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/>
  <line x1="366" y1="352" x2="314" y2="350" stroke="#818cf8" stroke-width="2.5" stroke-linecap="round" opacity="0.4"/>
</svg>'''

# --------------------------------------------------------------------------
# 2. Transparent Editorial Glyph (Monochrome Ink / Header ready - 512x512)
# Clean vector path without background card - ideal for white or dark theme
# --------------------------------------------------------------------------
svg_matrix_glyph = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <!-- Left Bracket Ear [ -->
  <path d="M 190 148 
           L 136 84 
           A 6 6 0 0 0 126 89 
           L 112 210 
           C 110 240 108 270 114 316 
           C 120 360 148 404 204 424 
           L 226 424
           C 232 424 236 419 236 413
           C 236 407 232 402 226 402
           L 208 402
           C 166 386 142 352 136 312
           C 132 276 134 246 136 214
           L 146 122
           L 182 166
           C 186 170 192 170 196 166
           C 200 162 198 156 190 148 Z" 
        fill="currentColor"/>

  <!-- Right Bracket Ear ] -->
  <path d="M 322 148 
           L 376 84 
           A 6 6 0 0 1 386 89 
           L 400 210 
           C 402 240 404 270 398 316 
           C 392 360 364 404 308 424 
           L 286 424
           C 280 424 276 419 276 413
           C 276 407 280 402 286 402
           L 294 402
           C 346 386 370 352 376 312
           C 380 276 378 246 376 214
           L 366 122
           L 330 166
           C 326 170 320 170 316 166
           C 312 162 314 156 322 148 Z" 
        fill="currentColor"/>

  <!-- Top Crown Arc -->
  <path d="M 192 168 Q 256 196 320 168" 
        fill="none" 
        stroke="currentColor" 
        stroke-width="10" 
        stroke-linecap="round"/>

  <!-- Editorial Spark ✦ -->
  <path d="M 256 190 
           C 257 210 263 216 283 217 
           C 263 218 257 224 256 244 
           C 255 224 249 218 229 217 
           C 249 216 255 210 256 190 Z" 
        fill="currentColor"/>

  <!-- Eyes -->
  <polygon points="172,258 226,268 220,282 178,274" fill="currentColor"/>
  <polygon points="340,258 286,268 292,282 334,274" fill="currentColor"/>

  <!-- 3x3 Conway Matrix Dots -->
  <rect x="251" y="296" width="10" height="10" rx="3" fill="currentColor"/>
  <rect x="231" y="320" width="10" height="10" rx="3" fill="currentColor"/>
  <rect x="251" y="320" width="10" height="10" rx="3" fill="currentColor"/>
  <rect x="271" y="320" width="10" height="10" rx="3" fill="currentColor"/>
  <rect x="211" y="344" width="10" height="10" rx="3" fill="currentColor"/>
  <rect x="251" y="344" width="10" height="10" rx="3" fill="currentColor"/>
  <rect x="291" y="344" width="10" height="10" rx="3" fill="currentColor"/>
  <rect x="251" y="368" width="10" height="10" rx="3" fill="currentColor"/>

  <!-- Whiskers -->
  <line x1="146" y1="332" x2="200" y2="336" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
  <line x1="140" y1="352" x2="194" y2="350" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
  <line x1="366" y1="332" x2="312" y2="336" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
  <line x1="372" y1="352" x2="318" y2="350" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
</svg>'''

# --------------------------------------------------------------------------
# 3. Geometric Origami / Bauhaus Matrix Cat (512x512)
# Ultra-modern polygonal isometric line art
# --------------------------------------------------------------------------
svg_origami_cat = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="origamiLineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0284c7"/>
      <stop offset="50%" stop-color="#4f46e5"/>
      <stop offset="100%" stop-color="#9333ea"/>
    </linearGradient>
  </defs>

  <g fill="none" stroke="url(#origamiLineGrad)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">
    <!-- Outer Contour -->
    <!-- Left Ear to Crown to Right Ear -->
    <path d="M 120 120 L 190 200 L 256 160 L 322 200 L 392 120"/>
    <!-- Outer Ears to Cheeks -->
    <path d="M 120 120 L 130 260 L 190 380 L 256 430 L 322 380 L 382 260 L 392 120"/>
    
    <!-- Internal Facial Facets -->
    <path d="M 190 200 L 130 260 L 256 310 L 382 260 L 322 200"/>
    <path d="M 256 160 L 256 310 L 256 430"/>
    <path d="M 190 380 L 256 310 L 322 380"/>

    <!-- Eyes (Geometric Diamond Prisms) -->
    <polygon points="190,260 216,244 234,260 216,276" fill="#4f46e5" fill-opacity="0.25" stroke="url(#origamiLineGrad)" stroke-width="6"/>
    <polygon points="322,260 296,244 278,260 296,276" fill="#4f46e5" fill-opacity="0.25" stroke="url(#origamiLineGrad)" stroke-width="6"/>

    <!-- Whisker/Matrix Node Pins -->
    <circle cx="120" cy="120" r="7" fill="#0284c7"/>
    <circle cx="392" cy="120" r="7" fill="#9333ea"/>
    <circle cx="256" cy="160" r="7" fill="#4f46e5"/>
    <circle cx="256" cy="310" r="7" fill="#4f46e5"/>
    <circle cx="256" cy="430" r="7" fill="#4f46e5"/>
    <circle cx="130" cy="260" r="6" fill="#0284c7"/>
    <circle cx="382" cy="260" r="6" fill="#9333ea"/>
  </g>
</svg>'''

# --------------------------------------------------------------------------
# 4. Horizontal Lockup for Website Header (800x200)
# Perfect fit for themes/blank-magazine header!
# Logo Mark on left + [catrix] Typographic Brand + Subtitle
# --------------------------------------------------------------------------
svg_header_lockup = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 160" width="100%" height="100%">
  <defs>
    <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0284c7"/>
      <stop offset="60%" stop-color="#4f46e5"/>
      <stop offset="100%" stop-color="#7c3aed"/>
    </linearGradient>
  </defs>

  <!-- Left Icon Container (140x140 at x=10, y=10) -->
  <g transform="translate(10, 10) scale(0.2734)">
    <!-- Scaled Matrix Cat -->
    <path d="M 190 148 L 136 84 A 6 6 0 0 0 126 89 L 112 210 C 110 240 108 270 114 316 C 120 360 148 404 204 424 L 226 424 C 232 424 236 419 236 413 C 236 407 232 402 226 402 L 208 402 C 166 386 142 352 136 312 C 132 276 134 246 136 214 L 146 122 L 182 166 C 186 170 192 170 196 166 C 200 162 198 156 190 148 Z" fill="url(#brandGrad)"/>
    <path d="M 322 148 L 376 84 A 6 6 0 0 1 386 89 L 400 210 C 402 240 404 270 398 316 C 392 360 364 404 308 424 L 286 424 C 280 424 276 419 276 413 C 276 407 280 402 286 402 L 294 402 C 346 386 370 352 376 312 C 380 276 378 246 376 214 L 366 122 L 330 166 C 326 170 320 170 316 166 C 312 162 314 156 322 148 Z" fill="url(#brandGrad)"/>
    <path d="M 192 168 Q 256 196 320 168" fill="none" stroke="url(#brandGrad)" stroke-width="10" stroke-linecap="round"/>
    <path d="M 256 190 C 257 210 263 216 283 217 C 263 218 257 224 256 244 C 255 224 249 218 229 217 C 249 216 255 210 256 190 Z" fill="#0284c7"/>
    <polygon points="172,258 226,268 220,282 178,274" fill="url(#brandGrad)"/>
    <polygon points="340,258 286,268 292,282 334,274" fill="url(#brandGrad)"/>
    <rect x="251" y="296" width="10" height="10" rx="3" fill="#4f46e5"/>
    <rect x="231" y="320" width="10" height="10" rx="3" fill="#4f46e5"/>
    <rect x="251" y="320" width="10" height="10" rx="3" fill="#0284c7"/>
    <rect x="271" y="320" width="10" height="10" rx="3" fill="#4f46e5"/>
    <rect x="211" y="344" width="10" height="10" rx="3" fill="#7c3aed"/>
    <rect x="251" y="344" width="10" height="10" rx="3" fill="#4f46e5"/>
    <rect x="291" y="344" width="10" height="10" rx="3" fill="#7c3aed"/>
    <rect x="251" y="368" width="10" height="10" rx="3" fill="#4f46e5"/>
    <line x1="146" y1="332" x2="200" y2="336" stroke="#0284c7" stroke-width="5" stroke-linecap="round"/>
    <line x1="140" y1="352" x2="194" y2="350" stroke="#0284c7" stroke-width="5" stroke-linecap="round"/>
    <line x1="366" y1="332" x2="312" y2="336" stroke="#7c3aed" stroke-width="5" stroke-linecap="round"/>
    <line x1="372" y1="352" x2="318" y2="350" stroke="#7c3aed" stroke-width="5" stroke-linecap="round"/>
  </g>

  <!-- Vertical Divider -->
  <line x1="168" y1="38" x2="168" y2="122" stroke="#e2e8f0" stroke-width="2" stroke-linecap="round"/>

  <!-- Brand Typography -->
  <!-- Left Bracket -->
  <text x="188" y="98" font-family="'Source Serif 4', 'Noto Serif SC', Georgia, serif" font-size="64" font-weight="700" fill="#4f46e5">[</text>
  
  <!-- "catrix" Text -->
  <text x="216" y="98" font-family="'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="56" font-weight="800" letter-spacing="-1px" fill="#0f172a">catrix</text>
  
  <!-- Right Bracket -->
  <text x="408" y="98" font-family="'Source Serif 4', 'Noto Serif SC', Georgia, serif" font-size="64" font-weight="700" fill="#4f46e5">]</text>

  <!-- Editorial Sub-label: 杂志 / DIGITAL MAGAZINE -->
  <text x="444" y="78" font-family="'Noto Serif SC', 'Source Han Serif SC', serif" font-size="22" font-weight="700" fill="#0f172a">杂志</text>
  <text x="444" y="98" font-family="'Inter', -apple-system, sans-serif" font-size="11" font-weight="700" letter-spacing="3.5px" fill="#64748b">DIGITAL MAGAZINE</text>

  <!-- Slogan / Tagline -->
  <text x="194" y="126" font-family="'Inter', 'Noto Serif SC', sans-serif" font-size="13" font-weight="500" letter-spacing="0.5px" fill="#94a3b8">立志成为全浦东最有影响力的高中生杂志 · PUDONG YOUTH MEDIA</text>
</svg>'''

# --------------------------------------------------------------------------
# 5. Favicon (64x64)
# High-contrast, maximum legibility for browser tabs
# --------------------------------------------------------------------------
svg_favicon = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <linearGradient id="favGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0284c7"/>
      <stop offset="100%" stop-color="#7c3aed"/>
    </linearGradient>
  </defs>
  <!-- Background Badge -->
  <rect width="64" height="64" rx="16" fill="#0f172a"/>
  
  <!-- Symmetrical Cat Ears / Matrix Brackets [ ] -->
  <path d="M 23 20 L 16 11 A 1 1 0 0 0 14 12 L 13 28 C 13 36 17 44 25 48 L 28 48 C 29 48 30 47 30 46 C 30 45 29 44 28 44 L 26 44 C 20 41 17 35 17 29 L 18 16 L 22 22 C 23 23 24 23 25 22 C 25 21 25 21 23 20 Z" fill="url(#favGrad)"/>
  
  <path d="M 41 20 L 48 11 A 1 1 0 0 1 50 12 L 51 28 C 51 36 47 44 39 48 L 36 48 C 35 48 34 47 34 46 C 34 45 35 44 36 44 L 38 44 C 44 41 47 35 47 29 L 46 16 L 42 22 C 41 23 40 23 39 22 C 39 21 39 21 41 20 Z" fill="url(#favGrad)"/>

  <!-- Editorial Spark ✦ -->
  <path d="M 32 23 C 32.5 26 33.5 27 36.5 27.5 C 33.5 28 32.5 29 32 32 C 31.5 29 30.5 28 27.5 27.5 C 30.5 27 31.5 26 32 23 Z" fill="#38bdf8"/>

  <!-- Eyes -->
  <rect x="20" y="32" width="7" height="3" rx="1.5" fill="#ffffff"/>
  <rect x="37" y="32" width="7" height="3" rx="1.5" fill="#ffffff"/>

  <!-- Matrix Dots -->
  <circle cx="32" cy="38" r="1.5" fill="#818cf8"/>
  <circle cx="28" cy="42" r="1.5" fill="#38bdf8"/>
  <circle cx="32" cy="42" r="1.5" fill="#c084fc"/>
  <circle cx="36" cy="42" r="1.5" fill="#38bdf8"/>
</svg>'''

# Save all files to static/images
files = {
    "catrix-logo-badge.svg": svg_matrix_cat,
    "catrix-logo-glyph.svg": svg_matrix_glyph,
    "catrix-logo-origami.svg": svg_origami_cat,
    "catrix-logo-horizontal.svg": svg_header_lockup,
    "catrix-favicon.svg": svg_favicon
}

for name, content in files.items():
    p = os.path.join(STATIC_IMG_DIR, name)
    with open(p, "w", encoding="utf-8") as f:
        f.write(content.strip())
    print(f"Generated: {p} ({len(content)} bytes)")

print("All SVGs successfully written.")
