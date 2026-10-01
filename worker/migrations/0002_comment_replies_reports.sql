-- 增量升级：旧评论保持顶层留言，历史审核状态保持不变。
ALTER TABLE comments ADD COLUMN parent_id INTEGER REFERENCES comments(id);
CREATE INDEX comments_parent_id ON comments(parent_id);
-- 仅保存举报类别及短期加盐标识，不保存举报者原始 IP。
CREATE TABLE comment_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  comment_id INTEGER NOT NULL REFERENCES comments(id),
  reporter_bucket TEXT NOT NULL,
  reason TEXT NOT NULL CHECK(reason IN ('spam', 'abuse', 'privacy', 'other')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'resolved')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(comment_id, reporter_bucket)
);
CREATE INDEX comment_reports_status_comment ON comment_reports(status, comment_id);
