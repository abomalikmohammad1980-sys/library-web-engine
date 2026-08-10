/**
 * ‏@engine/bidi — اشتقاق الاتجاه (UAX#9 مبسّط، النطاق الواقعي لكتبنا).
 *
 * النطاق عمدًا: قاعدةُ اشتقاق الاتجاه P2/P3 + محاكاة X3–X8 على مستوى الأساس
 * (لا embedding صريح RLE/LRE بعد)، مع W1–W7 وN1/N2 وL1 (ذيول السطر) وL2
 * (إعادة الترتيب البصري). هذا يغطي كتب الشاملة: فقرة RTL فيتخللها رقم/كلمة
 * لاتينية محايدة. الحقولُ الصريحة (RLE/LRE/RLO/LRO/PDF) تُعامَل حاليًا كـ
 * ON/BN (محدودية موثّقة) — الاشتقاق الكامل في بنية لاحقة عند الحاجة.
 *
 * المخرجات الأساس: `levels[i]` لكل محرف (0 = LTR، 1 = RTL، 2 = مستوى فرعي).
 * الرنّات تُستخرج تجاورَ المستويات، وإعادة الترتيب البصري L2 على مستوى
 * الرنّات في `visualOrder`.
 */

export type BidiDirection = "rtl" | "ltr";

/** تصنيف UAX#9 §4.2.4 للفئات المهمة (المصغّر). */
export type BidiClass =
  | "L" | "R" | "AL" | "EN" | "AN"
  | "ES" | "ET" | "CS" | "NSM"
  | "B" | "S" | "WS" | "ON" | "BN";

/** نطاق رنٍّ ثنائي الاتجاه في النص المنطقي: كل محرفٍ فيه بنفس المستوى. */
export interface BidiRun {
  start: number;
  end: number;
  direction: BidiDirection;
}

// ---------- التصنيف (فئات Unicode الفرعية المهمة — RTL/LTR/رقم/عَلاقة)
// النطاقات من UCD DerivedBidiClass: R = العبرية/السريانية/سكويط...،
// AL = الحروف العربية (فئة النصوص RTL)، AN = أرقام عربية.
const RTL_RE = /[\u0590-\u05FF\u0600-\u060B\u060D\u061B-\u061F\u0621-\u063A\u0640-\u064A\u066D-\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0700-\u074A\u0750-\u07B1\u07C0-\u07FF\u0800-\u083E\u0840-\u085B\u0860-\u086A\u08A0-\u08C9\uFB50-\uFBB1\uFBD3-\uFD3D\uFD50-\uFDFD\uFE70-\uFEFC]/;
const AL_RE = /[\u0600-\u0603\u0608-\u060B\u060D\u061B\u061C\u061E\u061F\u0621-\u063A\u0640-\u064A\u066D-\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0750-\u077F\u08A0-\u08C9\uFB50-\uFBB1\uFBD3-\uFD3D\uFD50-\uFDFD\uFE70-\uFEFC]/;
const EN_RE = /[0-9\u06F0-\u06F9]/; // أرقام أوروبية + أرقام عربية-شرقية ممتدة (EN)
const AN_RE = /[\u0660-\u0669]/;     // أرقام عربية-هندية (AN)
const ET_RE = /[\$¢£¤¥₧₨₩₪€₫₭₮₯₰₱₲₳₴₵₶₷₸₹₺₻₼₽]/;
const ES_RE = /[+\-]/;
const CS_RE = /[,/:._]/;
const NSM_RE = /[\u0300-\u036F\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u0711\u0730-\u074A\u0859-\u085B]/;
const WS_RE = /\s/;
const LRM = "\u200E", RLM = "\u200F", ALM = "\u061C";
const B_RE = /\r|\n|\u2028|\u2029/;
const BN_RE = /[\u00AD\u200B-\u200D\u2060]/;

export function bidiClass(cp: number): BidiClass {
  const ch = String.fromCodePoint(cp);
  if (ch === LRM) return "L";
  if (ch === RLM) return "R";
  if (ch === ALM) return "AL";
  if (B_RE.test(ch)) return "B";
  if (BN_RE.test(ch)) return "BN";
  if (RTL_RE.test(ch)) {
    if (AL_RE.test(ch)) return "AL";
    if (AN_RE.test(ch)) return "AN";
    return "R";
  }
  if (AN_RE.test(ch)) return "AN";
  if (EN_RE.test(ch)) return "EN";
  if (NSM_RE.test(ch)) return "NSM";
  if (ET_RE.test(ch)) return "ET";
  if (ES_RE.test(ch)) return "ES";
  if (CS_RE.test(ch)) return "CS";
  if (WS_RE.test(ch)) return "WS";
  if (ch === "!") return "L";
  return "L";
}

