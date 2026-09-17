// Derived search text only: retain DOM block boundaries without changing source
// bytes or splitting a word merely because inline emphasis surrounds part of it.
const blocks=new Set(['ADDRESS','ARTICLE','ASIDE','BLOCKQUOTE','DD','DIV','DL','DT','FIGCAPTION','FIGURE','FOOTER','H1','H2','H3','H4','H5','H6','HEADER','HR','LI','MAIN','NAV','OL','P','PRE','SECTION','TABLE','TBODY','TD','TFOOT','TH','THEAD','TR','UL'])
export function renderedSearchText(root){
 const chunks=[]
 const boundary=()=>{if(chunks.length&&!chunks.at(-1).endsWith('\n'))chunks.push('\n')}
 const visit=node=>{
  if(node.nodeType===3){chunks.push(node.nodeValue??'');return}
  if(node.nodeType!==1&&node!==root)return
  if(['SCRIPT','STYLE','TEMPLATE'].includes(node.tagName))return
  if(node.tagName==='BR'){boundary();return}
  const block=blocks.has(node.tagName)
  if(block)boundary()
  for(const child of node.childNodes)visit(child)
  if(block)boundary()
 }
 visit(root)
 return chunks.join('').trim()
}
