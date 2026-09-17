import {peopleHref,localPeopleHref} from './author_people'
/** Preserve the existing route namespace; never publish local author data. */
export function biographyShareUrl(authorId:string,baseUrl:string):string{
 const href=peopleHref(authorId)??localPeopleHref(authorId)
 if(!href)throw Error('biography_share_identity_invalid')
 return new URL(href,baseUrl).href
}
type ShareHost={share?:(data:ShareData)=>Promise<void>;copy?:(value:string)=>Promise<void>}
export async function shareBiography(title:string,url:string,host:ShareHost):Promise<'shared'|'copied'|'cancelled'|'failed'>{
 if(host.share){try{await host.share({title,url});return 'shared'}catch(error){if(error instanceof Error&&error.name==='AbortError')return 'cancelled'}}
 if(host.copy){try{await host.copy(url);return 'copied'}catch{/* The caller presents a clear failure instead of an unhandled rejection. */}}
 return 'failed'
}
