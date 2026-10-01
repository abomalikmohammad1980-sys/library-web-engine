import {CONTRACT,LANGUAGES,Store,prepareSource,sha256,validateResult} from './core.mjs';
import {nameProvider,nameReady} from './names.mjs';
const response=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
async function readJSON(stream,limit){
 if(!stream)throw Error('body_required');const reader=stream.getReader(),chunks=[];let count=0;
 try{while(true){const r=await reader.read();if(r.done)break;count+=r.value.length;if(count>limit){await reader.cancel();throw Error('body_limit');}chunks.push(r.value);}}finally{reader.releaseLock();}
 const all=new Uint8Array(count);let at=0;for(const x of chunks){all.set(x,at);at+=x.length;}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(all));
}
async function payload(request){if(!request.headers.get('content-type')?.includes('application/json'))throw Error('json_required');const p=await readJSON(request.body,512000);if(!p||typeof p!=='object'||Array.isArray(p))throw Error('object_required');return p;}
async function auth(request,env){
 if(typeof env.LOCALIZATION_ADMIN_TOKEN!=='string'||env.LOCALIZATION_ADMIN_TOKEN.length<32)return false;
 const value=request.headers.get('authorization')||'';if(value.length>1024)return false;
 const a=await sha256(value),b=await sha256('Bearer '+env.LOCALIZATION_ADMIN_TOKEN);let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;
}
const bounded=(value,fallback,max)=>value===undefined?fallback:Number.isSafeInteger(Number(value))&&Number(value)>=0?Math.min(Number(value),max):0;
export async function callProvider(job,env){
 const names=job.kind==='author';if(names&&!env.NAME_TRANSLATOR)return nameProvider(job,env);const service=names?env.NAME_TRANSLATOR:env.TRANSLATOR;if(!service)throw Error(names?'name_adapter_required':'translator_required');
 const url=names?'https://localization.internal/name':'https://khzanah.com/api/translate';
 const body=names?{contract:'khzanah-proper-name/1',source:job.source,targetLanguage:job.locale,context:job.context}:{text:job.source,sourceLanguage:'ar',targetLanguage:job.locale,purpose:job.kind==='ui'?'ui':'text'};
 const r=await service.fetch(new Request(url,{method:'POST',headers:{'content-type':'application/json',origin:'https://khzanah.com'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)}));
 if(!r.ok){await r.body?.cancel();throw Error('provider_http_'+r.status);}
 const p=await readJSON(r.body,100000);
 if(p.paidFallback===true||(names&&p.contract!=='khzanah-proper-name/1'))throw Error('provider_contract');
 return {translation:validateResult(job.source,p.translation),provider:String(p.engine||'adapter').slice(0,100)};
}
export class LocalizationCoordinator{
 constructor(ctx,env){this.ctx=ctx;this.env=env;this.store=new Store((...a)=>ctx.storage.sql.exec(...a),fn=>ctx.storage.transactionSync(fn));this.flushPromise=null;}
 async wake(delay=1000){const time=Date.now()+delay,old=await this.ctx.storage.getAlarm();if(old===null||old>time)await this.ctx.storage.setAlarm(time);}
 async fetch(request){
  const route=new URL(request.url).pathname;
  try{
   if(route==='/status'&&request.method==='GET')return response({...this.store.status(),nameAdapter:nameReady(this.env)});
   if(request.method!=='POST')return response({error:'method_not_allowed'},405);
   const p=await payload(request);
   if(route==='/sources'){
    if(!Array.isArray(p.rows)||p.rows.length>128)throw Error('rows_limit');
    const items=await Promise.all(p.rows.map(prepareSource));const result=this.store.ingest(items);await this.wake();return response(result);
   }
   if(route==='/seed'){
    if(!Array.isArray(p.rows)||p.rows.length>128)throw Error('rows_limit');
    // Validate every result before touching the batch.
    for(const r of p.rows){if(!r||!LANGUAGES.includes(r.locale)||typeof r.reviewed!=='boolean')throw Error('invalid_seed');const s=this.store.one('SELECT source FROM sources WHERE unit=? LIMIT 1',r.unit);if(!s)throw Error('unknown_source');validateResult(s.source,r.translation);}
    for(const r of p.rows)this.store.seed(r.unit,r.locale,r.translation,{reviewed:r.reviewed});await this.wake();return response({accepted:p.rows.length});
   }
   if(route==='/control'){
    if(typeof p.enabled!=='boolean')throw Error('invalid_control');this.store.set('enabled',p.enabled);
    if(p.retryBlocked===true)this.store.exec("UPDATE jobs SET status='pending',due=0,attempts=0 WHERE status='blocked'");
    await this.wake();return response(this.store.status());
   }
   if(route==='/publish'){await this.publish();return response({unpublished:this.store.pendingPublications(1).length>0});}
   return response({error:'not_found'},404);
  }catch(e){console.warn('localization_request_failed',String(e?.message||'invalid').slice(0,80));return response({error:'invalid_request'},400);}
 }
 async publish(){
  if(this.flushPromise)return this.flushPromise;
  this.flushPromise=(async()=>{
   if(!this.env.LOCALE_FILES)throw Error('storage_required');
   for(const p of this.store.pendingPublications(8)){
    const rows=this.store.publicationRows(p.locale,p.kind,p.shard).map(r=>[r.id,r.source,r.translation,r.reviewed===1]);
    const data=JSON.stringify({contract:CONTRACT,...p,published:undefined,rows});
    if(new TextEncoder().encode(data).length>4000000)throw Error('dictionary_too_large');
    await this.env.LOCALE_FILES.put(`localization/v1/${p.locale}/${p.kind}/${p.shard}.json`,data,{httpMetadata:{contentType:'application/json; charset=utf-8'}});
    this.store.published(p); // Concurrent changes leave generation dirty for another flush.
   }
  })().finally(()=>{this.flushPromise=null;});return this.flushPromise;
 }
 async alarm(){
  await this.ctx.storage.setAlarm(Date.now()+300000);
  let blocked=false;
  try{
   if(this.store.setting('enabled','false')==='true')for(let i=0;i<2;i++){
    const c=this.store.claim({dailyCalls:bounded(this.env.DAILY_CALLS,200,2000),dailyCharacters:bounded(this.env.DAILY_CHARACTERS,50000,1000000),monthlyCalls:bounded(this.env.MONTHLY_CALLS,5000,50000),monthlyCharacters:bounded(this.env.MONTHLY_CHARACTERS,1000000,10000000),allowNames:nameReady(this.env)});
    if(!c.job){blocked=c.reason==='budget';if(c.reason==='obsolete')continue;break;}
    try{const p=await callProvider(c.job,this.env);this.store.complete(c.job,p.translation,p.provider);}
    catch(e){const code=String(e?.message||'provider_failure'),rate=/429|503|502|quota/.test(code);this.store.fail(c.job,code,{retryAfter:rate?3600000:Math.min(86400000,60000*2**Math.min(c.job.attempts,10)),permanent:!rate&&c.job.attempts>=8});}
   }
   await this.publish();
   const pending=this.store.one("SELECT MIN(CASE WHEN status='running' THEN lease ELSE due END) due FROM jobs WHERE status IN ('pending','running') AND (?=1 OR kind<>'author')",nameReady(this.env)?1:0)?.due;
   if(this.store.pendingPublications(1).length)await this.ctx.storage.setAlarm(Date.now()+5000);
   else if(this.store.setting('enabled','false')==='true'&&pending!==null&&pending!==undefined)await this.ctx.storage.setAlarm(Math.max(Date.now()+(blocked?3600000:5000),pending));
   else await this.ctx.storage.deleteAlarm();
  }catch(e){console.warn('localization_alarm_failed',String(e?.message||'error').slice(0,80));}
 }
}
export default{
 async fetch(request,env){
  let route=new URL(request.url).pathname;if(route.startsWith('/api/localization/'))route=route.slice('/api/localization'.length);
  if(route==='/v1/capabilities'&&request.method==='GET')return response({contract:CONTRACT,languages:LANGUAGES,readDoesNotTranslate:true,nameAdapter:nameReady(env)});
  const m=/^\/v1\/dict\/([a-z]{2,3})\/(ui|book|author)\/([0-9a-f])\.json$/.exec(route);
  if(m&&request.method==='GET'){
   if(!LANGUAGES.includes(m[1])||(m[2]==='ui'&&m[3]!=='0'))return response({error:'not_found'},404);
   try{const object=await env.LOCALE_FILES.get(`localization/v1/${m[1]}/${m[2]}/${m[3]}.json`);if(!object)return response({error:'not_ready'},404);
    return new Response(object.body,{headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=60','etag':object.httpEtag,'x-content-type-options':'nosniff'}});
   }catch{return response({error:'dictionary_unavailable'},503);}
  }
  const a=/^\/admin\/(sources|seed|control|publish|status)$/.exec(route);
  if(a){if(!await auth(request,env))return response({error:'unauthorized'},401);const stub=env.LOCALIZATION_COORDINATOR.get(env.LOCALIZATION_COORDINATOR.idFromName('site-localization-v1'));return stub.fetch(new Request('https://localization.internal/'+a[1],request));}
  return response({error:'not_found'},404);
 }
};
