CREATE TABLE IF NOT EXISTS editorial_recommendations (
 id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL DEFAULT 0,
 entries TEXT NOT NULL DEFAULT '[]', updated_by TEXT, updated_at TEXT
);
INSERT OR IGNORE INTO editorial_recommendations(id) VALUES(1);
