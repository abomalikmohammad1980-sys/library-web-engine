import { pageContent } from '../components'
import { ACCESSIBLE_SCALE_MAX, getSettings, INTERFACE_SCALE_MIN, READER_SCALE_MIN, resetSettings, saveSettings, type AppSettings } from '../settings_store'
import { arabicNum, h, toast } from '../ui'
import { currentReadingData, importReadingDataFile } from '../reading_data'
import { capabilitySummary, offlineCapabilities, type OfflineCapability } from '../offline_policy'
import { makeProgrammaticFileInput } from '../programmatic_file_input'
import { downloadArtifact } from '../artifact_download'
import { listBooks, restoreArchivedBook } from '../engine/library_store'
import { buildLibraryArchive } from '../library_archive'
import { parseLibraryArchive, previewLibraryArchive, restoreLibraryArchive, type ArchiveConflictPolicy } from '../library_archive_restore'
import { connectAppSourceSync, presentSourceSync, type AppSourceSyncGateway } from '../source_sync_ui'
import { captureRouteResourceScope, routeEventListener } from '../resource_lifecycle'
import { brandMark } from '../brand'
import { publicPageHero } from '../public_page_hero'
import { resolveUiLabel } from '../ui_dictionary_loader'
import { uiTemplateText } from '../ui_template_binding'

