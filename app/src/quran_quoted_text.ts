/** Source delimiters identify Quran quotations; never infer verses from prose. */
export function quranQuotedText(text:string):Node[]{
 const nodes:Node[]=[];let offset=0
 for(const match of text.matchAll(/﴿[^﴿﴾]+﴾/gu)){
  nodes.push(document.createTextNode(text.slice(offset,match.index)))
  const verse=document.createElement('span');verse.className='quran-tafsir-ayah';verse.textContent=match[0];nodes.push(verse)
  offset=match.index!+match[0].length
 }
 nodes.push(document.createTextNode(text.slice(offset)));return nodes
}
