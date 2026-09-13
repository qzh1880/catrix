# Blank Magazine

**Blank Magazine** is a minimal, editorial-style personal blog theme for [Hugo](https://gohugo.io/). It pairs a pure-white canvas with print-grade serif typography, a magazine-cover featured story, a self-hosted photo gallery that scans local images automatically, and a calm reading experience that stays out of the way of your words.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/codesign2020/blank-magazine/blob/main/LICENSE)

![Blank Magazine screenshot](https://raw.githubusercontent.com/codesign2020/blank-magazine/main/images/screenshot.png)

## Features

- **Editorial typography** — Source Serif 4 + Noto Serif SC for content, Inter for the interface; a deliberate "serif for reading, sans for UI" system.
- **Magazine cover** — a wide featured story block on the home page.
- **Self-hosted photo gallery** — drop image files into a gallery folder and the theme scans them automatically; a single `index.md` carries only the text. External image URLs remain supported.
- **Taxonomy** — categories (genres such as essays / tech / reviews) and tags.
- **About page** with centered avatar/name and an initial-letter fallback.
- **Responsive** down to small phones, with a mobile slide-in menu.
- **Lightbox** gallery viewer, RSS feed and JSON output for search.
- No build step required — plain CSS and vanilla JS, works with the **standard (non-extended) Hugo binary**.

## Full page preview

**Home page** — featured cover story, latest posts and the four-up gallery strip:

![Home page full preview](https://raw.githubusercontent.com/codesign2020/blank-magazine/main/images/full-home.jpg)

**Article page** — print-grade serif reading layout:

![Article page full preview](https://raw.githubusercontent.com/codesign2020/blank-magazine/main/images/full-post.jpg)

**Photo gallery** — local-image gallery grid:

![Gallery page full preview](https://raw.githubusercontent.com/codesign2020/blank-magazine/main/images/full-gallery.jpg)

## Requirements

- Hugo **0.120.0** or newer (the standard binary is enough; extended is not required).

## Installation

```bash
# inside your Hugo site
git submodule add https://github.com/codesign2020/blank-magazine.git themes/blank-magazine
```

Then set the theme in your site config:

```toml
theme = "blank-magazine"
```

Or download a release and copy the folder into `themes/blank-magazine`.

## Quick start with the example site

A complete, ready-to-run site ships under [`exampleSite/`](./exampleSite):

```bash
cd blank-magazine
hugo server --source exampleSite --themesDir ../..
```

Open http://localhost:1313/.

## Configuration

A minimal site config (`hugo.toml`):

```toml
baseURL = "https://example.com/"
title = "Your Name"
theme = "blank-magazine"
defaultContentLanguage = "zh"

[pagination]
  pagerSize = 9

[params]
  author = "Your Name"
  authorBio = "writer / reader / walker"
  slogan = "A quiet place for words worth re-reading."
  email = "hello@example.com"
  mainSections = ["posts"]

[taxonomies]
  tag = "tags"
  category = "categories"

[outputs]
  home = ["HTML", "RSS", "JSON"]
```

The main navigation is defined through Hugo's `[[menu.main]]` entries; see `exampleSite/hugo.toml` for a full example.

### Writing a post

Posts live in `content/posts/`. Recommended front matter:

```toml
+++
title = 'My Essay'
date = 2026-09-01
categories = ['散文']
tags = ['生活', '阅读']
featured = false
cover = '/images/cover.jpg'
+++
```

Set `featured = true` on exactly one post to render it as the magazine-cover story.

## Photo gallery

Galleries live in `content/gallery/`. The recommended form is a **Page Bundle with local images** — no image host and no per-image links required:

```text
content/gallery/by-the-window/
├── index.md      # title, date and the written description only
├── 01.jpg
├── 02.jpg
└── 03.jpg
```

`index.md`:

```toml
+++
title = 'By the Window'
date = 2026-09-03
description = 'A short caption for this set'
+++

Write the story behind these photographs here. Markdown is supported.
```

Rules and behaviour:

- Images are sorted by file name — use zero-padded names (`01.jpg`, `02.jpg`, …) to control order. `jpg/jpeg/png/webp/gif` are supported.
- The cover is the first image automatically when no `cover` is set.
- An odd number of photos makes the last image span the full width, so the grid never leaves a gap.
- The legacy external form still works — list URLs in `photos = [...]` in front matter, and you may mix local and external images.

## Project structure

```text
blank-magazine/
├── archetypes/
├── layouts/          # baseof, home, list/single, gallery, about, partials
├── static/css/       # style.css
├── static/js/        # main.js
├── images/           # screenshot.png (1500×1000) and tn.png (900×600)
├── exampleSite/      # runnable demo content and config
├── theme.toml
├── hugo.toml         # supported Hugo version declaration
├── LICENSE
└── README.md
```

## Credits

- Fonts: Source Serif 4, Noto Serif SC and Inter via Google Fonts.
- Icons: Font Awesome.
- Demo photographs in `exampleSite` are from Unsplash and are used for demonstration only.

---

## 中文说明

Blank Magazine 是一款简约、杂志风的 Hugo 个人博客主题：纯白纸面、Source Serif 4 与思源宋体的印刷感衬线排版，封面报道式精选、可自建的本地图片相册、分类与标签体系，并完整适配移动端。

- 运行示例：在主题根目录执行 `hugo server --source exampleSite --themesDir ../..`
- 新建相册：在 `content/gallery/` 下建文件夹，把图片（建议 `01.jpg、02.jpg…` 补零命名）和一个只写文字的 `index.md` 放进去即可，主题会自动扫描图片、自动取首图为封面，奇数张时最后一张自动跨列补齐；也兼容在 front matter 用 `photos` 填写外链。
- 无需 extended 版本，普通 Hugo ≥ 0.120.0 即可。

## License

Released under the [MIT License](https://github.com/codesign2020/blank-magazine/blob/main/LICENSE).
