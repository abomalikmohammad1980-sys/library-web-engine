import { excerpt, ngramDice, normalizeArabic } from "./normalize.js";
import type { PageMatch, PdfPageText } from "./types.js";

export interface AlignParagraph { index: number; text: string; normalized: string; excluded: unknown }
export function alignPages(pages: PdfPageText[], paragraphs: AlignParagraph[], anchors?: number[]): PageMatch[] {
  const matches: PageMatch[] = []; let cursor = 0;
  for (let pi = 0; pi < pages.length; pi++) {
    const page = pages[pi]!; const logical = pi + 1;
    if (page.method === "empty-needs-ocr") { matches.push(make(page, null, logical, 0, ["لا توجد طبقة نصية كافية؛ يلزم OCR أو اعتماد يدوي"])); continue }
    if (pi === 0) { matches.push(make(page, paragraphs[0] ?? null, logical, paragraphs.length ? .9 : 0, ["بداية المستند مع طبقة نصية صالحة"])); continue }
    const expected = anchors?.[pi] ?? Math.round((pi / pages.length) * paragraphs.length);
    const center = Math.max(cursor + 1, expected); const radius = Math.max(35, Math.ceil(paragraphs.length / Math.max(1, pages.length) * 1.8));
    let best: { p: AlignParagraph; score: number; boundary: number } | null = null;
    for (let i = Math.max(cursor + 1, center - radius); i < Math.min(paragraphs.length, center + radius); i++) {
      const p = paragraphs[i]!; if (!p.normalized || p.excluded === "drawing") continue;
      const following = paragraphs.slice(i, Math.min(i + 4, paragraphs.length)).map(x => x.text).join(" ");
      const startScore = ngramDice(excerpt(page.text, false, 260), excerpt(following, false, 320));
      const prevPage = pages[pi - 1]!; const preceding = paragraphs.slice(Math.max(0, i - 4), i).map(x => x.text).join(" ");
      const endScore = ngramDice(excerpt(prevPage.text, true, 220), excerpt(preceding, true, 300));
      const distance = 1 - Math.min(1, Math.abs(i - expected) / Math.max(radius, 1));
      const score = startScore * 0.62 + endScore * 0.28 + distance * 0.10;
      if (!best || score > best.score) best = { p, score, boundary: endScore };
    }
    if (!best) { matches.push(make(page, null, logical, 0, ["لم يوجد مرشح رتيب"])); continue }
    cursor = best.p.index; const reasons = [`تشابه بداية الصفحة وحدّ السابقة؛ الدرجة ${best.score.toFixed(3)}`];
    matches.push(make(page, best.p, logical, best.score, reasons));
  }
  return matches;
}
function make(page: PdfPageText, p: AlignParagraph | null, logical: number, confidence: number, reasons: string[]): PageMatch {
  const status = confidence >= 0.74 ? "auto" : "needs_review";
  return { pdfPage: page.page, paragraphIndex: p?.index ?? null, wordLogicalPage: logical,
    confidence: Math.round(confidence * 1000) / 1000, status, reasons,
    pdfStart: excerpt(page.text), pdfEnd: excerpt(page.text, true), docxText: excerpt(p?.text ?? "") };
}
