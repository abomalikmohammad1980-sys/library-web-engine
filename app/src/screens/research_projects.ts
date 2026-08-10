import { getAnnotations } from '../annotation_store'
import { pageContent } from '../components'
import { listBooks } from '../engine/library_store'
import { createResearchProject, deleteResearchProject, listResearchProjects, updateResearchProject } from '../research_project'
import { stateView } from '../state_view'
import { arabicNum, h, toast } from '../ui'
import { researchProjectDocx } from '../research_project_docx'
import { downloadArtifact } from '../artifact_download'

export function researchProjectsScreen(): HTMLElement {
  const root = pageContent(h('section', { class: 'research-hero', 'aria-labelledby': 'research-title' }, h('p', { class: 'page-eyebrow' }, 'بحثك'), h('h1', { class: 'page-title', id: 'research-title' }, 'المشاريع البحثية'), h('p', { class: 'page-sub' }, 'اجمع فوائدك الموثقة من الكتب في ملفات موضوعية محفوظة على جهازك.')))
  const host = h('section', { class: 'research-projects', 'aria-live': 'polite' }); root.appendChild(host); void hydrate(host); return root
}
async function hydrate(host: HTMLElement): Promise<void> {
  const books = await listBooks(), bookById = new Map(books.map(book => [book.id, book])), annotations = getAnnotations()
  const benefits = [...annotations.notes.map(item => ({ ...item, kind: 'ملاحظة' })), ...annotations.highlights.map(item => ({ ...item, kind: 'تظليل' }))]
  const title = h('input', { type: 'text', placeholder: 'عنوان المشروع', 'aria-label': 'عنوان المشروع البحثي' }) as HTMLInputElement
  const description = h('textarea', { placeholder: 'وصف مختصر أو سؤال البحث', 'aria-label': 'وصف المشروع البحثي' }) as HTMLTextAreaElement
  const create = h('button', { type: 'button', class: 'btn btn--primary' }, 'إنشاء مشروع'), list = h('div', { class: 'research-projects__list' })
  const render = (): void => {
    const projects = listResearchProjects(); list.replaceChildren()
    if (!projects.length) { list.appendChild(stateView({ kind: 'empty', icon: 'bookmark', title: 'لا توجد مشاريع بحثية بعد', description: 'أنشئ مشروعًا ثم اختر له ملاحظاتك وتظليلاتك.', compact: true })); return }
    for (const project of projects) {
      const selected = new Set(project.annotationIds)
      const choices = h('div', { class: 'research-project__benefits' }, ...benefits.map(item => { const input = h('input', { type: 'checkbox' }) as HTMLInputElement; input.checked = selected.has(item.id); input.addEventListener('change', () => { input.checked ? selected.add(item.id) : selected.delete(item.id) }); return h('label', null, input, h('span', null, h('strong', null, `${item.kind} · ${bookById.get(item.bookId)?.title ?? 'كتاب محفوظ'} · صفحة ${arabicNum(item.pageIndex + 1)}`), h('small', null, item.text))) }))
      const save = h('button', { type: 'button', class: 'btn btn--primary' }, 'حفظ الاختيارات'), exportWord = h('button', { type: 'button', class: 'btn btn--secondary' }, 'تصدير Word'), remove = h('button', { type: 'button', class: 'btn btn--secondary' }, 'حذف المشروع')
      save.addEventListener('click', () => { updateResearchProject(project.id, [...selected]); toast('حُفظ المشروع البحثي'); render() })
      exportWord.addEventListener('click', () => { const rows = benefits.map(item => { const author = bookById.get(item.bookId)?.author; return { id: item.id, kind: item.kind, text: item.text, book: bookById.get(item.bookId)?.title ?? 'كتاب محفوظ', ...(author ? { author } : {}), page: item.pageIndex + 1 } }); const bytes = researchProjectDocx(project, rows); downloadArtifact({ fileName: `${project.title.replace(/[\\/:*?"<>|]/g, '-')}.docx`, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', content: bytes.slice().buffer as ArrayBuffer }); toast('جُهز ملف Word العلمي') })
      remove.addEventListener('click', () => { if (confirm(`حذف مشروع «${project.title}»؟ لن تُحذف الملاحظات والتظليلات.`)) { deleteResearchProject(project.id); render() } })
      list.appendChild(h('article', { class: 'research-project' }, h('h2', null, project.title), project.description ? h('p', null, project.description) : null, h('p', null, `${arabicNum(project.annotationIds.length)} فوائد مختارة`), benefits.length ? choices : stateView({ kind: 'empty', icon: 'bookmark', title: 'لا توجد فوائد لاختيارها', compact: true }), h('div', { class: 'research-project__actions' }, save, exportWord, remove)))
    }
  }
  create.addEventListener('click', () => { try { createResearchProject(title.value, description.value); title.value = ''; description.value = ''; render(); toast('أُنشئ المشروع البحثي') } catch (error) { toast(error instanceof Error ? error.message : 'تعذّر إنشاء المشروع') } })
  host.replaceChildren(h('div', { class: 'research-projects__create' }, title, description, create), list); render()
}
