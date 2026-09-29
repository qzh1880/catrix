-- 增量迁移：只新增评论相关表和索引，不修改现有投稿表。
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- 前端生成的提交标识；唯一约束防止网络重试产生重复留言。
  request_id TEXT NOT NULL UNIQUE,
  -- 保存 /posts/<slug>/ 路径，不含域名；昵称不代表已认证身份。
  article TEXT NOT NULL,
  nickname TEXT NOT NULL,
  body TEXT NOT NULL,
  -- 新留言默认待审核；approved 为公开，rejected 为隐藏，不是删除。
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
  -- 保存 UTC 时间，前端按读者本地时区显示。
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
-- 分别加速公开列表和审核队列的游标分页查询。
CREATE INDEX IF NOT EXISTS comments_article_status_id ON comments(article, status, id);
CREATE INDEX IF NOT EXISTS comments_status_id ON comments(status, id);

-- bucket 为盐值、时间窗口和 IP 的哈希，不存原始 IP。
-- expires_at 为 Unix 秒时间戳，过期行在后续新提交时清理。
CREATE TABLE IF NOT EXISTS comment_rate_limits (
  bucket TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS comment_rate_limits_expiry ON comment_rate_limits(expires_at);
