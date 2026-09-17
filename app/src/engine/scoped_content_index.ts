import type { StoredBook } from './library_store';
import { inferBookFormat } from '../book_format';
import { decodeUtf8Text, textParagraphs } from '../text_import';
import { parseShamelaStructuralText } from '../shamela_text_presentation';
import { scopedBokSegments, scopedWordSegments, type SearchContentScope, type ScopedSearchContent } from '../search_content_scope';
/** Stateless and storage-free. Caller retains account-scope checks around await.
 * Search each returned segment independently: concatenation would manufacture
 * phrase matches across body/note or paragraph boundaries. */
export async function scopedContentIndex(book: StoredBook, scope: SearchContentScope, signal?: AbortSignal): Promise<ScopedSearchContent> {
  signal?.throwIfAborted(); const format = inferBookFormat(book);
  const unknown = (reason: string): ScopedSearchContent => ({ complete: false, issues: [reason], segments: scope === 'both' ? book.bokPages?.length ? book.bokPages.flatMap((p, index) => p.text ? [{ key: `legacy:${index}`, kind: 'unclassified' as const, text: p.text, anchorIndex: index }] : []) : textParagraphs(book.extractedText ?? '').map((text, index) => ({ key: `unknown:${index}`, kind: 'unclassified', text, anchorIndex: null })) : [] });
  if (format === 'text' || format === 'markdown') {
    const rows = textParagraphs(decodeUtf8Text(book.data));
    return { complete: true, issues: [], segments: scope === 'foot' ? [] : rows.map((text, index) => ({ key: `text:${index}`, kind: 'body', text, anchorIndex: index })) };
  }
  if (format === 'shamela-bok') {
    if (!book.data.length || book.data.length > 32 * 1024 * 1024 || !/^[a-f0-9]{64}$/.test(book.originalSha256 ?? '')) return unknown('bok_structured_source_unavailable');
    const actual = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(book.data).buffer))].map(b => b.toString(16).padStart(2, '0')).join('');
    signal?.throwIfAborted(); if (actual !== book.originalSha256) return unknown('bok_source_integrity');
    let raw: any; try { raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(book.data)); } catch { return unknown('bok_non_reader_json'); }
    if (raw?.contract !== 'shamela-sqlite-pack/book-1' || !book.sourceBookId || raw.workId !== `shamela4_1:${book.sourceBookId}` || !Array.isArray(raw.pages) || !book.bokPages || raw.pages.length !== book.bokPages.length) return unknown('bok_source_identity');
    const pages = [];
    for (let index = 0; index < raw.pages.length; index++) {
      const page = raw.pages[index];
      if (!page || page.sequence !== index || String(page.sourceRowId) !== String(book.bokPages[index]!.id) || !Object.hasOwn(page, 'body') || !Object.hasOwn(page, 'foot') || !(page.body === null || typeof page.body === 'string') || !(page.foot === null || typeof page.foot === 'string')) return unknown('bok_source_pages');
      pages.push({ sequence: index, body: page.body === null ? null : parseShamelaStructuralText(page.body).text, foot: page.foot === null ? null : parseShamelaStructuralText(page.foot).text });
    }
    signal?.throwIfAborted(); return scopedBokSegments(pages, scope);
  }
  if (format === 'word') {
    const { extractFromDocx } = await import('@engine/ooxml-model'); signal?.throwIfAborted();
    const model = extractFromDocx(book.data); signal?.throwIfAborted();
    const paragraphs = model.paragraphs.map(p => ({ index: p.index, text: p.text, excluded: Boolean(p.excluded), runs: p.runs.flatMap(run => run.noteRef && typeof run.noteRef.id === 'string' && (run.noteRef.kind === 'footnote' || run.noteRef.kind === 'endnote') ? [{ noteRef: { id: run.noteRef.id, kind: run.noteRef.kind as 'footnote' | 'endnote' } }] : []) }));
    const notes = (map: typeof model.footnotes) => new Map([...map].map(([id, rows]) => [id, rows.map(p => ({ index: p.index, text: p.text, excluded: Boolean(p.excluded) }))]));
    return scopedWordSegments({ paragraphs, footnotes: notes(model.footnotes), endnotes: notes(model.endnotes) }, scope);
  }
  return unknown(format === 'pdf' ? 'pdf_scope_boundaries_unavailable' : 'container_scope_boundaries_unavailable');
}
