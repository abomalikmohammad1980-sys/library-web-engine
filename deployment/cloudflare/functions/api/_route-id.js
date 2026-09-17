/** Pages route params are percent-encoded. Decode once; callers validate their ID grammar. */
export function decodeRouteId(value){
 if(typeof value!=='string')return null
 try{return decodeURIComponent(value)}catch{return null}
}
