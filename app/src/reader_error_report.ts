import {uiTemplateText} from './ui_template_binding'
import { h } from './ui'

export interface ReaderErrorReportPayload {
  bookTitle: string
  bookId: string
  errorCode: string
  route: string
  appVersion: string
  deviceClass: 'mobile' | 'tablet' | 'desktop'
  userAgent: string
  timestamp: string
  retryState: 'before-retry' | 'after-retry'
}

export interface AnonymousConversationReceipt {
  conversationId: string
  bearerSecret: string
  pollUrl: string
  telegramLinkToken?: { token: string; expiresAt: string; deepLink: string }
}

export interface ReaderErrorReportClient {
  submit(payload: ReaderErrorReportPayload): Promise<AnonymousConversationReceipt>
  poll(receipt:AnonymousConversationReceipt):Promise<{conversationId:string;replies:Array<{text:string;createdAt?:string}>;updatedAt:string}>
}

const OUTBOX_KEY = 'alkhizana.reader-error-reports.v1'
const RESUME_KEY = 'alkhizana.reader-error-conversations.v1'

export function safeReaderErrorPayload(input: {
  bookTitle: string; bookId: string; errorCode: string; route?: string; retryState?: ReaderErrorReportPayload['retryState']
}, environment: { userAgent?: string; width?: number; appVersion?: string; now?: Date } = {}): ReaderErrorReportPayload {
  const width = environment.width ?? (typeof innerWidth === 'number' ? innerWidth : 1024)
  return {
    bookTitle: input.bookTitle.slice(0, 240),
    bookId: input.bookId.slice(0, 160),
    errorCode: input.errorCode.slice(0, 80),
    route: (input.route ?? (typeof location === 'undefined' ? '' : `${location.pathname}${location.search}`)).slice(0, 500),
    appVersion: (environment.appVersion ?? (import.meta.env.VITE_APP_VERSION || 'dev')).slice(0, 80),
    deviceClass: width <= 600 ? 'mobile' : width <= 1024 ? 'tablet' : 'desktop',
    userAgent: (environment.userAgent ?? (typeof navigator === 'undefined' ? '' : navigator.userAgent)).slice(0, 500),
    timestamp: (environment.now ?? new Date()).toISOString(),
    retryState: input.retryState ?? 'before-retry',
  }
}

export function createReaderErrorReportClient(fetcher: typeof fetch = fetch): ReaderErrorReportClient {
  return { async submit(payload) {
    const response = await fetcher('/api/error-reports', {
      method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(payload),
    })
    if (response.status === 404 || response.status === 501) throw new Error('report_service_unconfigured')
    if (!response.ok) throw new Error(`report_service_${response.status}`)
    return await response.json() as AnonymousConversationReceipt
  },async poll(receipt){
    if (!validConversationReceipt(receipt)) throw new Error('report_poll_receipt_invalid')
    const response=await fetcher(receipt.pollUrl,{method:'GET',credentials:'same-origin',cache:'no-store',headers:{authorization:`Bearer ${receipt.bearerSecret}`}})
    if(!response.ok)throw new Error(`report_poll_${response.status}`)
    const value=await response.json() as {conversationId?:unknown;replies?:unknown;updatedAt?:unknown}
    if(value.conversationId!==receipt.conversationId||!Array.isArray(value.replies)||typeof value.updatedAt!=='string')throw new Error('report_poll_invalid')
    const replies=value.replies.filter((item):item is {text:string;createdAt?:string}=>Boolean(item)&&typeof item==='object'&&typeof (item as {text?:unknown}).text==='string').map(item=>({text:item.text.slice(0,4000),...(typeof item.createdAt==='string'?{createdAt:item.createdAt}:{})}))
    return{conversationId:receipt.conversationId,replies,updatedAt:value.updatedAt}
  } }
}

function readJson<T>(storage: Storage, key: string): T[] {
  try { const parsed = JSON.parse(storage.getItem(key) ?? '[]'); return Array.isArray(parsed) ? parsed : [] } catch { return [] }
}

function validConversationReceipt(value: unknown): value is AnonymousConversationReceipt {
  if (!value || typeof value !== 'object') return false
  const receipt = value as Partial<AnonymousConversationReceipt>
  if (typeof receipt.conversationId !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/u.test(receipt.conversationId)) return false
  if (typeof receipt.bearerSecret !== 'string' || receipt.bearerSecret.length < 1 || receipt.bearerSecret.length > 512) return false
  return receipt.pollUrl === `/api/report-conversations/${encodeURIComponent(receipt.conversationId)}`
}

/** Receipts are session-only capabilities. Invalid or foreign URLs are never resumed. */
export function resumableReaderErrorConversations(storage: Storage): AnonymousConversationReceipt[] {
  return readJson<unknown>(storage, RESUME_KEY).filter(validConversationReceipt)
}

export function queueReaderErrorReport(storage: Storage, payload: ReaderErrorReportPayload): void {
  const pending = readJson<ReaderErrorReportPayload>(storage, OUTBOX_KEY)
  storage.setItem(OUTBOX_KEY, JSON.stringify([...pending.slice(-19), payload]))
}

export function pendingReaderErrorReports(storage: Storage): ReaderErrorReportPayload[] {
  return readJson<ReaderErrorReportPayload>(storage, OUTBOX_KEY)
}

