CREATE TABLE users (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('user','admin')), active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL
);
CREATE TABLE sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE workspaces (
 owner_id TEXT PRIMARY KEY REFERENCES users(id), revision INTEGER NOT NULL DEFAULT 0,
 data TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE grants (
 owner_id TEXT NOT NULL REFERENCES users(id), viewer_id TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL, PRIMARY KEY(owner_id, viewer_id), CHECK(owner_id <> viewer_id)
);
CREATE TABLE audit_log (
 id TEXT PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES users(id), action TEXT NOT NULL,
 target_id TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE kpi_rules (code TEXT PRIMARY KEY, label TEXT NOT NULL, points INTEGER NOT NULL CHECK(points >= 0));
INSERT INTO kpi_rules VALUES ('contact','聯繫',1),('touch','接觸',5),('activity','活動',5),('visit','看店',8),('interview','深度面談',10),('card','上卡',40);
