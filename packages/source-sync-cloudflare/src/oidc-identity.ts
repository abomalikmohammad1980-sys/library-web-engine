import type { IdentityVerifier } from "./identity.js";

export interface OidcIdentityConfig { issuer:string; audience:string; jwksUrl:string; algorithms:readonly ("RS256"|"ES256")[]; clockSkewSeconds?:number; fetchTimeoutMs?:number; maxCacheSeconds?:number }
export interface OidcIdentityDependencies { fetch?:typeof globalThis.fetch; now?:()=>number }
type Jwk=JsonWebKey&{kid?:string;alg?:string;use?:string;kty?:string};
type Cache={keys:Jwk[];expiresAt:number};

export class OidcJwksIdentityVerifier implements IdentityVerifier{
  private cache:Cache|null=null;private pending:Promise<Cache>|null=null;
  constructor(private readonly config:OidcIdentityConfig,private readonly deps:OidcIdentityDependencies={}){validateConfig(config)}
  async verifyBearer(token:string){try{const parts=token.split(".");if(parts.length!==3)return invalid();const header=json(parts[0]!) as {alg?:string;kid?:string;typ?:string};const claims=json(parts[1]!) as Record<string,unknown>;if(!header.kid||!this.config.algorithms.includes(header.alg as never))return invalid();let key=await this.key(header.kid,false);if(!key)key=await this.key(header.kid,true);if(!key||key.alg&&key.alg!==header.alg||key.use&&key.use!=="sig"||!keyTypeMatches(key,header.alg!))return invalid();const cryptoKey=await crypto.subtle.importKey("jwk",key,algorithm(header.alg!),false,["verify"]);const valid=await crypto.subtle.verify(algorithm(header.alg!),cryptoKey,b64(parts[2]!),new TextEncoder().encode(`${parts[0]}.${parts[1]}`));if(!valid||!validClaims(claims,this.config,(this.deps.now?.()??Date.now())/1000))return invalid();if(claims.is_guest===true||claims.account_type==="guest")return{kind:"guest" as const};return{kind:"account" as const,userId:String(claims.sub)};}catch{return invalid()}}
  private async key(kid:string,refresh:boolean){const now=this.deps.now?.()??Date.now();if(refresh||!this.cache||this.cache.expiresAt<=now)this.cache=await this.load();return this.cache.keys.find(k=>k.kid===kid)}
  private async load(){if(this.pending)return this.pending;this.pending=this.fetchKeys().finally(()=>{this.pending=null});return this.pending}
  private async fetchKeys():Promise<Cache>{const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),this.config.fetchTimeoutMs??5000);try{const response=await(this.deps.fetch??fetch)(this.config.jwksUrl,{signal:controller.signal,headers:{accept:"application/json"}});if(!response.ok)throw new Error("jwks_fetch_failed");const body=await response.json() as {keys?:unknown};if(!Array.isArray(body.keys))throw new Error("jwks_invalid");const maxAge=Math.min(cacheSeconds(response.headers.get("cache-control")),this.config.maxCacheSeconds??3600);return{keys:body.keys.filter(x=>typeof x==="object"&&x!==null) as Jwk[],expiresAt:(this.deps.now?.()??Date.now())+maxAge*1000}}finally{clearTimeout(timeout)}}
}
function validateConfig(c:OidcIdentityConfig){if(!c.issuer||!c.audience||!c.jwksUrl||!c.algorithms.length||c.algorithms.some(a=>a!=="RS256"&&a!=="ES256"))throw new Error("oidc_config_invalid");new URL(c.issuer);new URL(c.jwksUrl)}
function validClaims(c:Record<string,unknown>,cfg:OidcIdentityConfig,now:number){const skew=cfg.clockSkewSeconds??60,aud=c.aud;return c.iss===cfg.issuer&&(aud===cfg.audience||Array.isArray(aud)&&aud.includes(cfg.audience))&&typeof c.sub==="string"&&c.sub.length>0&&typeof c.exp==="number"&&now-skew<c.exp&&(!("nbf"in c)||typeof c.nbf==="number"&&now+skew>=c.nbf)&&(!("iat"in c)||typeof c.iat==="number"&&now+skew>=c.iat)}
function algorithm(alg:string):RsaHashedImportParams|EcdsaParams{return alg==="RS256"?{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"}:{name:"ECDSA",namedCurve:"P-256",hash:"SHA-256"} as EcdsaParams}
function keyTypeMatches(k:Jwk,alg:string){return alg==="RS256"?k.kty==="RSA":k.kty==="EC"&&k.crv==="P-256"}
function cacheSeconds(value:string|null){const m=value?.match(/(?:^|,)\s*max-age=(\d+)/i);return m?Math.max(1,Number(m[1])):60}
function b64(value:string){const normalized=value.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(value.length/4)*4,"=");return Uint8Array.from(atob(normalized),c=>c.charCodeAt(0))}
function json(value:string){return JSON.parse(new TextDecoder().decode(b64(value)))}
function invalid(){return{kind:"invalid" as const}}

export function oidcVerifierFromBindings(env:{OIDC_ISSUER?:string;OIDC_AUDIENCE?:string;OIDC_JWKS_URL?:string;OIDC_ALLOWED_ALGORITHMS?:string},deps?:OidcIdentityDependencies){const algorithms=env.OIDC_ALLOWED_ALGORITHMS?.split(",").map(x=>x.trim()).filter(Boolean) as ("RS256"|"ES256")[]|undefined;if(!env.OIDC_ISSUER||!env.OIDC_AUDIENCE||!env.OIDC_JWKS_URL||!algorithms?.length)throw new Error("oidc_bindings_missing");return new OidcJwksIdentityVerifier({issuer:env.OIDC_ISSUER,audience:env.OIDC_AUDIENCE,jwksUrl:env.OIDC_JWKS_URL,algorithms})}
