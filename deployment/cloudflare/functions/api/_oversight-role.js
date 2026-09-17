import {effectiveRoleSql,ownerSql} from './_oversight.js'
export function roleUndo(db,e,actor,reason){
 const before=JSON.parse(e.before_json),after=JSON.parse(e.after_json),role=before.role,previous=after.role,operation=crypto.randomUUID(),next=e.revision+1
 if(!['user','editor','admin'].includes(role)||!['user','editor','admin'].includes(previous))throw Error('protected_role')
 const stored=role==='editor'?'user':role,oldStored=previous==='editor'?'user':previous
 const write=db.prepare("UPDATE accounts SET role=?,role_version=?,updated_at=CURRENT_TIMESTAMP WHERE subject=? AND role_version=? AND json_object('role',"+effectiveRoleSql+")=? AND subject<>? AND role IN ('user','admin') AND "+ownerSql+" AND NOT EXISTS(SELECT 1 FROM oversight_undos WHERE event_id=?)").bind(stored,next,e.entity_id,e.revision,e.after_json,actor,actor,actor,actor,e.id)
 const audit=db.prepare('INSERT INTO account_role_events(id,subject,actor_subject,previous_role,role,revision,reason) SELECT ?,?,?,?,?,?,? WHERE changes()=1').bind(operation,e.entity_id,actor,oldStored,stored,next,reason)
 const capability=db.prepare('INSERT INTO account_capability_events(id,subject,actor_subject,previous_role,role,revision,reason) SELECT id,subject,actor_subject,?,?,revision,reason FROM account_role_events WHERE id=?').bind(previous,role,operation)
 const clear=db.prepare('DELETE FROM account_capabilities WHERE subject=? AND EXISTS(SELECT 1 FROM account_capability_events WHERE id=?)').bind(e.entity_id,operation)
 const grant=db.prepare("INSERT INTO account_capabilities(subject,editorial) SELECT ?,1 WHERE ?='editor' AND EXISTS(SELECT 1 FROM account_capability_events WHERE id=?)").bind(e.entity_id,role,operation)
 return {statements:[write,audit,capability,clear,grant],recordGuard:"EXISTS(SELECT 1 FROM account_capability_events WHERE id='"+operation+"')"}
}
