---
date: '2026-08-09T11:40:17+08:00'
draft: false
title: "Catrix.net 创作者投稿与协作指南"
author: "linearcat"
summary: 面向 catrix.net 创作者的完整协作与提交流程指南，涵盖从拉取代码到文章发布的每一步
# cover:
#     image: "https://avatars.githubusercontent.com/u/104124634?v=4" # image path/url
#     alt: "this is an alt text" # alt text
#     caption: "caption?" # display caption under cover
#     relative: false # when using page bundles set this to true
#     hidden: false # only hide on current single page
---

欢迎来到 **catrix.net**！非常高兴你能作为创作者加入我们。

~~由于没有人做编辑排版工作~~为了便于创作者直接实现自己的构想，提高效率，本站采用git -> github 的工作流。如果你是GitHub老手，那么这无疑是轻松愉快的。不过，即使你是第一次听说Github,这篇指南也会手把手带你完成从环境准备到文章上线的全过程。

当然，如果尝试过程中遇到报错，请寻找~~本站管理员或~~AI的帮助。如果你认为导致问题的原因是网站bug或文档有误，请及时联系管理员。

---

## 第一步：拉取源代码与准备环境

catrix.net这个网站的本体就是托管在Github上的一个仓库，你想上传文章，就要对这个仓库进行编辑。

想要编辑，你需要将网站的源代码拉取到本地。

1. **安装必要工具**：确保你的电脑上已经安装了 [Git](https://git-scm.com/) 和推荐的代码编辑器 [Visual Studio Code (VS Code)](https://code.visualstudio.com/)。安装VScode时请**勾选所有附加任务**。
2. **克隆代码库**：打开终端（或 VS Code 的终端），输入以下命令将代码拉取到本地：
   ```bash
   git clone https://github.com/qzh1880/catrix.git
   ```
3. **在本地打开代码库**：在catrix文件夹中右键打开VScode.
## 第二步：完善作者个人资料（新作者必读）
如果你是第一次在 catrix.net 投稿，请先创建你的专属作者名片。
 1. 在 VS Code 中，展开左侧的目录树，找到 **content/author/** 文件夹。
 2. 在该文件夹下，新建一个以你**名字或昵称（建议用英文或拼音）**命名的文件夹，例如 content/author/zhangsan/。
 3. 在这个新建的文件夹中，创建一个名为 **_index.md** 的文件。
 4. 填入以下个人资料（可根据需要修改）：
   ```yaml
   ---
   title: "张三"
   bio: "这里是你的个人简介/个性签名"
   avatar: "你的头像链接或存放在同目录下的图片名（如 avatar.jpg）"
   ---
   在这里可以写一段稍微详细一点的自我介绍,也可以放置自己的社交媒体链接。
```

## 第三步：撰写你的文章
资料准备就绪，接下来就可以开始挥洒创意了！
### 1. 创建文章文件
请在 **content/post/** 目录下新建你的文章文件。文件命名必须遵循 **日期-标题.md** 的格式。
例如：2026-08-09-my-first-post.md
### 2. 填写头部信息 (Front Matter)
在新创建的 Markdown 文件最顶部，我们需要填写文章的元数据（也就是 Head）。请将以下模板复制进去并修改：


```yaml
---
title: "这是你的文章标题"
date: 2026-08-09T12:00:00+08:00
author: ["zhangsan"]  # 这里一定要填你在 content/author/ 下创建的那个文件夹名称
tags: ["Maths"]
draft: false  # 设置为 false 表示文章准备发布；若是草稿请设为 true
summary: "用一两句话简短概括这篇文章的内容，用于列表页展示。"
---

这里开始写你的正文...
```


### 3. 用 Markdown 撰写正文
Front Matter 之后就是文章的主体部分。你需要使用 Markdown 语法来进行排版。
如果你对 Markdown 还不熟悉，不用担心，它非常简单易学。你可以参考以下优秀的教程：
 * [Markdown 菜鸟教程](https://www.runoob.com/markdown/md-tutorial.html)
 * [在此网站查看代码、公式的写法](https://adityatelange.github.io/hugo-PaperMod/)
在 VS Code 中，你可以按 Ctrl + Shift + V（Windows/Linux）或 Cmd + Shift + V（Mac）在右侧实时预览你的 Markdown 排版效果。
## 第四步：提交代码并等待审核
文章写完并检查无误后，千万不要直接推送到主分支（main）。请按照以下标准流程提交审核：
### 1. 创建你的专属创作分支
在终端中运行以下命令，创建一个新的分支（建议分支名包含你要发布的文章信息）：
```bash
git checkout -b post/分支名

```
### 2. 暂存并提交你的更改
将你新建或修改的文件（作者信息和文章）提交到 Git：
```bash
git add .
git commit -m "feat: 新增张三的个人资料和一篇文章"

```
### 3. 推送到 GitHub
将这个新分支推送到远程代码库：
```bash
git push origin post/分支名

```
### 4. 发起 Pull Request (PR) 申请合并
 1. 打开项目的 GitHub 页面。
 2. 页面顶部会自动提示你刚刚推送的分支，点击 **"Compare & pull request"** 按钮。
 3. 填写一个简短的标题和描述，告诉管理员你提交了什么内容。
 4. 点击 **"Create pull request"**。
## 🎉 完成！
接下来，你只需要耐心等待管理员的代码审查（Code Review）。
一旦审核通过并合并到 main 分支，网站的自动化程序就会自动构建，你的文章很快就会在 **catrix.net** 上和大家见面啦！期待你的精彩创作！
