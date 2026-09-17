export const cleanProfileName=value=>typeof value==='string'&&value.trim().length<=120&&!/[<>\u0000-\u001f\u007f]/u.test(value)?value.trim():''
// identity and assertion MUST already have passed verifyAccessAssertion.
export async function trustedAccessName(identity,assertion,env,{fetcher=fetch}={}){
 const signed=cleanProfileName(identity.name);if(signed)return signed
 try{
  const domain=new URL(env.ACCOUNT_ACCESS_DOMAIN)
  if(domain.protocol!=='https:'||!domain.hostname.endsWith('.cloudflareaccess.com')||domain.username||domain.password||domain.port||domain.pathname!=='/'||domain.search||domain.hash||!/^[-\w]+\.[-\w]+\.[-\w]+$/.test(assertion)||assertion.length>16384)return ''
  const response=await fetcher(`${domain.origin}/cdn-cgi/access/get-identity`,{headers:{cookie:`CF_Authorization=${assertion}`,accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(2000)})
  if(!response.ok||!response.body)return ''
  const reader=response.body.getReader(),parts=[];let size=0
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>32768)throw Error('size');parts.push(value)}}catch(e){await reader.cancel();throw e}finally{reader.releaseLock()}
  const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length}
  const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))
  if(data.user_uuid!==identity.subject||typeof data.email!=='string'||data.email.trim().toLowerCase()!==identity.email)return ''
  return cleanProfileName(data.name)
 }catch{return ''}
}
