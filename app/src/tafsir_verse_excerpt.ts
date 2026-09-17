const digits=(value:string)=>Number(value.replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))))
interface Heading {start:number;referenceStart:number;end:number;surah:number;from:number;to:number;valid:boolean}
function headings(html:string):Heading[]{
 const found:Heading[]=[]
 const pattern=/\[سورة\s+[^\[\]]+?\(([0-9٠-٩]+)\)\s*:\s*(?:آية|الآيات)\s+([0-9٠-٩]+)(?:\s+(?:الى|إلى)\s+([0-9٠-٩]+))?\s*\]/g
 for(const match of html.matchAll(pattern)){
  const index=match.index!,start=Math.max(html.lastIndexOf('>',index-1),html.lastIndexOf('\n',index-1),html.lastIndexOf('\r',index-1))+1
  const label=html.slice(start,index)
  if(!/^\s*\(?(?:الآية|الآيات|الآيتان|آية)\s*:?\s*\(?[0-9٠-٩\s\-–\u0640()]+\s*$/.test(label))continue
  const numbers=[...label.matchAll(/[0-9٠-٩]+/g)].map(m=>digits(m[0])),from=digits(match[2]!),to=digits(match[3]??match[2]!)
  found.push({start,referenceStart:index,end:index+match[0].length,surah:digits(match[1]!),from,to,valid:numbers[0]===from&&numbers.at(-1)===to&&from<=to})
 }
 return found
}
/** Hide only a duplicate heading reference; preserve ordinary citations and source assets. */
export function cleanTafsirHeadingReferences(html:string):string{
 for(const heading of headings(html).filter(h=>h.valid).reverse())html=html.slice(0,heading.referenceStart)+html.slice(heading.end)
 return html
}
/** Page-based imports can overlap neighbours. Cut only at explicit, consistent verse headings. */
export function tafsirVerseExcerpt(html:string,surah:number,ayah:number):string{
 const entries=headings(html),matching=entries.filter(h=>h.valid&&h.surah===surah&&h.from<=ayah&&h.to>=ayah)
 if(matching.length===1){const selected=matching[0]!,next=entries.find(h=>h.start>selected.start);html=html.slice(selected.start,next?.start)}
 return cleanTafsirHeadingReferences(html)
}
