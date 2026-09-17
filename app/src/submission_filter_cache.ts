import type {AccountBookSubmission,AccountReviewStatusFilter} from './account_service'
export interface SubmissionPage {submissions:AccountBookSubmission[];hasMore:boolean;page:number}
export type SubmissionFetch=(status:AccountReviewStatusFilter,page:number)=>Promise<SubmissionPage>
/** Per-panel memory only. Never retain administrator data across account sessions. */
export function createSubmissionFilterCache(fetchPage:SubmissionFetch){
 let epoch=0,initialized=false;
 const cache=new Map<string,SubmissionPage>(),pending=new Map<string,Promise<SubmissionPage>>();
 const key=(status:AccountReviewStatusFilter,page:number)=>`${status}:${page}`;
 const request=(status:AccountReviewStatusFilter,page:number)=>{
  const k=key(status,page),found=cache.get(k);if(found)return Promise.resolve(found);
  const running=pending.get(k);if(running)return running;
  const generation=epoch;
  const task=fetchPage(status,page).then(result=>{if(generation===epoch){cache.set(k,result);if(status==='all'&&page===0&&!result.hasMore){for(const filter of ['pending','approved','rejected'] as const)cache.set(key(filter,0),{page:0,hasMore:false,submissions:result.submissions.filter(row=>row.reviewStatus===filter)})}}return result}).finally(()=>{if(pending.get(k)===task)pending.delete(k)});
  pending.set(k,task);return task;
 };
 return {
  peek:(status:AccountReviewStatusFilter,page=0)=>cache.get(key(status,page)),
  clear(){epoch++;initialized=false;cache.clear();pending.clear()},
  async load(status:AccountReviewStatusFilter,page=0){
   const generation=epoch;
   if(!initialized&&page===0){initialized=true;try{await request('all',0)}catch{if(generation===epoch)initialized=false;throw Error('submissions_load_failed')};if(generation!==epoch)throw Error('submissions_load_superseded')}
   return request(status,page);
  },
 };
}
