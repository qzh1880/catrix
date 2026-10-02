# 文章评论区

读者填写昵称与正文即可留言。新评论提交后立即公开，管理员可删除留言。删除会清除昵称和正文，不能恢复。旧版待审核及已隐藏留言保持原状态，可在后台选择公开或删除。支持单层回复、举报和纯文本评论；昵称不代表经过认证的身份。

## 本地查看

需要 Node.js 24 和 Hugo Extended 0.146.0（与仓库发布流程一致）。在仓库根目录运行：

```sh
node scripts/preview-comments.mjs
```

Hugo 不在 PATH 时，可设置 `HUGO_BINARY` 为其可执行文件的绝对路径。预览地址：

- 文章：`http://localhost:1313/posts/2026-09-27-dirty-words/#comments`
- 管理：`http://localhost:1313/admin/comments`
- 本地演示凭证：`local-preview-comments-admin-key-only`

预览服务只监听本机。示例留言和新提交的留言都在内存 SQLite 中，停止服务后清空，不连接线上数据库。`.comment-preview/` 中的构建结果已加入忽略规则。端口冲突时可设置 `COMMENTS_PREVIEW_PORT`。

## 验证

```sh
node --test worker/tests/*.test.mjs
node --check assets/js/comments.js
hugo
```

自动化测试运行真实 SQL 迁移和查询，使用 Node 内置 SQLite 适配 D1 接口，覆盖即时公开、管理员删除、文章隔离、分页、鉴权、输入验证、频率限制和重复提交。它不替代 Cloudflare 测试环境中的部署验证。

浏览器验收：提交后正文清空并自动刷新公开列表；管理员删除后刷新文章，留言消失；重复提交原请求不能恢复已删除内容。请求失败时，表单保留文字以便重试。用键盘和手机检查输入、按钮、换行及长昵称。

## 部署准备

评论路由已接入 `worker/worker.js`，复用现有 `DB` 绑定。仓库没有原有 Worker 的完整部署配置，维护者需在其现有配置中合并以下设置，保留原有绑定和其他变量。

```toml
[vars]
COMMENTS_ALLOWED_ORIGINS = "https://catrix.net"
COMMENTS_RATE_LIMIT = "20"

# 在现有的 [[d1_databases]] / DB 绑定中添加或合并：
# migrations_dir = "worker/migrations"
```

若现有项目已有迁移目录，请把本次 SQL 加入该目录并使用下一个未占用的迁移编号，不能直接替换旧迁移目录。路径相对于实际 Wrangler 配置文件。迁移仅新增 `comments`、`comment_rate_limits` 及索引，不修改投稿数据表。

在测试环境应用迁移后，维护者可按现有发布流程执行：

```sh
npx wrangler d1 migrations apply <实际数据库名称> --remote
npx wrangler secret put COMMENTS_ADMIN_KEY
npx wrangler secret put COMMENTS_RATE_SALT
npx wrangler deploy
```

两个 Secret 使用不同的、至少 32 字符的随机值，在提示框中输入，不写入仓库。`COMMENTS_ADMIN_KEY` 用于评论管理；`COMMENTS_RATE_SALT` 用于短期频率限制。不要使用本文的演示凭证。

