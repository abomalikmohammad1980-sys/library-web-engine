// UTF-8 byte offsets in the original, checksum-bound JSON. No text rewriting.
import {createHash} from 'node:crypto'
const sha=b=>createHash('sha256').update(b).digest('hex')
export function sourceStringRanges(raw){
 let at=0;const found=new Map(),space=()=>{while([9,10,13,32].includes(raw[at]))at++}
 const string=()=>{const start=at++;while(at<raw.length){if(raw[at]===92){at+=2;continue}if(raw[at++]===34)return[start,at];}throw Error('source_json_string')}
 const value=(path)=>{
  if(path.length>64)throw Error('source_json_depth');space()
  if(raw[at]===34){const [start,end]=string();if(path.length===3&&((path[0]==='pages'&&['body','foot'].includes(path[2]))||(path[0]==='titles'&&path[2]==='title')))found.set(path.join('/'),[start,end-start,sha(raw.subarray(start,end))]);return}
  if(raw[at]===123){at++;space();if(raw[at]===125){at++;return}for(;;){space();if(raw[at]!==34)throw Error('source_json_key');const [start,end]=string(),key=JSON.parse(raw.subarray(start,end).toString());space();if(raw[at++]!==58)throw Error('source_json_colon');value([...path,key]);space();const next=raw[at++];if(next===125)return;if(next!==44)throw Error('source_json_object')}}
  if(raw[at]===91){at++;space();if(raw[at]===93){at++;return}let ordinal=0;for(;;){value([...path,String(ordinal++)]);space();const next=raw[at++];if(next===93)return;if(next!==44)throw Error('source_json_array')}}
  const start=at;while(at<raw.length&&![9,10,13,32,44,93,125].includes(raw[at]))at++;if(at===start)throw Error('source_json_value')
 }
 value([]);space();if(at!==raw.length)throw Error('source_json_trailing');return found
}
export function fieldSourceRanges(raw,bookId,boundaries){
 const book=JSON.parse(raw),locations=sourceStringRanges(raw),titles=new Map(),proof=new Set(boundaries.map(row=>row[0]))
 for(const [i,title] of (book.titles??[]).entries()){if(title.pageSourceRowId==null||!title.title)continue;const key=String(title.pageSourceRowId),list=titles.get(key)??[];list.push(i);titles.set(key,list)}
 const rows=[]
 for(const [ordinal,page] of book.pages.entries()){
  const id=`${bookId}:${Number.isSafeInteger(page.sequence)?page.sequence:ordinal}`,parts=[]
  for(const i of titles.get(String(page.sourceRowId))??[])parts.push(['title',...locations.get(`titles/${i}/title`)])
  for(const field of ['body','foot'])if(typeof page[field]==='string'&&page[field].trim())parts.push([field,...locations.get(`pages/${ordinal}/${field}`)])
  if(!parts.length)continue
  if(!proof.delete(id))throw Error('source_row_without_boundary:'+id)
  rows.push([id,parts])
 }
 if(proof.size)throw Error('boundary_without_source_row')
 return rows
}
