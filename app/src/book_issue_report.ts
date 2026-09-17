import {uiTemplateText,uiTemplateAttribute} from './ui_template_binding'
import { currentAccountClaims, type AccountClaims } from './account_authority'
import { h, toast } from './ui'

export const BOOK_ISSUE_DAILY_LIMIT = 5
const USAGE_KEY = 'alkhizana.book-issue-report-usage.v1'
const OUTBOX_KEY = 'alkhizana.book-issue-report-outbox.v1'
const ADMIN_QUEUE_KEY = 'alkhizana.book-issue-report-admin-queue.v1'

export type BookIssueKind = 'title' | 'author' | 'category' | 'file' | 'other' | 'comment' | 'correction'

export interface BookIssueReportPayload {
  contract: 'alkhizana-book-issue-report/1'
  reporterSubject: string
  bookId: string
  bookTitle: string
  kind: BookIssueKind
  message: string
  route: string
  timestamp: string
  context?: { part?:number; page?:number; pageIndex?:number; paragraphIndex?:number; selectedText?:string }
}

interface DailyUsage { subject: string; day: string; count: number }
export interface LocalBookIssueAdminRecord {
  contract: 'alkhizana-book-issue-admin-queue/1'
  reportId: string
  status: 'pending'
  receivedAt: string
  fingerprint: string
  payload: BookIssueReportPayload
}

function readArray<T>(storage: Storage, key: string): T[] {
  try { const value = JSON.parse(storage.getItem(key) ?? '[]'); return Array.isArray(value) ? value : [] } catch { return [] }
}

function utcDay(now: Date): string { return now.toISOString().slice(0, 10) }

export function remainingBookIssueReports(storage: Storage, subject: string, now = new Date()): number {
  const day = utcDay(now)
  const used = readArray<DailyUsage>(storage, USAGE_KEY).find(item => item.subject === subject && item.day === day)?.count ?? 0
  return Math.max(0, BOOK_ISSUE_DAILY_LIMIT - used)
}

export function reserveBookIssueReport(storage: Storage, claims: AccountClaims | null, now = new Date()): number {
  if (!claims?.subject) throw new Error('book_issue_sign_in_required')
  const day = utcDay(now)
  const entries = readArray<DailyUsage>(storage, USAGE_KEY).filter(item => item.day === day && item.subject)
  const match = entries.find(item => item.subject === claims.subject)
  if ((match?.count ?? 0) >= BOOK_ISSUE_DAILY_LIMIT) throw new Error('book_issue_daily_limit')
  if (match) match.count += 1
  else entries.push({ subject: claims.subject, day, count: 1 })
  storage.setItem(USAGE_KEY, JSON.stringify(entries))
  return BOOK_ISSUE_DAILY_LIMIT - (match?.count ?? 1)
}

export function queueBookIssueReport(storage: Storage, payload: BookIssueReportPayload): void {
  const queued = readArray<BookIssueReportPayload>(storage, OUTBOX_KEY)
  storage.setItem(OUTBOX_KEY, JSON.stringify([...queued.slice(-49), payload]))
}

export function pendingBookIssueReports(storage: Storage): BookIssueReportPayload[] {
  return readArray<BookIssueReportPayload>(storage, OUTBOX_KEY)
}

function normalizedIssueMessage(value: string): string {
  return value.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('ar')
}

function issueFingerprint(payload: BookIssueReportPayload): string {
  return [payload.reporterSubject, payload.bookId, payload.kind, payload.context?.part??'', payload.context?.page??'', normalizedIssueMessage(payload.context?.selectedText??''), normalizedIssueMessage(payload.message)].join('\u001f')
}

function shortStableHash(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index); hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function validateLocalIssueReport(claims: AccountClaims | null, payload: BookIssueReportPayload): void {
  if (!claims?.subject) throw new Error('book_issue_sign_in_required')
  if (payload.contract !== 'alkhizana-book-issue-report/1' || payload.reporterSubject !== claims.subject)
    throw new Error('book_issue_reporter_mismatch')
  if (!['title', 'author', 'category', 'file', 'other', 'comment', 'correction'].includes(payload.kind)
      || !payload.bookId.trim() || payload.bookId.length > 160 || payload.bookTitle.length > 240)
    throw new Error('book_issue_invalid_payload')
  const message = normalizedIssueMessage(payload.message)
  if (message.length < 8 || message.length > 1200) throw new Error('book_issue_invalid_message')
  const context=payload.context
  if(context){
    if((context.part!==undefined&&(!Number.isInteger(context.part)||context.part<1||context.part>10_000))||(context.page!==undefined&&(!Number.isInteger(context.page)||context.page<1||context.page>100_000))||normalizedIssueMessage(context.selectedText??'').length>500)throw new Error('book_issue_invalid_context')
  }
}

