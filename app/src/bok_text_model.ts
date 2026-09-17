export interface BokTextPage {id:number;text:string;part:number;page:number}
export interface BokTextDraft {baseHash:string;text:string;revision:number}
export async function bokTextHash(text:string):Promise<string>{const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('')}
export function validBokTextDraft(value:unknown):value is BokTextDraft{
 if(!value||typeof value!=='object')return false
 const d=value as Partial<BokTextDraft>
 return typeof d.baseHash==='string'&&/^[a-f0-9]{64}$/.test(d.baseHash)&&typeof d.text==='string'&&d.text.length<=100000&&Number.isSafeInteger(d.revision)&&Number(d.revision)>0
}
/** Literal replacement: metacharacters and dollar signs are never interpreted. */
export function replaceBokText(text:string,query:string,replacement:string):{text:string;count:number}{
 if(!query)return{text,count:0}
 const parts=text.split(query);return{text:parts.join(replacement),count:parts.length-1}
}
export function findBokText(pages:readonly BokTextPage[],query:string,start=0):{index:number;offset:number}|undefined{
 if(!query||!pages.length)return
 for(let step=0;step<pages.length;step++){const index=(Math.max(0,start)+step)%pages.length,offset=pages[index]!.text.indexOf(query);if(offset>=0)return{index,offset}}
}