function saveConversation(storage: Storage, receipt: AnonymousConversationReceipt): void {
  if (!validConversationReceipt(receipt)) return
  const conversations = resumableReaderErrorConversations(storage).filter(item => item.conversationId !== receipt.conversationId)
  storage.setItem(RESUME_KEY, JSON.stringify([...conversations.slice(-9), receipt]))
}

export function createReaderErrorReportButton(context: { bookTitle: string; bookId: string; errorCode: string }): HTMLButtonElement {
  const button = h('button', { class: 'btn reader-error-report__trigger', type: 'button' }, 'أعلمنا بالخطأ') as HTMLButtonElement
  button.addEventListener('click', () => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : button
    const overlay = h('div', { class: 'reader-error-report__overlay' })
    const dialog = h('section', { class: 'reader-error-report__dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'reader-error-report-title' })
    const title = h('h2', { id: 'reader-error-report-title' }, 'إبلاغ الخزانة بهذا الخطأ')
    const consent = h('input', { type: 'checkbox', id: 'reader-error-report-consent' }) as HTMLInputElement
    const status = h('p', { class: 'reader-error-report__status', role: 'status', 'aria-live': 'polite' }, 'لن نرسل نص الكتاب ولا ملاحظاتك ولا ملفك الأصلي.')
    const diagnostics = h('textarea', { class: 'reader-error-report__diagnostics', 'aria-label': 'بيانات التشخيص التي ستُرسل', readonly: true }) as HTMLTextAreaElement
    diagnostics.value = `${context.bookTitle}\n${context.bookId}\n${context.errorCode}`
    const close = h('button', { class: 'btn btn--secondary', type: 'button' }, 'إلغاء') as HTMLButtonElement
    const submit = h('button', { class: 'btn reader-error-report__submit', type: 'button', disabled: true }, 'إرسال البلاغ') as HTMLButtonElement
    let conversationPanel: HTMLElement | undefined
    const mountConversation = (receipt: AnonymousConversationReceipt): void => {
      conversationPanel?.remove()
      const replies = h('div', { class: 'reader-error-report__replies', 'aria-live': 'polite' })
      const retry = h('button', { class: 'btn btn--secondary', type: 'button' }, 'تحديث الردود') as HTMLButtonElement
      const poll = async (): Promise<void> => {
        retry.disabled = true; status.textContent = 'جارٍ التحقق من الرد…'
        try {
          const result = await createReaderErrorReportClient().poll(receipt)
          replies.replaceChildren(...result.replies.map(reply => h('p', { class: 'reader-error-report__reply', dataset:{noTranslate:''} }, reply.text)))
          status.textContent = result.replies.length ? 'وصل رد من فريق الخزانة.' : 'لا يوجد رد جديد بعد.'
          retry.textContent = 'تحديث الردود'
        } catch { status.textContent = 'تعذّر تحديث الردود الآن.'; retry.textContent = 'إعادة المحاولة' }
        finally { retry.disabled = false }
      }
      retry.addEventListener('click', () => { void poll() })
      conversationPanel = h('section', { class: 'reader-error-report__conversation', 'aria-label': 'متابعة البلاغ' }, h('h3', null, 'متابعة البلاغ'), replies, retry)
      dialog.append(conversationPanel)
      void poll()
    }
    consent.addEventListener('change', () => { submit.disabled = !consent.checked })
    const dismiss = (): void => { overlay.remove(); previousFocus.focus() }
    close.addEventListener('click', dismiss)
    overlay.addEventListener('click', event => { if (event.target === overlay) dismiss() })
    overlay.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); dismiss(); return }
      if (event.key !== 'Tab') return
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),a[href]'))
      if (!focusable.length) return
      const first = focusable[0]!, last = focusable.at(-1)!
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    })
    submit.addEventListener('click', async () => {
      submit.disabled = true
      const payload = safeReaderErrorPayload(context)
      try {
        const receipt = await createReaderErrorReportClient().submit(payload)
        saveConversation(sessionStorage, receipt)
        status.textContent = 'وصل البلاغ. يمكنك متابعة الرد هنا.'
        mountConversation(receipt)
        if (receipt.telegramLinkToken) {
          const telegram = h('a', { class: 'btn btn--secondary', href: receipt.telegramLinkToken.deepLink, rel: 'noopener noreferrer' }, 'استلام الرد في تيليجرام')
          dialog.appendChild(telegram)
        }
      } catch (error) {
        queueReaderErrorReport(localStorage, payload)
        status.textContent = error instanceof Error && error.message === 'report_service_unconfigured'
          ? 'خدمة البلاغات غير مهيأة بعد؛ حُفظ البلاغ محليًا لإرساله عند تفعيلها.'
          : 'تعذّر الإرسال الآن؛ حُفظ البلاغ محليًا وستتاح إعادة المحاولة.'
      }
    })
    const consentLabel = h('label', { class: 'reader-error-report__consent' }, consent, ' أوافق على إرسال بيانات التشخيص المذكورة فقط.') as HTMLLabelElement
    consentLabel.htmlFor = 'reader-error-report-consent'
    dialog.append(title, h('p', null, uiTemplateText('0503cd497038226f',{p1:context.bookTitle})), status, diagnostics,
      consentLabel,
      h('div', { class: 'reader-error-report__dialog-actions' }, submit, close))
    const resumed = resumableReaderErrorConversations(sessionStorage).at(-1)
    if (resumed) mountConversation(resumed)
    overlay.appendChild(dialog); document.body.appendChild(overlay); title.tabIndex = -1; title.focus()
  })
  return button
}
