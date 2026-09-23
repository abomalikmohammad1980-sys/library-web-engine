// Served by Pages Functions from the same immutable deployment as the client.
// The /api path bypasses all generations of the site's service worker.
const CATALOG_SHA='157b8a546eabb127d3627268851c0cc0a091f4d32c58018c2cdd8565173ea05d'

export async function onRequest({request,env}){
 const url=new URL(request.url)
 if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{allow:'GET, HEAD'}})
 if(url.searchParams.get('v')!==CATALOG_SHA)return new Response('catalog_version_mismatch',{status:400,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}})
 const asset=await env.ASSETS.fetch(new URL('/data/shamela-catalog.snapshot.json',url))
 if(!asset.ok)return new Response('catalog_unavailable',{status:503,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}})
 const headers=new Headers(asset.headers)
 headers.set('content-type','application/json; charset=utf-8')
 headers.set('cache-control','public, max-age=31536000, immutable')
 headers.set('x-content-type-options','nosniff')
 return new Response(request.method==='HEAD'?null:asset.body,{status:200,headers})
}
