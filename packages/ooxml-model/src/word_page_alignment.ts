import type {BodyParagraph,DocumentModelV0} from './index.js'
export interface WordAlignmentMap {totalPages:number;paragraphs?:Array<{text:string;physicalPage:number;paragraphIndex:number}>}
// U+000E يظهر من Word COM كعلامة بنيوية لبداية بعض فقرات الحقول/الفهارس،
// وU+0001 قد يظهر كفقرة Range بنيوية قرب نهاية المستند. كلاهما لا يمثل
// محرفًا مؤلفًا ولا يظهر في OOXML المرئي.
export const normalizeWordPageText = (value: string): string => value.replace(/[\r\u0001\u0007\u000e]/g, ' ').replace(/\s+/g, ' ').trim()

/** U+0002 هي علامة إحالة الحاشية في Word COM، لا حرفًا مؤلفًا. */
function matchesWordPageText(wordValue: string, modelValue: string): boolean {
  if (wordValue === modelValue) return true
  if (!wordValue.includes('\u0002')) return false
  const escaped = wordValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\u0002/g, '[0-9٠-٩]+')
  return new RegExp(`^${escaped}$`, 'u').test(modelValue)
}

/** فروق تمثيل موثقة لا تعني اختلاف الفقرة أو ملكية الصفحة. */
export function matchesWordPageParagraph(wordValue: string, paragraph: BodyParagraph): boolean {
  const word = normalizeWordPageText(wordValue), model = normalizeWordPageText(paragraph.text)
  // COM emits one slash per inline picture, including multiple pictures in
  // one empty paragraph. Require exact structural ownership, never ignore
  // authored slashes or unmatched image counts.
  if(!model&&/^\/+$/u.test(word)&&word.length===paragraph.anchors?.filter(anchor=>anchor.inlineFlow).length)return true
  if (matchesWordPageText(word, model)) return true
  // COM Range.Text exports the verified symbol-font slots as '(' even when a
  // paragraph also contains ordinary Arabic. Only slots proved by font-bearing
  // runs participate; neither the source text nor fragment offsets are changed.
  const provedSymbolRun = (run: BodyParagraph['runs'][number]): boolean =>
    /^(?:AGA Arabesque|KFGQPC Arabic Symbols 01)$/iu.test(run.family ?? '')
    || (/^Symbol$/iu.test(run.family ?? '') && run.text === '\uf0d2'
      && run.noteRef?.custom === true && run.noteRef.customMark === '\uf0d2')
  const symbols = new Set(paragraph.runs.filter(provedSymbolRun)
    .flatMap(run => [...run.text].filter(char => /[\uF000-\uF0FF]/u.test(char))))
  for (const char of symbols) {
    const unproved = paragraph.runs.some(run => run.text.includes(char)
      && !provedSymbolRun(run))
    if (unproved) symbols.delete(char)
  }
  const comparableModel = normalizeWordPageText([...paragraph.text].map(char => symbols.has(char) ? '(' : char).join(''))
  if (symbols.size && matchesWordPageText(word, comparableModel)) return true
  // A single inline drawing separated from text by a boundary line break has
  // a COM '/' sentinel. Requiring both structures avoids stripping authored '/'.
  if (paragraph.anchors?.filter(anchor => anchor.inlineFlow).length === 1) {
    if (/^\s*\n/u.test(paragraph.text) && word.startsWith('/ ')
      && matchesWordPageText(word.slice(2), comparableModel)) return true
    if (/\n\s*$/u.test(paragraph.text) && word.endsWith(' /')
      && matchesWordPageText(word.slice(0, -2), comparableModel)) return true
  }
  // بعض إصدارات Word COM تعيد موضع إحالة الحاشية داخل القوسين فراغًا
  // `( )` بدل الرقم الذي يحفظه OOXML. لا نقبل هذا الفرق إلا إذا أثبت نموذج
  // الفقرة نفسه وجود w:footnoteReference/w:endnoteReference، وبعدد المواضع
  // نفسه؛ وهكذا لا تتحول الأقواس الفارغة المؤلَّفة إلى wildcard عام.
  if (paragraph.runs.some(run => run.noteRef) && /\(\s*\)/u.test(word)) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\(\s*\\\)/g, '\\([0-9٠-٩]+\\)')
    if (new RegExp(`^${escaped}$`, 'u').test(model)) return true
  }
  // Word COM يحدث رقم صفحة TOC قبل استخراج الحقيقة، بينما DOCX الأصلي يبقي
  // نتيجة الحقل السابقة. وجود tab قبل الرقم يقيد القاعدة بصف فهرس حقيقي.
  if (/\t[0-9٠-٩]+\s*$/u.test(paragraph.text)) {
    const withoutPage = (value: string): string => value.replace(/\s+[0-9٠-٩]+\s*$/u, '').trim()
    const compact = (value: string): string => withoutPage(value).replace(/\s+/g, '')
    if (compact(word) === compact(model)) return true
  }
  // بعض الفهارس القديمة ترسم قائد النقاط يدويًا، ويعكس Word ترتيب 73.0 في
  // قصة RTL إلى 0.73 داخل OOXML. المحتوى قبل القائد والرقم نفسه يظلان ثابتين.
  if (/\.{10,}/.test(model) && /\.{10,}/.test(word)) {
    const leader = (value: string): [string, string] => {
      const [prefix = '', suffix = ''] = value.split(/\.{10,}/, 2)
      return [prefix.replace(/\s+/g, ''), suffix.replace(/\D/g, '').replace(/^0+/, '')]
    }
    const [wordPrefix, wordNumber] = leader(word), [modelPrefix, modelNumber] = leader(model)
    if (wordPrefix === modelPrefix && wordNumber === modelNumber && wordNumber.length > 0) return true
  }
  // خطوط dingbat قد تعيد Word COM محارف ASCII بحسب charset بينما OOXML يحفظ
  // PUA. نقبلها للمحاذاة فقط إذا كانت الفقرة كلها من عائلة زخرفية وبلا حروف.
  const decorative = paragraph.runs.length > 0
    && paragraph.runs.every(run => /(?:arabesque|wingdings|webdings|symbol)/i.test(run.family ?? ''))
    && !/[\p{L}\p{N}]/u.test(word) && !/[\p{L}\p{N}]/u.test(model)
  return decorative
}

