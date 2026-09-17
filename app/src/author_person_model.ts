import type {StoredAuthor} from './engine/library_store'
import {loadShamelaAuthorMetadata} from './shamela_author_metadata'
import {loadLocalTarajmBiography,readTarajmBiographyCache} from './author_people'
import {createAuthorPersonLoader,type AuthorPersonBundle,type AuthorPersonRelease} from './author_person_bundle'
import release from './author_person_release.json'
const loader=createAuthorPersonLoader(release as AuthorPersonRelease,`./data/author-persons/${release.generation}/`)
export const loadAuthorPersonBundle=(id:string,signal?:AbortSignal)=>loader.load(id,signal)
/** Static relations are release-audited. A separately cached local biography
 * may have other relations: retain the complete former lookup for that case. */
export async function authorPersonPresentationContext(bundle:AuthorPersonBundle,record?:StoredAuthor){
 const cached=!bundle.tarajm.biography&&record?.tarajmExternalId?readTarajmBiographyCache(record.tarajmExternalId):undefined
 if(cached){
  const [index,tarajm]=await Promise.all([loadShamelaAuthorMetadata(),loadLocalTarajmBiography(bundle.entry.authorId,[bundle.entry.name],bundle.entry.deathYearHijri)])
  return{catalog:index.authors,biography:cached,peopleHrefByTarajmId:tarajm.peopleHrefByTarajmId}
 }
 return{catalog:[bundle.entry,...bundle.relationCatalog.filter(a=>a.authorId!==bundle.entry.authorId)],biography:bundle.tarajm.biography,peopleHrefByTarajmId:new Map(bundle.tarajm.peopleHrefByTarajmId)}
}
