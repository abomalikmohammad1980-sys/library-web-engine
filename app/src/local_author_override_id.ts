/** Stable identity, not a name match. Accepts legacy Unicode local IDs as well. */
export async function localAuthorOverrideId(id:string):Promise<string>{
 if(!id.trim())throw Error('invalid_local_author_id')
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(id))
 return 'local:'+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')
}
