import { decideAtomicPublication, evaluateBuildReadiness, requiredDocxPublicationApproval, type BookBuildManifest, type DerivedArtifactKind, type OptionalDerivedArtifactKind, type RequiredDerivedArtifactKind, type RequiredDocxPublicationApproval } from "@library/source-sync";

export type BuildJobState = "pending" | "in-flight" | "retryable" | "succeeded" | "failed";
export interface BuildJob { jobId:string; buildId:string; bookId:string; sourceRevisionId:string; kind:DerivedArtifactKind; state:BuildJobState; attempt:number; nextAttemptAtMs:number; leaseId:string|null; leaseUntilMs:number|null; recordVersion:number; lastError:string|null }
export interface BuildJobStore {
  ensureBuildJobs(manifest: BookBuildManifest): Promise<void>;
  claim(nowMs:number, leaseId:string, leaseMs:number, limit:number): Promise<BuildJob[]>;
  complete(job:BuildJob, artifact: BookBuildManifest["artifacts"][number]): Promise<boolean>;
  retry(job:BuildJob, nextAttemptAtMs:number, code:string): Promise<boolean>;
  fail(job:BuildJob, code:string): Promise<boolean>;
  getManifest(buildId:string): Promise<BookBuildManifest>;
  getActiveBuildId(bookId:string): Promise<string|null>;
  publish(decision: Extract<ReturnType<typeof decideAtomicPublication>, {kind:"publish"}>): Promise<boolean>;
  /** Must verify a separate, non-estimate, explicit public-publish approval. Missing port denies DOCX publication. */
  authorizePublicDocxPublication?(required:RequiredDocxPublicationApproval):Promise<boolean>;
}
export interface DerivedArtifactBuilder { build(input:{job:BuildJob}):Promise<BookBuildManifest["artifacts"][number]> }
export type ArtifactBuilders = Record<RequiredDerivedArtifactKind, DerivedArtifactBuilder> & Partial<Record<OptionalDerivedArtifactKind,DerivedArtifactBuilder>>;

export class DurableBuildWorker {
  constructor(private readonly store:BuildJobStore, private readonly builders:ArtifactBuilders, private readonly policy:{leaseMs:number;limit:number;baseRetryMs:number;maxRetryMs:number}) {}
  async runOnce(nowMs:number, leaseId:string) {
    const jobs=await this.store.claim(nowMs,leaseId,this.policy.leaseMs,this.policy.limit); let completed=0,retried=0,failed=0,published=0;
    for(const job of jobs){ try { const builder=this.builders[job.kind];if(!builder)throw new PermanentBuildError("artifact_builder_missing");const artifact=await builder.build({job}); if(!await this.store.complete(job,artifact)) continue; completed++;
      const manifest=await this.store.getManifest(job.buildId); const ready=evaluateBuildReadiness(manifest); if(ready.kind==="ready"){ const approval=requiredDocxPublicationApproval(manifest);if(approval&&(!this.store.authorizePublicDocxPublication||!await this.store.authorizePublicDocxPublication(approval)))continue; const current=await this.store.getActiveBuildId(job.bookId); const decision=decideAtomicPublication({manifest,expectedActiveBuildId:current,currentActiveBuildId:current}); if(decision.kind==="publish"&&await this.store.publish(decision)) published++; }
    } catch(error){ const failure=classifyBuildError(error); if(failure.retryable){const exponential=Math.min(this.policy.maxRetryMs,this.policy.baseRetryMs*2**Math.min(30,job.attempt-1));const delay=Math.min(this.policy.maxRetryMs,Math.max(exponential,failure.retryAfterMs??0)); if(await this.store.retry(job,nowMs+delay,failure.code)) retried++;} else if(await this.store.fail(job,failure.code)) failed++; } }
    return {claimed:jobs.length,completed,retried,failed,published};
  }
}
export class PermanentBuildError extends Error { constructor(readonly code:string){super(code);} }
function classifyBuildError(error:unknown):{code:string;retryable:boolean;retryAfterMs:number|null}{
 if(error instanceof PermanentBuildError)return{code:error.code,retryable:false,retryAfterMs:null};
 if(error&&typeof error==="object"){
  const item=error as{code?:unknown;retryable?:unknown;retryAfterMs?:unknown};
  const code=typeof item.code==="string"&&/^[a-z][a-z0-9_-]{0,63}$/i.test(item.code)?item.code:"artifact_build_failed";
  if(typeof item.retryable==="boolean")return{code,retryable:item.retryable,retryAfterMs:typeof item.retryAfterMs==="number"&&Number.isFinite(item.retryAfterMs)&&item.retryAfterMs>=0?item.retryAfterMs:null};
 }
 return{code:"artifact_build_failed",retryable:true,retryAfterMs:null};
}
