import type {SearchHit} from '../../packages/search/src/index'
/** Paginate the same unit the UI renders, while retaining occurrence totals. */
export function searchDocumentPage<T extends {hits:SearchHit[];total:number}>(full:T,offset:number,limit:number){
 const grouped=new Map<string,SearchHit&{occurrenceCount:number}>()
 for(const hit of full.hits){const current=grouped.get(hit.id);if(current)current.occurrenceCount++;else grouped.set(hit.id,{...hit,occurrenceCount:1})}
 return {...full,totalDocuments:grouped.size,hits:[...grouped.values()].slice(Math.max(0,offset),Math.max(0,offset)+Math.max(0,Math.min(500,limit)))}
}
