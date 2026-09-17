export type QuranVerseResourceKind = 'gharib' | 'qiraat' | 'tasrif' | 'irab'

export interface QuranVerseResourceEntry {
  ayah: number
  from: number
  to: number
  text: string
}

export interface QuranVerseResourceResult {
  title: string
  author: string
  entries: QuranVerseResourceEntry[]
}

const definitions: Record<QuranVerseResourceKind, string[]> = {
  gharib: ['gharib-ibn-qutaybah'],
  qiraat: ['surahpedia-qiraat-word'],
  tasrif: ['surahpedia-tasrif-word'],
  // لا يُسقط المورد السابق قبل اكتمال حزمة موسوعة سورة؛ الحزمة الجديدة
  // مقدمة، والقديمة fallback موثق لا ملء تخمينيًا.
  irab: ['surahpedia-irab-word', 'irab-darwish'],
}
const titles: Record<QuranVerseResourceKind, string> = { gharib: 'غريب القرآن', qiraat: 'القراءات', tasrif: 'التصريف', irab: 'إعراب القرآن' }
const cache = new Map<string, Promise<QuranVerseResourceResult>>()

/** يقرأ الحزمة المحلية الموثقة للسورة وحدها ولا يدّعي اكتمال آية غير مغطاة. */
export async function loadQuranVerseResource(kind: QuranVerseResourceKind, surah: number, ayah: number): Promise<QuranVerseResourceResult | undefined> {
  if (!Number.isInteger(surah) || surah < 1 || surah > 114 || !Number.isInteger(ayah) || ayah < 1) return undefined
  const slugs = definitions[kind], key = `${kind}:${surah}`
  let pending = cache.get(key)
  if (!pending) {
    pending = (async () => {
      for (const slug of slugs) {
        const response = await fetch(`./quran/resources/packs/${slug}/${surah}.json`, { credentials: 'same-origin', cache: 'force-cache' })
        if (!response.ok) continue
        const value = await response.json() as { kind?: string; title?: string; author?: string; records?: QuranVerseResourceEntry[] }
        if (value.kind !== kind || !Array.isArray(value.records)) throw new Error('quran-resource-invalid')
        return { title: value.title ?? titles[kind], author: value.author ?? '', entries: value.records }
      }
      throw new Error('quran-resource-unavailable')
    })()
    cache.set(key, pending)
  }
  const resource = await pending
  const entries = resource.entries.filter(entry => entry.from <= ayah && entry.to >= ayah && entry.text?.trim())
  return entries.length ? { ...resource, entries } : undefined
}
