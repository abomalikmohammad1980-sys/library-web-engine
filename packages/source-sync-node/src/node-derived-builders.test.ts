import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { vi } from "vitest";
import { extractFromDocx } from "@engine/ooxml-model";
import { createNodeDocumentBuilders, requireCompleteArtifactBuilders } from "./node-derived-builders.js";
import type { BuildJob } from "../../source-sync-server/src/index.js";

const roots:string[]=[];afterEach(async()=>Promise.all(roots.splice(0).map(r=>rm(r,{recursive:true,force:true}))));
describe("Node document artifact builders",()=>{
 it("converts a real DOCX into immutable reader/toc/search artifacts with verified hashes",async()=>{
  const root=await mkdtemp(join(tmpdir(),"source-derived-"));roots.push(root);const docx=new URL("../../../corpus/books/sample-ahadith.docx",import.meta.url);
  const builders=createNodeDocumentBuilders({readRevisionBytes:async()=>new Uint8Array(await readFile(docx))},{putImmutable:async({objectKey,bytes})=>{const p=join(root,objectKey);await mkdir(dirname(p),{recursive:true});await writeFile(p,bytes);}},"engine-test");
  for(const kind of ["reader","toc","search"] as const){const artifact=await builders[kind]!.build({job:job(kind)});expect(artifact).toMatchObject({kind,status:"ready",engineVersion:"engine-test",fingerprint:{algorithm:"sha256"}});const stored=await readFile(join(root,artifact.objectKey!));expect(stored.byteLength).toBe(artifact.fingerprint!.byteLength);expect(JSON.parse(stored.toString("utf8"))).toBeTruthy();}
 });
 it("refuses a runnable pipeline while a real PDF builder is absent",()=>{const partial=createNodeDocumentBuilders({readRevisionBytes:async()=>new Uint8Array()},{putImmutable:async()=>{}},"1");expect(()=>requireCompleteArtifactBuilders(partial)).toThrow(/pdf/);});
 it("extracts one bounded model for reader/toc/search and invalidates it when source bytes change",async()=>{
  const original=new Uint8Array(await readFile(new URL("../../../corpus/books/sample-ahadith.docx",import.meta.url)));let current=original;
  const extract=vi.fn(extractFromDocx),builders=createNodeDocumentBuilders({readRevisionBytes:async()=>current},{putImmutable:async()=>{}},"1",undefined,{maxEntries:1,maxSourceBytes:32*1024*1024,extract});
  for(const kind of ["reader","toc","search"] as const)await builders[kind]!.build({job:job(kind)});
  expect(extract).toHaveBeenCalledTimes(1);
  current=new Uint8Array(await readFile(new URL("../../../corpus/books/sample-jalsa27.docx",import.meta.url)));
  await builders.search!.build({job:job("search")});
  expect(extract).toHaveBeenCalledTimes(2);
 });
 it("does not retain a model when the source exceeds the configured memory budget",async()=>{
  const bytes=new Uint8Array(await readFile(new URL("../../../corpus/books/sample-ahadith.docx",import.meta.url))),extract=vi.fn(extractFromDocx);
  const builders=createNodeDocumentBuilders({readRevisionBytes:async()=>bytes},{putImmutable:async()=>{}},"1",undefined,{maxEntries:1,maxSourceBytes:1,extract});
  await builders.toc!.build({job:job("toc")});await builders.search!.build({job:job("search")});
  expect(extract).toHaveBeenCalledTimes(2);
 });
});
function job(kind:BuildJob["kind"]):BuildJob{return{jobId:`job-${kind}`,buildId:"build-1",bookId:"book-1",sourceRevisionId:"revision-1",kind,state:"in-flight",attempt:1,nextAttemptAtMs:0,leaseId:"lease",leaseUntilMs:100,recordVersion:1,lastError:null};}
