/** Structural classification only. No separators, regex footnote guessing or text rewriting. */
export type SearchContentScope = 'both' | 'body' | 'foot';
export interface ScopedSearchSegment {
  key: string; kind: 'body' | 'footnote' | 'endnote' | 'unclassified'; text: string;
  /** Original reader coordinate; null explicitly means no proven reader anchor. */
  anchorIndex: number | null; noteId?: string;
}
export interface ScopedSearchContent { segments: ScopedSearchSegment[]; complete: boolean; issues: string[] }
interface BokSourcePage { text?: string; body?: string | null; foot?: string | null; sequence?: number }
interface WordParagraph { index: number; text: string; excluded?: boolean; runs?: ReadonlyArray<{ noteRef?: { kind: 'footnote' | 'endnote'; id: string } | null }> }
interface WordSource { paragraphs: readonly WordParagraph[]; footnotes: ReadonlyMap<string, readonly WordParagraph[]>; endnotes: ReadonlyMap<string, readonly WordParagraph[]> }
const validIndex = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
export function scopedBokSegments(pages: readonly BokSourcePage[], scope: SearchContentScope): ScopedSearchContent {
  const segments: ScopedSearchSegment[] = [], issues: string[] = [];
  pages.forEach((page, index) => {
    const anchorIndex = page.sequence === undefined ? index : validIndex(page.sequence) ? page.sequence : null;
    // Both keys must be present. An absent field is not proof of an empty note.
    const structured = Object.hasOwn(page, 'body') && Object.hasOwn(page, 'foot') && (page.body === null || typeof page.body === 'string') && (page.foot === null || typeof page.foot === 'string');
    if (!structured) {
      issues.push(`unclassified_page:${index}`);
      if (scope === 'both' && typeof page.text === 'string' && page.text) segments.push({ key: `bok:${index}:unknown`, kind: 'unclassified', text: page.text, anchorIndex });
      return;
    }
    if (scope !== 'foot' && page.body) segments.push({ key: `bok:${index}:body`, kind: 'body', text: page.body, anchorIndex });
    if (scope !== 'body' && page.foot) segments.push({ key: `bok:${index}:foot`, kind: 'footnote', text: page.foot, anchorIndex });
  });
  return { segments, complete: issues.length === 0, issues };
}
export function scopedWordSegments(model: WordSource, scope: SearchContentScope): ScopedSearchContent {
  const segments: ScopedSearchSegment[] = [], issues: string[] = [], anchors = new Map<string, number>();
  for (const p of model.paragraphs) {
    if (p.excluded) continue;
    if (scope !== 'foot' && p.text) segments.push({ key: `word:body:${p.index}`, kind: 'body', text: p.text, anchorIndex: validIndex(p.index) ? p.index : null });
    for (const run of p.runs ?? []) if (run.noteRef) { const key = `${run.noteRef.kind}:${run.noteRef.id}`; if (!anchors.has(key) && validIndex(p.index)) anchors.set(key, p.index); }
  }
  if (scope !== 'body') {
    for (const [kind, notes] of [['footnote', model.footnotes], ['endnote', model.endnotes]] as const) {
      for (const [id, paragraphs] of notes) {
        // OOXML separator/continuation separator notes are not authored notes.
        if (id === '-1' || id === '0') continue;
        paragraphs.forEach((p, ordinal) => { if (!p.excluded && p.text) segments.push({ key: `word:${kind}:${id}:${ordinal}`, kind, text: p.text, noteId: id, anchorIndex: anchors.get(`${kind}:${id}`) ?? null }); });
      }
    }
    for (const key of anchors.keys()) { const colon = key.indexOf(':'), kind = key.slice(0, colon), id = key.slice(colon + 1); if (!(kind === 'footnote' ? model.footnotes : model.endnotes).has(id)) issues.push(`missing_${kind}:${id}`); }
  }
  return { segments, complete: issues.length === 0, issues };
}
