CREATE TABLE IF NOT EXISTS visitor_counter_meta (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  baseline_count INTEGER NOT NULL CHECK (baseline_count >= 0)
);

INSERT OR IGNORE INTO visitor_counter_meta (id, baseline_count) VALUES (1, 500);

CREATE TABLE IF NOT EXISTS unique_visitors (
  visitor_id TEXT PRIMARY KEY NOT NULL,
  first_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
