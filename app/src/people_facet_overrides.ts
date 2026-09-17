import {loadLocalTarajmFacetRecords,type TarajmFacetRecord} from './author_people'
import {loadAuthorStructuredOverrides} from './author_override_client'
import type {AuthorStructuredFields} from './author_structured_fields'

/** Explicit arrays replace imported membership, including an explicit empty array. */
export function mergePeopleFacetOverrides(records:readonly TarajmFacetRecord[],overrides:readonly {authorId:string;fields:AuthorStructuredFields}[]):TarajmFacetRecord[]{
 const key=(id:string)=>/^\d+$/.test(id)?String(Number(id)):id
 const merged=new Map(records.map(row=>[key(row.shamelaAuthorId),{...row,biography:{...row.biography}}]))
 for(const override of overrides){
  const match=/^shamela:(\d+)$/.exec(override.authorId)
  if(!match)continue
  const id=key(match[1]!),fields=override.fields
  if(!['places','traits','categories'].some(field=>Object.hasOwn(fields,field)))continue
  const row=merged.get(id)??{shamelaAuthorId:id,biography:{sources:[]}}
  for(const field of ['places','traits','categories'] as const){
   if(Object.hasOwn(fields,field))row.biography[field]={value:[...(fields[field]??[])],provider:'local',sourceUrl:`#/people/${id.padStart(6,'0')}`,verifiedAt:''}
  }
  merged.set(id,row)
 }
 return [...merged.values()]
}

export async function loadCurrentPeopleFacetRecords():Promise<TarajmFacetRecord[]>{
 // Only the immutable source is cached. A new visit reads current cloud edits.
 const [records,overrides]=await Promise.all([loadLocalTarajmFacetRecords(),loadAuthorStructuredOverrides()])
 return mergePeopleFacetOverrides(records,overrides)
}
