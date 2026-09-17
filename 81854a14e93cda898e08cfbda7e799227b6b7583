import type { BookSourceRevision, RevisionHistorySnapshot } from "@library/source-sync";
import type { RevisionHistoryStore } from "../../source-sync-server/src/index.js";
import type { D1DatabaseBinding } from "./bindings.js";

type Row = Record<string, unknown>;
export class D1RevisionHistoryStore implements RevisionHistoryStore {
  constructor(private readonly db: D1DatabaseBinding) {}
  async isOwner(bookId:string,userId:string){return await this.db.prepare("SELECT 1 AS owned FROM books WHERE id=?1 AND owner_id=?2").bind(bookId,userId).first()!==null;}
  async snapshot(bookId:string):Promise<RevisionHistorySnapshot>{
    const publication=await this.db.prepare("SELECT active_source_revision_id,active_build_id,desired_source_revision_id,record_version FROM book_publications WHERE book_id=?1").bind(bookId).first<Row>();
    const rows=await this.db.prepare("SELECT id,book_id,operation_id,base_revision_id,sha256,byte_length,source_name,created_at,created_by_device_id,status FROM book_source_revisions WHERE book_id=?1 ORDER BY created_at DESC,id DESC").bind(bookId).all<Row>();
    return {bookId,currentRevisionId:nullable(publication?.active_source_revision_id),currentBuildId:nullable(publication?.active_build_id),desiredRevisionId:nullable(publication?.desired_source_revision_id),recordVersion:Number(publication?.record_version??0),revisions:(rows.results??[]).map(revision)};
  }
  async findRollback(bookId:string,operationId:string){const r=await this.db.prepare("SELECT target_revision_id,status,publication_record_version FROM source_revision_rollbacks WHERE book_id=?1 AND operation_id=?2").bind(bookId,operationId).first<Row>();return r?{targetRevisionId:String(r.target_revision_id),status:String(r.status) as "queued"|"published",recordVersion:Number(r.publication_record_version)}:null;}
  async readyBuild(bookId:string,revisionId:string){const r=await this.db.prepare("SELECT id FROM book_builds WHERE book_id=?1 AND source_revision_id=?2 AND status='ready'").bind(bookId,revisionId).first<{id:string}>();return r?.id??null;}
  async enqueue(bookId:string,revisionId:string){const now=new Date().toISOString(),buildId=`build:${revisionId}`,manifest=JSON.stringify({buildId,bookId,sourceRevisionId:revisionId,status:"processing",artifacts:[],createdAt:now});await this.db.prepare("INSERT OR IGNORE INTO book_builds (id,book_id,source_revision_id,status,manifest_json,created_at) VALUES (?1,?2,?3,'processing',?4,?5)").bind(buildId,bookId,revisionId,manifest,now).run();for(const kind of ["reader","pdf","search","toc","cover"])await this.db.prepare("INSERT OR IGNORE INTO build_jobs (id,build_id,book_id,source_revision_id,kind,state,next_attempt_at_ms) VALUES (?1,?2,?3,?4,?5,'pending',0)").bind(`${buildId}:${kind}`,buildId,bookId,revisionId,kind).run();}
  async commitRollback(i:{bookId:string;operationId:string;targetRevisionId:string;buildId:string|null;expectedRecordVersion:number;deviceId:string}){const status=i.buildId?"published":"queued";const result=i.buildId
    ?await this.db.prepare("UPDATE book_publications SET active_source_revision_id=?2,active_build_id=?3,desired_source_revision_id=NULL,record_version=record_version+1 WHERE book_id=?1 AND record_version=?4").bind(i.bookId,i.targetRevisionId,i.buildId,i.expectedRecordVersion).run()
    :await this.db.prepare("UPDATE book_publications SET desired_source_revision_id=?2,record_version=record_version+1 WHERE book_id=?1 AND record_version=?3").bind(i.bookId,i.targetRevisionId,i.expectedRecordVersion).run();
    if((result.meta?.changes??0)!==1)return{committed:false,recordVersion:i.expectedRecordVersion};const recordVersion=i.expectedRecordVersion+1;
    await this.db.prepare("INSERT OR IGNORE INTO source_revision_rollbacks (book_id,operation_id,target_revision_id,requested_by_user_id,requested_by_device_id,status,publication_record_version) SELECT ?1,?2,?3,owner_id,?4,?5,?6 FROM books WHERE id=?1").bind(i.bookId,i.operationId,i.targetRevisionId,i.deviceId,status,recordVersion).run();await this.db.prepare("INSERT INTO audit_events (principal_sub,event_type,book_id,device_id,operation_id,outcome) SELECT owner_id,'source_rollback',?1,?2,?3,?4 FROM books WHERE id=?1").bind(i.bookId,i.deviceId,i.operationId,status).run();return{committed:true,recordVersion};
  }
}
function nullable(v:unknown){return v==null?null:String(v)}
function revision(r:Row):BookSourceRevision{return{revisionId:String(r.id),bookId:String(r.book_id),operationId:String(r.operation_id),baseRevisionId:nullable(r.base_revision_id),fingerprint:{algorithm:"sha256",hex:String(r.sha256),byteLength:Number(r.byte_length)},sourceName:String(r.source_name),createdAt:String(r.created_at),createdByDeviceId:String(r.created_by_device_id),status:String(r.status) as BookSourceRevision["status"]}}
