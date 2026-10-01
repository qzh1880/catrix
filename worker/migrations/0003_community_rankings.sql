-- 点赞按匿名浏览器标识去重；只保存加盐摘要，不保存原始标识或 IP。
CREATE TABLE community_likes (
  kind TEXT NOT NULL CHECK(kind IN ('comment','feedback')),
  target_id INTEGER NOT NULL,
  voter TEXT NOT NULL,
  PRIMARY KEY(kind,target_id,voter)
);
CREATE INDEX community_likes_target ON community_likes(kind,target_id);
CREATE TABLE feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL UNIQUE,
  nickname TEXT NOT NULL,
  body TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE ranked_sessions (
  id TEXT PRIMARY KEY,
  player TEXT NOT NULL,
  seed INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE ranked_scores (
  session_id TEXT PRIMARY KEY REFERENCES ranked_sessions(id),
  player TEXT NOT NULL,
  nickname TEXT NOT NULL,
  score INTEGER NOT NULL,
  lines INTEGER NOT NULL,
  finished_at INTEGER NOT NULL
);
CREATE INDEX ranked_scores_period ON ranked_scores(finished_at,score);
CREATE INDEX ranked_scores_player ON ranked_scores(player,score);
