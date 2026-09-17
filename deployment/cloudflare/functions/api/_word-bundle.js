const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
const integer=(value,min,max)=>Number.isSafeInteger(value)&&value>=min&&value<=max
const fail=()=>{throw Error('invalid_word_bundle')}
/** Integrity binding is not an Office signature. Reader validation remains mandatory. */
export async function validateWordBundle(form,digest){
 const raw=form.get('wordBundle'),file=form.get('wordMapFile')
 if(raw===null&&file===null)return null
 if(typeof raw!=='string'||raw.length>4096||!(file instanceof File)||file.size<1||file.size>32*1024*1024)return fail()
 const manifest=JSON.parse(raw),keys=['contract','sourceSha256','pdfSha256','mapSha256','totalPages']
 if(!manifest||typeof manifest!=='object'||Array.isArray(manifest)||Object.keys(manifest).some(k=>!keys.includes(k))||manifest.contract!=='khizana-word-bundle/1'||!hash(manifest.sourceSha256)||!hash(manifest.pdfSha256)||!hash(manifest.mapSha256)||!integer(manifest.totalPages,1,100000))return fail()
 const source=form.get('file'),pdf=form.get('pdfFile')
 if(!(source instanceof File)||!source.name.toLowerCase().endsWith('.docx')||!(pdf instanceof File)||[...form.keys()].some(k=>k.startsWith('volumeFile:')))return fail()
 if(await digest(source)!==manifest.sourceSha256||await digest(pdf)!==manifest.pdfSha256||await digest(file)!==manifest.mapSha256)return fail()
 const map=JSON.parse(await file.text())
 if(!map||map.totalPages!==manifest.totalPages||!integer(map.paragraphCount,1,1000000)||!Array.isArray(map.starts)||map.starts.length<1||map.starts.length>map.totalPages||!Array.isArray(map.paragraphs)||map.paragraphs.length!==map.paragraphCount||!Array.isArray(map.fragments)||map.fragments.length>1000000)return fail()
 const position=p=>p&&integer(p.paragraphIndex,0,map.paragraphCount-1)&&integer(p.physicalPage,1,map.totalPages)&&Number.isSafeInteger(p.adjustedPage)
 if(map.starts.some(p=>!position(p))||map.paragraphs.some(p=>!position(p)||typeof p.text!=='string')||map.fragments.some(p=>!position(p)||!integer(p.startOffset,0,100000000)||!integer(p.endOffset,p.startOffset,100000000)||typeof p.text!=='string'))return fail()
 return {manifest:{contract:manifest.contract,sourceSha256:manifest.sourceSha256,pdfSha256:manifest.pdfSha256,mapSha256:manifest.mapSha256,totalPages:manifest.totalPages},file,kind:'word-map',partNumber:null,mime:'application/json'}
}
export const missingWordBundleSchema=error=>/no such table:\s*user_book_word_bundles\b/.test(String(error?.message??''))
export async function wordBundleMetadata(db,bookId){
 let row;try{row=await db.prepare('SELECT manifest_json,byte_length FROM user_book_word_bundles WHERE book_id=?1').bind(bookId).first()}catch(error){if(missingWordBundleSchema(error))return undefined;throw error}
 return row?{...JSON.parse(row.manifest_json),mapBytes:row.byte_length,mapUrl:`/api/account/books/${encodeURIComponent(bookId)}/file?wordMap=1`}:undefined
}
