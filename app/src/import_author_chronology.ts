import type {StoredAuthor} from './engine/library_store'
import {canonicalAuthorIdentity} from './author_display_names'
import {loadAuthorOverride} from './author_override_client'
type Chronology={deathYearHijri?:number;deathYearGregorian?:number;contemporary?:boolean}
export function importAuthorHasPublicIdentity(author:StoredAuthor):boolean{return /^shamela:\d+$/.test(canonicalAuthorIdentity(author.shamelaId??author.id))}
export async function importAuthorChronology(author:StoredAuthor):Promise<Chronology>{
 const id=canonicalAuthorIdentity(author.shamelaId??author.id)
 const [base,override]=await Promise.all([originalChronology(author),/^shamela:\d+$/.test(id)?loadAuthorOverride(id):Promise.resolve(null)])
 const fields=override?.fields,result={...base}
 for(const [field,key] of [['deathHijri','deathYearHijri'],['deathGregorian','deathYearGregorian']] as const){
  if(!fields||!Object.hasOwn(fields,field))continue
  if(fields[field]===null)delete result[key];else if(fields[field]!==undefined)result[key]=fields[field]
  // Clearing a death date means unknown, not proof that the author is alive.
  result.contemporary=false
 }
 if(result.deathYearHijri!==undefined||result.deathYearGregorian!==undefined)result.contemporary=false
 return result
}
async function originalChronology(author:StoredAuthor):Promise<Chronology>{
 const {parseBiographyText,localStructuredBiography,loadLocalTarajmBiography,mergeStructuredBiography}=await import('./author_people')
 const parsed=author.biography?parseBiographyText(author.biography):undefined
 const fallback:Chronology={contemporary:Boolean(author.contemporary)}
 if((parsed?.deathHijri??author.deathYearHijri)!==undefined)fallback.deathYearHijri=parsed?.deathHijri??author.deathYearHijri!
 if(parsed?.deathGregorian!==undefined)fallback.deathYearGregorian=parsed.deathGregorian
 const id=author.shamelaId??/^(?:local:)?shamela-author-(\d+)$/.exec(author.id)?.[1]
 if(!id||!/^\d+$/.test(id))return fallback
 const [{loadShamelaAuthorMetadata},{withShamelaBiography}]=await Promise.all([import('./shamela_author_metadata'),import('./shamela_biography')])
 const index=await loadShamelaAuthorMetadata(),entry=index.authors.find(row=>row.authorId===id)
 if(!entry)return fallback
 const enriched=await withShamelaBiography(entry),local=localStructuredBiography(enriched,author)
 const tarajm=await loadLocalTarajmBiography(id,[entry.name,...author.aliases],author.deathYearHijri)
 const biography=mergeStructuredBiography(tarajm.biography,local),death=biography.death?.value
 if(death?.hijri!==undefined)fallback.deathYearHijri=death.hijri
 if(death?.gregorian!==undefined)fallback.deathYearGregorian=death.gregorian
 const text=enriched.biography?parseBiographyText(enriched.biography):undefined
 if(fallback.deathYearGregorian===undefined&&text?.deathGregorian!==undefined)fallback.deathYearGregorian=text.deathGregorian
 return fallback
}
