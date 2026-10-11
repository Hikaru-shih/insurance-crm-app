ALTER TABLE users ADD COLUMN email_verified_at TEXT;
CREATE TABLE account_tokens (
 token_hash TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id),
 purpose TEXT NOT NULL CHECK(purpose IN ('verify','reset')),
 expires_at INTEGER NOT NULL,
 created_at INTEGER NOT NULL
);
CREATE INDEX account_tokens_user ON account_tokens(user_id,purpose);