export function settingsScreen(): HTMLElement {
  const resourceScope = captureRouteResourceScope()
  let settings = getSettings()
  const root = pageContent(
    publicPageHero({ eyebrow: 'الإعدادات', title: 'اجعل الخِزانة كما ترتاح لها', titleId: 'settings-title', description: 'تُطبق التغييرات فورًا، وتبقى محفوظة على هذا الجهاز.', className: 'settings-hero' }),
  )
  root.classList.add('settings-page')
  const interfaceRange = rangeControl('حجم واجهة الموقع', 'يكبّر القوائم والأزرار والنصوص خارج صفحات Word حتى ٢٠٠٪.', INTERFACE_SCALE_MIN, ACCESSIBLE_SCALE_MAX, settings.interfaceScale)
  const readerRange = rangeControl('حجم صفحة القراءة', 'يكبّر الورقة بصريًا من دون تغيير فواصل Word أو محتواها حتى ٢٠٠٪.', READER_SCALE_MIN, ACCESSIBLE_SCALE_MAX, settings.readerScale)
  const contrast = switchControl('تباين مرتفع', 'حدود أوضح وألوان أقوى لضعف البصر.', settings.highContrast)
  const motion = switchControl('تقليل الحركة', 'يلغي الانتقالات والحركة السلسة قدر الإمكان.', settings.reduceMotion)
  const theme = themeControl(settings.theme ?? 'original')
  const commit = (): void => {
    settings = { interfaceScale: Number(interfaceRange.input.value), readerScale: Number(readerRange.input.value), highContrast: contrast.input.checked, reduceMotion: motion.input.checked, theme: theme.input.value as NonNullable<AppSettings['theme']> }
    saveSettings(settings)
    interfaceRange.value.textContent = `${arabicNum(settings.interfaceScale)}٪`
    readerRange.value.textContent = `${arabicNum(settings.readerScale)}٪`
  }
  interfaceRange.input.addEventListener('input', commit)
  readerRange.input.addEventListener('input', commit)
  contrast.input.addEventListener('change', commit)
  motion.input.addEventListener('change', commit)
  theme.input.addEventListener('change', commit)
  const reset = h('button', { class: 'btn btn--secondary', type: 'button' }, 'استعادة الإعدادات الأصلية')
  reset.addEventListener('click', () => {
    settings = resetSettings()
    interfaceRange.input.value = String(settings.interfaceScale); readerRange.input.value = String(settings.readerScale)
    contrast.input.checked = settings.highContrast; motion.input.checked = settings.reduceMotion
    theme.input.value = settings.theme ?? 'original'
    interfaceRange.value.textContent = `${arabicNum(settings.interfaceScale)}٪`; readerRange.value.textContent = `${arabicNum(settings.readerScale)}٪`
    toast('استُعيدت الإعدادات الأصلية')
  })
  const exportButton = h('button', { class: 'btn btn--primary', type: 'button' }, 'تصدير بيانات القراءة')
  exportButton.addEventListener('click', () => exportReadingData())
  const exportLibrary = h('button', { class: 'btn btn--secondary', type: 'button' }, 'تصدير أرشيف المكتبة الكامل') as HTMLButtonElement
  exportLibrary.addEventListener('click', async () => { exportLibrary.disabled = true; try { const books = await listBooks(); if (!books.length) { toast('لا توجد كتب لأرشفتها'); return } const bytes = buildLibraryArchive(books); downloadArtifact({ fileName: `alkhizana-library-${new Date().toISOString().slice(0, 10)}.zip`, mimeType: 'application/zip', content: bytes.slice().buffer as ArrayBuffer }); toast(`جُهز أرشيف ${arabicNum(books.length)} كتاب`) } catch { toast('تعذّر تجهيز أرشيف المكتبة') } finally { exportLibrary.disabled = false } })
  const archivePolicy = h('select', { 'aria-label': 'سياسة تعارض معرفات أرشيف المكتبة' }, h('option', { value: 'skip' }, 'تجاوز الكتب الموجودة'), h('option', { value: 'replace-as-new' }, 'استيراد المتعارض كنسخة جديدة'), h('option', { value: 'replace-same' }, 'استبدال الكتاب ذي المعرف نفسه')) as HTMLSelectElement
  const archiveInput = makeProgrammaticFileInput(h('input', { type: 'file', accept: '.zip,application/zip' }) as HTMLInputElement), archiveImport = h('button', { class: 'btn btn--secondary', type: 'button' }, 'استعادة أرشيف المكتبة') as HTMLButtonElement
  archiveImport.addEventListener('click', () => archiveInput.click())
  archiveInput.addEventListener('change', async () => { const file = archiveInput.files?.[0]; if (!file) return; archiveImport.disabled = true; try { const candidates = await parseLibraryArchive(new Uint8Array(await file.arrayBuffer())), existing = new Set((await listBooks()).map(book => book.id)), preview = previewLibraryArchive(candidates, existing), policy = archivePolicy.value as ArchiveConflictPolicy; const warning = policy === 'replace-same' ? ' ستُستبدل الكتب المتعارضة بمعاملة مستقلة لكل كتاب.' : ''; const prompt = `المعاينة: ${arabicNum(preview.total)} كتاب، منها ${arabicNum(preview.conflicts)} متعارض.${warning} لا تُستورد بيانات القراءة من هذا ZIP. متابعة؟`; if (!confirm(await resolveUiLabel(prompt, document.documentElement.dataset.siteLanguage ?? 'ar'))) { toast('أُلغيت الاستعادة بلا تغيير'); return } const report = await restoreLibraryArchive(candidates, existing, policy, restoreArchivedBook); toast(`استُعيد ${arabicNum(report.imported)} · تُجاوز ${arabicNum(report.skipped)} · فشل ${arabicNum(report.failed.length)}`); if (report.imported) window.dispatchEvent(new CustomEvent('library-changed')) } catch (error) { toast(error instanceof Error ? error.message : 'تعذّر استعادة الأرشيف') } finally { archiveImport.disabled = false; archiveInput.value = '' } })
  const importInput = makeProgrammaticFileInput(h('input', { type: 'file', accept: 'application/json,.json' }) as HTMLInputElement)
  const importButton = h('button', { class: 'btn btn--secondary', type: 'button' }, 'استيراد نسخة محفوظة') as HTMLButtonElement
  const importStatus = h('p', { class: 'settings-import-status', role: 'status', 'aria-live': 'polite' }, 'يُدمج المستورد مع بيانات هذا الجهاز ولا يحذف المحفوظات الحالية.')
  importButton.addEventListener('click', () => importInput.click())
  importInput.addEventListener('change', async () => {
    const file = importInput.files?.[0]
    if (!file) return
    importButton.disabled = true; importStatus.replaceChildren(uiTemplateText('35a8b5d266365424',{p1:file.name}))
    try {
      const confirmation = await resolveUiLabel('ستُدمج الرفوف والعلامات والملاحظات والنشاط مع بيانات هذا الجهاز. هل تريد المتابعة؟', document.documentElement.dataset.siteLanguage ?? 'ar')
      if (resourceScope.disposed) return
      const merged = await importReadingDataFile(file, () => confirm(confirmation))
      if (!merged) { importStatus.textContent = 'أُلغي الاستيراد ولم تتغير البيانات.'; return }
      settings = merged.settings
      interfaceRange.input.value = String(settings.interfaceScale); readerRange.input.value = String(settings.readerScale)
      contrast.input.checked = settings.highContrast; motion.input.checked = settings.reduceMotion
      theme.input.value = settings.theme ?? 'original'
      interfaceRange.value.textContent = `${arabicNum(settings.interfaceScale)}٪`; readerRange.value.textContent = `${arabicNum(settings.readerScale)}٪`
      importStatus.textContent = `تم الدمج: ${arabicNum(merged.annotations.notes.length)} ملاحظة، ${arabicNum(merged.annotations.highlights.length)} تظليل، ${arabicNum(merged.shelves.length)} رف.`
      toast('استُوردت بيانات القراءة ودمجت بنجاح')
    } catch (error) {
      importStatus.textContent = error instanceof Error ? error.message : 'تعذّر قراءة نسخة البيانات'
      toast('لم تتغير بياناتك الحالية')
    } finally { importButton.disabled = false; importInput.value = '' }
  })
  root.append(
    h('section', { class: 'settings-panel', 'aria-labelledby': 'appearance-title' }, h('div', { class: 'settings-panel__head' }, h('h2', { id: 'appearance-title' }, 'القراءة والوصول'), h('p', null, 'خيارات عملية لا تغيّر أمانة النص الأصلي.')), theme.element, interfaceRange.element, readerRange.element, contrast.element, motion.element, h('div', { class: 'settings-actions' }, reset)),
    h('section', { class: 'settings-panel', 'aria-labelledby': 'data-title' }, h('div', { class: 'settings-panel__head' }, h('h2', { id: 'data-title' }, 'بياناتك لك'), h('p', null, 'نزّل نسخة JSON مفتوحة من نشاط القراءة، أو أرشيف ZIP كاملًا يضم فهرس الكتب وملفات Word وPDF المتاحة.')), h('div', { class: 'settings-export' }, h('div', null, h('p', null, 'يمكنك الاحتفاظ بالنسخة أو نقل ملفاتك دون اتصال أو خدمة سحابية.'), importStatus), h('div', { class: 'settings-export__actions' }, exportButton, exportLibrary, archivePolicy, archiveImport, archiveInput, importButton, importInput))),
    sourceSyncPanel(window.__KHIZANA_SOURCE_SYNC__),
    offlineStatusPanel(resourceScope),
    h('section', { class: 'settings-panel settings-about', 'aria-labelledby': 'about-alkhizana-title' },
      brandMark('settings-about__brand brand-mark'),
      h('div', null, h('p', { class: 'page-eyebrow' }, 'عن المشروع'), h('h2', { id: 'about-alkhizana-title' }, 'الخِزانة'), h('p', null, 'مكتبة عربية تجمع أمانة الملفات الأصلية والقراءة والبحث والتنظيم في تطبيق واحد.')),
    ),
  )
  return root
}

