-- 文章使用规范路径作为标识，避免与评论数字 ID 混用。
CREATE TABLE article_likes(article TEXT NOT NULL,voter TEXT NOT NULL,PRIMARY KEY(article,voter));
-- 棋盘只保存在后端，version 用于防止并发点击覆盖进度。
CREATE TABLE mines_sessions(id TEXT PRIMARY KEY,player TEXT NOT NULL,level TEXT NOT NULL,board TEXT NOT NULL,started_at INTEGER NOT NULL,finished_at INTEGER,version INTEGER NOT NULL DEFAULT 0);
CREATE INDEX mines_expiry ON mines_sessions(started_at);
CREATE TABLE mines_scores(session_id TEXT PRIMARY KEY,player TEXT NOT NULL,level TEXT NOT NULL,nickname TEXT NOT NULL,elapsed_ms INTEGER NOT NULL,finished_at INTEGER NOT NULL);
CREATE INDEX mines_rank ON mines_scores(level,elapsed_ms,finished_at);
