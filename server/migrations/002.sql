CREATE TABLE score_entries (
 owner_id TEXT NOT NULL REFERENCES users(id), id TEXT NOT NULL,
 date TEXT NOT NULL, code TEXT NOT NULL, label TEXT NOT NULL,
 points INTEGER NOT NULL CHECK(points >= 0), note TEXT NOT NULL,
 revoked INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(owner_id,id)
);
