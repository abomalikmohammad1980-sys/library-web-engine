/** Hash routes are client-only; unknown HTTP paths must separately return 404. */
export function validRouteShape(parts:readonly string[]):boolean{
 if(parts.length===0)return true
 if(parts.length===1&&parts[0]==='recommendations')return true
 if(parts.length===1)return ['welcome','features','quotes','new-books','browse','quran','sunnah','shelves','reading-plans','research-projects','editions','series','data-quality','me','settings','notes','library','search','authors'].includes(parts[0]!)
 if(parts.length===2)return ['reader','book','people','author'].includes(parts[0]!)||parts[0]==='admin'&&parts[1]==='books'||parts[0]==='account'&&parts[1]==='sign-in'
 return parts[0]==='sunnah'&&parts[1]==='source'&&parts.length===3||parts[0]==='quran'&&parts[1]==='tafsir'&&parts.length>=3&&parts.length<=5
}
