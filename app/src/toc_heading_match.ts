/** Matching only: never replace the stored source or remove its ornaments. */
export function tocHeadingKey(value:string):string{
 return value.normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/gu,'').replace(/[\s*❊❋✽✻✶✳※()[\]{}«»]+/gu,' ').trim()
}
export function isTocHeading(text:string,title:string):boolean{
 const key=tocHeadingKey(title)
 return !!key&&tocHeadingKey(text)===key
}
