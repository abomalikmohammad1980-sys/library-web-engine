export type SurahpediaWordResourceKind = "irab" | "qiraat" | "tasrif";

export interface SurahpediaWordEntry {
  wordId: number;
  position: number;
  word: string;
  text: string;
}

export interface SurahpediaWordPage {
  projectId: 22 | 36 | 37;
  kind: SurahpediaWordResourceKind;
  page: number;
  surah: number;
  ayah: number;
  title: string;
  entries: SurahpediaWordEntry[];
}

type RawProjectPayload = { title: string; page: string; html: string };

const PROJECTS = {
  22: "irab",
  36: "qiraat",
  37: "tasrif",
} as const;

const decodeEntities = (value: string): string => value
  .replace(/&#(\d+);/g, (_, value: string) => String.fromCodePoint(Number(value)))
  .replace(/&#x([a-f\d]+);/gi, (_, value: string) => String.fromCodePoint(Number.parseInt(value, 16)))
  .replace(/&nbsp;/gi, " ")
  .replace(/&quot;/gi, '"')
  .replace(/&(?:apos|#0?39);/gi, "'")
  .replace(/&amp;/gi, "&")
  .replace(/&lt;/gi, "<")
  .replace(/&gt;/gi, ">");

const cleanText = (html: string): string => decodeEntities(html
  .replace(/<br\s*\/?\s*>/gi, "\n")
  .replace(/<\/(?:p|div|li)\s*>/gi, "\n")
  .replace(/<[^>]+>/g, " "))
  .replace(/[ \t\f\v]+/g, " ")
  .replace(/ *\n */g, "\n")
  .replace(/\n{3,}/g, "\n\n")
  .trim();

/**
 * Surahpedia currently prefixes some JSON responses with unrelated hidden HTML.
 * Only the structurally validated JSON object is accepted; the prefix is never retained.
 */
export function parseSurahpediaJsonEnvelope(raw: string): RawProjectPayload {
  if (raw.length > 2_000_000) throw Error("surahpedia_response_too_large");
  const start = raw.search(/\{\s*"title"\s*:/);
  if (start < 0) throw Error("surahpedia_json_envelope_missing");
  let value: unknown;
  try { value = JSON.parse(raw.slice(start)); } catch { throw Error("surahpedia_json_envelope_invalid"); }
  if (!value || typeof value !== "object") throw Error("surahpedia_json_envelope_invalid");
  const payload = value as Partial<RawProjectPayload>;
  if (typeof payload.title !== "string" || typeof payload.page !== "string" || typeof payload.html !== "string")
    throw Error("surahpedia_json_envelope_invalid");
  return { title: payload.title, page: payload.page, html: payload.html };
}

export function parseSurahpediaWordPage(raw: string, projectId: 22 | 36 | 37, expected: { page: number; surah: number; ayah: number }): SurahpediaWordPage {
  const payload = parseSurahpediaJsonEnvelope(raw);
  const page = Number(payload.page);
  if (page !== expected.page || !Number.isSafeInteger(page) || page < 1 || page > 6236)
    throw Error("surahpedia_page_identity_mismatch");
  const titleIdentity = /آية\s+([\d٠-٩۰-۹]+)\s*-\s*سورة\s+(.+)$/u.exec(payload.title);
  const dataIdentity = /data-page-title="سُ?ورة\s+[^"-]+\s*-\s*آية\s+([\d٠-٩۰-۹]+)"/u.exec(payload.html);
  const arabicNumber = (value: string): number => Number(value.replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))).replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))));
  if (!titleIdentity || !dataIdentity || arabicNumber(titleIdentity[1]!) !== expected.ayah || arabicNumber(dataIdentity[1]!) !== expected.ayah)
    throw Error("surahpedia_ayah_identity_mismatch");
  if (/<(?:script|iframe|object|embed)\b|\son\w+\s*=/i.test(payload.html))
    throw Error("surahpedia_unsafe_markup");

  const anchor = /<a\b[^>]*href="https:\/\/surahpedia\.com\/ar\/quran\/(\d+)\/(\d+)\/(\d+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const matches = [...payload.html.matchAll(anchor)];
  if (!matches.length) throw Error("surahpedia_word_entries_missing");
  const seen = new Set<number>();
  const entries = matches.map((match, index): SurahpediaWordEntry => {
    const surah = Number(match[1]), linkedPage = Number(match[2]), wordId = Number(match[3]);
    if (surah !== expected.surah || linkedPage !== expected.page || !Number.isSafeInteger(wordId) || wordId < 1 || seen.has(wordId))
      throw Error("surahpedia_word_identity_mismatch");
    seen.add(wordId);
    const word = cleanText(match[4] ?? "");
    const bodyStart = (match.index ?? 0) + match[0].length;
    const bodyEnd = index + 1 < matches.length ? matches[index + 1]!.index ?? payload.html.length : payload.html.lastIndexOf("</div>");
    const body = payload.html.slice(bodyStart, bodyEnd);
    if (/<a\b[^>]*href=/i.test(body)) throw Error("surahpedia_unexpected_link_in_content");
    const text = cleanText(body);
    if (!word || !text) throw Error("surahpedia_word_content_empty");
    return { wordId, position: index + 1, word, text };
  });
  return { projectId, kind: PROJECTS[projectId], page, surah: expected.surah, ayah: expected.ayah, title: payload.title, entries };
}
