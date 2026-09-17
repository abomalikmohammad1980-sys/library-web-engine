import {seoShard} from '../../../../app/src/page_meta_model.ts'
import {refreshPublicSeoRecord} from '../../_seo-live-record.js'
import {boundedBytes} from '../../_seo-toc.js'
export async function onRequestGet({request,env}){
 const url=new URL(request.url),kind=url.searchParams.get('kind'),id=url.searchParams.get('id')??''
 if(!['authors','books'].includes(kind)||!(kind==='authors'?/^\d{1,12}$/:/^[A-Za-z0-9_-]{1,200}$/).test(id))return Response.json({error:'invalid_seo_id'},{status:400})
 try{
  let base
  if(/^\d{1,12}$/.test(id)){
   const response=await env.ASSETS.fetch(new URL(`/data/seo/${kind}-${seoShard(id)}.json`,url))
   if(!response.ok)throw Error('seo_shard_unavailable')
   const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await boundedBytes(response.body,1048576)));base=data.records[id]
  }
  const record=await refreshPublicSeoRecord(env.VISITORS_DB,kind,id,base)
  return Response.json(record?{record}:{error:'not_found'},{status:record?200:404,headers:{'cache-control':'no-store','x-robots-tag':'noindex'}})
 }catch{return Response.json({error:'seo_unavailable'},{status:503,headers:{'cache-control':'no-store','x-robots-tag':'noindex'}})}
}
