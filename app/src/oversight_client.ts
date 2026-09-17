import {currentAccountClaims} from './account_authority'
type Options={fetch?:typeof fetch;signal?:AbortSignal}
export interface OversightEvent{id:number;actorName:string;actorSubject:string;entityType:string;entityId:string;action:string;createdAt:string;canUndo:boolean;undone:boolean;summary:string;revision:number;unsupportedReason?:string;before?:Record<string,unknown>|null;after?:Record<string,unknown>|null}
export interface OversightNotification{id:number;message:string;reason:string;createdAt:string}
const fail=(code='oversight_invalid_response'):never=>{throw Error(code)}
const str=(v:unknown,max:number,empty=false):v is string=>typeof v==='string'&&v.length<=max&&(empty||Boolean(v.trim()))
async function request(path:string,admin:boolean,options:Options,init:RequestInit={}){
 const identity=currentAccountClaims();if(!identity||(admin&&identity.role!=='super-admin'))return fail('oversight_forbidden')
 const signal=options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000)
 const response=await(options.fetch??fetch)(path,{...init,credentials:'same-origin',cache:'no-store',redirect:'error',signal,headers:{Accept:'application/json',...init.headers}})
 const check=()=>{const active=currentAccountClaims();if(active?.subject!==identity.subject||active?.sessionId!==identity.sessionId||(admin&&active?.role!=='super-admin'))fail('oversight_session_changed');signal.throwIfAborted()};check()
 if(response.status===409)return fail('oversight_conflict');if(!response.ok)return fail('oversight_unavailable')
 if(!response.headers.get('content-type')?.includes('application/json')||!response.body)return fail()
 const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0
 const abort=()=>void reader.cancel().catch(()=>{});signal.addEventListener('abort',abort,{once:true})
 try{for(;;){check();const part=await reader.read();check();if(part.done)break;size+=part.value.length;if(size>2*1024*1024)return fail();chunks.push(part.value)}}catch(error){await reader.cancel().catch(()=>{});throw error}finally{signal.removeEventListener('abort',abort);reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}const result=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));check();return result
}
const pageNumber=(page:number)=>{if(!Number.isSafeInteger(page)||page<0||page>10000)fail()}
export async function loadOversight(page=0,actor='',options:Options={}):Promise<{events:OversightEvent[];page:number;hasMore:boolean;total?:number}>{
 pageNumber(page);if(!str(actor,240,true))return fail()
 const result=await request(`/api/admin/oversight?page=${page}&limit=30${actor?'&actor='+encodeURIComponent(actor):''}`,true,options)
 if(!result||result.page!==page||typeof result.hasMore!=='boolean'||!Array.isArray(result.events)||result.events.length>50||(result.hasMore&&!result.events.length))return fail()
 const ids=new Set<number>();const events=result.events.map((row:any)=>{if(!row||!Number.isSafeInteger(row.id)||row.id<1||ids.has(row.id)||!str(row.actorName,300)||!str(row.actorSubject,240)||!str(row.entityType,100)||!str(row.entityId,240)||!str(row.action,100)||!str(row.summary,5000)||!str(row.createdAt,100)||!Number.isFinite(Date.parse(row.createdAt))||typeof row.canUndo!=='boolean'||typeof row.undone!=='boolean'||!Number.isSafeInteger(row.revision)||row.revision<1||row.unsupportedReason!==undefined&&!str(row.unsupportedReason,1000,true))return fail();ids.add(row.id);return {id:row.id,actorName:row.actorName,actorSubject:row.actorSubject,entityType:row.entityType,entityId:row.entityId,action:row.action,createdAt:row.createdAt,canUndo:row.canUndo,undone:row.undone,summary:row.summary,revision:row.revision,...(row.unsupportedReason?{unsupportedReason:row.unsupportedReason}:{})} as OversightEvent})
 for(let i=0;i<events.length;i++){for(const key of ['before','after'] as const){const value=result.events[i][key];if(value!==undefined){if(value!==null&&(typeof value!=='object'||Array.isArray(value)))return fail();events[i][key]=value}}}
 if(actor&&events.some((e:OversightEvent)=>e.actorSubject!==actor))return fail()
 if(result.total!==undefined&&(!Number.isSafeInteger(result.total)||result.total<0))return fail()
 return{events,page,hasMore:result.hasMore,total:result.total}
}
export async function loadOversightActors(page=0,options:Options={}):Promise<{actors:{id:string;name:string}[];hasMore:boolean}>{
 pageNumber(page);const result=await request('/api/admin/oversight-actors?page='+page,true,options)
 if(!result||result.page!==page||typeof result.hasMore!=='boolean'||!Array.isArray(result.actors)||result.actors.length>100||(result.hasMore&&!result.actors.length))return fail()
 const seen=new Set<string>();for(const row of result.actors){if(!row||!str(row.id,240)||!str(row.name,300)||seen.has(row.id))return fail();seen.add(row.id)}
 return{actors:result.actors,hasMore:result.hasMore}
}
export async function undoOversight(eventId:number,expectedVersion:number,reason:string,options:Options={}):Promise<number>{
 if(!Number.isSafeInteger(eventId)||eventId<1||!Number.isSafeInteger(expectedVersion)||expectedVersion<1||expectedVersion>=2147483647||!str(reason.trim(),1000)||/[\u0000-\u001f\u007f]/.test(reason))return fail('oversight_reason_required')
 const result=await request('/api/admin/oversight',true,options,{method:'POST',headers:{'content-type':'application/json','x-alkhizana-request':'account-ui'},body:JSON.stringify({eventId,expectedVersion,reason:reason.trim()})})
 if(result?.ok!==true||!Number.isSafeInteger(result.revision)||result.revision!==expectedVersion+1)return fail();return result.revision
}
export async function loadOversightInbox(page=0,options:Options={}):Promise<{notifications:OversightNotification[];page:number;hasMore:boolean}>{
 pageNumber(page);const result=await request(`/api/account/notifications?page=${page}&limit=50`,false,options)
 if(!result||result.page!==page||typeof result.hasMore!=='boolean'||!Array.isArray(result.notifications)||result.notifications.length>50||(result.hasMore&&!result.notifications.length))return fail()
 const seen=new Set<number>();const notifications=result.notifications.map((row:any)=>{if(!row||!Number.isSafeInteger(row.id)||row.id<1||seen.has(row.id)||!str(row.message,5000)||!str(row.reason,1000,true)||!str(row.createdAt,100)||!Number.isFinite(Date.parse(row.createdAt)))return fail();seen.add(row.id);return{id:row.id,message:row.message,reason:row.reason,createdAt:row.createdAt}});return{notifications,page,hasMore:result.hasMore}
}
