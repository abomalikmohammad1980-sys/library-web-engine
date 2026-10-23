// SQL is synchronous inside a DO event: no await between selecting and leasing.
// External I/O is handled by the service; only Cloudflare owns progress.
export const LEASE_MS = 180000
export class LocalQueueStore {
  constructor(sql) {
    this.sql = sql
    sql.exec(`CREATE TABLE IF NOT EXISTS local_jobs (
      id TEXT PRIMARY KEY, payload TEXT NOT NULL, state TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'local', token TEXT, lease_until INTEGER NOT NULL DEFAULT 0,
      available_at INTEGER NOT NULL, created_at INTEGER NOT NULL, completed_at INTEGER,
      attempts INTEGER NOT NULL DEFAULT 0, fallback_attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT NOT NULL DEFAULT '')`)
    sql.exec('CREATE INDEX IF NOT EXISTS local_jobs_ready ON local_jobs(state, available_at, lease_until)')
    sql.exec('CREATE TABLE IF NOT EXISTS local_presence (id INTEGER PRIMARY KEY, last_seen INTEGER NOT NULL)')
  }
  rows(query, ...args) { return this.sql.exec(query, ...args).toArray() }
  get(id) {
    const row = this.rows('SELECT * FROM local_jobs WHERE id = ?', id)[0]
    return row ? { ...row, ...JSON.parse(row.payload) } : null
  }
  enqueue(payload, now = Date.now()) {
    this.sql.exec(`INSERT OR IGNORE INTO local_jobs (id,payload,state,available_at,created_at)
      VALUES (?,?,'pending',?,?)`, payload.id, JSON.stringify(payload), now, now)
    return this.get(payload.id)
  }
  presence(now = Date.now()) {
    this.sql.exec('INSERT OR REPLACE INTO local_presence VALUES (1,?)', now)
  }
  online(now = Date.now()) {
    return now - (this.rows('SELECT last_seen FROM local_presence WHERE id=1')[0]?.last_seen || 0) < 45000
  }
  claim(now = Date.now(), target) {
    const row = this.rows(`SELECT id FROM local_jobs WHERE
      ((state='pending' AND available_at<=?) OR (state='processing' AND lease_until<=?))
      AND (? IS NULL OR json_extract(payload,'$.target')=?)
      ORDER BY created_at, id LIMIT 1`, now, now,target ?? null,target ?? null)[0]
    if (!row) return null
    this.sql.exec(`UPDATE local_jobs SET state='processing', token=?, lease_until=?, attempts=attempts+1
      WHERE id=?`, crypto.randomUUID(), now+LEASE_MS, row.id)
    return this.get(row.id)
  }
  requireLease(id, token, now = Date.now()) {
    const row = this.get(id)
    if (!row || row.state !== 'processing' || row.token !== token || row.lease_until <= now) throw Error('lease_lost')
    return row
  }
  renew(id, token, now = Date.now()) {
    this.requireLease(id, token, now)
    this.sql.exec('UPDATE local_jobs SET lease_until=? WHERE id=?', now+LEASE_MS, id)
    return { leaseUntil: now+LEASE_MS }
  }
  finish(id, token, now = Date.now()) {
    const row = this.get(id)
    if (row?.state === 'completed' && row.token === token) return { completed: true, duplicate: true }
    this.requireLease(id, token, now)
    this.sql.exec("UPDATE local_jobs SET state='completed',completed_at=?,lease_until=0 WHERE id=?", now, id)
    return { completed: true }
  }
  fallback(id, token, error, now = Date.now()) {
    this.requireLease(id, token, now)
    this.sql.exec("UPDATE local_jobs SET mode='fallback',last_error=? WHERE id=?", error.slice(0,120), id)
  }
  retryLater(id, token, now = Date.now()) {
    const row = this.requireLease(id, token, now)
    const count = row.fallback_attempts+1
    this.sql.exec(`UPDATE local_jobs SET state=?,token=NULL,lease_until=0,available_at=?,fallback_attempts=? WHERE id=?`,
      count>=4 ? 'failed' : 'pending', now + Math.min(3600000, 60000*2**count), count, id)
  }
  retryFailed(id, now = Date.now()) {
    this.sql.exec("UPDATE local_jobs SET state='pending',available_at=?,fallback_attempts=0 WHERE id=? AND state='failed'", now,id)
    return { state: this.get(id)?.state || 'not_found' }
  }
  status(now = Date.now()) {
    const result = { completed:0, pending:0, processing:0, failed:0, completedLastMinute:0 }
    for (const row of this.rows('SELECT state,COUNT(*) AS count FROM local_jobs GROUP BY state')) result[row.state] = row.count
    result.completedLastMinute = this.rows('SELECT COUNT(*) AS count FROM local_jobs WHERE completed_at>?',now-60000)[0].count
    result.total = result.completed+result.pending+result.processing+result.failed
    result.current = this.rows("SELECT id,payload,mode FROM local_jobs WHERE state='processing' LIMIT 10")
      .map(row=>({id:row.id,target:JSON.parse(row.payload).target,sourceType:JSON.parse(row.payload).sourceType,mode:row.mode}))
    result.failedItems = this.rows("SELECT id,payload,last_error FROM local_jobs WHERE state='failed' ORDER BY created_at LIMIT 20")
      .map(row=>({id:row.id,target:JSON.parse(row.payload).target,error:row.last_error}))
    return result
  }
}
