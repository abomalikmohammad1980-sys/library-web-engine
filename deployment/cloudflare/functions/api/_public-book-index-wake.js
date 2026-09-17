// Only call after an authorized mutation has committed successfully. Events are
// already durable in D1; a failed wake never turns a successful edit into error.
export function afterPublicBookMutation(context,response){
 if(!response||response.status<200||response.status>=300||!['POST','PATCH','DELETE'].includes(context.request?.method)
 ||context.env?.BOOK_INDEX_QUEUE_ENABLED!=='true'||typeof context.env?.BOOK_INDEX_WAKE?.fetch!=='function'||typeof context.waitUntil!=='function')return response
 const work=Promise.resolve().then(()=>context.env.BOOK_INDEX_WAKE.fetch('https://book-index.internal/wake',{method:'POST'}))
 .then(async result=>{await result.body?.cancel().catch(()=>{})}).catch(()=>{})
 try{context.waitUntil(work)}catch{/* Durable minute dispatcher is the recovery path. */}
 return response
}