function sourceSyncPanel(gateway?: AppSourceSyncGateway): HTMLElement {
  const status = h('div', { class: 'source-sync-card', role: 'status', 'aria-live': 'polite' })
  const actions = h('div', { class: 'settings-actions' })
  const panel = h('section', { class: 'settings-panel', 'aria-labelledby': 'source-sync-title' },
    h('div', { class: 'settings-panel__head' }, h('h2', { id: 'source-sync-title' }, 'الحساب ومزامنة المصادر'), h('p', null, 'بوابة اختيارية؛ لا تسجيل دخول وهميًا ولا رفع دون حساب ومزود مفعّلين.')),
    status, actions,
  )
  const render = (state: Parameters<typeof presentSourceSync>[0]): void => {
    const view = presentSourceSync(state, gateway)
    status.className = `source-sync-card source-sync-card--${view.tone}`
    status.replaceChildren(h('strong', null, view.title), h('p', null, view.detailBinding ? uiTemplateText(view.detailBinding.id,view.detailBinding.parameters) : view.detail), state.usage ? h('small', null, uiTemplateText('8033e117e94730fe',{p1:state.usage.committedBytes,p2:state.usage.maxAccountStorageBytes})) : h('small', null, 'لا تُرسل بيانات القراءة ضمن مزامنة مصادر الكتب.'))
    actions.replaceChildren()
    if (view.canRefresh) { const refresh = h('button', { class: 'btn btn--secondary', type: 'button' }, 'تحديث الحالة') as HTMLButtonElement; refresh.addEventListener('click', () => { refresh.disabled = true; void connectAppSourceSync(gateway, render).finally(() => { refresh.disabled = false }) }); actions.append(refresh) }
    if (view.canSignIn) { const signIn = h('button', { class: 'btn btn--primary', type: 'button' }, 'تسجيل الدخول عبر المزود') as HTMLButtonElement; signIn.addEventListener('click', () => gateway?.requestSignIn?.()); actions.append(signIn) }
  }
  void connectAppSourceSync(gateway, render)
  return panel
}

