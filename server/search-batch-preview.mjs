// Preserve the explicitly encoded batch body when preview SEO adds noindex.
export function preserveSearchBatchEncoding(source){
 const before='return new Response(response.body,{status:response.status,statusText:response.statusText,headers})'
 if(source.split(before).length!==2)throw Error('unreviewed_preview_middleware')
 return source.replace(before,"return new Response(response.body,{status:response.status,statusText:response.statusText,headers,encodeBody:response.headers.get('x-search-batch')==='1'?'manual':'automatic'})")
}
