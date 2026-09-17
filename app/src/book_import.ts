import { h, arabicNum, toast } from './ui'
import {uiTemplateText} from './ui_template_binding'
import { icon } from './icons'
import {localBookIndexJobs,localIndexStatusPanel} from './local_index_status'
import {currentLibraryIdentityScope} from './engine/library_store'
import { deleteBook, getBook, saveBook, saveBokBook, saveEpubBook, savePdfBook, saveTextBook, saveUploadedPdf, listAuthorRecords, canonicalAuthorName, downloadBytes, type StoredAuthor, type BookAuthorRef, type BookPart, type BookIntakeFields, type MarkdownAsset } from './engine/library_store'
import { convertStoredBookToPdf } from './engine/word_pdf'
import { BOOK_CATEGORIES, approximateGregorianYear, applyFolderAuthor, extractSingleFileMetadata, folderAuthorFromRelativePath, isWordFile, parseBookFileName, shouldShowMultiFileImportControls } from './library_metadata'
import { deterministicCoverHue, deterministicCoverTemplate, discoverWordCover, previewCover } from './book_cover'
import { ensureShamelaCatalogImported } from './shamela_catalog'
import { stateView } from './state_view'
import { makeProgrammaticFileInput } from './programmatic_file_input'
import { canImportWordFileInRuntime, getRuntimeCapabilities } from './runtime_capabilities'
import { downloadArtifact } from './artifact_download'
import { preparePdfImportDraft } from './pdf_import_draft'
import { decodeUtf8Text, textParagraphs, textTitleFromFileName } from './text_import'
import { parseEpub } from './epub_import'
import type { BookFormat } from './book_format'
import { formatLabel } from './book_format'
import type { BokPage, BokTocEntry } from './bok_import'
import { listShelves, setBookOnShelf } from './shelf_store'
import { parseReviewedTags, suggestTagsFromHeadings, type BookTag } from './book_tags'
import { requestEstimatedImportOverride, wordImportAuthorityMode, type PaginationConsent } from './word_import_authority'
import { hasAuthoritativeWordPageMaps } from './reader_page_authority'
import { assertStoredWordPageMaps } from './word_import_validation'
import { convertWordToBok } from './word_to_bok'
import { mirrorLocallySavedBookToAccount, retryPendingAccountBookMirrors } from './account_book_mirror'
import {captureCentralImportGuard,type CentralImportSaveStrategy,type CentralImportInput} from './central_import_guard'
import {captureLocalImportGuard} from './local_import_guard'
import {mountCentralImportAuthor,centralAuthorCreateLauncher} from './central_import_author'
import {captureRouteResourceScope} from './resource_lifecycle'
import {bookTagChips} from './book_tag_chips'
import {importAuthorDeath} from './import_author_death'
import {importAuthorChronology,importAuthorHasPublicIdentity} from './import_author_chronology'
import {readWordCompanionPackage,validateWordCompanionPackage,type WordCompanionPackage} from './word_companion_package'
import {wordCompanionHelp} from './word_companion_help'
import {ensureWordUploadSetup} from './word_upload_setup'
import {convertWithConnectedWord} from './word_connected_client'
// Connected conversion is available in the upload dialog, not only in Vite.
const wordCompanionEnabled=true
import {saveBookPdf} from './engine/library_store'

interface ImportDraft {
  companion?:WordCompanionPackage
  format: BookFormat
  file: File
  data: Uint8Array
  title: string
  author: string
  description?: string
  publisher?: string
  edition?: string
  investigator?: string
  publicationYearHijri?: number
  category?: string
  deathYearHijri?: number
  rawSourceMetadata?: string
  volumeCount?: number
  extractedText?: string
  bokPages?: BokPage[]
  bokToc?: BokTocEntry[]
  textToc?: Array<{ title: string; paragraphIndex: number; level: number; bookmark?: string }>
  markdownAssets?: MarkdownAsset[]
  pdfFirstPageCover?: { data: Uint8Array; mimeType: string }
  pdfHasTextLayer?: boolean
  sourceData?: Uint8Array
  cover?: { mediaPath: string; bytes: Uint8Array; mimeType: string }
}
interface DirectoryHandleLike { kind: 'file' | 'directory'; name?: string; values(): AsyncIterableIterator<DirectoryHandleLike>; getFile(): Promise<File> }
export interface BookImportManagerOptions { hideLauncher?: boolean; initialFiles?: File[]; centralSave?:CentralImportSaveStrategy }

