const DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;
export function normalizeArabic(value: string): string {
  return value.normalize("NFKC").replace(DIACRITICS, "").replace(/\u0640/g, "")
    .replace(/[إأآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ").toLowerCase();
}
export function excerpt(value: string, fromEnd = false, length = 180): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return fromEnd ? clean.slice(-length) : clean.slice(0, length);
}
export function ngramDice(a: string, b: string, n = 3): number {
  const aa = normalizeArabic(a), bb = normalizeArabic(b);
  if (!aa || !bb) return 0;
  const grams = (s: string) => { const m = new Map<string, number>(); for (let i = 0; i <= s.length - n; i++) m.set(s.slice(i, i + n), (m.get(s.slice(i, i + n)) ?? 0) + 1); return m };
  const x = grams(aa), y = grams(bb); let common = 0, totalX = 0, totalY = 0;
  for (const v of x.values()) totalX += v; for (const v of y.values()) totalY += v;
  for (const [g, v] of x) common += Math.min(v, y.get(g) ?? 0);
  return totalX + totalY ? (2 * common) / (totalX + totalY) : Number(aa === bb);
}
