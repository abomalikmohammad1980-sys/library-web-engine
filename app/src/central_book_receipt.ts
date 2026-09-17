export const CENTRAL_BOOK_CACHE='alkhizana:central-book-overrides:v1'
type RevisionRow={bookId:string;revision?:number;[key:string]:unknown}
/** A delayed public cache response must not resurrect a server-confirmed deletion. */
export function mergeCentralRevisions<T extends RevisionRow>(incoming:T[],known:T[]):T[]{
 const rows=new Map(incoming.map(row=>[row.bookId,row]))
 for(const row of known)if(!rows.has(row.bookId)||Number(row.revision??0)>Number(rows.get(row.bookId)?.revision??0))rows.set(row.bookId,row)
 return [...rows.values()]
}
export function rememberCentralMutation(result:{id:string;revision:number;visibility:string;logicallyDeleted:boolean},metadata:{title?:string;author?:string;category?:string|null}):void{
 try{
  const cached=JSON.parse(localStorage.getItem(CENTRAL_BOOK_CACHE)??'{}'),rows=Array.isArray(cached.overrides)?cached.overrides:[]
  const old=rows.find((row:RevisionRow)=>row.bookId===result.id)??{}
  const next={...old,...(metadata.title!==undefined?{title:metadata.title}:{}),...(metadata.author!==undefined?{author:metadata.author}:{}),...(metadata.category!==undefined?{category:metadata.category}:{}),bookId:result.id,revision:result.revision,visibility:result.visibility,logicallyDeleted:result.logicallyDeleted}
  localStorage.setItem(CENTRAL_BOOK_CACHE,JSON.stringify({schemaVersion:1,overrides:mergeCentralRevisions([next],rows)}))
 }catch{/* A confirmed server mutation must not be reported as failed if browser storage is full. */}
}
