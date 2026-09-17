import {h} from './ui'
import {listAccountBooksPage} from './account_service'
import {currentAccountClaims} from './account_authority'
import {captureReadingIdentity} from './reading_identity_scope'
import {captureRouteResourceScope, routeEventListener} from './resource_lifecycle'
import {silentSkeleton} from './silent_skeleton'
import {icon} from './icons'
import type {AccountBookSubmission} from './account_service'

export function groupAccountBookFiles(books:AccountBookSubmission[]):AccountBookSubmission[][]{
 const groups=new Map<string,AccountBookSubmission[]>(),seen=new Set<string>()
 for(const book of books){if(seen.has(book.id))continue;seen.add(book.id);const key=JSON.stringify([book.title.normalize('NFC').trim(),book.author.normalize('NFC').trim()]);const group=groups.get(key)??[];group.push(book);groups.set(key,group)}
 return [...groups.values()]
}
function accountFileFormat(book:AccountBookSubmission):string{return book.mimeType.includes('pdf')?'PDF':book.mimeType.includes('word')?'Word':book.mimeType.includes('epub')?'EPUB':'ملف'}

/** Open server copies through authenticated, transient reader hydration. */
export function accountLibraryPanel(): HTMLElement {
  const scope = captureRouteResourceScope()
  const rows = h('div', {class: 'account-library-files', 'aria-live': 'polite'})
  const host = h('section', {class: 'me-private-library', 'aria-labelledby': 'account-library-title'},
    h('h2', {id: 'account-library-title'}, 'كتب حسابي'),
    h('p', null, 'تبقى كتبك خاصة حتى تقرر الإدارة إجازةَ نشرها للعامة'), rows)
  let generation = 0
  const displayedBooks=new Map<string,AccountBookSubmission>()
  const load = async (page = 0, append = false): Promise<void> => {
    if (scope.disposed) return
    const requestGeneration = ++generation
    const identity = captureReadingIdentity()
    const isCurrent = (): boolean => !scope.disposed && requestGeneration === generation && identity.isCurrent()
    if (!append) { displayedBooks.clear(); rows.replaceChildren(silentSkeleton('cards')) }
    if (!currentAccountClaims()) {
      rows.replaceChildren(h('a', {class: 'btn btn--primary', href: '#/account/sign-in'}, 'تسجيل الدخول'))
      return
    }
    const previousMore = rows.querySelector<HTMLButtonElement>('[data-account-books-more]')
    if (previousMore) previousMore.disabled = true
    try {
      const result = await listAccountBooksPage(page)
      if (!isCurrent()) return
      previousMore?.remove()
      rows.querySelector('[data-account-books-error]')?.remove()
      for(const book of result.books)displayedBooks.set(book.id,book)
      const entries = groupAccountBookFiles([...displayedBooks.values()]).map(files => {
        const book=files[0]!
        const state=(file:AccountBookSubmission)=>file.reviewStatus === 'pending' ? 'بانتظار المراجعة' : file.reviewStatus === 'rejected' ? 'مرفوض' : file.visibility === 'public' ? 'منشور' : 'خاص'
        const status=files.every(file=>state(file)===state(book))?state(book):'حالات مراجعة مختلفة'
        return h('article', {class: 'me-private-library__account-book',dataset:{accountBookId:book.id}},
          h('span',{class:'account-book-status',title:status,'aria-label':status},icon(book.reviewStatus==='pending'?'clock':book.reviewStatus==='rejected'?'close':book.visibility==='public'?'check':'lock',20),h('span',null,status)),
          h('div',{class:'account-book-identity'},h('a', {href: `#/reader/${encodeURIComponent(`account-book:${book.id}`)}`, dataset: {noTranslate: ''}}, book.title),h('small',{dataset:{noTranslate:''}},book.author)),
          h('div',{class:'account-book-formats'},...files.map(file=>h('a',{href:`/api/account/books/${encodeURIComponent(file.id)}/file`,class:'btn btn--secondary account-book-download',title:`${accountFileFormat(file)} — ${state(file)}`,'aria-label':`تنزيل ${accountFileFormat(file)} — ${state(file)}`},icon('download',18),h('span',null,accountFileFormat(file))))),
        )
      })
      rows.replaceChildren(...(entries.length ? entries : [h('p', null, 'لا توجد كتب محفوظة في الحساب بعد.')]))
      if (result.hasMore) rows.append(h('button', {type: 'button', class: 'btn btn--secondary', dataset: {accountBooksMore: ''}, onclick: () => { void load(page + 1, true) }}, 'تحميل كتب أقدم'))
    } catch {
      if (!isCurrent()) return
      const error = h('p', {role: 'status', dataset: {accountBooksError: ''}}, 'تعذّر تحميل كتب الحساب.')
      if (append) {
        rows.querySelector('[data-account-books-error]')?.remove()
        rows.append(error)
        if (previousMore) previousMore.disabled = false
      } else rows.replaceChildren(error, h('button', {type: 'button', class: 'btn btn--secondary', onclick: () => { void load() }}, 'إعادة المحاولة'))
    }
  }
  const refresh = (): void => { void load() }
  routeEventListener(window, 'alkhizana:account-changed', refresh, undefined, scope)
  routeEventListener(window, 'library-changed', refresh, undefined, scope)
  refresh()
  return host
}