/** P2/P3: أساس الفقرة من أول حرفٍ قويّ (L/R/AL) — الأرقام والمحايد لا تحدّد
 *  الاتجاه؛ المحارف اللاحقة للقويّ الأول لا تغيّر الأساس (المعلَّم من OOXML يُقدَّم). */
export function baseDirection(text: string, paragraphBidi?: boolean): BidiDirection {
  if (paragraphBidi) return "rtl";
  for (let i = 0; i < text.length; i++) {
    const c = bidiClass(text.charCodeAt(i));
    if (c === "L") return "ltr";
    if (c === "R" || c === "AL") return "rtl";
  }
  return "ltr";
}

function isStrong(c: BidiClass): boolean {
  return c === "L" || c === "R" || c === "AL";
}

/**
 * محاكاة X3–X8 على مستوى الأساس (الفقرة) دون إدخالات صريحة:
 *  - base=0 (LTR):  L→0، R/AL→1، EN→1 (بعد W7)، AN→2
 *  - base=1 (RTL):  L→0، R→1، AL→2، EN→2، AN→3
 *  ثم تصحيح W7 مسبقًا (EN→L إن سبقه حرف قويّ L) داخل X-الحلقة.
 */
function resolveClasses(text: string, baseLvl: number): BidiClass[] {
  const classes = [...text].map((ch) => bidiClass(ch.codePointAt(0)!));

  // W1: NSM ترث حرفها السابق؛ NSM قائدة ترث الأساس.
  for (let i = 0; i < classes.length; i++) {
    if (classes[i] === "NSM") {
      if (i > 0) classes[i] = classes[i - 1]!;
      else classes[i] = baseLvl === 1 ? "R" : "L";
    }
  }

  // W2/W3/W7: EN بين AL تصبح AN؛ EN بعد قويّ L تصبح L.
  let lastStrong: BidiClass | null = null;
  for (let i = 0; i < classes.length; i++) {
    const c = classes[i]!;
    if (isStrong(c)) lastStrong = c;
    if (c === "EN" && lastStrong === "AL") classes[i] = "AN";
  }
  lastStrong = null;
  for (let i = 0; i < classes.length; i++) {
    const c = classes[i]!;
    if (isStrong(c)) lastStrong = c;
    if (c === "EN" && lastStrong === "L") classes[i] = "L";
  }

  // W4/W5/W6: ES/CS/ET محايدة بين أرقام — تصبح EN/AN أو تُحول إلى ON.
  const resolveSep = (i: number): void => {
    if (classes[i] === "ES" || classes[i] === "CS" || classes[i] === "ET") {
      const prev = i > 0 ? classes[i - 1] : null;
      const next = i + 1 < classes.length ? classes[i + 1] : null;
      if (classes[i] === "ES" && prev === "EN" && next === "EN") classes[i] = "EN";
      else if (classes[i] === "CS" && prev === "EN" && next === "EN") classes[i] = "EN";
      else if (classes[i] === "CS" && prev === "AN" && next === "AN") classes[i] = "AN";
      else if (classes[i] === "ET") {
        // ET بين EN: يصبح EN
        if (prev === "EN" && next === "EN") classes[i] = "EN";
        // ET بعد EN: يبقى EN حتى لاحقًا (تسلسل ET ملحق بـ EN — مبسّط)
        else if (prev === "EN") classes[i] = "EN";
        else classes[i] = "ON";
      } else classes[i] = "ON";
    }
  };
  for (let i = 0; i < classes.length; i++) resolveSep(i);

  // N1/N2: المحايد (WS/ON) بين قويّين من جهة واحدة يأخذ جهتهما؛ وإلا الأساس.
  for (let i = 0; i < classes.length; i++) {
    const c = classes[i]!;
    if (c === "ON" || c === "WS") {
      let before: BidiClass | null = null, after: BidiClass | null = null;
      for (let j = i - 1; j >= 0; j--) {
        const cj = classes[j]!;
        if (isStrong(cj)) { before = cj; break; }
        if (cj === "B" || cj === "S") break;
      }
      for (let j = i + 1; j < classes.length; j++) {
        const cj = classes[j]!;
        if (isStrong(cj)) { after = cj; break; }
        if (cj === "B" || cj === "S") break;
      }
      const same = before && after && ((before === "L" && after === "L") || (before !== "L" && after !== "L"));
      if (before && same) classes[i] = before!;
      else if (after && after === before && before !== "L") classes[i] = "R"; // EN→R context
      else classes[i] = baseLvl === 1 ? "R" : "L";
    }
  }

  return classes;
}

