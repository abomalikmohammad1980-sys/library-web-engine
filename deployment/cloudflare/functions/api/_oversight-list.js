import {RESOURCES,snapshotSql,effectiveRoleSql,activeAuthorBookSql} from './_oversight.js'

// Bulk read-only eligibility checks. Undo POST still rechecks the exact snapshot
// and performs its atomic guarded mutation; a list response is never authority.
export async function listUndoStates(db,events){
 const states=new Map(),checks=[]
 for(const e of events){
  if(e.rollback||e.undone){states.set(e.id,{reason:e.rollback?'undo_operation':'already_undone'});continue}
  let d=RESOURCES[e.entity_type]
  if(!d||(e.entity_type==='subject-category'&&e.action==='create')){states.set(e.id,{reason:'unsupported_resource'});continue}
  if(['author-override','central-author'].includes(e.entity_type)&&Object.hasOwn(JSON.parse(e.after_json),'fields_json'))d={...d,fields:[...d.fields,'fields_json']}
  const table=d.special?'accounts':d.table,key=d.special?'subject':d.key,rev=d.special?'role_version':d.rev,snapshot=d.special?"json_object('role',"+effectiveRoleSql+")":snapshotSql(d)
  let sql='SELECT ? AS id, EXISTS(SELECT 1 FROM '+table+' WHERE '+key+'=? AND '+rev+'=? AND '+snapshot+'=?)',args=[e.id,e.entity_id,e.revision,e.after_json]
  if(e.entity_type==='book-review'&&e.action==='create'){sql+=' AND NOT EXISTS(SELECT 1 FROM central_book_overrides WHERE book_id=?)';args.push(e.entity_id)}
  if(e.entity_type==='central-author'&&e.action==='create'){sql+=' AND NOT '+activeAuthorBookSql;args.push(e.entity_id)}
  checks.push({sql:sql+' AS eligible',args})
 }
 for(let i=0;i<checks.length;i+=10){const chunk=checks.slice(i,i+10),result=await db.prepare(chunk.map(c=>c.sql).join(' UNION ALL ')).bind(...chunk.flatMap(c=>c.args)).all();for(const row of result.results??[])states.set(row.id,row.eligible?{}:{reason:'later_change'})}
 return states
}

export function eventSummary(e){
 const names={'subject-category':'تصنيف موضوعي','book-review':'كتاب','central-book':'بيانات كتاب','central-author':'ترجمة مؤلف','author-override':'ترجمة مؤلف','account-role':'صلاحيات حساب','account-block':'حظر حساب'}
 const after=JSON.parse(e.after_json),before=e.before_json?JSON.parse(e.before_json):null
 const action=e.rollback?'تراجع عن':e.action==='create'?'إضافة':e.entity_type==='book-review'&&after.visibility==='public'&&before?.visibility!=='public'?'نشر':after.deleted_at||after.logically_deleted_at?'حذف':'تعديل'
 const title=after.title||after.display_name||after.name||before?.title||before?.display_name||before?.name
 return action+' '+(names[e.entity_type]??'عملية إدارية')+(typeof title==='string'?' — '+title.slice(0,300):'')
}
