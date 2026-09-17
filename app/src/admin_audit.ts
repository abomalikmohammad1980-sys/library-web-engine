import type { AccountClaims } from './account_authority'

const KEY = 'alkhizana:admin-audit:v1'
const LIMIT = 1000

export interface AdminAuditEvent {
  id: string
  at: string
  actorSubject: string
  actorRole: 'admin' | 'super-admin'
  action: 'published-book-updated' | 'published-book-logically-deleted' | 'published-book-restored' | 'submission-published' | 'submission-kept-private' | 'submission-rejected'
  bookId: string
  fields: string[]
}

export function appendSubmissionReviewAuditEvent(claims: AccountClaims, bookId: string, decision: 'publish' | 'private' | 'reject', now = new Date()): AdminAuditEvent {
  if (claims.role !== 'admin' && claims.role !== 'super-admin') throw new Error('لا يمكن تسجيل مراجعة دون صلاحية موثقة')
  const action = decision === 'publish' ? 'submission-published' : decision === 'private' ? 'submission-kept-private' : 'submission-rejected'
  const event: AdminAuditEvent = { id: crypto.randomUUID(), at: now.toISOString(), actorSubject: claims.subject, actorRole: claims.role, action, bookId, fields: ['visibility', 'reviewStatus'] }
  persistAuditEvent(event)
  return event
}

export function appendAdminAuditEvent(claims: AccountClaims, bookId: string, fields: string[], now = new Date()): AdminAuditEvent {
  if (claims.role !== 'super-admin') throw new Error('لا يمكن تسجيل حدث إداري دون صلاحية المدير العام')
  const action = fields.includes('logicallyDeleted:true') ? 'published-book-logically-deleted'
    : fields.includes('logicallyDeleted:false') ? 'published-book-restored' : 'published-book-updated'
  // يكفي التدقيق معرفة الحقول المتغيرة؛ لا نخزن عنوانًا/وصفًا أو قيمة شخصية خامًا.
  const changedFields = [...new Set(fields.map(field => field.split(':', 1)[0]?.trim() ?? '').filter(field => /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(field)))].slice(0, 32)
  const event: AdminAuditEvent = { id: crypto.randomUUID(), at: now.toISOString(), actorSubject: claims.subject, actorRole: 'super-admin', action, bookId, fields: changedFields }
  persistAuditEvent(event)
  return event
}

function persistAuditEvent(event: AdminAuditEvent): void {
  if (typeof localStorage === 'undefined') return
  const current = listAdminAuditEvents()
  localStorage.setItem(KEY, JSON.stringify([...current, event].slice(-LIMIT)))
}

export function listAdminAuditEvents(): AdminAuditEvent[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(value) ? value.filter(isAdminAuditEvent).map(item => ({ ...item, fields: [...item.fields] })) : []
  } catch { return [] }
}

function isAdminAuditEvent(item: unknown): item is AdminAuditEvent {
  if (!item || typeof item !== 'object') return false
  const event = item as Partial<AdminAuditEvent>
  return typeof event.id === 'string' && event.id.length > 0
    && typeof event.at === 'string' && Number.isFinite(Date.parse(event.at))
    && typeof event.actorSubject === 'string' && event.actorSubject.length > 0
    && (event.actorRole === 'admin' || event.actorRole === 'super-admin')
    && (event.action === 'published-book-updated' || event.action === 'published-book-logically-deleted' || event.action === 'published-book-restored' || event.action === 'submission-published' || event.action === 'submission-kept-private' || event.action === 'submission-rejected')
    && ((event.action.startsWith('published-book-') && event.actorRole === 'super-admin') || event.action.startsWith('submission-'))
    && typeof event.bookId === 'string' && event.bookId.length > 0
    && Array.isArray(event.fields) && event.fields.length <= 32
    && event.fields.every(field => typeof field === 'string' && /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(field))
}

export function exportAdminAuditJson(): string {
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), events: listAdminAuditEvents() }, null, 2)
}
