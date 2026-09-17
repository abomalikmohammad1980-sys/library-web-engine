/** ‏abstractNum — علامات الترقيم الآلي (ترجمة مفهومية من `abstractNum.dart`).
 *  من numbering.xml (عبر النموذج): تنسيقُ العلامة (numFmt) وقالبها (lvlText)
 *  وبدايتها (start) — مع عدّاداتٍ لكل numId/ilvl. */

import type { BodyParagraph, DocumentModelV0 } from "@engine/ooxml-model";

const ROMAN_ONES = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"];
const ROMAN_TENS = ["", "X", "XX", "XXX", "XL", "L", "LX", "LXX", "LXXX", "XC"];
const ROMAN_HUNDREDS = ["", "C", "CC", "CCC", "CD", "D", "DC", "DCC", "DCCC", "CM"];

function toRoman(n: number): string {
  if (n <= 0 || n >= 4000) return String(n);
  const out = ROMAN_HUNDREDS[Math.floor(n / 100) % 10]!
    + ROMAN_TENS[Math.floor(n / 10) % 10]!
    + ROMAN_ONES[n % 10]!;
  return out;
}

const ABJAD = ["أ", "ب", "ج", "د", "هـ", "و", "ز", "ح", "ط", "ي", "ك", "ل", "م", "ن",
  "س", "ع", "ف", "ص", "ق", "ر", "ش", "ت", "ث", "خ", "ذ", "ض", "ظ", "غ"];

function toAbjad(n: number): string {
  if (n <= 0) return String(n);
  let out = "";
  let v = n;
  while (v > 0) {
    const d = (v - 1) % 28;
    out = ABJAD[d]! + out;
    v = Math.floor((v - 1) / 28);
  }
  return out;
}

function toArabicAlpha(n: number): string {
  // أ/ب/ت/ث… بالدورة (تجاوز الـ28 يعيد أ)
  if (n <= 0) return String(n);
  const letters = ["ا", "ب", "ج", "د", "هـ", "و", "ز", "ح", "ط", "ي", "ك", "ل", "م",
    "ن", "س", "ع", "ف", "ص", "ق", "ر", "ش", "ت", "ث", "خ", "ذ", "ض", "ظ", "غ"];
  let out = "";
  let v = n;
  while (v > 0) {
    const d = (v - 1) % 28;
    out = letters[d]! + out;
    v = Math.floor((v - 1) / 28);
  }
  return out;
}

const CIRCLED = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪", "⑫", "⑬", "⑭", "⑮", "⑯", "⑰", "⑱", "⑲", "⑳"];

// ECMA-376 ST_NumberFormat alphabets.  Like letter numbering, these are
// bijective sequences: after the last symbol Word continues with two symbols.
const IROHA_KATAKANA = [..."イロハニホヘトチリヌルヲワカヨタレソツネナラムウヰノオクヤマケフコエテアサキユメミシヱヒモセス"];
const KOREAN_CHOSUNG = [..."ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ"];

function alphabetic(n: number, alphabet: readonly string[]): string {
  if (n <= 0 || alphabet.length === 0) return String(n);
  let out = "";
  let v = n;
  while (v > 0) {
    out = alphabet[(v - 1) % alphabet.length]! + out;
    v = Math.floor((v - 1) / alphabet.length);
  }
  return out;
}

/** تنسيقُ رقمٍ حسب numFmt (الأسماء من ECMA-376 §17.9.6.2). */
export function formatNumber(fmt: string, n: number): string {
  const easternArabic = (value: number) => String(value).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[Number(d)]!);
  switch (fmt) {
    case "decimal": return String(n);
    // أسماء Word/OOXML للأرقام العربية الشرقية؛ decimal يبقى 0-9 إنجليزيًا.
    case "hindiNumbers": case "hindiCounting": return easternArabic(n);
    case "decimalEnclosedCircle":
      return n >= 1 && n <= 20 ? CIRCLED[n - 1]! : `(${n})`;
    case "decimalEnclosedParen": return `(${n})`;
    case "upperRoman": return toRoman(n);
    case "lowerRoman": return toRoman(n).toLowerCase();
    case "upperLetter": return String.fromCharCode(64 + ((n - 1) % 26) + 1);
    case "lowerLetter": return String.fromCharCode(96 + ((n - 1) % 26) + 1);
    case "arabicAbjad": return toAbjad(n);
    case "arabicAlpha": return toArabicAlpha(n);
    case "irohaFullWidth": return alphabetic(n, IROHA_KATAKANA);
    case "chosung": return alphabetic(n, KOREAN_CHOSUNG);
    case "bullet": return "•";
    case "none": return "";
    default: return String(n);
  }
}

/** عدّاد الترقيم عبر الفقرات — يعاد ضبطه عند تغيُّر numId أو صعودٍ في ilvl. */
export class NumberingState {
  private counters = new Map<string, Map<string, number>>();
  private lastKey: string | null = null;
  private lastIlvl = 0;

  /** قيمة المستوى ilvl الحالية لـnumId (يُعالج البدء من w:start). */
  private value(numId: string, ilvl: string, start: number): number {
    let perNum = this.counters.get(numId);
    if (!perNum) {
      perNum = new Map();
      this.counters.set(numId, perNum);
    }
    const lvl = Number(ilvl) || 0;
    const current = perNum.get(ilvl) ?? (start - 1);
    perNum.set(ilvl, current + 1);
    // صعود المستوى ⟵ قائمة متداخلة جديدة تُبقي قيم الآباء؛ نزولٌ ⟵ تنظيف الأبناء
    if (lvl < this.lastIlvl) {
      for (const [k] of perNum) if (Number(k) > lvl) perNum.delete(k);
    }
    return current + 1;
  }

  /** يبني نصّ العلامة للفقرة (استبدال %n في lvlText بقيم المستويات). */
  markerFor(p: BodyParagraph, model: DocumentModelV0): string {
    if (!p.numbered || !p.numId || p.numId === "0") return "";
    const ilvl = p.ilvl ?? "0";
    const key = `${p.numId}/${ilvl}`;
    const level = model.numbering.get(key);
    const fmt = level?.fmt ?? "decimal";
    if (fmt === "none") return "";
    const start = level?.start ?? 1;

    // عدّاد: عند تغيّر numId نبدأ من الصفر
    if (this.lastKey !== p.numId) {
      this.lastIlvl = 0;
    }
    this.lastKey = p.numId;
    const my = this.value(p.numId, ilvl, start);
    this.lastIlvl = Number(ilvl) || 0;

    const lvlText = level?.lvlText;
    if (!lvlText) return `${formatNumber(fmt, my)}.`;
    // استبدال %1..%9 بقيم المستويات المقابلة لنفس numId
    let out = lvlText;
    for (let i = 1; i <= 9; i++) {
      const token = `%${i}`;
      if (!out.includes(token)) continue;
      let val: string;
      if (i === (Number(ilvl) || 0) + 1) {
        val = formatNumber(fmt, my);
      } else {
        const parentLevel = model.numbering.get(`${p.numId}/${i - 1}`);
        const parentFmt = parentLevel?.fmt ?? "decimal";
        const parentStart = parentLevel?.start ?? 1;
        const parentVal = this.counters.get(p.numId)?.get(String(i - 1)) ?? parentStart;
        val = formatNumber(parentFmt, parentVal);
      }
      out = out.split(token).join(val);
    }
    return out;
  }
}