function offlineStatusPanel(resourceScope = captureRouteResourceScope()): HTMLElement {
  const panel = h('section', { class: 'settings-panel offline-status', 'aria-labelledby': 'offline-status-title' })
  const render = (): void => {
    const items = offlineCapabilities(navigator.onLine, Boolean((window as Window & { electronAPI?: unknown; __TAURI__?: unknown }).electronAPI || (window as Window & { __TAURI__?: unknown }).__TAURI__))
    const summary = capabilitySummary(items)
    panel.replaceChildren(
      h('div', { class: 'settings-panel__head' }, h('h2', { id: 'offline-status-title' }, 'العمل دون اتصال'), h('p', { role: 'status', 'aria-live': 'polite' }, navigator.onLine ? `${arabicNum(summary.available)} خدمات محلية جاهزة؛ الاتصال متاح.` : `${arabicNum(summary.available)} خدمات جاهزة الآن، و${arabicNum(summary.unavailable)} تحتاج اتصالًا أو أداة جهاز.`)),
      h('div', { class: 'offline-status__list' }, ...items.map(offlineCapabilityRow)),
    )
  }
  routeEventListener(window, 'online', render, undefined, resourceScope)
  routeEventListener(window, 'offline', render, undefined, resourceScope)
  render()
  return panel
}

function offlineCapabilityRow(item: OfflineCapability): HTMLElement {
  const ready = item.availability !== 'connection-required'
  const status = item.availability === 'device-only' ? 'عبر هذا الجهاز' : ready ? 'متاح دون اتصال' : 'يحتاج اتصالًا'
  return h('article', { class: `offline-capability${ready ? ' is-ready' : ''}` },
    h('span', { class: 'offline-capability__mark', 'aria-hidden': 'true' }, ready ? '✓' : '•'),
    h('span', null, h('strong', null, item.label), h('small', null, item.detail)),
    h('em', null, status),
  )
}

function rangeControl(title: string, description: string, min: number, max: number, current: number): { element: HTMLElement; input: HTMLInputElement; value: HTMLElement } {
  const input = h('input', { type: 'range', min: String(min), max: String(max), value: String(current), step: '5', 'aria-label': title }) as HTMLInputElement
  const value = h('output', null, `${arabicNum(current)}٪`)
  return { input, value, element: h('label', { class: 'settings-row settings-row--range' }, h('span', null, h('strong', null, title), h('small', null, description)), h('span', { class: 'settings-range' }, input, value)) }
}

function switchControl(title: string, description: string, checked: boolean): { element: HTMLElement; input: HTMLInputElement } {
  const input = h('input', { type: 'checkbox' }) as HTMLInputElement
  input.checked = checked
  return { input, element: h('label', { class: 'settings-row' }, h('span', null, h('strong', null, title), h('small', null, description)), h('span', { class: 'settings-switch' }, input, h('span', { 'aria-hidden': 'true' }))) }
}

function themeControl(current: NonNullable<AppSettings['theme']>): { element: HTMLElement; input: HTMLSelectElement } {
  const input = h('select', { class: 'settings-theme-select', 'aria-label': 'سمة ألوان الخِزانة' },
    h('option', { value: 'original' }, 'الأصلية'),
    h('option', { value: 'light' }, 'البيضاء'),
    h('option', { value: 'dark' }, 'السوداء'),
    h('option', { value: 'sepia' }, 'البنية الدافئة'),
  ) as HTMLSelectElement
  input.value = current
  return { input, element: h('label', { class: 'settings-row' }, h('span', null, h('strong', null, 'ألوان الخِزانة'), h('small', null, 'تغيّر واجهة التطبيق والقارئ، ولا تقلب صور PDF أو صفحات Word الأصلية.')), input) }
}

function exportReadingData(): void {
  const payload = currentReadingData()
  downloadArtifact({ fileName: `alkhizana-reading-data-${new Date().toISOString().slice(0, 10)}.json`, mimeType: 'application/json;charset=utf-8', content: JSON.stringify(payload, null, 2) })
  toast('تم تجهيز نسخة بيانات القراءة')
}
