import type{LocalIndexJob}from'./local_index_jobs';
type Store=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
const prefix='alkhizana:local-word-index-pending:v1:';
/** Coalesce requests without losing an identity switch or invalidation during await. */
export function createWordResumeRunner(options:{scope:()=>string;run:(scope:string)=>Promise<void>;canRun?:()=>boolean}){
 let requested=false,flight:Promise<void>|undefined;
 return ():Promise<void>=>{requested=true;return flight??=(async()=>{while(requested&&(options.canRun?.()??true)){requested=false;const owner=options.scope();await options.run(owner);if(options.scope()!==owner)requested=true}})().finally(()=>{flight=undefined})};
}
export const WORD_CHECKPOINT_MAX_IDS=4096,WORD_CHECKPOINT_MAX_BYTES=1024*1024;
export function pendingWordIds(storage:Store,scope:string):string[]{const raw=storage.getItem(prefix+encodeURIComponent(scope))??'[]';if(raw.length>WORD_CHECKPOINT_MAX_BYTES)throw Error('local_index_checkpoint_capacity');const data:unknown=JSON.parse(raw);if(!Array.isArray(data)||data.length>WORD_CHECKPOINT_MAX_IDS||data.some(id=>typeof id!=='string'||!id||id.length>=256))throw Error('local_index_checkpoint_invalid');return [...new Set(data)] as string[]}
export function checkpointWordJobs(storage:Store,scope:string,jobs:readonly LocalIndexJob[]):void{const ids=new Set(pendingWordIds(storage,scope));for(const job of jobs){if(job.ownerScope!==scope)continue;job.state==='complete'?ids.delete(job.bookId):ids.add(job.bookId)}const raw=JSON.stringify([...ids]);if(ids.size>WORD_CHECKPOINT_MAX_IDS||new TextEncoder().encode(raw).byteLength>WORD_CHECKPOINT_MAX_BYTES)throw Error('local_index_checkpoint_capacity');storage.setItem(prefix+encodeURIComponent(scope),raw)}
/** Reads known local IDs only. Never enumerates or fetches the central library. */
export async function resumeWordCheckpoint<T extends{id:string;title:string;originalSha256?:string;fileSize?:number}>(options:{storage:Store;scope:()=>string;getBook:(id:string)=>Promise<T|undefined>;isWord:(book:T)=>boolean;ready:(book:T)=>Promise<boolean>;fingerprint?:(book:T)=>Promise<string>;enqueue:(id:string,title:string,scope:string,revision:string)=>void;canRun?:()=>boolean;yield?:()=>Promise<void>}):Promise<number>{
 const owner=options.scope(),ids=pendingWordIds(options.storage,owner),active=()=>options.scope()===owner&&(options.canRun?.()??true);let queued=0;
 for(const id of ids){if(!active())break;await(options.yield?.()??new Promise<void>(r=>setTimeout(r,0)));if(!active())break;const book=await options.getBook(id);if(!active())break;if(book&&options.isWord(book)){const ready=await options.ready(book);if(!active())break;if(!ready){const revision=options.fingerprint?await options.fingerprint(book):book.originalSha256||`${book.id}:${book.fileSize}`;if(!active())break;options.enqueue(id,book.title,owner,revision);queued++;continue}}
  const left=pendingWordIds(options.storage,owner).filter(value=>value!==id);options.storage.setItem(prefix+encodeURIComponent(owner),JSON.stringify(left));
 }return queued;
}