配置和命令参考：[D1 迁移](https://developers.cloudflare.com/d1/reference/migrations/)及 [Worker Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)。

先在测试环境确认提交和删除流程和 D1 写入，再在 `hugo.toml` 填入部署后的真实接口地址并启用：

```toml
[params.comments]
enabled = true
apiURL = "https://你的实际Worker域名/comments"
```

正式网页通过 HTTPS 访问。只有 `posts` 下的文章显示评论；在单篇文章 Front Matter 中设置 `comments: false` 可隐藏评论区。此开关控制页面显示，不会删除留言，也不会关闭后台接口。

管理入口为同一个 Worker 的 `/admin/comments`。凭证仅在当前页面内存中保留，退出或刷新后重新输入。原投稿后台的旧凭证不能用于评论管理。

## 行为与限制

- 每页公开展示 20 条公开留言，最新提交在前；管理列表每页 30 条。
- 昵称 1–40 字符，正文 2–2000 字符；服务器再次验证类型、长度、文章路径及 JSON 请求大小。
- 所有用户文字用 `textContent` 显示，不渲染 HTML 或 Markdown。
- 同一提交标识可安全重试，不会重复创建留言。刷新页面后重新填写属于新提交。
- 文章身份为去掉站点子路径后的 `/posts/<slug>/`，可兼容根域名和 GitHub Pages 项目子路径。第一版支持默认的单层文章 slug；修改已发布文章 slug 时需同步迁移评论关联。
- 路径格式验证不等于文章存在性验证。评论直接公开，管理员可删除不当留言及指向不存在文章的留言。
- 默认同一 IP 每个固定 10 分钟窗口最多 20 次新提交，可通过 `COMMENTS_RATE_LIMIT` 调整为 1–1000。校园网络可能共享出口 IP，应按实际使用情况调整。此功能是基础节流，不是完整反垃圾系统。
- 原始 IP 不写入评论数据库；短期计数只存带 Secret 和时间窗口的哈希，过期记录在下一次有效新提交时清理。昵称、正文、文章路径及提交时间保存在数据库，直到维护者清理。
- 管理员删除会清空昵称与正文；保留 ID、提交标识、文章路径和时间以阻止请求重试恢复内容。支持单层回复和举报；支持点赞及取消；没有读者自助删除、账号登录或通知功能。
- 本次改动未修复原投稿后台的硬编码鉴权及上传校验问题。评论管理使用独立 Secret；原投稿功能仍需维护者单独处理。

## 文件分工

- `layouts/partials/comments.html`：文章底部的评论表单与列表。
- `assets/css/comments.css`、`assets/js/comments.js`：样式及交互，Hugo 生成内容指纹。
- `worker/comments.js`：公开读取、提交、删除及频率限制。
- `worker/comments-admin.js`：评论管理页面。
- `worker/migrations/0001_comments.sql`：评论数据表及索引。
- `worker/tests/`：真实 SQLite 后台测试。
- `scripts/preview-comments.mjs`：本地预览，自动构建网站并启动模拟 Worker。

需要回退前端时将 `enabled` 改为 `false` 并重新构建网站；如需同时停止接收评论，维护者应关闭 Worker 的评论路由。保留数据库以便恢复。

## 从先审核模式升级

同时更新 Worker 和 GitHub Pages 前端。只发布网页不会改变数据库写入行为。
新版本显式将新评论保存为 approved，即时公开本身不需要修改原有 SQL 迁移；回复和举报需要执行下方的 0002 迁移，也不会自动公开旧的 pending/rejected 留言。
后台默认显示已公开评论，删除前弹出确认；旧留言仍可在对应筛选项下公开或删除。
原 moderate 路由保留用于旧数据兼容，但无法恢复内容已经清空的删除记录。
本地测试通过后仍需在实际 Cloudflare 环境验证提交、公开、删除全流程。

## 回复和举报升级步骤

本次新增 `worker/migrations/0002_comment_replies_reports.sql`。必须先在现有 D1 数据库执行该增量迁移，再发布新版 Worker，最后发布前端。未执行迁移时，新接口会因缺少列或表返回 503。

1. 使用站长实际部署配置运行 `npx wrangler d1 migrations apply <实际数据库名称> --remote --config <实际配置文件>`。若站长使用另一迁移目录，应把 0002 加入该目录并按现有编号规则命名。不要重复执行已经应用过的 ALTER TABLE。
2. 发布新版 Worker，保留 DB 绑定、COMMENTS_ADMIN_KEY、COMMENTS_RATE_SALT 和来源配置。
3. 发布 GitHub Pages 前端；验证回复、举报、后台结案和删除流程。

若采用此前教程中的独立入口，举报仍通过 `/comments` 的 POST 请求发送，管理接口仍在 `/admin/comments/` 下，不需要增加新公开路由。当前仓库仍不包含完整的独立 Worker 部署配置。

### 回复规则

- 只能回复同一文章下的公开顶层留言，回复本身不能继续被回复。
- 回复直接公开，按提交时间与其他留言一起倒序排列，显示原留言昵称及最多 120 字符摘要。
- 删除原留言不会删除回复；原留言删除或隐藏后，摘要位置显示“原留言已删除或不可见”，不再返回其内容。
- 旧评论自动视为顶层留言，旧审核状态保持不变。

### 举报规则

- 读者可选择广告刷屏、辱骂攻击、泄露隐私或其他不当内容。举报类别不公开展示。
- 举报不会自动隐藏评论。管理员在“待处理举报”中查看类别及数量，可删除评论或“保留评论并结案”。删除评论会同时结案相关举报。
- 同一 IP 在同一 10 分钟窗口对同一留言的举报会去重；每个 IP 每窗口最多 10 次新的举报，使用独立于留言的限流配额。校园共享网络下，这不等同于独立举报人数。
- 仅保存评论关联、类别、状态、时间及带盐的窗口标识，不保存举报者原始 IP。已处理举报记录仍保留在数据库，需由站长按其数据保留规则清理。
- 匿名举报不能证明违规，只供管理员判断；不以举报数量自动处罚读者。

## 点赞和社区功能

新增点赞、反馈及游戏排名使用 `0003_community_rankings.sql` 迁移和现有独立 Worker。完整升级及验证步骤见 [社区与游戏更新](community-and-rankings.md)。
