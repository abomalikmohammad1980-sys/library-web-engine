import {normalizeArabicSearch,normalizeArabicSearchWithMap} from '../../../packages/search/src/index'
import type {ScopedSearchContent,ScopedSearchSegment} from '../search_content_scope'
export interface ScopedContentMatch{
 segmentKey:string;kind:ScopedSearchSegment['kind'];anchorIndex:number|null;noteId?:string;
 text:string;occurrenceCount:number;firstMatchStart:number;firstMatchEnd:number;
}
/** Exact normalized phrase in one classified segment. Callers retain the
 * provider's completeness flag and apply their exclusion/filter semantics.
 * Segments are never concatenated: sharing a reader anchor is not adjacency. */
export function matchScopedContent(content:ScopedSearchContent,query:string,signal?:AbortSignal){
 const matches:ScopedContentMatch[]=[],needle=normalizeArabicSearch(query).trim()
 let totalOccurrences=0
 if(needle)for(const segment of content.segments){
  signal?.throwIfAborted()
  const mapped=normalizeArabicSearchWithMap(segment.text)
  let offset=0,first=-1,occurrenceCount=0,found:number
  while((found=mapped.text.indexOf(needle,offset))!==-1){if(first<0)first=found;occurrenceCount++;offset=found+needle.length}
  if(!occurrenceCount)continue
  totalOccurrences+=occurrenceCount
  matches.push({segmentKey:segment.key,kind:segment.kind,anchorIndex:segment.anchorIndex,...(segment.noteId?{noteId:segment.noteId}:{}),text:segment.text,occurrenceCount,firstMatchStart:mapped.originalOffsets[first]??0,firstMatchEnd:(mapped.originalOffsets[first+needle.length-1]??0)+1})
 }
 signal?.throwIfAborted()
 return{matches,totalOccurrences,complete:content.complete,issues:[...content.issues]}
}
