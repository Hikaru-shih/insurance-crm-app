CREATE TABLE users (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('user','admin')), active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL
);
CREATE TABLE sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at BIGINT NOT NULL
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

CREATE TABLE score_entries (
 owner_id TEXT NOT NULL REFERENCES users(id), id TEXT NOT NULL,
 date TEXT NOT NULL, code TEXT NOT NULL, label TEXT NOT NULL,
 points INTEGER NOT NULL CHECK(points >= 0), note TEXT NOT NULL,
 revoked INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(owner_id,id)
);

CREATE TABLE report_settings (id INTEGER PRIMARY KEY CHECK(id=1), period TEXT NOT NULL CHECK(period IN ('week','month')));
INSERT INTO report_settings VALUES(1,'week');

ALTER TABLE users ADD COLUMN name TEXT NOT NULL DEFAULT '';

ALTER TABLE users ADD COLUMN email_verified_at TEXT;
CREATE TABLE account_tokens (
 token_hash TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id),
 purpose TEXT NOT NULL CHECK(purpose IN ('verify','reset')),
 expires_at BIGINT NOT NULL,
 created_at BIGINT NOT NULL
);
CREATE INDEX account_tokens_user ON account_tokens(user_id,purpose);