/**
 * X7 — المستويات النهائية (UAX9 §3.3.4):
 * أساس 0 (LTR): L→0، R→1، AL→2، EN→1، AN→2
 * أساس 1 (RTL): L→2، R→1، AL→2، EN→2، AN→3
 */
export function computeLevels(text: string, base: BidiDirection): number[] {
  const baseLvl = base === "rtl" ? 1 : 0;
  const classes = resolveClasses(text, baseLvl);
  const levels: number[] = [];
  for (const c of classes) {
    switch (c) {
      case "L": levels.push(baseLvl === 1 ? 2 : 0); break;
      case "R": levels.push(1); break;
      case "AL": levels.push(2); break;
      case "AN": levels.push(baseLvl === 1 ? 3 : 2); break;
      case "EN": levels.push(baseLvl === 1 ? 2 : 1); break;
      default: levels.push(baseLvl); break;
    }
  }
  return levels;
}

/**
 * L1 (مبسّطة، مستوى السطر): المحارف الختامية (WS/ON/ET) في نهاية سطرٍ
 * تُعاد إلى مستوى الأساس — يقودُ ترتيب السطر البصري في الحالات الهامشية.
 * تُطبَّق على نسخة المستويات الخاصة بالسطر (تعديل موضعي).
 */
export function applyLineEnd(levels: number[], base: BidiDirection): void {
  const baseLvl = base === "rtl" ? 1 : 0;
  for (let i = levels.length - 1; i >= 0; i--) {
    if (levels[i] === baseLvl) break; // نطاق ختامي متجانس — نتوقف عند أوّل أساس
    levels[i] = baseLvl;
  }
}

/** يستخرج رنّات النص المنطقي (متجاورة المستوى) مع اتجاه كلٍّ منها:
 *  اتجاه الرنّ = نوع أقوى محرفٍ فيه بعد الحل (نص عربي ⇒ rtl حتى لو كان
 *  مستواه زوجيًا 2 عند أساس RTL)، والرقم/المحايد الصرف يتبع تكافؤ المستوى. */
export function bidiRuns(text: string, base: BidiDirection): BidiRun[] {
  const baseLvl = base === "rtl" ? 1 : 0;
  const classes = resolveClasses(text, baseLvl);
  const lvl = computeLevels(text, base);
  const runs: BidiRun[] = [];
  let s = 0;
  for (let i = 1; i <= text.length; i++) {
    if (i === text.length || lvl[i] !== lvl[s]) {
      let dir: BidiDirection = lvl[s]! % 2 === 1 ? "rtl" : "ltr";
      for (let k = s; k < i; k++) {
        const c = classes[k]!;
        if (isStrong(c)) { dir = c === "L" ? "ltr" : "rtl"; break; }
      }
      runs.push({ start: s, end: i, direction: dir });
      s = i;
    }
  }
  return runs;
}

/** مستويات كل محارف النص + ترتيبها البصري (L2) — مساعد للاختبار والاستهلاك. */
export function visualLevels(text: string, base: BidiDirection): number[] {
  return computeLevels(text, base);
}

/**
 * L2 — الترتيب البصري لرنّات منطقية (مستوياتها مقابلة). يُعيد فهارس الرنّات
 * بالترتيب الذي تُرسم به: من أعلى مستوى إلى أدنى مستوى فردي، اعكس كل تتابع
 * متجاورٍ عند ذلك المستوى أو أعلى.
 */
export function visualRunOrder(levels: number[]): number[] {
  const order = levels.map((_, i) => i);
  let max = 0;
  for (const l of levels) if (l > max) max = l;
  for (let lvl = max; lvl >= 1; lvl--) {
    let i = 0;
    while (i < order.length) {
      if (levels[order[i]!]! >= lvl) {
        let j = i;
        while (j < order.length && levels[order[j]!]! >= lvl) j++;
        for (let a = i, b = j - 1; a < b; a++, b--) {
          const t = order[a]!; order[a] = order[b]!; order[b] = t;
        }
        i = j;
      } else i++;
    }
  }
  return order;
}
