// Only inert typography and bounded spacing; never URLs, positioning or custom CSS.
const allowed=new Set(['color','background-color','font-family','font-size','font-weight','font-style','font-variant','line-height','text-align','text-indent','text-decoration','direction','unicode-bidi','white-space','word-break','overflow-wrap','margin','margin-top','margin-bottom','margin-left','margin-right','padding','padding-top','padding-bottom','padding-left','padding-right','border','border-collapse','border-spacing','vertical-align','list-style-type'])
export function safeImportedStyle(value:string):string{
 return value.split(';').flatMap(item=>{
  const colon=item.indexOf(':');if(colon<0)return[]
  const key=item.slice(0,colon).trim().toLowerCase(),val=item.slice(colon+1).trim()
  if(!allowed.has(key)||!val||/[\\@{}<>!]/.test(val)||/url\s*\(|(?:javascript|expression)|var\s*\(|attr\s*\(/i.test(val))return[]
  return [`${key}: ${val}`]
 }).join('; ')
}
