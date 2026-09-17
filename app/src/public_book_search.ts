import type {SearchQueryOptions,SearchResult,SearchResultSet} from './engine/search_store'
import {parseAdvancedSearchQuery} from '../../packages/search/src/index'
export function publicBookSearchEnabled():boolean{return (globalThis as unknown as {__PUBLIC_BOOK_SEARCH_ENABLED__?:boolean}).__PUBLIC_BOOK_SEARCH_ENABLED__===true}
const snapshots=new Map<string,string>()
export async function searchPublicBooks(query:string,options:SearchQueryOptions,fetcher:typeof fetch=fetch):Promise<SearchResultSet>{
 const output=[] as SearchResultSet;output.totalDocuments=0;output.totalOccurrences=0;output.coverageComplete=true
 const requested=options.fields??['body','heading','tag','category','card'],fields=requested.filter((f):f is 'body'|'heading'|'card'=>['body','heading','card'].includes(f))
 if(requested.some(field=>field==='tag'||field==='category'))output.coverageComplete=false
 if(options.contentScope&&options.contentScope!=='both'||options.deathFrom||options.deathTo||options.deathState){output.coverageComplete=false;return output}
 const scoped=options.bookIds?.map(id=>id.startsWith('central-submission:')?id.slice(19):undefined).filter((id):id is string=>Boolean(id))
 if(options.bookIds?.length&&!scoped?.length)return output
 const expression=parseAdvancedSearchQuery(query),offset=options.resultOffset??0,limit=Math.min(100,options.resultLimit??100)
 if(!expression.query.trim())return output
 for(const field of fields){
  const params=new URLSearchParams({q:expression.query,field,mode:'exact',offset:String(offset),limit:String(limit)})
  if(field==='body'&&fields.includes('heading'))params.set('pdfBookmarks','0')
  for(const id of scoped??[])params.append('book',id)
  for(const author of options.authors??[])params.append('author',author)
  for(const category of options.categories??[])params.append('category',category)
  for(const excluded of expression.excluded)params.append('exclude',excluded)
  const key=new URLSearchParams(params);key.delete('offset');key.delete('limit');const identity=key.toString()
  if(offset===0)snapshots.delete(identity);else if(snapshots.has(identity))params.set('snapshot',snapshots.get(identity)!)
  const response=await fetcher(`/api/search/public-books?${params}`,{cache:'no-store',...(options.signal?{signal:options.signal}:{})})
  if(!response.ok)throw Error(response.status===409?'public_search_snapshot_changed':'public_search_unavailable')
  const data=await response.json() as {contract:string;snapshot:string;coverageComplete?:boolean;failedBooks?:number;pendingBooks?:number;totalDocuments:number;hits:Array<{bookId:string;generation:number;field:'body'|'heading'|'card';ordinal:number;title:string;author:string;category?:string;snippet:string;anchor:Record<string,unknown>}>}
  if(data.contract!=='public-book-search/1'||!Array.isArray(data.hits)||data.hits.length>limit||!Number.isSafeInteger(data.totalDocuments)||data.totalDocuments<0||typeof data.snapshot!=='string')throw Error('public_search_invalid_response')
  snapshots.set(identity,data.snapshot);if(snapshots.size>32)snapshots.delete(snapshots.keys().next().value!)
  output.totalDocuments!+=data.totalDocuments;output.totalOccurrences!+=data.totalDocuments
  if(data.coverageComplete!==true){output.coverageComplete=false;if((data.failedBooks??0)>0)output.unavailableBookIds=['public-uploads'];if(data.pendingBooks!==0)output.pendingBookIds=['public-uploads']}
  for(const hit of data.hits){if(typeof hit.bookId!=='string'||typeof hit.snippet!=='string'||!hit.anchor||hit.field!==field&&!(field==='body'&&hit.field==='heading'))throw Error('public_search_invalid_response');const anchor=hit.anchor
   const row:SearchResult={publicUpload:true,resultKey:JSON.stringify(['public-upload',hit.bookId,hit.generation,hit.field,hit.ordinal]),bookId:'central-submission:'+hit.bookId,title:hit.title,author:hit.author,authors:[hit.author],...(hit.category?{category:hit.category}:{}),tags:[],field:hit.field,paraIndex:Number.isSafeInteger(anchor.paragraphIndex)?Number(anchor.paragraphIndex):-1,snippet:hit.snippet,matchText:hit.snippet,occurrenceCount:1}
   if(Number.isSafeInteger(anchor.pageIndex))row.pageIndex=Number(anchor.pageIndex)
   if(Number.isSafeInteger(anchor.volumeIndex))row.volumeIndex=Number(anchor.volumeIndex)
   if(typeof anchor.pageLabel==='string')row.pageLabel=anchor.pageLabel
   if(typeof anchor.partLabel==='string')row.partLabel=anchor.partLabel
   output.push(row)
  }
 }
 return output
}