export function alignWordParagraphIndices(model: DocumentModelV0, map: WordAlignmentMap): number[] | null {
  const word = map.paragraphs ?? []
  if (!word.length) return null
  const modelText = model.paragraphs.map((p) => normalizeWordPageText(p.text))
  const wordText = word.map((p) => normalizeWordPageText(p.text))
  // المسار الأقوى: Word.Paragraphs وBodyParagraph متساويان عددًا وترتيبًا.
  // لا نسقط فقرات الرسم من التسلسل؛ نفسر sentinel الخاص بـCOM فقط عند إثبات
  // أن فقرة OOXML المقابلة خالية وتحمل صورة inline.
  if (word.length === model.paragraphs.length) {
    const directWordText = wordText.map((text, index) =>
      text === '/' && !modelText[index]
        && model.paragraphs[index]?.anchors?.some(anchor => anchor.inlineFlow) ? '' : text)
    if (directWordText.every((text, index) => matchesWordPageParagraph(text, model.paragraphs[index]!))) {
      return word.map((_, index) => index)
    }
  }
  const modelNonEmpty = modelText.map((text, index) => ({ text, index })).filter((x) => x.text)
  // Word COM يمثل فقرة الصورة السطرية الخالصة بـ`/`. عند اختلاف عدادي Word
  // وOOXML لا ينطبق المسار المباشر أعلاه، لكن sentinel يظل بنيويًا لا نصًا.
  // لا نحذفه إلا بميزانية مثبتة من فقرات OOXML الخالية ذات inlineFlow، حتى لا
  // يتحول `/` مؤلف حقيقي إلى wildcard عام.
  const inlineImageOnly = model.paragraphs.filter((paragraph, index) =>
    !modelText[index] && paragraph.anchors?.some(anchor => anchor.inlineFlow)).length
  const wordSlashCount = wordText.filter(text => text === '/').length
  const comparableWordText = wordSlashCount > 0 && wordSlashCount <= inlineImageOnly
    ? wordText.map(text => text === '/' ? '' : text) : wordText
  const wordNonEmpty = comparableWordText.map((text, index) => ({ text, index })).filter((x) => x.text)
  if (modelNonEmpty.length !== wordNonEmpty.length) return null
  const textualMismatches = modelNonEmpty.flatMap((item, i) =>
    matchesWordPageParagraph(wordNonEmpty[i]!.text, model.paragraphs[item.index]!) ? [] : [i])
  // Matching neighbours do not prove a changed value came from a field.
  // Representation differences must pass the run-aware matcher above.
  if (textualMismatches.length) return null

  const assigned = Array<number>(model.paragraphs.length)
  const pairs = [
    { model: -1, word: -1 },
    ...modelNonEmpty.map((item, i) => ({ model: item.index, word: wordNonEmpty[i]!.index })),
    { model: model.paragraphs.length, word: word.length },
  ]
  for (let p = 1; p + 1 < pairs.length; p++)
    assigned[pairs[p]!.model] = pairs[p]!.word
  for (let p = 0; p + 1 < pairs.length; p++) {
    const a = pairs[p]!, b = pairs[p + 1]!
    const modelCount = b.model - a.model - 1, wordCount = b.word - a.word - 1
    for (let offset = 0; offset < modelCount; offset++) {
      let wordIndex: number
      if (wordCount > 0)
        wordIndex = a.word + 1 + Math.min(wordCount - 1, Math.floor((offset + 0.5) * wordCount / modelCount))
      else wordIndex = a.word >= 0 ? a.word : b.word
      const fallback = a.word >= 0 ? a.word : b.word
      assigned[a.model + 1 + offset] = word[wordIndex] ? wordIndex : fallback
    }
  }
  return assigned.every(index => Number.isInteger(index) && index >= 0 && index < word.length) ? assigned : null
}

