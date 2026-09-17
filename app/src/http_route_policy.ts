import {canonicalizePath,locationRouteHash} from './path_location'
import {validRouteShape} from './route_shape'

/** Pure HTTP routing policy shared with the existing client route grammar.
 * Entity existence and public/private visibility remain the metadata layer's job. */
export function httpRoutePolicy(pathname:string,search=''):{kind:'redirect';path:string}|{kind:'known'|'not-found'}{
 if(!pathname.startsWith('/')||pathname.includes('//'))return{kind:'not-found'}
 try{decodeURIComponent(pathname)}catch{return{kind:'not-found'}}
 const canonical=canonicalizePath(pathname+search)
 if(canonical!==pathname+search)return{kind:'redirect',path:canonical}
 const hash=locationRouteHash({pathname,search:'',hash:''})
 const parts=hash.replace(/^#\/?/,'').split('/').filter(Boolean)
 return{kind:validRouteShape(parts)?'known':'not-found'}
}
