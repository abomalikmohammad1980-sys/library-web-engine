import {canonicalShamelaBookId,shamelaPublicBookId} from './shamela_public_identity'

export interface RepairBook {id:string;title:string}
export interface RepairFailure {id:string;title:string;reason:string}
export interface RepairProgress {completed:number;total:number;title:string}
/** A preparation attempt is not proof of search coverage. Always rerun the
 * original search afterwards; only that response owns coverageComplete. */
export async function repairSearchBooks(ids:readonly string[],books:readonly RepairBook[],deps:{
 signal:AbortSignal; identity:()=>string; prepare:(id:string,signal:AbortSignal)=>Promise<void>;
 progress:(value:RepairProgress)=>void;
}):Promise<RepairFailure[]>{
 const identity=deps.identity(),active=()=>{if(deps.signal.aborted||deps.identity()!==identity)throw new DOMException('Index preparation cancelled','AbortError')}
 const lookup=new Map(books.map(book=>[book.id,book])),seen=new Set<string>(),targets:RepairBook[]=[]
 for(const id of ids){let book=lookup.get(id)??lookup.get(canonicalShamelaBookId(id));if(!book&&/^[1-9]\d*$/.test(id)){try{book=lookup.get(shamelaPublicBookId(id))}catch{/* Invalid source identifier. */}}
  const target=book??{id,title:'كتاب لم يتوفر اسمه في الكتالوج'};if(!seen.has(target.id)){seen.add(target.id);targets.push(target)}}
 const failures:RepairFailure[]=[]
 for(const [index,book] of targets.entries()){
  active();deps.progress({completed:index,total:targets.length,title:book.title})
  try{if(!lookup.has(book.id))throw Error('لم يتوفر سجل الكتاب؛ أعد تحميل الكتالوج.');await deps.prepare(book.id,deps.signal);active()}
  catch(error){active();failures.push({...book,reason:error instanceof Error?error.message:'تعذّرت تهيئة الكتاب.'})}
  active();deps.progress({completed:index+1,total:targets.length,title:book.title})
 }
 return failures
}
