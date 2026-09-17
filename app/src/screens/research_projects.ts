import {annotationEditorBoundary} from '../annotation_editor_boundary'
import { pageContent } from '../components'
import { listBooks } from '../engine/library_store'
import { stateView } from '../state_view'
import { arabicNum, h, toast } from '../ui'
import { researchProjectDocx } from '../research_project_docx'
import { downloadArtifact } from '../artifact_download'
import { publicPageHero } from '../public_page_hero'
import { bookOrdinal, compareBooksByAuthorDeath, type OrderableBook } from '../book_ordering'
import { authorLink, categoryLink, effectiveBookCategory } from '../taxonomy_links'
import {uiTemplateText,uiTemplateAttribute,uiLabelParameter,renderBoundUiTemplate} from '../ui_template_binding'

export function researchProjectsScreen(): HTMLElement {
  const root = pageContent(publicPageHero({ eyebrow: 'بحثك', title: 'المشاريع البحثية', titleId: 'research-title', description: 'اجمع فوائدك الموثقة من الكتب في ملفات موضوعية محفوظة على جهازك.', className: 'research-hero' }))
  const host = h('section', { class: 'research-projects', 'aria-live': 'polite' }); root.appendChild(host); void hydrate(host); return root
}
async function hydrate(host: HTMLElement): Promise<void> {
  const editor=annotationEditorBoundary(host,()=>void hydrate(host))
  const {getAnnotations,createResearchProject,deleteResearchProject,listResearchProjects,updateResearchProject}=editor
  let books:Awaited<ReturnType<typeof listBooks>>
  try{books=await listBooks()}catch{if(editor.isCurrent())host.replaceChildren(stateView({kind:'error',title:'تعذّر جمع ذاكرة القراءة',compact:true}));return}
  if(!editor.isCurrent())return
  const bookById = new Map(books.map(book => [book.id, book])), annotations = getAnnotations()
  const benefits = [...annotations.notes.map(item => ({ ...item, kind: 'ملاحظة' })), ...annotations.highlights.map(item => ({ ...item, kind: 'تظليل' }))]
    .sort((a, b) => compareBooksByAuthorDeath(
      bookById.get(a.bookId) ?? { id: a.bookId, title: a.text, author: '' } satisfies OrderableBook,
      bookById.get(b.bookId) ?? { id: b.bookId, title: b.text, author: '' } satisfies OrderableBook,
    ) || a.pageIndex - b.pageIndex || a.id.localeCompare(b.id, 'en'))
  const title = h('input', { type: 'text', placeholder: 'عنوان المشروع', 'aria-label': 'عنوان المشروع البحثي' }) as HTMLInputElement
  const description = h('textarea', { placeholder: 'وصف مختصر أو سؤال البحث', 'aria-label': 'وصف المشروع البحثي' }) as HTMLTextAreaElement
  const create = h('button', { type: 'button', class: 'btn btn--primary' }, 'إنشاء مشروع'), list = h('div', { class: 'research-projects__list' })
  const render = (): void => {
    if(!editor.isCurrent())return
    const projects = listResearchProjects(); list.replaceChildren()
    if (!projects.length) { list.appendChild(stateView({ kind: 'empty', icon: 'bookmark', title: 'لا توجد مشاريع بحثية بعد', description: 'أنشئ مشروعًا ثم اختر له ملاحظاتك وتظليلاتك.', compact: true })); return }
    for (const [projectIndex, project] of projects.entries()) {
      const selected = new Set(project.annotationIds)
      const choices = h('div', { class: 'research-project__benefits' }, ...benefits.map((item, index) => {
        const input = h('input', { type: 'checkbox' }) as HTMLInputElement
        input.checked = selected.has(item.id)
        input.addEventListener('change', () => { if(!editor.isCurrent())return; input.checked ? selected.add(item.id) : selected.delete(item.id) })
        const book = bookById.get(item.bookId), bookTitle = book?.title ?? 'كتاب محفوظ', ordinal = bookOrdinal(index)
        const choice=h('div', { class: 'research-project__benefit' },
          h('span', { class: 'book-card__ordinal', 'aria-hidden': 'true' }, arabicNum(ordinal.number)),
          h('label', null, input, h('span', null,
            h('strong', null, h('span', null, item.kind), ' · ', h('span', book ? { dataset: { noTranslate: '' } } : null, bookTitle), ' · ', h('span', null, uiTemplateText('e95fdd861149fc31',{p1:item.pageIndex+1}))),
            h('small', { dataset: { noTranslate: '' } }, item.text))),
          book ? h('div', { class: 'research-project__book-links' }, h('a', { href: `#/reader/${book.id}?pageIndex=${item.pageIndex}`, dataset: { noTranslate: '' } }, book.title), authorLink(book.author, undefined, book.authorId), categoryLink(effectiveBookCategory(book))) : null)
        uiTemplateAttribute(choice,'aria-label','afecb05314ef7e20',{p1:ordinal.number,p2:book?bookTitle:uiLabelParameter(bookTitle)})
        return choice
      }))
      const save = h('button', { type: 'button', class: 'btn btn--primary' }, 'حفظ الاختيارات'), exportWord = h('button', { type: 'button', class: 'btn btn--secondary' }, 'تصدير Word'), remove = h('button', { type: 'button', class: 'btn btn--secondary' }, 'حذف المشروع')
      save.addEventListener('click', () => { if(!editor.isCurrent())return; updateResearchProject(project.id, [...selected]); toast('حُفظ المشروع البحثي'); render() })
      exportWord.addEventListener('click', () => { if(!editor.isCurrent())return; const rows = benefits.map(item => { const author = bookById.get(item.bookId)?.author; return { id: item.id, kind: item.kind, text: item.text, book: bookById.get(item.bookId)?.title ?? 'كتاب محفوظ', ...(author ? { author } : {}), page: item.pageIndex + 1 } }); const bytes = researchProjectDocx(project, rows); downloadArtifact({ fileName: `${project.title.replace(/[\\/:*?"<>|]/g, '-')}.docx`, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', content: bytes.slice().buffer as ArrayBuffer }); toast('جُهز ملف Word العلمي') })
      remove.addEventListener('click', () => { if(!editor.isCurrent())return; if (confirm(renderBoundUiTemplate('c381f7f82fd61735',{p1:project.title},document.documentElement.lang||'ar'))) { if(!editor.isCurrent())return; deleteResearchProject(project.id); render() } })
      const card=h('article', { class: 'research-project' }, h('span', { class: 'book-card__ordinal', 'aria-hidden': 'true' }, arabicNum(projectIndex + 1)), h('h2', { dataset: { noTranslate: '' } }, project.title), project.description ? h('p', { dataset: { noTranslate: '' } }, project.description) : null, h('p', null, uiTemplateText('99fe92fc8190d341',{p1:project.annotationIds.length})), benefits.length ? choices : stateView({ kind: 'empty', icon: 'bookmark', title: 'لا توجد فوائد لاختيارها', compact: true }), h('div', { class: 'research-project__actions' }, save, exportWord, remove))
      uiTemplateAttribute(card,'aria-label','9c1c06a14f9fbeb9',{p1:projectIndex+1,p2:project.title})
      list.appendChild(card)
    }
  }
  create.addEventListener('click', () => { if(!editor.isCurrent())return; try { createResearchProject(title.value, description.value); title.value = ''; description.value = ''; render(); toast('أُنشئ المشروع البحثي') } catch (error) { toast(error instanceof Error ? error.message : 'تعذّر إنشاء المشروع') } })
  host.replaceChildren(h('div', { class: 'research-projects__create' }, title, description, create), list); render()
}
