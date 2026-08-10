/*
 * جسرُ المشهد — المرحلة 2 (عقد SPEC): يربط قشرة app بمحرّكي scene/paint.
 *
 * الاتجاه: app ⟵ scene ⟵ (layout, shaper, font-system) — لا العكس.
 * مسؤولياته:
 *  1) موفِّر خطوطٍ يُجلب من public/fonts ويخزّن البايتات (كاش لكل ملف)
 *  2) buildBookScene: نموذج ooxml ⟵ SceneDocument (تقسيم صفحاتٍ حقيقي)
 *
 * نقّيٌ من DOM في جوهره (الموفِّر يستقبل دالة تحميل) — يُختبر في node.
 * الخطوط المُقدَّمة هنا هي مرجع النشر؛ أي عائلة غائبة تسقط إلى
 *  Al-Jazeera-Arabic-Regular (بديل آمن للنص العربي، أدلّته في AGENTS.md).
 */

import { buildScene, type BuildOptions, type SceneDocument } from '@engine/scene'
import { familyCandidates, normalizeFamily, type FontProvider } from '@engine/font-system'
import type { DocumentModelV0 } from '@engine/ooxml-model'

/** خطٌّ خادم النشر: اسمٌ منسّق ⟵ ملفٌ في public/fonts. */
export const SERVED_FONTS: Record<string, string> = {
  'aljazeera': 'Al-Jazeera-Arabic-Regular.ttf',
  'aljazeera regular': 'Al-Jazeera-Arabic-Regular.ttf',
  'aljazeera bold': 'Al-Jazeera-Arabic-Bold.ttf',
  'al-jazeera arabic': 'Al-Jazeera-Arabic-Regular.ttf',
  'al-jazeera arabic regular': 'Al-Jazeera-Arabic-Regular.ttf',
  'al-jazeera arabic bold': 'Al-Jazeera-Arabic-Bold.ttf',
  'al-jazeera arabic light': 'Al-Jazeera-Arabic-Light.ttf',
  'al-jazeera-arabic-regular': 'Al-Jazeera-Arabic-Regular.ttf',
  'al-jazeera-arabic-bold': 'Al-Jazeera-Arabic-Bold.ttf',
  'al-jazeera-arabic-light': 'Al-Jazeera-Arabic-Light.ttf',
  'trad arabic': 'trado.ttf',
  'trad arabic bold': 'tradbdo.ttf',
  'traditional arabic': 'trado.ttf',
  'traditional arabic bold': 'tradbdo.ttf',
  'sakkal majalla': 'majalla.ttf',
  'sakkal majalla bold': 'majallab.ttf',
  'majalla': 'majalla.ttf',
  'majalla bold': 'majallab.ttf',
  'trado': 'trado.ttf',
  'tradbdo': 'tradbdo.ttf',
  'adwa assalaf': 'adwa-assalaf.ttf',
  'adwa-assalaf': 'adwa-assalaf.ttf',
}

export const FALLBACK_FONT_FILE = 'Al-Jazeera-Arabic-Regular.ttf'

/** ملفُ الخدمة لعائلة (ترتيب المرشحين: عائلة+عريض ثم العائلة المجردة). */
export function servedFontFile(family: string, bold?: boolean, italic?: boolean, served = SERVED_FONTS): string | null {
  for (const candidate of familyCandidates(family, bold, italic)) {
    const file = served[normalizeFamily(candidate)]
    if (file) return file
  }
  return null
}

/** خادم تحميل الملفات — المتصفح يجلب، الاختبار يقرأ من القرص. */
export interface FontServer {
  load(file: string): Promise<Uint8Array>
}

/** موفِّر خطوطٍ من خادم ملفات + سجلّ أسماء. كاشٌ لكل ملف. */
export function fontServerProvider(server: FontServer, served = SERVED_FONTS, fallbackFile = FALLBACK_FONT_FILE): FontProvider {
  const cache = new Map<string, Promise<Uint8Array>>()
  const load = (file: string): Promise<Uint8Array> => {
    let p = cache.get(file)
    if (!p) {
      p = server.load(file)
      cache.set(file, p)
    }
    return p
  }
  return {
    async resolveFont(req) {
      const hit = servedFontFile(req.family, req.bold, req.italic, served)
      if (hit) return load(hit)
      if (req.fallbackFamily) {
        const fb = servedFontFile(req.fallbackFamily, undefined, undefined, served)
        if (fb) return load(fb)
      }
      return load(fallbackFile)
    },
  }
}

/** خادم متصفّح: مسارٌ نسبيٌّ إلى جذر public. */
export function browserFontServer(base = '/fonts/'): FontServer {
  return {
    async load(file) {
      const res = await fetch(`${base}${file}`)
      if (!res.ok) throw new Error(`خطٌّ غير موجود: ${file} (${res.status})`)
      const buf = await res.arrayBuffer()
      return new Uint8Array(buf)
    },
  }
}

/** يبني مشهدَ الكتاب كاملًا (تقسيم صفحاتٍ هندسيّ حقيقي عبر buildScene). */
export async function buildBookScene(model: DocumentModelV0, opts?: BuildOptions & { server?: FontServer }): Promise<SceneDocument> {
  const provider = fontServerProvider(opts?.server ?? browserFontServer())
  return buildScene(model, provider, opts)
}
