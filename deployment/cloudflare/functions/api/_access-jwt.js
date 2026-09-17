const encoder=new TextEncoder()
const keyCaches=new Map()

const clean=value=>String(value??'').trim()
const decode=value=>{
  const normalized=value.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(value.length/4)*4,'=')
  return Uint8Array.from(atob(normalized),character=>character.charCodeAt(0))
}
const parse=value=>JSON.parse(new TextDecoder().decode(decode(value)))
const normalizeIssuer=value=>clean(value).replace(/\/+$/u,'')
const audienceMatches=(claim,expected)=>claim===expected||Array.isArray(claim)&&claim.includes(expected)

async function loadKeys(domain,fetcher,now,timeoutMs,force=false){
  const cacheKey=normalizeIssuer(domain),cached=keyCaches.get(cacheKey)??{keys:[],expiresAt:0,refreshedAt:0,pending:null}
  if(!force&&cached.expiresAt>now)return cached.keys
  if(force&&cached.keys.length&&now-cached.refreshedAt<30_000)return cached.keys
  if(cached.pending)return cached.pending
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),timeoutMs)
  cached.pending=(async()=>{const response=await fetcher(`${cacheKey}/cdn-cgi/access/certs`,{headers:{accept:'application/json'},signal:controller.signal})
    if(!response.ok)throw new Error('access_jwks_fetch_failed')
    const body=await response.json()
    if(!Array.isArray(body.keys)||body.keys.length>64||body.keys.some(key=>!key||typeof key!=='object'))throw new Error('access_jwks_invalid')
    const match=response.headers.get('cache-control')?.match(/(?:^|,)\s*max-age=(\d+)/iu),seconds=Math.min(3600,Math.max(30,Number(match?.[1]??60)))
    cached.keys=body.keys;cached.expiresAt=now+seconds*1000;cached.refreshedAt=now;return cached.keys
  })().finally(()=>{clearTimeout(timeout);cached.pending=null})
  keyCaches.set(cacheKey,cached)
  return cached.pending
}

export async function verifyAccessAssertion(assertion,env,{fetcher=fetch,now=()=>Date.now(),fetchTimeoutMs=5000,includeLifetime=false}={}){
  try{
    const domain=normalizeIssuer(env.ACCOUNT_ACCESS_DOMAIN),audience=clean(env.ACCOUNT_ACCESS_AUD)
    if(!domain||!audience)return null
    const parts=clean(assertion).split('.')
    if(parts.length!==3)return null
    const header=parse(parts[0]),claims=parse(parts[1])
    if(header.alg!=='RS256'||typeof header.kid!=='string'||!header.kid)return null
    const nowMs=now();let keys=await loadKeys(domain,fetcher,nowMs,fetchTimeoutMs),jwk=keys.find(key=>key?.kid===header.kid)
    if(!jwk){keys=await loadKeys(domain,fetcher,nowMs,fetchTimeoutMs,true);jwk=keys.find(key=>key?.kid===header.kid)}
    if(!jwk||jwk.kty!=='RSA'||jwk.use&&jwk.use!=='sig'||jwk.alg&&jwk.alg!=='RS256')return null
    const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify'])
    const valid=await crypto.subtle.verify({name:'RSASSA-PKCS1-v1_5'},key,decode(parts[2]),encoder.encode(`${parts[0]}.${parts[1]}`))
    const seconds=nowMs/1000,issuer=normalizeIssuer(claims.iss),email=clean(claims.email).toLowerCase(),subject=clean(claims.sub)
    if(!valid||issuer!==domain||!audienceMatches(claims.aud,audience)||typeof claims.exp!=='number'||seconds>=claims.exp||typeof claims.nbf==='number'&&seconds<claims.nbf||!subject||subject.length>500||!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email))return null
    return{email,subject,name:typeof claims.name==='string'?claims.name.trim():typeof claims.custom?.name==='string'?claims.custom.name.trim():'',...(includeLifetime?{expiresAt:claims.exp}:{})}
  }catch{return null}
}

export function clearAccessKeyCacheForTests(){keyCaches.clear()}
