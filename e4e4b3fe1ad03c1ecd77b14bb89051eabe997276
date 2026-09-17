import { createHash } from "node:crypto";
import { extractFromDocx } from "@engine/ooxml-model";
import type { DerivedArtifact, DerivedArtifactKind } from "@library/source-sync";
import type { ArtifactBuilders, BuildJob } from "../../source-sync-server/src/index.js";
import { discoverWordCover } from "../../word-cover/src/index.js";
import type { WordPageMapClient } from "./word-page-map-client.js";

export interface ImmutableRevisionSource { readRevisionBytes(revisionId:string):Promise<Uint8Array> }
export interface BoundDocxRevision { bytes:Uint8Array;editionId:string;format:"docx";sha256:string }
export interface SourceEditionRevisionSource extends ImmutableRevisionSource { readRevisionSource?(revisionId:string):Promise<BoundDocxRevision> }
export interface DerivedArtifactSink { putImmutable(input:{objectKey:string;bytes:Uint8Array;contentType:string}):Promise<void> }
export interface DocumentModelCachePolicy {
 maxEntries:number; maxSourceBytes:number;
 extract?:typeof extractFromDocx;
}

/** Production adapters over the existing OOXML parser. PDF and cover are
 * intentionally absent until a real exporter/extractor boundary is available. */
export function createNodeDocumentBuilders(source:SourceEditionRevisionSource,sink:DerivedArtifactSink,engineVersion:string,wordMap?:WordPageMapClient,cachePolicy:DocumentModelCachePolicy={maxEntries:1,maxSourceBytes:32*1024*1024}):Partial<ArtifactBuilders>{
 if(!Number.isSafeInteger(cachePolicy.maxEntries)||cachePolicy.maxEntries<0||!Number.isSafeInteger(cachePolicy.maxSourceBytes)||cachePolicy.maxSourceBytes<0)throw new Error("invalid_document_model_cache_policy");
 const cache=new Map<string,ReturnType<typeof extractFromDocx>>(),extract=cachePolicy.extract??extractFromDocx;
 const modelFor=(bound:BoundDocxRevision)=>{const hit=cache.get(bound.sha256);if(hit){cache.delete(bound.sha256);cache.set(bound.sha256,hit);return hit}const model=extract(bound.bytes);if(cachePolicy.maxEntries>0&&bound.bytes.byteLength<=cachePolicy.maxSourceBytes){cache.set(bound.sha256,model);while(cache.size>cachePolicy.maxEntries)cache.delete(cache.keys().next().value!)}return model};
 const build=async(job:BuildJob,kind:"reader"|"toc"|"search")=>{const bound=await readBound(source,job.sourceRevisionId),model=modelFor(bound);let value:unknown,mapResult:Awaited<ReturnType<WordPageMapClient["build"]>>|undefined;
  if(kind==="reader"){if(wordMap)mapResult=await wordMap.build(bound.bytes);value={compatibilityMode:model.compatibilityMode,defaultTabStop:model.defaultTabStop,sections:model.sections,paragraphs:model.paragraphs,numbering:[...model.numbering.entries()],...(mapResult?{wordPageMap:mapResult.map}:{})};}
  else if(kind==="toc")value=model.paragraphs.filter(p=>p.toc!==null||p.bookmarkIds?.length).map(p=>({paragraphIndex:p.index,styleId:p.styleId,text:p.text,toc:p.toc,bookmarks:p.bookmarkIds??[]}));
  else value={paragraphs:model.paragraphs.filter(p=>!p.excluded||p.excluded==="empty").map(p=>({index:p.index,text:p.text,styleId:p.styleId,sectionIndex:p.sectionIndex}))};
  const bytes=new TextEncoder().encode(JSON.stringify(value));const hex=createHash("sha256").update(bytes).digest("hex");const objectKey=`artifacts/${job.bookId}/${job.buildId}/${kind}/${hex}.json`;await sink.putImmutable({objectKey,bytes,contentType:"application/json"});
  return {artifactId:`${job.buildId}:${kind}`,kind,bookId:job.bookId,sourceRevisionId:job.sourceRevisionId,buildId:job.buildId,status:"ready",fingerprint:{algorithm:"sha256",hex,byteLength:bytes.byteLength},objectKey,engineVersion,sourceEdition:{editionId:bound.editionId,format:"docx",sha256:bound.sha256},...(mapResult?{wordPageMap:{authoritative:true as const,engine:"microsoft-word-com" as const,fingerprint:mapResult.fingerprint,totalPages:mapResult.map.totalPages}}:{})} satisfies DerivedArtifact;};
 const cover=async(job:BuildJob)=>{const bound=await readBound(source,job.sourceRevisionId),found=discoverWordCover(bound.bytes);if(!found)throw new Error("No eligible Word cover");const hex=createHash("sha256").update(found.bytes).digest("hex"),objectKey=`artifacts/${job.bookId}/${job.buildId}/cover/${hex}`;await sink.putImmutable({objectKey,bytes:found.bytes,contentType:found.mimeType});return{artifactId:`${job.buildId}:cover`,kind:"cover",bookId:job.bookId,sourceRevisionId:job.sourceRevisionId,buildId:job.buildId,status:"ready",fingerprint:{algorithm:"sha256",hex,byteLength:found.bytes.byteLength},objectKey,engineVersion,sourceEdition:{editionId:bound.editionId,format:"docx",sha256:bound.sha256}} satisfies DerivedArtifact};
 return {reader:{build:({job})=>build(job,"reader")},toc:{build:({job})=>build(job,"toc")},search:{build:({job})=>build(job,"search")},cover:{build:({job})=>cover(job)}};
}
async function readBound(source:SourceEditionRevisionSource,revisionId:string):Promise<BoundDocxRevision>{const value=source.readRevisionSource?await source.readRevisionSource(revisionId):undefined,bytes=value?.bytes??await source.readRevisionBytes(revisionId),sha256=createHash("sha256").update(bytes).digest("hex");if(value&&(value.format!=="docx"||value.sha256!==sha256||!value.editionId.trim()))throw new Error("source_edition_binding_mismatch");return value??{bytes,editionId:revisionId,format:"docx",sha256}}

export function requireCompleteArtifactBuilders(partial:Partial<ArtifactBuilders>):ArtifactBuilders{
 const missing=(['reader','pdf','search','toc','cover'] as DerivedArtifactKind[]).filter(k=>partial[k]===undefined);if(missing.length)throw new Error(`Missing production artifact builders: ${missing.join(",")}`);return partial as ArtifactBuilders;
}
