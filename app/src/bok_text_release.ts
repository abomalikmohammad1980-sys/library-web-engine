import {ArabicSearchShard, type SerializedSearchShard} from '../../packages/search/src/index'
import type {StoredBook} from './engine/library_store'
import {bokTextHash,validBokTextDraft,type BokTextDraft} from './bok_text_model'

export interface ReviewedBokDraft extends BokTextDraft {pageId:number; expectedRevision:number}
export interface BokTextRelease {
 contract:'bok-text-release/1'; bookId:string; sourceHash:string; revisionHash:string
 pages:NonNullable<StoredBook['bokPages']>; search:SerializedSearchShard
 reviewedPages:Array<{pageId:number;revision:number;baseHash:string}>
}

/** Builds both consumers from the same immutable text snapshot. Does not publish or write storage.
 * Activation must switch the reader AND search pointer in one deployment transaction.
 * Source bytes, page IDs/order and TOC are never rewritten by this operation. */
export async function buildBokTextRelease(book:StoredBook,sourceHash:string,drafts:readonly ReviewedBokDraft[]):Promise<BokTextRelease>{
 if(book.managedSource!=='published'||book.sourceFormat!=='shamela-bok'||!/^[a-f0-9]{64}$/.test(sourceHash)||book.originalSha256!==sourceHash||!book.bokPages?.length)throw Error('bok_release_source_mismatch')
 if(!drafts.length||drafts.length>book.bokPages.length)throw Error('bok_release_empty_or_excessive')
 const ids=new Set<number>(),pages=book.bokPages.map(page=>({...page, ...(page.controls?{controls:page.controls.map(control=>({...control}))}:{})}))
 for(const page of pages){if(!Number.isSafeInteger(page.id)||page.id<0||ids.has(page.id))throw Error('bok_release_ambiguous_page');ids.add(page.id)}
 const seen=new Set<number>(),reviewedPages:BokTextRelease['reviewedPages']=[]
 for(const draft of drafts){
  if(!validBokTextDraft(draft)||draft.text.includes('\0')||draft.revision!==draft.expectedRevision||seen.has(draft.pageId))throw Error('bok_release_draft_conflict')
  seen.add(draft.pageId)
  const page=pages.find(page=>page.id===draft.pageId)
  if(!page||await bokTextHash(page.text)!==draft.baseHash)throw Error('bok_release_page_base_mismatch')
  // Inline structural offsets cannot silently point into different text after an edit.
  // A future structured editor must supply reviewed control mappings for those pages.
  if(page.controls?.length&&page.text!==draft.text)throw Error('bok_release_controls_require_review')
  page.text=draft.text
  reviewedPages.push({pageId:draft.pageId,revision:draft.revision,baseHash:draft.baseHash})
 }
 reviewedPages.sort((a,b)=>a.pageId-b.pageId)
 const revisionHash=await bokTextHash(JSON.stringify({bookId:book.id,sourceHash,pages,reviewedPages}))
 const documents=pages.map((page,paragraphIndex)=>({id:`${book.id}:${page.id}`,bookId:book.id,paragraphIndex,text:page.text}))
 const search=ArabicSearchShard.build(`bok:${book.id}:${revisionHash}`,documents).serialize()
 return{contract:'bok-text-release/1',bookId:book.id,sourceHash,revisionHash,pages,search,reviewedPages}
}

/** For isolated preview only. Persistent/public consumers must also activate release.search.
 * Keep originalSha256/data and book identity: originals, bookmarks and notes retain provenance.
 * Character-offset notes on an edited page require quote revalidation, not blind relocation. */
export function previewBokTextRelease(book:StoredBook,release:BokTextRelease):StoredBook{
 if(book.id!==release.bookId||book.originalSha256!==release.sourceHash)throw Error('bok_release_source_mismatch')
 return{...book,bokPages:release.pages.map(page=>({...page})),extractedText:release.pages.map(page=>page.text).join('\n\n')}
}
