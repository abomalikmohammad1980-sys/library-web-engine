export type QuranVerseResourceKind = 'gharib' | 'qiraat' | 'tasrif' | 'irab'

export interface QuranVerseResourceEntry {
  ayah: number
  from: number
  to: number
  text: string
  word?: string
  meaning?: string
}

export interface QuranVerseResourceResult {
  title: string
  author: string
  entries: QuranVerseResourceEntry[]
}

const definitions: Record<QuranVerseResourceKind, string[]> = {
  // المصدر المعتمد حصراً: الحزمة الرسمية الصادرة عن مجمع الملك فهد.
  gharib: ['kfgqpc-muyassar-gharib'],
  qiraat: ['surahpedia-qiraat-word'],
  tasrif: ['surahpedia-tasrif-word'],
  // Fail closed: لا يقبل الإعراب إلا حزمة فريق تفسير المتفق عليها.
  irab: ['surahpedia-irab-word'],
}
const titles: Record<QuranVerseResourceKind, string> = { gharib: 'غريب القرآن', qiraat: 'القراءات', tasrif: 'التصريف', irab: 'إعراب القرآن' }
const cache = new Map<string, Promise<QuranVerseResourceResult | undefined>>()

/** يقرأ الحزمة المحلية الموثقة للسورة وحدها ولا يدّعي اكتمال آية غير مغطاة. */
export async function loadQuranVerseResource(kind: QuranVerseResourceKind, surah: number, ayah: number, retry = false): Promise<QuranVerseResourceResult | undefined> {
  if (!Number.isInteger(surah) || surah < 1 || surah > 114 || !Number.isInteger(ayah) || ayah < 1) return undefined
  const slugs = definitions[kind], key = `${kind}:${surah}:${ayah}`
  if (retry) cache.delete(key)
  let pending = cache.get(key)
  if (!pending) {
    pending = (async () => {
      let foundValidPack = false
      for (const slug of slugs) {
        try {
          const response = await fetch(`./quran/resources/packs/${slug}/${surah}.json`, { credentials: 'same-origin', cache: retry ? 'reload' : 'force-cache' })
          if (!response.ok) continue
          const value = await response.json() as { kind?: string; slug?: string; title?: string; author?: string; records?: QuranVerseResourceEntry[] }
          if (value.kind !== kind || !Array.isArray(value.records)) continue
          if (kind === 'gharib' && (value.slug !== 'kfgqpc-muyassar-gharib' || value.author !== 'مجمع الملك فهد لطباعة المصحف الشريف')) continue
          if (kind === 'irab' && (value.slug !== 'surahpedia-irab-word' || value.author !== 'الفريق العلمي بمركز تفسير للدراسات القرآنية')) continue
          foundValidPack = true
          const entries = value.records.filter(entry => entry.from <= ayah && entry.to >= ayah && entry.text?.trim())
          if (entries.length) return { title: value.title ?? titles[kind], author: value.author ?? '', entries }
        } catch { /* جرّب الحزمة الاحتياطية إن أعاد خادم SPA صفحة shell أو ملفًا تالفًا. */ }
      }
      if (foundValidPack) return undefined
      throw new Error('quran-resource-unavailable')
    })()
    cache.set(key, pending)
    // لا نثبت رفض الشبكة في الكاش؛ زر إعادة المحاولة يستدعي الدالة نفسها
    // ويجب أن ينشئ fetch جديدًا بدل إعادة Promise مرفوضة قديمة.
    pending.catch(() => cache.delete(key))
  }
  const resource = await pending
  return resource
}
