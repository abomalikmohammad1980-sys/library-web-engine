/** Candidate keys are only a superset filter; callers verify the full phrase. */
export function localIndexKeys(text:string):Set<string>{
 const keys=new Set<string>(['']) // All rows, including one-letter-only phrases.
 for(const token of text.split(/\s+/u).filter(Boolean)){
  for(let i=0;i+3<=token.length;i++)keys.add(token.slice(i,i+3))
 }
 return keys
}
export function localQueryCandidates<T>(index:ReadonlyMap<string,T[]>,query:string):readonly T[]{
 let selected:readonly T[]|undefined
 for(const token of query.split(/\s+/u).filter(Boolean)){
  const width=3
  if(token.length<width)continue
  for(let i=0;i+width<=token.length;i++){
   const bucket=index.get(token.slice(i,i+width))
   if(!bucket)return []
   if(!selected||bucket.length<selected.length)selected=bucket
  }
 }
 // Short phrases have no trigram. Verify all rows rather than losing matches.
 return selected??index.get('')??[]
}
