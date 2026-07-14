/** القواعد الرأسية لترصيف Word — منقولةٌ من أداة القياس (tools/word-oracle/
 *  vertical_v1.mjs) إلى نواة المحرّك كدوالَّ نقيّة قابلة للاختبار.
 *
 *  المرجع الكامل: docs/word-behavior-spec/RULES-REFERENCE.md (القسم «ثانيًا/ثالثًا/
 *  رابعًا»). كل الأرقام مقيسةٌ من حقيقة Word (XPS)، لا مُلفَّقة.
 *
 *  الوحدات: twips (1/1440 بوصة). em = حجم الخط بالـtwips. المقاييس كسورٌ من em. */

/** مقاييس الخط الرأسية (ق‌ر1): كسورٌ من em من جدولَي hhea وOS/2. */
export interface VertMetrics {
  /** hhea ascent / upem */
  a: number;
  /** −hhea descent / upem (موجب) */
  d: number;
  /** hhea lineGap / upem */
  g: number;
  /** OS/2 usWinDescent / upem (لـexternalLeading في بداية الصفحة) */
  wd: number;
  /** OS/2 usWinAscent / upem (اختياريّ): يفعّل صيغة بداية الصفحة المقصوصة
   *  (externalLeading = max(0,…) كـGDI tmExternalLeading). حين يُحذف، يُستعمل
   *  الاحتياطيّ المبسَّط الذي يفترض externalLeading ≥ 0. */
  wa?: number;
}

export interface LineSpacing {
  /** قيمة w:line (240ths للـauto، أو twips للـexact/atLeast)، أو null (مفرد) */
  line: number | null;
  lineRule: "auto" | "exact" | "atLeast";
}

/** run على سطر: مقاييسه وحجمه (twips). */
export interface RunMetric {
  met: VertMetrics;
  emTwips: number;
}

/** صندوق السطر: أقصى صعود/نزول/فجوة عبر runs السطر (ق‌ر5). */
export interface LineBox {
  asc: number;
  desc: number;
  gap: number;
}

const q10 = (em: number): number => Math.round(em / 10) * 10; // تكميم em لأقرب 10

/** المضاعف من w:spacing (ق‌ر2): auto ⇒ line/240، غيره ⇒ 1. */
export function lineMultiplier(sp: LineSpacing): number {
  return sp.line != null && sp.lineRule !== "exact" && sp.lineRule !== "atLeast"
    ? sp.line / 240 : 1;
}

/** ق‌ر1: خطوة السطر المفردة = (a+d+g) × em (بالخط الواحد). */
export function singlePitch(m: VertMetrics, emTwips: number): number {
  return (m.a + m.d + m.g) * q10(emTwips);
}

/** ق‌ر5: صندوق السطر من runs = max على كلٍّ من a/d/g × em المكمَّم. */
export function lineBox(runs: readonly RunMetric[]): LineBox | null {
  let asc = 0, desc = 0, gap = 0;
  for (const r of runs) {
    const em = q10(r.emTwips);
    if (r.met.a * em > asc) asc = r.met.a * em;
    desc = Math.max(desc, r.met.d * em);
    gap = Math.max(gap, r.met.g * em);
  }
  return asc ? { asc, desc, gap } : null;
}

/** ق‌ر7: خطوة الأساس بين سطرين داخل الفقرة (فصل asc/desc):
 *  step = A.desc + A.gap + (A.asc+A.desc+A.gap)×(m−1) + B.asc
 *  حيث m مضاعف تباعد الفقرة (auto). exact ⇒ line مباشرة؛ atLeast ⇒ max(step,line). */
export function intraStep(A: LineBox, B: LineBox, sp: LineSpacing): number {
  if (sp.line != null && sp.lineRule === "exact") return sp.line;
  const m = lineMultiplier(sp);
  const base = A.desc + A.gap + (A.asc + A.desc + A.gap) * (m - 1) + B.asc;
  if (sp.line != null && sp.lineRule === "atLeast") return Math.max(base, sp.line);
  return base;
}

/** ق‌ر6: خطوة حدّ الفقرات = خطوة سطرٍ (بمضاعف السابقة) + فجوة التباعد + صعود اللاحقة.
 *  فجوة التباعد = max(after السابقة, before اللاحقة)، أو 0 لـcontextualSpacing
 *  (يمرَّر جاهزًا). A=آخر سطر السابقة، B=أول سطر اللاحقة، spA=تباعد السابقة. */
export function boundaryStep(A: LineBox, B: LineBox, spA: LineSpacing, gap: number): number {
  const mA = lineMultiplier(spA);
  return A.desc + A.gap + (A.asc + A.desc + A.gap) * (mA - 1) + gap + B.asc;
}

/** حدّ التباعد بين فقرتين (ق‌ر6): max(after,before)، أو 0 إن اشتركتا في نمطٍ ذي
 *  contextualSpacing. */
export function boundaryGap(
  afterA: number, beforeB: number,
  ctx: { styleA?: string; styleB?: string; contextualStyles: ReadonlySet<string> },
): number {
  if (ctx.styleA && ctx.styleA === ctx.styleB && ctx.contextualStyles.has(ctx.styleA)) return 0;
  return Math.max(afterA, beforeB);
}

/** ق‌ر8/8-ج/8-د: صعود أول سطر الصفحة فوق الهامش العلوي.
 *  - مع معايرة (pagestart-cal): يُستعمل الصعود المقيس مباشرةً (الأدقّ، ق8-د).
 *  - بلا معايرة: النموذج = (hheaTotal − winDesc) × em (يشمل externalLeading، ق8-ج).
 *  ‏mClass: "m1" (مفرد m=1.0) أو "mN" (متعدّد m>1). */
export function pageStartAscent(
  m: VertMetrics, emTwips: number, sp: LineSpacing,
  cal?: { [em: string]: { m1?: number; mN?: number } },
): number {
  const em = q10(emTwips);
  const mClass = lineMultiplier(sp) > 1 ? "mN" : "m1";
  const calVal = cal?.[String(em)]?.[mClass];
  if (calVal != null) return calVal;
  // النموذج (ق8-ج): الأساس الأوّل = usWinAscent + externalLeading، حيث
  // externalLeading = max(0, (hheaAsc−hheaDesc+hheaGap) − (usWinAsc+usWinDesc)).
  // مؤكَّدٌ ببحثٍ في شفرة WPF LineServices (LineServicesCallbacks.cs: الأساس الأوّل =
  // الصعود المُقرَّب وحده) ومطابِقٌ للمعايرة المقيسة ضمن نقطة جهازٍ واحدة (<1tw).
  if (m.wa != null) {
    const extLead = Math.max(0, (m.a + m.d + m.g) - (m.wa + m.wd));
    return (m.wa + extLead) * em;
  }
  return (m.a + m.d + m.g - m.wd) * em; // احتياطيّ مبسَّط (يفترض externalLeading ≥ 0)
}

/** حَمْل النقطة (dot-carry، نموذج LineServices): يُراكم Word الـpitch الكسريّ ويُقحِم
 *  نقطة 600dpi (2.4tw) تعويضية دوريًا. النمذجة: قنص الإزاحة المتراكمة عن مرساة
 *  الفقرة (أول سطرٍ مرصود) لشبكة الحَمْل. anchorY=موضع المرساة، smoothOffset=الإزاحة
 *  الملساء المتراكمة، grid=شبكة الحَمْل (2.4tw = نقطة كاملة). */
export function carrySnap(anchorY: number, smoothOffset: number, grid = 2.4): number {
  return anchorY + Math.round(smoothOffset / grid) * grid;
}