export function bookImportManager(onSaved: () => void, options: BookImportManagerOptions = {}): HTMLElement {
  const centralGuard=options.centralSave?captureCentralImportGuard():captureLocalImportGuard()
  const centralLauncherController=new AbortController();captureRouteResourceScope().add(()=>centralLauncherController.abort())
  if(!options.centralSave)void retryPendingAccountBookMirrors().then(result => { if (result.uploaded) toast(`اكتمل رفع ${arabicNum(result.uploaded)} من الكتب المحفوظة إلى الحساب.`) })
  const section = h('section', { class: 'import-manager', ...(options.hideLauncher ? { 'aria-label': 'مراجعة الكتب المختارة' } : { 'aria-labelledby': 'import-title' }) })
  const head = h('div', { class: 'import-manager__head' },
    h('div', null, h('p', { class: 'page-eyebrow' }, 'استيراد منظم'), h('h2', { id: 'import-title' }, 'أضف كتبًا إلى الخِزانة'), h('p', null, 'مكان واحد لملفات Word وPDF وEPUB وBOK والنصوص؛ يتعرف النظام إلى كل صيغة ويعالجها بمسارها الصحيح.')),
  )
  const actions = h('div', { class: 'import-manager__actions' })
  const filesButton = h('button', { class: 'btn btn--primary import-manager__primary', type: 'button' }, icon('plus', 19), 'إضافة ملفات')
  const folderButton = h('button', { class: 'btn btn--primary import-manager__folder', type: 'button', title: 'اختيار مجلد كامل', 'aria-label': 'إضافة مجلد كامل' }, icon('box', 18), h('span', null, 'إضافة مجلد'))
  actions.append(h('div', { class: 'import-manager__unified' }, filesButton, folderButton))
  if(options.centralSave)actions.append(centralAuthorCreateLauncher(centralLauncherController.signal))
  head.appendChild(actions)
  const fileInput = makeProgrammaticFileInput(h('input', { type: 'file', accept: '.docx,.doc,.rtf,.pdf,.epub,.bok,.txt,.md,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/rtf,text/rtf,application/pdf,application/epub+zip,application/x-shamela-bok,text/plain,text/markdown' }) as HTMLInputElement)
  if(wordCompanionEnabled)fileInput.accept+=',.khizana-word'
  fileInput.multiple = true
  const folderInput = makeProgrammaticFileInput(h('input', { type: 'file' }) as HTMLInputElement)
  folderInput.multiple = true
  folderInput.setAttribute('webkitdirectory', '')
  const workspace = h('div', { class: 'import-workspace', 'aria-live': 'polite' })
  if (options.hideLauncher) head.hidden = true
  section.append(head, fileInput, folderInput, workspace)
  if(options.centralSave)section.prepend(h('p',{role:'status'},'إضافة مركزية: بعد المراجعة ستُنشر الكتب للعامة بصلاحيتك. لا تختَر ملفات خاصة.'))

  const stage = async (selected: File[], pickedFolderAuthor?: string): Promise<void> => {
    centralGuard?.()
    const accepted = selected.filter(isSupportedBookFile).sort((a, b) => a.name.localeCompare(b.name, 'ar', { numeric: true }))
    const ignored = selected.length - accepted.length
    if (!accepted.length) { toast('لم يُعثر على ملفات كتب بصيغة مدعومة'); return }
    workspace.replaceChildren(stateView({ kind: 'loading', icon: 'book', title: 'جارٍ قراءة بيانات الكتب', description: `نفحص ${arabicNum(accepted.length)} ملفًا ونستخرج بياناته قبل عرضها للمراجعة.`, compact: true }))
    const drafts: ImportDraft[] = []
    const failures: string[] = []
    const legacyOriginals: File[] = []
    const capabilities = await getRuntimeCapabilities()
    const needsConnectedWord=accepted.some(isWordFile)&&!capabilities.wordPdfConversionAvailable
    if(needsConnectedWord){
      const ready=await ensureWordUploadSetup(workspace,centralLauncherController.signal)
      if(!ready)return
      centralGuard?.()
    }
    for (const file of accepted) {
      try {
        if (!isWordFile(file)) {
          drafts.push(await prepareStandaloneDraft(file, pickedFolderAuthor, selected))
          continue
        }
        const legacy = /\.(doc|rtf)$/i.test(file.name)
        if(needsConnectedWord){
          const bytes=await convertWithConnectedWord(file,()=>{workspace.textContent=`يعالج Word ملف «${file.name}» في الخلفية. لم يبدأ الرفع بعد؛ يمكنك متابعة العمل في مستنداتك.`})
          centralGuard?.()
          if(centralLauncherController.signal.aborted)return
          const companion=await readWordCompanionPackage(bytes)
          await validateWordCompanionPackage(companion)
          const normalizedName=file.name.replace(/\.(docx|doc|rtf)$/i,'.docx')
          const normalized=new File([new Uint8Array(companion.source)],normalizedName,{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'})
          const proposed=applyFolderAuthor(extractSingleFileMetadata(companion.source,normalizedName),pickedFolderAuthor)
          drafts.push({format:'word',file:normalized,data:companion.source,title:proposed.title,author:proposed.author??'',companion})
          continue
        }
        if (legacy && !canImportWordFileInRuntime(file.name, capabilities)) {
          failures.push(`${file.name}: تحويل DOC/RTF يحتاج تشغيل الخِزانة المحلي؛ لم يُحفظ سجل غير قابل للقراءة`)
          legacyOriginals.push(file)
          continue
        }
        const source = new Uint8Array(await file.arrayBuffer())
        const data = legacy ? await normalizeLegacyWord(source, file.name) : source
        const cover = discoverWordCover(data)
        const folderAuthor = pickedFolderAuthor ?? folderAuthorFromRelativePath((file as File & { webkitRelativePath?: string }).webkitRelativePath)
        const proposed = applyFolderAuthor(extractSingleFileMetadata(data, file.name), folderAuthor)
        drafts.push({ format: 'word', file, data, title: proposed.title, author: proposed.author ?? '', ...(legacy ? { sourceData: source } : {}), ...(cover ? { cover } : {}) })
      } catch (error) {
        failures.push(`${file.name}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    await ensureShamelaCatalogImported().catch(() => undefined)
    const knownAuthors = await listAuthorRecords()
    for (const draft of drafts) {
      const selected = canonicalAuthorName(draft.author)
      const existing = selected ? knownAuthors.find(author => author.canonicalName === selected || author.aliases.some(alias => canonicalAuthorName(alias) === selected)) : undefined
      if (existing) draft.author = existing.name
    }
    centralGuard?.()
    renderReview(workspace, drafts, { ignored, failures, legacyOriginals }, onSaved, knownAuthors,options.centralSave,centralGuard)
  }
  const importSelected = async (selected: File[], pickedFolderAuthor?: string): Promise<void> => {
    if (!selected.length) { section.dispatchEvent(new CustomEvent('book-import-cancelled')); return }
    section.dispatchEvent(new CustomEvent('book-import-selection'))
    await stage(selected, pickedFolderAuthor)
  }
  filesButton.addEventListener('click', () => fileInput.click())
  fileInput.addEventListener('change', () => { void importSelected(Array.from(fileInput.files ?? [])); fileInput.value = '' })
  folderInput.addEventListener('change', () => { void importSelected(Array.from(folderInput.files ?? [])); folderInput.value = '' })
  fileInput.addEventListener('cancel', () => section.dispatchEvent(new CustomEvent('book-import-cancelled')))
  folderInput.addEventListener('cancel', () => section.dispatchEvent(new CustomEvent('book-import-cancelled')))
  folderButton.addEventListener('click', async () => {
    const picker = (window as Window & { showDirectoryPicker?: () => Promise<DirectoryHandleLike> }).showDirectoryPicker
    if (!picker) { folderInput.click(); return }
    try {
      const root = await picker()
      const files: File[] = []
      await collectDirectory(root, files)
      await importSelected(files, root.name)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') { section.dispatchEvent(new CustomEvent('book-import-cancelled')); return }
      toast('تعذّر فتح المجلد؛ استخدم اختيار المجلد البديل')
      folderInput.click()
    }
  })
  if (options.initialFiles?.length) queueMicrotask(() => { void importSelected(options.initialFiles!).catch(() => toast('تعذّر تجهيز الملفات المختارة؛ أعد المحاولة.')) })
  return section
}

function isSupportedBookFile(file: File): boolean {
  return isWordFile(file) || /\.(pdf|epub|bok|txt|md|khizana-word)$/i.test(file.name)
}

async function prepareStandaloneDraft(file: File, pickedFolderAuthor?: string, siblingFiles: File[] = []): Promise<ImportDraft> {
  if(/\.khizana-word$/i.test(file.name)){
    if(!wordCompanionEnabled)throw Error('رفع حزمة أداة Word غير متاح بعد؛ يجري إكمال حفظها على الخادم.')
    if(file.size>128*1024*1024)throw Error('حزمة Word تتجاوز الحد المسموح (128 ميجابايت)')
    const companion=await readWordCompanionPackage(new Uint8Array(await file.arrayBuffer()))
    await validateWordCompanionPackage(companion)
    const original=new File([new Uint8Array(companion.source)],companion.fileName,{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'})
    const proposed=applyFolderAuthor(extractSingleFileMetadata(companion.source,original.name),pickedFolderAuthor)
    return {format:'word',file:original,data:companion.source,title:proposed.title,author:proposed.author??'',companion}
  }
  const fromName = parseBookFileName(file.name)
  const folderAuthor = pickedFolderAuthor ?? folderAuthorFromRelativePath((file as File & { webkitRelativePath?: string }).webkitRelativePath)
  const fallbackAuthor = fromName.author || folderAuthor || 'غير معروف'
  if (/\.pdf$/i.test(file.name)) {
    return preparePdfImportDraft(file, fallbackAuthor)
  }
  const data = new Uint8Array(await file.arrayBuffer())
  if (/\.epub$/i.test(file.name)) {
    const parsed = parseEpub(data, file.name)
    return { format: 'epub', file, data, title: parsed.title || fromName.title, author: parsed.author === 'غير معروف' ? fallbackAuthor : parsed.author, ...(parsed.publisher ? { publisher: parsed.publisher } : {}), ...(parsed.edition ? { edition: parsed.edition } : {}), ...(parsed.investigator ? { investigator: parsed.investigator } : {}), ...(parsed.publicationYearHijri ? { publicationYearHijri: parsed.publicationYearHijri } : {}), ...(parsed.description ? { description: parsed.description } : {}), extractedText: parsed.text, textToc: parsed.toc }
  }
  if (/\.(txt|md)$/i.test(file.name)) {
    const decoded = decodeUtf8Text(data)
    const paragraphs = textParagraphs(decoded)
    const textToc = /\.md$/i.test(file.name) ? paragraphs.map((text, paragraphIndex) => { const match = text.match(/^(#{1,6})\s+(.+)$/u); return match ? { title: match[2]!.trim(), paragraphIndex, level: match[1]!.length } : undefined }).filter((entry): entry is { title: string; paragraphIndex: number; level: number } => Boolean(entry)) : []
    const markdown = /\.md$/i.test(file.name)
    const markdownAssets = markdown ? await collectMarkdownAssets(decoded, file, siblingFiles) : []
    return { format: markdown ? 'markdown' : 'text', file, data, title: textTitleFromFileName(file.name) || fromName.title, author: fallbackAuthor, textToc, ...(markdownAssets.length ? { markdownAssets } : {}) }
  }
  if (/\.bok$/i.test(file.name)) {
    const runtime = globalThis as typeof globalThis & { process?: { browser: true; env: Record<string, string | undefined>; version: string; nextTick: (callback: (...args: unknown[]) => void, ...args: unknown[]) => void } }
    runtime.process ??= { browser: true, env: {}, version: '', nextTick: (callback, ...args) => queueMicrotask(() => callback(...args)) }
    const { parseBok } = await import('./bok_import')
    const parsed = parseBok(data, file.name)
    const draft: ImportDraft = { format: 'shamela-bok', file, data, title: parsed.title || fromName.title, author: parsed.author === 'غير معروف' ? fallbackAuthor : parsed.author, description: parsed.description, rawSourceMetadata: parsed.rawBetaka, extractedText: parsed.extractedText, bokPages: parsed.pages, bokToc: parsed.toc }
    if (parsed.publisher) draft.publisher = parsed.publisher
    if (parsed.edition) draft.edition = parsed.edition
    if (parsed.investigator) draft.investigator = parsed.investigator
    if (parsed.publicationYearHijri !== undefined) draft.publicationYearHijri = parsed.publicationYearHijri
    if (parsed.category) draft.category = parsed.category
    if (parsed.deathYearHijri !== undefined) draft.deathYearHijri = parsed.deathYearHijri
    if (parsed.volumeCount !== undefined) draft.volumeCount = parsed.volumeCount
    return draft
  }
  throw new Error('صيغة كتاب غير مدعومة')
}

async function collectDirectory(handle: DirectoryHandleLike, files: File[], prefix = ''): Promise<void> {
  for await (const child of handle.values()) {
    if (child.kind === 'file') {
      const file = await child.getFile()
      Object.defineProperty(file, 'webkitRelativePath', { configurable: true, value: `${prefix}${file.name}` })
      files.push(file)
    } else await collectDirectory(child, files, `${prefix}${child.name ?? 'مجلد'}/`)
  }
}

async function collectMarkdownAssets(markdown: string, source: File, siblings: File[]): Promise<MarkdownAsset[]> {
  const refs = [...markdown.matchAll(/!\[[^\]]*\]\((?:<([^>]+)>|([^\s)]+))(?:\s+["'][^"']*["'])?\)/g), ...markdown.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)]
    .map(match => match[1] ?? match[2] ?? '').filter(ref => ref && !/^(?:[a-z]+:|\/|#)/i.test(ref))
  if (!refs.length) return []
  const sourcePath = relativeFilePath(source)
  const base = sourcePath.includes('/') ? sourcePath.slice(0, sourcePath.lastIndexOf('/') + 1) : ''
  const wanted = new Set(refs.map(ref => normalizeRelativePath(`${base}${safeDecodeUri(ref).split(/[?#]/, 1)[0]}`)))
  const assets: MarkdownAsset[] = []
  for (const file of siblings) {
    const path = normalizeRelativePath(relativeFilePath(file))
    if (!wanted.has(path) || file === source || !/\.(?:png|jpe?g|gif|webp|avif)$/i.test(path)) continue
    assets.push({ path: path.slice(base.length), data: new Uint8Array(await file.arrayBuffer()), mimeType: file.type || mimeFromAsset(path) })
  }
  return assets
}

function relativeFilePath(file: File): string { return ((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name).replace(/\\/g, '/') }
function safeDecodeUri(value: string): string { try { return decodeURIComponent(value) } catch { return value } }
function normalizeRelativePath(path: string): string {
  const parts: string[] = []
  for (const part of path.split('/')) { if (!part || part === '.') continue; if (part === '..') parts.pop(); else parts.push(part) }
  return parts.join('/')
}
function mimeFromAsset(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase()
  return extension === 'png' ? 'image/png' : extension === 'gif' ? 'image/gif' : extension === 'webp' ? 'image/webp' : extension === 'avif' ? 'image/avif' : 'image/jpeg'
}

function renderReview(root: HTMLElement, drafts: ImportDraft[], report: { ignored: number; failures: string[]; legacyOriginals: File[] }, onSaved: () => void, knownAuthors: StoredAuthor[],centralSave?:CentralImportSaveStrategy,centralGuard?:()=>void): void {
  const centralController=new AbortController();captureRouteResourceScope().add(()=>centralController.abort())
  if (!drafts.length) {
    root.replaceChildren(reportBox(0, report.failures, report.ignored, report.legacyOriginals))
    return
  }
  const form = h('form', { class: 'import-review' })
  const deathTasks=new Map<HTMLInputElement,Promise<void>>()
  const authorListId = `known-authors-${Date.now()}`
  const authorList = h('datalist', { id: authorListId }, ...knownAuthors.map(author => h('option', { value: author.name }, author.deathYearHijri ? `ت ${author.deathYearHijri} هـ` : author.contemporary ? 'معاصر' : 'مؤلف مسجل')))
  form.appendChild(authorList)
  form.appendChild(h('div', { class: 'import-review__head' }, h('div', null, h('h3', null, `مراجعة ${arabicNum(drafts.length)} كتاب`), h('p', null, 'الحقول المعلّمة مطلوبة قبل حفظ أي كتاب.')), h('button', { class: 'btn btn--secondary', type: 'button', onclick: () => root.replaceChildren() }, 'إلغاء')))
  const rows = h('div', { class: 'import-review__rows' })
  const controls: Array<{ draft: ImportDraft; title: HTMLInputElement; author: HTMLInputElement; centralAuthor?:ReturnType<typeof mountCentralImportAuthor>; coAuthors: HTMLInputElement[]; suggestedTags: BookTag[]; tags: {value:string}; death: HTMLInputElement; contemporary: HTMLInputElement; category: HTMLSelectElement; publisher: HTMLInputElement; edition: HTMLInputElement; investigator: HTMLInputElement; publicationYear: HTMLInputElement; description: HTMLTextAreaElement; shelf: HTMLSelectElement; customCover: HTMLInputElement; keepPdfCover: HTMLInputElement; approx: HTMLElement; syncDeath: () => void; refreshCover: () => void; convertToBok?: () => Promise<boolean> }> = []
  drafts.forEach((draft, index) => {
    const title = textInput('عنوان الكتاب', draft.title)
    const author = textInput('المؤلف', draft.author)
    author.setAttribute('list', authorListId)
    const coAuthors: HTMLInputElement[] = []
    const coAuthorsHost = h('div', { class: 'import-coauthors', 'aria-live': 'polite' })
    const addCoAuthor = h('button', { class: 'import-author-add', type: 'button', title: 'إضافة مؤلف مشارك', 'aria-label': 'إضافة مؤلف مشارك' }, icon('plus', 18)) as HTMLButtonElement
    const authorControl = h('div', { class: 'import-author-control' }, author, addCoAuthor, coAuthorsHost)
    const appendCoAuthor = (): void => {
      const input = textInput('اسم المؤلف المشارك', '')
      input.setAttribute('list', authorListId)
      const remove = h('button', { type: 'button', class: 'import-author-remove', title: 'حذف المؤلف المشارك', 'aria-label': 'حذف المؤلف المشارك' }, icon('close', 18))
      const row = h('div', { class: 'import-coauthors__row' }, input, remove)
      remove.addEventListener('click', () => { coAuthors.splice(coAuthors.indexOf(input), 1); row.remove() })
      coAuthors.push(input); coAuthorsHost.appendChild(row); input.focus()
    }
    addCoAuthor.addEventListener('click', appendCoAuthor)
    const death = textInput('سنة الوفاة الهجرية', draft.deathYearHijri ? String(draft.deathYearHijri) : '', 'number')
    death.min = '-10000'; death.max = '3000'; death.inputMode = 'numeric'
    const contemporary = h('input', { type: 'checkbox' }) as HTMLInputElement
    const category = categorySelect()
    if (draft.category && BOOK_CATEGORIES.some(value => value === draft.category)) category.value = draft.category
    const suggestedTags = suggestTagsFromHeadings(draft.textToc?.map(item => ({ ...item })) ?? draft.bokToc?.map(item => ({ title: item.title, level: item.level, pageId: item.id })) ?? [])
    const tags = bookTagChips(suggestedTags.map(tag => tag.name).join('، '))
    const publisher = textInput('الناشر', draft.publisher ?? '')
    const edition = textInput('الطبعة', draft.edition ?? '')
    const investigator = textInput('المحقق', draft.investigator ?? '')
    const publicationYear = textInput('سنة النشر الهجرية', draft.publicationYearHijri ? String(draft.publicationYearHijri) : '', 'number')
    const description = h('textarea', { 'aria-label': 'الوصف' }, draft.description ?? '') as HTMLTextAreaElement
    description.rows = 3
    const shelf = h('select', { 'aria-label': 'الرف' }, h('option', { value: '' }, 'دون رف'), ...listShelves().map(item => h('option', { value: item.id }, item.name))) as HTMLSelectElement
    const customCover = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', 'aria-label': 'استبدال الغلاف' }) as HTMLInputElement
    const keepPdfCover = h('input', { type: 'checkbox', 'aria-label': 'اعتماد الصفحة الأولى غلافًا' }) as HTMLInputElement
    keepPdfCover.checked = Boolean(draft.pdfFirstPageCover)
    const previewReal = draft.cover ?? (draft.pdfFirstPageCover ? { bytes: draft.pdfFirstPageCover.data, mimeType: draft.pdfFirstPageCover.mimeType } : undefined)
    const cover = previewCover(title.value, author.value, deterministicCoverHue(`${title.value}|${draft.file.name}`), previewReal, { category: category.value, format: formatLabel({ sourceFormat: draft.format }), template: deterministicCoverTemplate(`${title.value}|${draft.file.name}`) })
    const refreshCover = (): void => cover.update(title.value, author.value, category.value)
    title.addEventListener('input', refreshCover); author.addEventListener('input', refreshCover)
    category.addEventListener('change', refreshCover)
    const approx = h('small', { class: 'import-approx' }, 'أدخل السنة الهجرية لعرض الميلادي التقريبي')
    const deathGuard=importAuthorDeath({death,contemporary})
    let deathRequest=0,pendingDeath=false
    const selectKnownDeath=(existing:StoredAuthor):void=>{
      const request=++deathRequest,selectedName=author.value
      pendingDeath=false
      deathGuard.select(existing)
      if(existing.deathYearHijri!==undefined&&!importAuthorHasPublicIdentity(existing)){deathTasks.delete(author);return}
      pendingDeath=true;contemporary.checked=false;contemporary.disabled=true
      const task=importAuthorChronology(existing).then(value=>{if(request!==deathRequest||author.value!==selectedName)return;pendingDeath=false;deathGuard.select(value);updateDeath()})
      deathTasks.set(author,task)
      void task.catch(()=>{if(request===deathRequest&&author.value===selectedName){deathGuard.clear();contemporary.disabled=true;approx.textContent='تعذّر التحقق من وفاة المؤلف؛ أعد اختيار اسمه للمحاولة.'}})
    }
    let deathAuthorName=author.value
    const updateDeath = (): void => {
      if(deathAuthorName!==author.value){deathAuthorName=author.value;const existing=knownAuthors.find(item=>item.canonicalName===canonicalAuthorName(author.value)||item.aliases.some(alias=>canonicalAuthorName(alias)===canonicalAuthorName(author.value)));if(existing)selectKnownDeath(existing);else {++deathRequest;pendingDeath=false;deathTasks.delete(author);deathGuard.clear()}}
      deathGuard.sync()
      if(pendingDeath){contemporary.checked=false;contemporary.disabled=true}
      if (contemporary.checked) { death.value = ''; approx.textContent = 'مؤلف معاصر' }
      else {
        const hijri = Number(death.value)
        approx.textContent = hijri > 0 ? `نحو ${arabicNum(approximateGregorianYear(hijri))}م — تقريبي` : 'أدخل السنة الهجرية لعرض الميلادي التقريبي'
      }
    }
    death.addEventListener('input', updateDeath); contemporary.addEventListener('change', updateDeath)
    const syncAuthorDeath=():void=>{
      ++deathRequest;pendingDeath=false;deathTasks.delete(author)
      deathAuthorName=author.value
      const selected = canonicalAuthorName(author.value)
      const existing = knownAuthors.find(item => item.canonicalName === selected || item.aliases.some(alias => canonicalAuthorName(alias) === selected))
      if(existing)selectKnownDeath(existing)
      else deathGuard.clear()
      updateDeath()
    }
    author.addEventListener('input',syncAuthorDeath)
    const centralAuthor=centralSave?mountCentralImportAuthor({authorInput:author,signal:centralController.signal,onChange:selected=>{if(selected){++deathRequest;pendingDeath=false;deathTasks.delete(author);deathAuthorName=author.value;deathGuard.select(selected);updateDeath()}else syncAuthorDeath()}}):undefined
    if(centralAuthor)authorControl.append(centralAuthor.element)
    const initialAuthor=knownAuthors.find(item=>item.canonicalName===canonicalAuthorName(author.value)||item.aliases.some(alias=>canonicalAuthorName(alias)===canonicalAuthorName(author.value)))
    if(initialAuthor)selectKnownDeath(initialAuthor)
    updateDeath()
    const formatBadge = h('strong', { class: 'format-badge' }, formatLabel({ sourceFormat: draft.format }))
    const bokAction = draft.format === 'word'
      ? h('button', { class: 'btn btn--secondary import-word-bok', type: 'button' }, 'تحويله إلى BOK') as HTMLButtonElement
      : undefined
    const convertToBok = draft.format === 'word' ? async (): Promise<boolean> => {
      const action = bokAction!
      const oldLabel = action.textContent
      action.disabled = true
      action.textContent = 'جارٍ التحويل إلى BOK…'
      try {
        const result = await convertWordToBok({
          fileName: draft.file.name, data: draft.data, ...(draft.sourceData ? { sourceData: draft.sourceData } : {}),
          title: title.value.trim() || draft.title, author: author.value.trim() || 'غير معروف',
        })
        const { parseBok } = await import('./bok_import')
        const parsed = parseBok(result.data, result.fileName)
        draft.format = 'shamela-bok'
        draft.file = new File([result.data.slice().buffer as ArrayBuffer], result.fileName, { type: 'application/x-shamela-bok' })
        draft.data = result.data
        delete draft.sourceData
        draft.extractedText = parsed.extractedText
        draft.bokPages = parsed.pages
        draft.bokToc = parsed.toc
        formatBadge.textContent = 'BOK'
        action.textContent = 'سيُحفظ BOK فقط'
        if (!tags.value.trim() && parsed.toc.length) tags.value = suggestTagsFromHeadings(parsed.toc.map(item => ({ title: item.title, level: item.level, pageId: item.id }))).map(tag => tag.name).join('، ')
        toast('تم التحويل؛ سيُحفظ BOK فقط ولن تُحفظ نسخة Word')
        return true
      } catch (error) {
        toast(error instanceof Error ? error.message : 'تعذّر تحويل Word إلى BOK')
        return false
      } finally {
        if (draft.format === 'word') { action.disabled = false; action.textContent = oldLabel }
      }
    } : undefined
    bokAction?.addEventListener('click', () => { void convertToBok?.() })
    const row = h('fieldset', { class: 'import-book' },
      h('legend', null, h('span', null, arabicNum(index + 1)), draft.file.name, formatBadge),
      cover.element,
      h('div', { class: 'import-book__fields' },
      field('عنوان الكتاب *', title), field('المؤلف *', authorControl),
      h('div', { class: 'import-death' }, field('سنة الوفاة (هـ) *', death), h('label', { class: 'import-contemporary' }, contemporary, h('span', null, 'معاصر')), approx),
      field('التصنيف *', category), field('الوسوم المقترحة من الفهرس (اختيارية)', tags.element), field('الناشر', publisher), field('الطبعة', edition), field('المحقق', investigator), field('سنة النشر (هـ)', publicationYear), field('الرف', shelf),
      ...(draft.pdfFirstPageCover ? [h('div', { class: 'import-pdf-cover-choice' }, h('p', null, draft.pdfHasTextLayer === false ? 'هذا PDF ممسوح ضوئيًا بلا طبقة نصية في الصفحة الأولى؛ يُعرض من الصور الأصلية ولا يتاح بحث نصي بلا OCR.' : 'استُخدمت معاينة محدودة الدقة من الصفحة الأولى غلافًا؛ ملف PDF الأصلي لم يتغير.'), h('label', null, keepPdfCover, h('span', null, 'اعتماد الصفحة الأولى غلافًا — أزل العلامة لاستخدام الغلاف المولّد')))] : []),
      field('استبدال الغلاف (اختياري)', customCover), field('الوصف', description)),
      bokAction,
    )
    rows.appendChild(row)
    controls.push({ draft, title, author, ...(centralAuthor?{centralAuthor}:{}), coAuthors, suggestedTags, tags, death, contemporary, category, publisher, edition, investigator, publicationYear, description, shelf, customCover, keepPdfCover, approx, syncDeath: ()=>{centralAuthor?.getCentralAuthorId();updateDeath()}, refreshCover, ...(convertToBok ? { convertToBok } : {}) })
  })
  const batch = batchDefaultsPanel(controls)
  const bulkBok = h('button', { class: 'btn btn--secondary import-bulk-bok', type: 'button' }, 'تحويل جميع كتب Word إلى BOK') as HTMLButtonElement
  const bulkBokPanel = h('section', { class: 'import-bulk-conversion' },
    h('div', null, h('h4', null, 'صيغة الحفظ للمجموعة'), h('p', null, 'يحوّل جميع ملفات Word المختارة إلى BOK دفعة واحدة؛ تبقى الملفات غير التابعة لـWord كما هي.')),
    bulkBok,
  )
  bulkBok.addEventListener('click', async () => {
    const pending = controls.filter(control => control.draft.format === 'word' && control.convertToBok)
    if (!pending.length) { toast('لا توجد كتب Word متبقية للتحويل'); return }
    bulkBok.disabled = true
    let converted = 0
    for (let index = 0; index < pending.length; index++) {
      bulkBok.textContent = `تحويل ${arabicNum(index + 1)} من ${arabicNum(pending.length)} إلى BOK…`
      if (await pending[index]!.convertToBok!()) converted++
    }
    bulkBok.textContent = converted === pending.length ? 'تم تحويل جميع كتب Word إلى BOK' : `تم تحويل ${arabicNum(converted)} من ${arabicNum(pending.length)}`
    bulkBok.disabled = converted === pending.length
  })
  const mergeParts = h('input', { type: 'checkbox' }) as HTMLInputElement
  const mergedTitle = textInput('اسم الكتاب متعدد الأجزاء', drafts[0]?.title ?? '')
  mergedTitle.disabled = true
  mergeParts.addEventListener('change', () => { mergedTitle.disabled = !mergeParts.checked })
  const multipart = h('section', { class: 'import-multipart' },
    h('label', { class: 'import-multipart__toggle' }, mergeParts, h('span', null, 'هذه الملفات أجزاء لكتاب واحد')),
    field('اسم الكتاب الجامع', mergedTitle),
    h('p', null, 'ترتب الأجزاء طبيعيًا بحسب اسم الملف، وتظهر في المكتبة بطاقة واحدة وقارئ واحد متسلسل.'),
  )
  const manualPdf = h('input', { type: 'checkbox' }) as HTMLInputElement
  const pdfFile = h('input', { type: 'file', accept: 'application/pdf,.pdf' }) as HTMLInputElement
  const pdfStarts = textInput('بدايات الأجزاء داخل PDF', '1')
  pdfFile.disabled = true; pdfStarts.disabled = true
  const updatePdfMode = (): void => { pdfFile.disabled = pdfStarts.disabled = !manualPdf.checked; pdfStarts.placeholder = mergeParts.checked ? 'مثال: 1، 121، 244' : 'صفحة PDF المقابلة لصفحة Word 1' }
  manualPdf.addEventListener('change', updatePdfMode); mergeParts.addEventListener('change', updatePdfMode)
  const pdfHelp = h('p', null, 'اترك هذا الخيار مغلقًا ليحوّل الموقع Word عبر Microsoft Word. عند تفعيله يُحفظ PDF الذي اخترته ويربط بالنص؛ افصل بدايات الأجزاء بفواصل.')
  void getRuntimeCapabilities().then(capabilities => {
    if (!capabilities.wordPdfConversionAvailable && pdfHelp.isConnected) pdfHelp.textContent = 'في نسخة الويب العامة لا يتوفر تحويل Word إلى PDF؛ يمكنك الاستمرار في حفظ وقراءة Word، أو إرفاق PDF جاهز من هذا الخيار.'
  })
  const pdfOption = h('section', { class: 'import-manual-pdf' },
    h('label', { class: 'import-multipart__toggle' }, manualPdf, h('span', null, 'لدي PDF جاهز — لا تحوّل Word آليًا')),
    field('ملف PDF الجاهز', pdfFile),
    field('بداية الصفحة/الأجزاء في PDF', pdfStarts),
    pdfHelp,
  )
  const submit = h('button', { class: 'btn btn--primary import-review__save', type: 'submit' }, `حفظ ${arabicNum(drafts.length)} كتاب`)
  const wordOnly = drafts.every(draft => draft.format === 'word')
  if (shouldShowMultiFileImportControls(drafts.length)) form.append(batch)
  if (shouldShowMultiFileImportControls(drafts.length) && drafts.some(draft => draft.format === 'word')) form.append(bulkBokPanel)
  if (shouldShowMultiFileImportControls(drafts.length) && wordOnly) form.append(multipart)
  if (wordOnly) form.append(pdfOption)
  if(wordCompanionEnabled&&drafts.some(d=>d.format==='word'&&!d.companion))form.prepend(wordCompanionHelp())
  if(drafts.some(d=>d.companion))form.prepend(h('p',{role:'status'},'اجتازت حزمة Word فحص ارتباط النص وملف PDF وخريطة الصفحات.'))
  form.append(rows, submit)
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    if(drafts.some(d=>d.companion)&&(mergeParts.checked||manualPdf.checked)){toast('احفظ حزم الأداة ككتب مستقلة دون استبدال PDF المرجعي أو جمع الأجزاء.');return}
    try{centralGuard?.()}catch(error){toast(error instanceof Error?error.message:'تعذّر النشر');return}
    try{await Promise.all([...deathTasks.values()])}catch{toast('تعذّر التحقق من وفاة المؤلف؛ أعد اختيار اسمه قبل الحفظ.');return}
    controls.forEach(item=>{item.centralAuthor?.getCentralAuthorId();item.syncDeath()})
    const invalid = controls.find(({ title, author, death, contemporary, category }) => !title.value.trim() || !author.value.trim() || !category.value || (!contemporary.checked && !(death.readOnly&&death.value!==''&&Number.isFinite(Number(death.value))) && !(Number(death.value) > 0)))
    if (invalid) { invalid.title.closest('.import-book')?.classList.add('import-book--invalid'); invalid.title.focus(); toast('أكمل العنوان والمؤلف والوفاة أو «معاصر» والتصنيف لكل كتاب'); return }
    if (mergeParts.checked && !mergedTitle.value.trim()) { mergedTitle.focus(); toast('أدخل اسم الكتاب الجامع للأجزاء'); return }
    if (mergeParts.checked && drafts.some(draft => draft.format !== 'word')) { toast('جمع الأجزاء متاح لملفات Word؛ ألغِ الجمع عند الحفظ بصيغة BOK'); return }
    if (manualPdf.checked && !pdfFile.files?.[0]) { pdfFile.focus(); toast('اختر ملف PDF الجاهز'); return }
    if (manualPdf.checked && !mergeParts.checked && controls.length > 1) { toast('لربط PDF يدويًا بعدة ملفات، اجمعها أولًا كأجزاء كتاب واحد أو أضف كل كتاب منفردًا'); return }
    const capabilities = await getRuntimeCapabilities()
    const hasWordDrafts = drafts.some(draft => draft.format === 'word')
    const authorityMode = wordImportAuthorityMode({
      hasWord: drafts.some(d=>d.format==='word'&&!d.companion),
      manualPdf: hasWordDrafts && manualPdf.checked,
      wordConversionAvailable: capabilities.wordPdfConversionAvailable,
    })
    let wordConsent: PaginationConsent | undefined
    if (hasWordDrafts && authorityMode === 'estimated-consent') {
      const consent = await requestEstimatedImportOverride(drafts.find(d=>d.format==='word'&&!d.companion)!.data, message => window.confirm(message))
      if (!consent) { toast('لم يُحفظ الكتاب؛ أعد المعالجة للحصول على مطابقة Word موثقة'); return }
      wordConsent = consent
    }
    submit.disabled = true; submit.textContent = 'جارٍ حفظ الكتب…'
    const canAutoConvertPdf = authorityMode === 'authoritative-conversion'
    const importOwnerScope=currentLibraryIdentityScope()
    let success = 0
    let accountMirrorFailures = 0
    const failures = [...report.failures]
    const retries:HTMLElement[]=[]
    const publishCentral=async(id:string,files:File[])=>{
      centralGuard?.();const book=await getBook(id);centralGuard?.();if(!book)throw Error('تعذّر استعادة النسخة المحلية للنشر')
      const input:CentralImportInput={localBookId:id,metadata:book,files,book}
      try{centralGuard?.();await centralSave!.save(input);centralGuard?.()}
      catch(error){
        const status=h('p',{role:'status'},'حُفظت النسخة المحلية؛ لم نتأكد من نشرها للعامة. لا توجد إعادة رفع عامة تلقائية.')
        const retry=h('button',{type:'button',class:'btn btn--secondary'},`إعادة محاولة نشر ${book.title}`) as HTMLButtonElement
        retry.onclick=async()=>{retry.disabled=true;try{centralGuard?.();await centralSave!.save(input);centralGuard?.();status.textContent='تأكد نشر الكتاب للعامة.';retry.remove();onSaved()}catch(error){status.textContent=error instanceof Error?error.message:'تعذّر تأكيد النشر.'}finally{retry.disabled=false}}
        retries.push(h('section',null,status,retry));throw error
      }
    }
    if (mergeParts.checked) {
      let savedId: string | undefined
      try {
        centralGuard?.()
        const item = controls[0]!
        const centralAuthorId=centralSave?item.centralAuthor?.getCentralAuthorId():undefined
        const authors:BookAuthorRef[] = centralAuthorId?[{id:centralAuthorId,name:item.author.value.trim()},...item.coAuthors.map(input=>({name:input.value.trim()})).filter(ref=>ref.name)]:reviewedAuthors(item.author, item.coAuthors, knownAuthors)
        const linkedAuthor = authors[0]
        const mergedCustomCover=centralSave?await readCustomCover(item.customCover.files?.[0]):undefined
        centralGuard?.()
        const id = await saveBook({
          title: mergedTitle.value.trim(), author: item.author.value.trim(),
          ...(linkedAuthor?.id ? { authorId: linkedAuthor.id } : {}),
          authors,
          tags: parseReviewedTags(item.tags.value, item.suggestedTags),
          contemporary: item.contemporary.checked, category: item.category.value,
          coverHue: deterministicCoverHue(`${mergedTitle.value.trim()}|${item.draft.file.name}`),
          ...(centralSave?{
            ...(item.publisher.value.trim()?{publisher:item.publisher.value.trim()}:{}),
            ...(item.edition.value.trim()?{edition:item.edition.value.trim()}:{}),
            ...(item.investigator.value.trim()?{investigator:item.investigator.value.trim()}:{}),
            ...(item.description.value.trim()?{description:item.description.value.trim()}:{}),
            ...(Number(item.publicationYear.value)>0?{publicationYearHijri:Number(item.publicationYear.value)}:{}),
            ...(mergedCustomCover?{customCoverData:mergedCustomCover.data,customCoverMimeType:mergedCustomCover.mimeType}:{}),
          }:{}),
          ...(item.draft.cover ? { coverMediaPath: item.draft.cover.mediaPath } : {}),
          fileName: item.draft.file.name, data: item.draft.data, mimeType: item.draft.file.type,
          ...(item.draft.sourceData ? { sourceData: item.draft.sourceData, sourceMimeType: item.draft.file.type } : {}),
          ...(item.contemporary.checked ? {} : { deathYearHijri: Number(item.death.value) }),
          volumes: controls.map((volume, index) => ({ number: index + 1, fileName: volume.draft.file.name, data: volume.draft.data, mimeType: volume.draft.file.type, ...(volume.draft.sourceData ? { sourceData: volume.draft.sourceData, sourceMimeType: volume.draft.file.type } : {}) })),
          ...wordConsent,
        })
        savedId = id
        centralGuard?.()
        if (manualPdf.checked) await attachReadyPdf(id, pdfFile.files![0]!, controls.length, pdfStarts.value)
        else if (canAutoConvertPdf) await requireAuthoritativeWordImport(id)
        centralGuard?.()
        if(!centralSave)for (let index = 0; index < controls.length; index++) {
          centralGuard?.()
          const volume = controls[index]!
          const mirror = await mirrorLocallySavedBookToAccount({
            localBookId: id,
            sourcePartNumber: index + 1,
            file: volume.draft.file,
            title: `${mergedTitle.value.trim()} — الجزء ${index + 1}`,
            author: item.author.value.trim(),
            category: item.category.value,
          })
          if (mirror.kind === 'local-only') accountMirrorFailures++
          centralGuard?.()
        }
        localBookIndexJobs.enqueue(id,mergedTitle.value.trim(),importOwnerScope)
        if(centralSave)await publishCentral(id,controls.map(item=>item.draft.file))
        success++
      } catch (error) {
        try{centralGuard?.()}catch{return}
        if (savedId&&!centralSave) await deleteBook(savedId).catch(() => undefined)
        failures.push(`${mergedTitle.value}: ${error instanceof Error ? error.message : String(error)}`)
      }
    } else for (const item of controls) {
      let savedId: string | undefined
      try {
        centralGuard?.()
        const centralAuthorId=centralSave?item.centralAuthor?.getCentralAuthorId():undefined
        const authors:BookAuthorRef[] = centralAuthorId?[{id:centralAuthorId,name:item.author.value.trim()},...item.coAuthors.map(input=>({name:input.value.trim()})).filter(ref=>ref.name)]:reviewedAuthors(item.author, item.coAuthors, knownAuthors)
        const linkedAuthor = authors[0]
        const uploadedCustom = await readCustomCover(item.customCover.files?.[0])
        centralGuard?.()
        const custom = uploadedCustom ?? (item.keepPdfCover.checked ? item.draft.pdfFirstPageCover : undefined)
        const metadata: BookIntakeFields = {
          title: item.title.value.trim(), author: item.author.value.trim(), contemporary: item.contemporary.checked, category: item.category.value,
          ...(linkedAuthor?.id ? { authorId: linkedAuthor.id } : {}),
          authors,
          tags: parseReviewedTags(item.tags.value, item.suggestedTags),
          coverHue: deterministicCoverHue(`${item.title.value.trim()}|${item.draft.file.name}`),
          coverTemplate: deterministicCoverTemplate(`${item.title.value.trim()}|${item.draft.file.name}`),
          ...(item.draft.cover ? { coverMediaPath: item.draft.cover.mediaPath } : {}),
          ...(custom ? { customCoverData: custom.data, customCoverMimeType: custom.mimeType } : {}),
          ...(item.contemporary.checked ? {} : { deathYearHijri: Number(item.death.value) }),
          ...(item.publisher.value.trim() ? { publisher: item.publisher.value.trim() } : {}),
          ...(item.edition.value.trim() ? { edition: item.edition.value.trim() } : {}),
          ...(item.investigator.value.trim() ? { investigator: item.investigator.value.trim() } : {}),
          ...(Number(item.publicationYear.value) > 0 ? { publicationYearHijri: Number(item.publicationYear.value) } : {}),
          ...(item.description.value.trim() ? { description: item.description.value.trim() } : {}),
          ...(item.draft.rawSourceMetadata ? { rawSourceMetadata: item.draft.rawSourceMetadata } : {}),
          ...(item.draft.volumeCount ? { volumeCount: item.draft.volumeCount } : {}),
        }
        const id = await saveReviewedDraft(item.draft, metadata, wordConsent)
        savedId = id
        centralGuard?.()
        if (item.draft.format === 'word' && manualPdf.checked) await attachReadyPdf(id, pdfFile.files![0]!, 1, pdfStarts.value)
        else if (item.draft.format === 'word' && !item.draft.companion && canAutoConvertPdf) await requireAuthoritativeWordImport(id)
        centralGuard?.()
        if (item.shelf.value) setBookOnShelf(item.shelf.value, id, true)
        if(!centralSave){const mirror = await mirrorLocallySavedBookToAccount({
          localBookId: id,
          ...(item.draft.companion?{wordCompanion:true}:{}),
          file: item.draft.file,
          title: metadata.title,
          author: metadata.author,
          ...(metadata.category ? { category: metadata.category } : {}),
        })
        if (mirror.kind === 'local-only') accountMirrorFailures++;centralGuard?.()}
        if(item.draft.format==='word')localBookIndexJobs.enqueue(id,metadata.title,importOwnerScope)
        if(centralSave)await publishCentral(id,[item.draft.file])
        success++
      } catch (error) {
        try{centralGuard?.()}catch{return}
        if (savedId&&!centralSave) await deleteBook(savedId).catch(() => undefined)
        failures.push(`${item.draft.file.name}: ${error instanceof Error ? error.message : String(error)}`)
        if(centralSave){try{centralGuard?.()}catch{break}}
      }
    }
    try{centralGuard?.()}catch{return}
    root.replaceChildren(reportBox(success, failures, report.ignored, report.legacyOriginals),...retries,localIndexStatusPanel())
    if (accountMirrorFailures) toast(`حُفظت الكتب محليًا، وتعذّر رفع ${arabicNum(accountMirrorFailures)} منها إلى الحساب؛ بقيت النسخة المحلية ولم تُحذف.`)
    if (success) { onSaved(); window.dispatchEvent(new Event('library-changed')) }
  })
  root.replaceChildren(form)
}

async function requireAuthoritativeWordImport(bookId: string): Promise<void> {
  await convertStoredBookToPdf(bookId, 'office')
  const stored = await getBook(bookId)
  if (!stored) throw new Error('تعذّر استعادة الكتاب بعد معالجة Word')
  const maps = stored.volumes?.length
    ? [...stored.volumes].sort((a, b) => a.number - b.number).map(volume => volume.wordPageMap)
    : [stored.wordPageMap]
  if (!hasAuthoritativeWordPageMaps(maps, maps.length)) {
    throw new Error('أعاد Microsoft Word أثرًا ناقصًا؛ أُلغي الاستيراد ولم تُحفظ نسخة تقديرية')
  }
  await assertStoredWordPageMaps(stored)
}

function reviewedAuthors(primary: HTMLInputElement, additional: HTMLInputElement[], knownAuthors: StoredAuthor[]): BookAuthorRef[] {
  const names = [primary.value, ...additional.map(input => input.value)].map(value => value.trim()).filter(Boolean)
  const unique = names.filter((name, index) => names.findIndex(other => canonicalAuthorName(other) === canonicalAuthorName(name)) === index)
  return unique.map(name => {
    const key = canonicalAuthorName(name)
    const existing = knownAuthors.find(author => author.canonicalName === key || author.aliases.some(alias => canonicalAuthorName(alias) === key))
    return existing ? { name: existing.name, id: existing.id } : { name }
  })
}

async function readCustomCover(file?: File): Promise<{ data: Uint8Array; mimeType: string } | undefined> {
  if (!file) return undefined
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('صيغة الغلاف يجب أن تكون PNG أو JPEG أو WebP')
  if (!file.size || file.size > 5 * 1024 * 1024) throw new Error('حجم الغلاف يجب ألا يتجاوز 5 ميجابايت')
  return { data: new Uint8Array(await file.arrayBuffer()), mimeType: file.type }
}

async function saveReviewedDraft(draft: ImportDraft, metadata: BookIntakeFields, wordConsent?: PaginationConsent): Promise<string> {
  if(draft.companion){
    await validateWordCompanionPackage(draft.companion)
    const id=await saveBook({...metadata,fileName:draft.file.name,data:draft.data,mimeType:draft.file.type,wordPageMap:draft.companion.map,paginationAuthority:'word-map'})
    try{await saveBookPdf(id,draft.companion.pdf,draft.file.name.replace(/\.docx$/i,'.pdf'),draft.companion.map,'microsoft-word-companion-v1');return id}
    catch(error){await deleteBook(id);throw error}
  }
  if (draft.format === 'pdf') return savePdfBook({ ...metadata, fileName: draft.file.name, data: draft.data })
  if (draft.format === 'epub') return saveEpubBook({ ...metadata, fileName: draft.file.name, data: draft.data, extractedText: draft.extractedText ?? '', ...(draft.textToc?.length ? { toc: draft.textToc } : {}) })
  if (draft.format === 'text' || draft.format === 'markdown') return saveTextBook({ ...metadata, fileName: draft.file.name, data: draft.data, sourceFormat: draft.format, ...(draft.textToc?.length ? { toc: draft.textToc } : {}), ...(draft.markdownAssets?.length ? { markdownAssets: draft.markdownAssets } : {}) })
  if (draft.format === 'shamela-bok') return saveBokBook({ ...metadata, fileName: draft.file.name, data: draft.data, extractedText: draft.extractedText ?? '', pages: draft.bokPages ?? [], toc: draft.bokToc ?? [] })
  return saveBook({
    ...metadata,
    fileName: draft.file.name,
    data: draft.data,
    mimeType: draft.file.type,
    ...wordConsent,
    ...(draft.sourceData ? { sourceData: draft.sourceData, sourceMimeType: draft.file.type } : {}),
  })
}

async function attachReadyPdf(bookId: string, file: File, partCount: number, startsText: string): Promise<void> {
  const { PDFDocument } = await import('pdf-lib')
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (new TextDecoder('ascii').decode(bytes.slice(0, 5)) !== '%PDF-') throw new Error('الملف المختار ليس PDF صالحًا')
  const document = await PDFDocument.load(bytes)
  const totalPages = document.getPageCount()
  const parsed = startsText.split(/[،,;\s]+/).map(value => Number(value)).filter(value => Number.isInteger(value) && value > 0)
  const starts = partCount > 1 ? parsed : [parsed[0] ?? 1]
  if (starts.length !== partCount) throw new Error(`أدخل ${partCount} بداية للأجزاء داخل PDF`)
  if (starts.some((start, index) => start > totalPages || (index > 0 && start <= starts[index - 1]!))) throw new Error('بدايات أجزاء PDF يجب أن تكون متزايدة وضمن عدد صفحاته')
  const parts: BookPart[] = starts.map((startPage, index) => ({ number: index + 1, ...(partCount > 1 ? { title: `الجزء ${index + 1}` } : {}), startPage, endPage: (starts[index + 1] ?? totalPages + 1) - 1, wordStartPage: 1 }))
  await saveUploadedPdf(bookId, bytes, file.name, parts)
}

function textInput(label: string, value: string, type = 'text'): HTMLInputElement {
  return h('input', { type, value, 'aria-label': label }) as HTMLInputElement
}

function field(label: string, control: HTMLElement): HTMLElement {
  return h('label', { class: 'import-field' }, h('span', null, label), control)
}

function categorySelect(label = 'التصنيف'): HTMLSelectElement {
  const select = h('select', { 'aria-label': label }) as HTMLSelectElement
  select.appendChild(h('option', { value: '' }, 'اختر التصنيف…'))
  for (const category of BOOK_CATEGORIES) select.appendChild(h('option', { value: category }, category))
  return select
}

interface ReviewControl {
  author: HTMLInputElement
  death: HTMLInputElement
  contemporary: HTMLInputElement
  category: HTMLSelectElement
  syncDeath: () => void
  refreshCover: () => void
}

function batchDefaultsPanel(controls: ReviewControl[]): HTMLElement {
  const author = textInput('مؤلف الدفعة', '')
  author.placeholder = 'اتركه فارغًا لعدم تغيير المؤلف'
  const death = textInput('وفاة الدفعة الهجرية', '', 'number')
  death.min = '1'; death.max = '2000'; death.placeholder = 'اتركها فارغة'
  const contemporary = h('input', { type: 'checkbox' }) as HTMLInputElement
  const category = categorySelect('تصنيف الدفعة')
  const approx = h('small', { class: 'import-approx' }, 'لن تُغيّر الوفاة ما لم تدخل سنة أو تحدد «معاصر»')
  const sync = (): void => {
    death.disabled = contemporary.checked
    if (contemporary.checked) { death.value = ''; approx.textContent = 'سيُطبّق: مؤلف معاصر' }
    else {
      const hijri = Number(death.value)
      approx.replaceChildren(hijri > 0 ? uiTemplateText('import-batch-death',{p1:arabicNum(hijri),p2:arabicNum(approximateGregorianYear(hijri))}) : 'لن تُغيّر الوفاة ما لم تدخل سنة أو تحدد «معاصر»')
    }
  }
  death.addEventListener('input', sync); contemporary.addEventListener('change', sync)
  const status = h('p', { class: 'import-batch__status', role: 'status' }, 'لا توجد بيانات مطبّقة بعد.')
  const apply = h('button', { class: 'btn btn--primary', type: 'button' }, uiTemplateText('import-batch-apply',{p1:arabicNum(controls.length)}))
  const undo = h('button', { class: 'btn btn--secondary', type: 'button' }, 'تراجع عن آخر تطبيق')
  undo.hidden = true
  let snapshot: Array<{ author: string; death: string; contemporary: boolean; category: string }> | null = null
  apply.addEventListener('click', () => {
    const sharedAuthor = author.value.trim()
    const sharedDeath = Number(death.value)
    const hasDeath = contemporary.checked || sharedDeath > 0
    const sharedCategory = category.value
    if (!sharedAuthor && !hasDeath && !sharedCategory) { toast('أدخل مؤلفًا أو وفاة/معاصرًا أو تصنيفًا لتطبيقه'); return }
    snapshot = controls.map((item) => ({ author: item.author.value, death: item.death.value, contemporary: item.contemporary.checked, category: item.category.value }))
    let affected = 0
    for (const item of controls) {
      const before = `${item.author.value}\0${item.death.value}\0${item.contemporary.checked}\0${item.category.value}`
      if (sharedAuthor) item.author.value = sharedAuthor
      if (hasDeath) {
        item.contemporary.checked = contemporary.checked
        item.death.value = contemporary.checked ? '' : String(sharedDeath)
        item.syncDeath()
      }
      if (sharedCategory) item.category.value = sharedCategory
      item.refreshCover()
      const after = `${item.author.value}\0${item.death.value}\0${item.contemporary.checked}\0${item.category.value}`
      if (before !== after) affected++
    }
    status.replaceChildren(affected ? uiTemplateText('import-batch-applied',{p1:arabicNum(affected)}) : 'القيم المحددة مطابقة للقيم الموجودة؛ لم يتغير كتاب.')
    undo.hidden = false
  })
  undo.addEventListener('click', () => {
    if (!snapshot) return
    controls.forEach((item, index) => {
      const previous = snapshot?.[index]
      if (!previous) return
      item.author.value = previous.author
      item.death.value = previous.death
      item.contemporary.checked = previous.contemporary
      item.category.value = previous.category
      item.syncDeath()
      item.refreshCover()
    })
    snapshot = null
    undo.hidden = true
    status.replaceChildren(uiTemplateText('import-batch-undone',{p1:arabicNum(controls.length)}))
  })
  return h('section', { class: 'import-batch', 'aria-labelledby': 'import-batch-title' },
    h('div', { class: 'import-batch__head' }, h('div', null, h('h3', { id: 'import-batch-title' }, 'بيانات مشتركة للدفعة'), h('p', null, 'تُطبّق فقط الحقول التي تحددها؛ عناوين الكتب لا تتغير.')), h('span', null, uiTemplateText('import-book-count',{p1:arabicNum(controls.length)}))),
    h('div', { class: 'import-batch__fields' }, field('المؤلف', author), h('div', { class: 'import-death' }, field('سنة الوفاة (هـ)', death), h('label', { class: 'import-contemporary' }, contemporary, h('span', null, 'معاصر')), approx), field('التصنيف', category)),
    h('div', { class: 'import-batch__actions' }, apply, undo, status),
  )
}

function reportBox(success: number, failures: string[], ignored: number, legacyOriginals: File[] = []): HTMLElement {
  const box = h('div', { class: 'import-report', role: 'status' },
    h('h3', null, success ? uiTemplateText('import-saved-count',{p1:arabicNum(success)}) : 'لم تُحفظ كتب'),
    h('p', null, uiTemplateText('import-report-counts',{p1:arabicNum(success),p2:arabicNum(failures.length),p3:arabicNum(ignored)})),
  )
  if (failures.length) box.appendChild(h('ul', null, ...failures.map((failure) => h('li', null, failure))))
  if (legacyOriginals.length) {
    const originals = h('div', { class: 'import-report__originals' }, h('strong', null, 'ملفات Word الأصلية لم تتغير:'))
    for (const file of legacyOriginals) {
      const download = h('button', { class: 'btn btn--secondary', type: 'button' }, uiTemplateText('import-original-download',{p1:file.name}))
      download.addEventListener('click', async () => downloadArtifact({ content: await file.arrayBuffer(), fileName: file.name, mimeType: file.type || 'application/octet-stream' }))
      originals.appendChild(download)
    }
    box.appendChild(originals)
  }
  return box
}

export async function normalizeLegacyWord(data: Uint8Array, fileName: string): Promise<Uint8Array> {
  const extension = fileName.toLocaleLowerCase().endsWith('.rtf') ? 'rtf' : 'doc'
  const response = await fetch(`/api/convert/word-to-docx?ext=${extension}`, { method: 'POST', body: new Uint8Array(data) })
  if (!response.ok) {
    let message = `تعذّر تحويل ${extension.toUpperCase()} إلى DOCX`
    try { message = (await response.json() as { error?: string }).error ?? message } catch { /* استجابة نصية */ }
    throw new Error(message)
  }
  const docx = new Uint8Array(await response.arrayBuffer())
  if (docx.length < 4 || docx[0] !== 0x50 || docx[1] !== 0x4b) throw new Error('نسخة DOCX المحولة غير صالحة')
  return docx
}