/** طابور محلي موثق للإدارة: مصادقة، حد يومي، ومنع إعادة البلاغ نفسه. */
export function enqueueBookIssueReportForAdministration(
  storage: Storage, claims: AccountClaims | null, payload: BookIssueReportPayload, now = new Date(),
): LocalBookIssueAdminRecord {
  validateLocalIssueReport(claims, payload)
  const fingerprint = issueFingerprint(payload)
  const queue = readArray<LocalBookIssueAdminRecord>(storage, ADMIN_QUEUE_KEY)
  if (queue.some(record => record.fingerprint === fingerprint)) throw new Error('book_issue_duplicate')
  reserveBookIssueReport(storage, claims, now)
  const receivedAt = now.toISOString()
  const record: LocalBookIssueAdminRecord = {
    contract: 'alkhizana-book-issue-admin-queue/1', reportId: `local-${shortStableHash(`${fingerprint}\u001f${receivedAt}`)}`,
    status: 'pending', receivedAt, fingerprint, payload: { ...payload, timestamp: receivedAt },
  }
  storage.setItem(ADMIN_QUEUE_KEY, JSON.stringify([...queue.slice(-199), record]))
  queueBookIssueReport(storage, record.payload)
  return record
}

export function pendingAdministrativeBookIssueReports(storage: Storage): LocalBookIssueAdminRecord[] {
  return readArray<LocalBookIssueAdminRecord>(storage, ADMIN_QUEUE_KEY)
}

