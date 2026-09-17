import {normalizePeopleFacet,type PeopleFacetKind,type TarajmFacetRecord} from './author_people'
export function peopleFacetDirectory(records:readonly TarajmFacetRecord[],kind:PeopleFacetKind):{label:string;authorCount:number}[]{
 const groups=new Map<string,{label:string;authors:Set<string>}>()
 for(const record of records){
  const values=kind==='place'?record.biography.places?.value??[]:[...(record.biography.traits?.value??[]),...(record.biography.categories?.value??[])]
  for(const value of values){const label=value.trim(),key=normalizePeopleFacet(label);if(!key)continue;const group=groups.get(key)??{label,authors:new Set<string>()};group.authors.add(record.shamelaAuthorId);groups.set(key,group)}
 }
 return [...groups.values()].map(group=>({label:group.label,authorCount:group.authors.size})).sort((a,b)=>a.label.localeCompare(b.label,'ar'))
}
