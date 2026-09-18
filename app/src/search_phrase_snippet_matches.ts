import {normalizeArabicSearch,normalizeArabicSearchWithMap} from '../../packages/search/src/index'
import {cleanShamelaPlainText} from './shamela_text_presentation'

/** Exact token phrases, allowing the legacy numeric footnote markers between words. */
export function snippetPhraseOffsets(source:string,query:string):number[]{
 const normalized=normalizeArabicSearchWithMap(cleanShamelaPlainText(source))
 const tokens=[...normalized.text.matchAll(/\S+/gu)],wanted=normalizeArabicSearch(query).split(' ').filter(Boolean)
 if(!wanted.length)return[]
 const offsets:number[]=[],note=/^[\d٠-٩۰-۹]+$/u
 for(let start=0;start<tokens.length;start++){
  if(tokens[start]![0]!==wanted[0])continue
  let cursor=start,word=1
  for(;word<wanted.length;word++){
   cursor++
   while(cursor<tokens.length&&note.test(tokens[cursor]![0]))cursor++
   if(tokens[cursor]?.[0]!==wanted[word])break
  }
  if(word===wanted.length)offsets.push(normalized.originalOffsets[tokens[start]!.index!]??0)
 }
 return offsets
}
