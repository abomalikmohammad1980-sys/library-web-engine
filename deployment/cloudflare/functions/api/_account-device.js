const COOKIE = '__Host-khizana-device'
const clean = (value, max) => String(value ?? '').trim().slice(0, max)
function tokenFrom(request) {
  const value = (request.headers.get('cookie') || '').split(';').map(x => x.trim()).find(x => x.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1)
  return /^[a-f0-9]{64}$/.test(value || '') ? value : null
}
async function deviceKey(token) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))].map(x => x.toString(16).padStart(2, '0')).join('')
}
// Presentation metadata only; authorization still requires verifyRegisteredDevice.
export async function requestAccountDeviceId(request) {
  const token = tokenFrom(request)
  return token ? deviceKey(token) : null
}
export async function verifyRegisteredDevice(context, subject) {
  const token = tokenFrom(context.request)
  if (!token) return false
  const row = await context.env.VISITORS_DB.prepare('SELECT device_id FROM account_devices WHERE owner_subject=?1 AND device_id=?2 AND revoked_at IS NULL').bind(subject, await deviceKey(token)).first()
  return Boolean(row)
}
export async function registerDevice(context, subject, input = {}) {
  const token = tokenFrom(context.request) || [...crypto.getRandomValues(new Uint8Array(32))].map(x => x.toString(16).padStart(2, '0')).join('')
  const deviceId = await deviceKey(token), label = clean(input.label, 120) || 'هذا الجهاز', platform = clean(input.platform, 40) || 'web'
  const db = context.env.VISITORS_DB
  const old = await db.prepare('SELECT revoked_at AS revokedAt FROM account_devices WHERE owner_subject=?1 AND device_id=?2').bind(subject, deviceId).first()
  if (old?.revokedAt) return {error: 'device_revoked'}
  const result = await db.prepare('INSERT INTO account_devices(owner_subject,device_id,label,platform) SELECT ?1,?2,?3,?4 WHERE EXISTS(SELECT 1 FROM account_devices WHERE owner_subject=?1 AND device_id=?2 AND revoked_at IS NULL) OR (SELECT COUNT(*) FROM account_devices WHERE owner_subject=?1 AND revoked_at IS NULL)<3 ON CONFLICT(owner_subject,device_id) DO UPDATE SET label=excluded.label,platform=excluded.platform,last_seen_at=CURRENT_TIMESTAMP WHERE account_devices.revoked_at IS NULL').bind(subject, deviceId, label, platform).run()
  if (Number(result.meta?.changes ?? 0) !== 1) {
    await db.prepare('INSERT INTO account_device_limit_events(owner_subject) VALUES(?1)').bind(subject).run()
    return {error: 'device_limit_reached'}
  }
  const now = new Date().toISOString()
  return {device: {deviceId, label, platform, createdAt: now, lastSeenAt: now, revokedAt: null}, cookie: `${COOKIE}=${token}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=31536000`}
}
