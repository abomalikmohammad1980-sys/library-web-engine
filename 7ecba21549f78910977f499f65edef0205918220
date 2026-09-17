import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ManagedSourceMapping } from "@library/source-sync";
import { NodeManagedSourceAdapter } from "./node-managed-source-adapter.js";
import { JsonSourceSyncPersistence } from "./json-source-sync-persistence.js";
import { SourceSyncScheduler } from "./source-sync-scheduler.js";
import { SourceSyncDaemon } from "./source-sync-daemon.js";
const roots:string[]=[];
afterEach(async()=>Promise.all(roots.splice(0).map(r=>rm(r,{recursive:true,force:true}))));
describe("daemon restart integration",()=>{it("startup reconciliation queues one durable revision and restart does not duplicate it",async()=>{
 const root=await mkdtemp(join(tmpdir(),"daemon-e2e-"));roots.push(root);await writeFile(join(root,"book.docx"),await readFile(new URL("../../../corpus/books/sample-ahadith.docx",import.meta.url)));
 const state=join(root,".state","sync.json"),adapter=new NodeManagedSourceAdapter(root),persistence=new JsonSourceSyncPersistence(state),snapshot=(await adapter.sample("book.docx"))!;
 const mapping:ManagedSourceMapping={mappingId:"m",bookId:"book",logicalPath:"book.docx",...(snapshot.fileIdentity?{fileIdentity:snapshot.fileIdentity}:{}),lastPublishedRevisionId:null,lastFingerprint:null,lastObservedSnapshot:null,state:"linked",recordVersion:0};await persistence.transaction(async tx=>{await tx.compareAndSwapMapping(null,mapping)});
 const make=()=>new SourceSyncScheduler(adapter,new JsonSourceSyncPersistence(state),{stability:{debounceMs:0,stableIntervalMs:0,requiredStableSamples:2},sleep:async()=>{},now:()=>100});
 for(let run=0;run<2;run++){const scheduler=make(),daemon=new SourceSyncDaemon({managedRoot:root,stateFile:state,reconcileIntervalMs:1000,outboxIntervalMs:1000,buildIntervalMs:1000},{runOnce:async()=>{}},{runOnce:async()=>{}},()=>{},scheduler);await daemon.start();await scheduler.idle();await new Promise(resolve=>setTimeout(resolve,50));await daemon.stop();}
 const operations=await new JsonSourceSyncPersistence(state).transaction(tx=>tx.listRunnableOutbox(100,10));expect(operations).toHaveLength(1);expect(operations[0]).toMatchObject({bookId:"book",state:"pending"});
});});