export async function submitBookIssueReport(
  payload: BookIssueReportPayload, fetcher: typeof fetch = fetch, claims: AccountClaims | null = currentAccountClaims(),
): Promise<void> {
  validateLocalIssueReport(claims, payload)
  const response = await fetcher('/api/account/book-reports', {
    method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json', 'x-alkhizana-request':'account-ui' }, body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error(response.status === 404 || response.status === 501 ? 'report_service_unconfigured' : `report_service_${response.status}`)
  const receipt=await response.json()
  if(receipt?.ok!==true||typeof receipt.id!=='string'||!receipt.id)throw Error('report_receipt_invalid')
}

export type BookIssueContextProvider=()=>BookIssueReportPayload['context']
export function createBookIssueReportButton(book: { id: string; title: string },contextProvider?:BookIssueContextProvider): HTMLButtonElement {
  const button = h('button', { class: 'btn btn--secondary book-issue-report__trigger', type: 'button', title: 'إبلاغ الخزانة عن خطأ في بيانات الكتاب', 'aria-label': '' }, 'إشارة خطأ') as HTMLButtonElement
  uiTemplateAttribute(button,'aria-label','8e79e68b48d2aa41',{p1:book.title})
  button.addEventListener('click', event => {
    event.preventDefault(); event.stopPropagation()
    const claims = currentAccountClaims()
    if (!claims) { toast('يلزم تسجيل الدخول لإرسال إشارة خطأ'); routeLocation.hash = '#/account/sign-in'; return }
    const remaining = remainingBookIssueReports(localStorage, claims.subject)
    if (!remaining) { toast('بلغت الحد اليومي: خمس رسائل'); return }

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : button
    const overlay = h('div', { class: 'reader-error-report__overlay book-issue-report__overlay' })
    const dialog = h('form', { class: 'reader-error-report__dialog book-issue-report__dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'book-issue-report-title' }) as HTMLFormElement
    const title = h('h2', { id: 'book-issue-report-title' }, 'إشارة خطأ في الكتاب')
    const kind = h('select', { class: 'book-issue-report__kind', 'aria-label': 'نوع الخطأ' },
      h('option', { value: 'title' }, 'خطأ في العنوان'), h('option', { value: 'author' }, 'خطأ في المؤلف'),
      h('option', { value: 'category' }, 'خطأ في التصنيف'), h('option', { value: 'file' }, 'خلل في الملف أو العرض'),
      h('option', { value: 'comment' }, 'تعليق عام على الكتاب'), h('option', { value: 'correction' }, 'تصحيح النص المحدد'), h('option', { value: 'other' }, 'أمر آخر'),
    ) as HTMLSelectElement
    const message = h('textarea', { class: 'book-issue-report__message', placeholder: 'اشرح الخلل باختصار…', 'aria-label': 'وصف الخطأ' }) as HTMLTextAreaElement
    const context=contextProvider?.(),safeContext=context?{...(context.part!==undefined?{part:context.part}:{}),...(context.page!==undefined?{page:context.page}:{}),...(context.pageIndex!==undefined?{pageIndex:context.pageIndex}:{}),...(context.paragraphIndex!==undefined?{paragraphIndex:context.paragraphIndex}:{}),...(context.selectedText?.trim()?{selectedText:context.selectedText.trim().slice(0,500)}:{})}:undefined
    message.rows = 5; message.maxLength = 1200; message.required = true
    const status = h('p', { class: 'reader-error-report__status', role: 'status', 'aria-live': 'polite' }, uiTemplateText('9b2c0fa319736d59',{p1:remaining,p2:BOOK_ISSUE_DAILY_LIMIT}))
    const cancel = h('button', { class: 'btn btn--secondary', type: 'button' }, 'إلغاء') as HTMLButtonElement
    const submit = h('button', { class: 'btn reader-error-report__submit', type: 'submit' }, 'إرسال البلاغ') as HTMLButtonElement
    const dismiss = (): void => { overlay.remove(); previousFocus.focus() }
    cancel.addEventListener('click', dismiss)
    overlay.addEventListener('click', ev => { if (ev.target === overlay) dismiss() })
    dialog.addEventListener('submit', async ev => {
      ev.preventDefault()
      const description = message.value.trim()
      if (!description) { message.reportValidity(); return }
      submit.disabled = true
      const payload: BookIssueReportPayload = {
        contract: 'alkhizana-book-issue-report/1', reporterSubject: claims.subject, bookId: book.id.slice(0, 160),
        bookTitle: book.title.slice(0, 240), kind: kind.value as BookIssueKind, message: description.slice(0, 1200),
        route: `${location.pathname}${location.search}`.slice(0, 500), timestamp: new Date().toISOString(), ...(safeContext&&Object.keys(safeContext).length?{context:safeContext}:{}),
      }
      try {
        await submitBookIssueReport(payload)
        try { reserveBookIssueReport(localStorage, claims) } catch { /* Server receipt is authoritative even if storage is full. */ }
        toast('وصل البلاغ إلى إدارة الخزانة')
        dismiss()
      } catch (error) {
        status.textContent = error instanceof Error&&error.message==='report_service_409'?'هذا البلاغ مكرر أو بلغت الحد اليومي.':'لم يصل البلاغ إلى الإدارة. بقي النص هنا؛ أعد المحاولة عند توفر الاتصال.'
        submit.disabled=false
      }
    })
    dialog.append(title, h('p', null, 'الكتاب: ', h('span', { dataset: { noTranslate: 'true' } }, book.title)), ...(safeContext?[h('p',{class:'book-issue-report__context'},'الموضع المرفق: ',...(safeContext.part?[uiTemplateText('87d061d51b726e3b',{p1:safeContext.part}),' · ']:[]),safeContext.page?uiTemplateText('e95fdd861149fc31',{p1:safeContext.page}):'بلا صفحة',...(safeContext.selectedText?[' · ','مع النص المحدد']:[]))]:[]), h('label', { class: 'book-issue-report__field' }, h('span', null, 'موضع الخلل'), kind), h('label', { class: 'book-issue-report__field' }, h('span', null, 'وصف الخلل'), message), status, h('div', { class: 'reader-error-report__dialog-actions' }, submit, cancel))
    dialog.insertBefore(h('p',null,'ستصل هذه الملاحظة إلى إدارة الخزانة لمراجعتها وتصحيح الكتاب؛ ليست ملاحظة شخصية أو اقتباسًا منشورًا.'),title.nextSibling)
    if(safeContext?.selectedText)dialog.insertBefore(h('blockquote',{dataset:{noTranslate:''}},safeContext.selectedText),message.parentElement)
    overlay.append(dialog); document.body.append(overlay); message.focus()
  })
  return button
}

import {routeLocation} from "./path_location"
