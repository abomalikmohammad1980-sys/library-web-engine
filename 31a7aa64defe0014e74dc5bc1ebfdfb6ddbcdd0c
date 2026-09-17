ALTER TABLE source_quarantines ADD COLUMN resolution_operation_id TEXT;
ALTER TABLE source_quarantines ADD COLUMN resolution_lease_id TEXT;
ALTER TABLE source_quarantines ADD COLUMN resolution_lease_until_ms INTEGER;
CREATE UNIQUE INDEX quarantine_resolution_operation ON source_quarantines(resolution_operation_id) WHERE resolution_operation_id IS NOT NULL;
