import {normalizePublicSearch} from '../_public-book-search.js'
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex'}})
const eligible=`FROM public_book_search_fts f JOIN public_book_search_rows r ON r.row_id=f.rowid JOIN public_book_search_receipts s ON s.book_id=r.book_id AND s.generation=r.generation JOIN public_book_index_jobs j ON j.book_id=s.book_id AND j.generation=s.generation AND j.manifest_sha256=s.manifest_sha256 AND j.state='ready' JOIN public_book_index_eligible e ON e.id=j.book_id AND e.generation=j.generation`
export async function queryPublicBooks(db,params,env={}){
 const q=normalizePublicSearch(params.get('q')??''),field=params.get('field')??'body'
 const offset=Number(params.get('offset')??0),limit=Number(params.get('limit')??100)
 if(!q||q.length>200||!['body','heading','card'].includes(field)||!Number.isSafeInteger(offset)||offset<0||offset>1000000||!Number.isSafeInteger(limit)||limit<1||limit>100)return json({error:'invalid_query'},400)
 if(params.get('mode')&&params.get('mode')!=='exact')return json({error:'unsupported_mode'},422)
 const epoch=await db.prepare('SELECT version FROM public_book_search_epoch WHERE id=1').first()
 const version=String(epoch?.version??'')
 if(!version)return json({error:'search_unavailable'},503)
 if(params.has('snapshot')&&params.get('snapshot')!==version)return json({error:'search_snapshot_changed'},409)
 const phrase='"'+q.replaceAll('"','""')+'"',args=[phrase,q,field]
 let where=`WHERE public_book_search_fts MATCH ?1 AND instr(r.normalized,?2)>0 AND ((r.field=?3 AND NOT(e.mime_type='application/pdf' AND r.field='body')) ${params.get('pdfBookmarks')==='0'?'':"OR (?3='body' AND r.field='heading' AND j.coverage_mode='pdf-bookmarks-only')"})`
 const pdfReceiptGate=`j.artifact_key NOT LIKE 'public-book-index/v2/%' AND (e.mime_type<>'application/pdf' OR j.coverage_mode='pdf-bookmarks-only')`
 where+=` AND ${pdfReceiptGate}`
 const books=params.getAll('book');if(books.length>100||books.some(id=>!id||id.length>200))return json({error:'invalid_scope'},400)
 if(books.length){where+=` AND e.id IN (${books.map((_,i)=>'?'+(i+4)).join(',')})`;args.push(...books)}
 for(const [parameter,column] of [['author','e.author'],['category','e.category']]){const values=params.getAll(parameter);if(values.length>100||values.some(v=>v.length>500))return json({error:'invalid_scope'},400);if(values.length){where+=` AND ${column} IN (${values.map((_,i)=>'?'+(args.length+i+1)).join(',')})`;args.push(...values)}}
 const exclusions=params.getAll('exclude').map(normalizePublicSearch);if(exclusions.length>8||exclusions.some(v=>!v||v.length>200))return json({error:'invalid_scope'},400)
 for(const exclusion of exclusions){args.push(exclusion);where+=` AND instr(r.normalized,?${args.length})=0`}
 const count=await db.prepare(`SELECT COUNT(*) n ${eligible} ${where}`).bind(...args).first()
 const coverage=await db.prepare(`SELECT COUNT(*) n,SUM(CASE WHEN j.state='failed' THEN 1 ELSE 0 END) failed FROM public_book_index_eligible e LEFT JOIN public_book_index_jobs j ON j.book_id=e.id AND j.generation=e.generation LEFT JOIN public_book_search_receipts s ON s.book_id=j.book_id AND s.generation=j.generation AND s.manifest_sha256=j.manifest_sha256 AND j.state='ready' AND ${pdfReceiptGate} WHERE s.book_id IS NULL`).first()
 // Only bounded snippets leave the server. Full text and storage keys never do.
 const rows=await db.prepare(`SELECT r.book_id,r.generation,r.field,r.ordinal,json_remove(r.anchor_json,'$._searchOffsets') anchor_json,e.title,e.author,e.category,substr(r.text,MAX(1,COALESCE(json_extract(r.anchor_json,'$._searchOffsets[' || CAST((instr(r.normalized,?2)-1)/64 AS INTEGER) || ']'),0)-60),1000) snippet ${eligible} ${where} ORDER BY r.book_id,r.field,r.ordinal LIMIT ?${args.length+1} OFFSET ?${args.length+2}`).bind(...args,limit,offset).all()
 const after=await db.prepare('SELECT version FROM public_book_search_epoch WHERE id=1').first()
 if(String(after?.version)!==version)return json({error:'search_snapshot_changed'},409)
 return json({contract:'public-book-search/1',snapshot:version,coverageComplete:Number(coverage?.n??0)===0,pendingBooks:Number(coverage?.n??0)-Number(coverage?.failed??0),failedBooks:Number(coverage?.failed??0),totalDocuments:Number(count?.n??0),offset,limit,hits:(rows.results??[]).map(row=>({bookId:row.book_id,generation:row.generation,field:row.field,ordinal:row.ordinal,title:row.title,author:row.author,category:row.category,snippet:row.snippet,anchor:JSON.parse(row.anchor_json)}))})
}
export async function onRequest({request,env}){
 if(env.PUBLIC_BOOK_SEARCH_ENABLED!=='true')return json({error:'not_found'},404)
 if(request.method!=='GET')return json({error:'method_not_allowed'},405)
 try{return await queryPublicBooks(env.VISITORS_DB,new URL(request.url).searchParams,env)}catch{return json({error:'search_unavailable'},503)}
}
