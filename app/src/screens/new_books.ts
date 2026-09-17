import { pageContent } from '../components'
import {listDiscoveryBooks} from '../discovery_books'
import type {HomeCardDisplay} from './home'
import {captureReadingIdentity} from '../reading_identity_scope'
import { routeObserver, captureRouteResourceScope } from '../resource_lifecycle'
import { collectionStateKind, stateView } from '../state_view'
import { h } from '../ui'
import { homeNewCard } from './home'
import { compareBooksByMetric } from '../book_ordering'
import { silentSkeleton } from '../silent_skeleton'
import { publicPageHero } from '../public_page_hero'
import {uiTemplateText,uiDateParameter} from '../ui_template_binding'

const PAGE_SIZE = 40

export interface NewBookDayGroup { key: string; date: Date; books: HomeCardDisplay[] }

export function groupBooksByAddedDay(books: HomeCardDisplay[]): NewBookDayGroup[] {
  const groups = new Map<string, NewBookDayGroup>()
  for (const book of [...books].sort(compareBooksByMetric(book => book.addedAt))) {
    const date = new Date(book.addedAt)
    if (Number.isNaN(date.getTime())) continue
    const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
    const group = groups.get(key) ?? { key, date, books: [] }
    group.books.push(book)
    groups.set(key, group)
  }
  return [...groups.values()]
}

export function formattedAddedDay(date: Date): { hijri: string; gregorian: string } {
  const hijri = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
  const gregorian = new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
  return { hijri, gregorian }
}

export function newBooksScreen(): HTMLElement {
  const scope = captureRouteResourceScope()
  const identity=captureReadingIdentity()
  const page = pageContent(publicPageHero({ eyebrow: 'حديث الخِزانة', title: 'كل جديد الخِزانة', titleId: 'new-books-title', description: 'أحدث الكتب مرتبة بحسب يوم إضافتها، من الأحدث إلى الأقدم.', className: 'new-books-hero' }))
  page.classList.add('new-books-page')
  const content = h('section', { class: 'new-books-feed', 'aria-live': 'polite', 'aria-busy': 'true' }, silentSkeleton('cards'))
  page.appendChild(content)
  void listDiscoveryBooks().then(books => {
    if(scope.disposed||!identity.isCurrent())return
    content.removeAttribute('aria-busy')
    const ordered = [...books].sort(compareBooksByMetric(book => book.addedAt))
    if (collectionStateKind({ settled: true, count: ordered.length }) === 'empty') {
      content.replaceChildren(stateView({ kind: 'empty', icon: 'book', title: 'لا توجد إضافات حديثة', description: 'ستظهر الكتب هنا عند إضافتها إلى المكتبة.', actionLabel: 'فتح المكتبة', href: '#/library' }))
      return
    }
    const ordinalById = new Map(ordered.map((book, index) => [book.id, index] as const))
    let visible = Math.min(PAGE_SIZE, ordered.length)
    const list = h('div', { class: 'new-books-groups' })
    const sentinel = h('p', { class: 'new-books-sentinel', role: 'status' })
    const render = (): void => {
      const groups = groupBooksByAddedDay(ordered.slice(0, visible))
      list.replaceChildren(...groups.map(group => {
        const date=group.date.toISOString()
        const gregorianTime = h('time', {dataset:{uiText:''}}, uiTemplateText('e247c72af5db1232',{p1:uiDateParameter(date,{calendar:'gregory',day:'numeric',month:'long',year:'numeric'})}))
        gregorianTime.setAttribute('datetime', group.date.toISOString().slice(0,10))
        const weekday=h('span',null,new Intl.DateTimeFormat(document.documentElement.lang||'ar',{weekday:'long'}).format(group.date))
        return h('section', { class: 'new-books-day', 'aria-labelledby': `new-books-${group.key}` },
          h('header', { class: 'new-books-day__head' }, weekday,h('h2', { id: `new-books-${group.key}` }, uiTemplateText('a0bcd53cdefe15b2',{p1:uiDateParameter(date,{calendar:'islamic-umalqura',day:'numeric',month:'long',year:'numeric'})})), gregorianTime),
          h('div', { class: 'home-new-grid new-books-day__grid' }, ...group.books.map(book => homeNewCard(book, ordinalById.get(book.id) ?? 0))),
        )
      }))
      sentinel.replaceChildren(visible < ordered.length ? uiTemplateText('95defc4d8604a53e',{p1:visible,p2:ordered.length}) : uiTemplateText('cedb409354eb0648',{p1:ordered.length}))
      sentinel.dataset.complete = String(visible >= ordered.length)
    }
    content.replaceChildren(list, sentinel)
    const observer = routeObserver(new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting) || visible >= ordered.length) return
      visible = Math.min(ordered.length, visible + PAGE_SIZE)
      render()
    }, { rootMargin: '800px 0px' }), scope)
    observer.observe(sentinel)
    render()
  }).catch(error => {
    content.removeAttribute('aria-busy')
    const kind = collectionStateKind({ settled: true, error, online: navigator.onLine })
    content.replaceChildren(kind === 'offline'
      ? stateView({ kind, icon: 'globe', title: 'تعمل مكتبتك دون اتصال', description: 'تعذّر تحديث قائمة الجديد الآن؛ كتبك المحفوظة ما زالت متاحة.', actionLabel: 'فتح المكتبة', href: '#/library' })
      : stateView({ kind: 'error', title: 'تعذّر ترتيب الكتب الجديدة', description: 'كتبك محفوظة؛ أعد فتح الصفحة للمحاولة من جديد.' }))
  })
  return page
}
