/*
 * اختبار جسر المشهد — المرحلة 2: بناء SceneDocument من كتاب docx حقيقي عبر
 *  موفّر خطوطٍ يقرأ من public/fonts. المنطق نقّي (لا DOM) فيعمل في node.
 */
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { extractFromDocx } from '@engine/ooxml-model'
import {
  buildBookScene, fontServerProvider, servedFontFile,
  type FontServer,
} from './scene'

const DOCX = new URL('../../public/books/sample-ahadith.docx', import.meta.url)
const FONTS = new URL('../../public/fonts/', import.meta.url)

/** خادم ملفاتٍ للاختبار: قراءة من public/fonts مباشرة. */
const server: FontServer = {
  load: (file) => Promise.resolve(new Uint8Array(readFileSync(new URL(file, FONTS)))),
}

describe('scene — مطابقة خطوط النشر', () => {
  it('يرسم وجوه Al-Jazeera إلى ملفاتها', () => {
    expect(servedFontFile('Aljazeera', false)).toBe('Al-Jazeera-Arabic-Regular.ttf')
    expect(servedFontFile('Al-Jazeera Arabic', false)).toBe('Al-Jazeera-Arabic-Regular.ttf')
    expect(servedFontFile('Al-Jazeera Arabic', true)).toBe('Al-Jazeera-Arabic-Bold.ttf')
    expect(servedFontFile('al-jazeera-arabic-light', false)).toBe('Al-Jazeera-Arabic-Light.ttf')
  })

  it('يرسم العائلات الشائعة إلى بديلها', () => {
    expect(servedFontFile('Traditional Arabic', true)).toBe('tradbdo.ttf')
    expect(servedFontFile('Trad Arabic', false)).toBe('trado.ttf')
  })

  it('يُسقط العائلة الغائبة إلى الخط الاحتياطي', async () => {
    expect(servedFontFile('عائلة غائبة', false)).toBeNull()
    const provider = fontServerProvider(server)
    const bytes = await provider.resolveFont({ family: 'عائلة غائبة' })
    expect(bytes).not.toBeNull()
  })
})

describe('scene — بناء مشهد كتاب حقيقي', () => {
  const model = extractFromDocx(readFileSync(DOCX))
  let doc!: Awaited<ReturnType<typeof buildBookScene>>

  beforeAll(async () => {
    doc = await buildBookScene(model, { server })
  })

  it('ينتج صفحاتٍ بمقاييس هندسية صحيحة', () => {
    expect(doc.pages.length).toBeGreaterThan(1)
    for (const page of doc.pages) {
      expect(page.widthTwips).toBeGreaterThan(0)
      expect(page.heightTwips).toBeGreaterThan(0)
      expect(page.paragraphs.length).toBeGreaterThan(0)
    }
  })

  it('يكسر الفقرات إلى سطورٍ وكلماتٍ مشكّلة بغليفات', () => {
    let shapedWords = 0
    let glyphs = 0
    for (const page of doc.pages) {
      for (const para of page.paragraphs) {
        for (const line of para.lines) {
          for (const word of line.words) {
            shapedWords++
            glyphs += word.glyphs.length
            expect(word.fontIndex).toBeGreaterThanOrEqual(0)
            expect(word.fontIndex).toBeLessThan(doc.fonts.length)
          }
        }
      }
    }
    expect(shapedWords).toBeGreaterThan(10)
    expect(glyphs).toBeGreaterThan(50)
  })

  it('يحلّ الخطوط عبر الموفّر ويحفظ البايتات للترسيم', () => {
    expect(doc.fonts.length).toBeGreaterThan(0)
    for (const f of doc.fonts) {
      expect(f.family.length).toBeGreaterThan(0)
      expect(f.data.length).toBeGreaterThan(0)
      expect(f.upem).toBeGreaterThan(0)
    }
  })

  it('لا يفقد نصًّا: مجموعة حروف الكلمات تطابق متن النموذج', () => {
    const sceneText = doc.pages
      .flatMap((p) => p.paragraphs.flatMap((par) => par.lines.flatMap((ln) => ln.words.map((w) => w.text))))
      .join(' ')
    const bodyText = model.paragraphs
      .filter((p) => !p.excluded && !p.tableCell && p.text.trim())
      // المشهد يرسم النص المرئي للـrun؛ sourceText يحتفظ بالمحرف المنطقي
      // الأصلي لرموز Word (مثل '(' مقابل glyph خاص PUA) ولا يجوز مقارنته بالرسم.
      .map((p) => p.runs.filter((run) => !run.hidden).map((run) => run.text).join('').trim())
      .join(' ')
    // ترتيب الكلمات في المشهد بصري (RTL يعكس المنطقي) — المقارنة بمجموعة
    // المحارف (مطابقة متعددٍ) بعد طمس كل المسافات، فتثبت عدم فقدان نصٍّ
    const sceneChars = sceneText.replace(/\s+/g, '').split('').sort().join('')
    const bodyChars = bodyText.replace(/\s+/g, '').split('').sort().join('')
    expect(sceneChars).toBe(bodyChars)
  })
})
