// Resource definitions are server-owned; clients cannot choose tables or snapshot fields.
export const RESOURCES={
  "book-review": {
    "type": "book-review",
    "table": "user_books",
    "key": "id",
    "rev": "review_version",
    "actor": "reviewed_by",
    "fields": [
      "title",
      "author",
      "category",
      "visibility",
      "review_status",
      "review_note",
      "deleted_at"
    ]
  },
  "central-book": {
    "type": "central-book",
    "table": "central_book_overrides",
    "key": "book_id",
    "rev": "revision",
    "actor": "updated_by",
    "fields": [
      "title",
      "author",
      "category",
      "visibility",
      "logically_deleted_at"
    ]
  },
  "central-author": {
    "type": "central-author",
    "table": "central_authors",
    "key": "author_id",
    "rev": "revision",
    "actor": "updated_by",
    "fields": [
      "display_name",
      "biography",
      "source",
      "death_year_hijri",
      "contemporary",
      "hidden_at"
    ]
  },
  "author-override": {
    "type": "author-override",
    "table": "author_overrides",
    "key": "author_id",
    "rev": "revision",
    "actor": "updated_by",
    "fields": [
      "display_name",
      "biography",
      "source",
      "disabled"
    ]
  }
}
export const snapshotSql=d=>'json_object('+d.fields.map(f=>"'"+f+"',"+f).join(',')+')'
RESOURCES['account-block']={table:'account_blocks',key:'subject',rev:'version',actor:'updated_by',fields:['blocked','reason']}
RESOURCES['account-role']={special:true}
RESOURCES['subject-category']={table:'subject_categories',key:'category_id',rev:'revision',actor:'updated_by',fields:['name']}
export const effectiveRoleSql="CASE WHEN role='user' AND EXISTS(SELECT 1 FROM account_capabilities c WHERE c.subject=accounts.subject AND editorial=1) THEN 'editor' ELSE role END"
export const ownerSql="EXISTS(SELECT 1 FROM accounts a WHERE a.subject=? AND a.role='super-admin') AND NOT EXISTS(SELECT 1 FROM account_blocks WHERE subject=? AND blocked=1) AND NOT EXISTS(SELECT 1 FROM account_credentials WHERE subject=?)"
export function pagination(url,allowed=['page','limit','actor']){
 if([...url.searchParams.keys()].some(k=>!allowed.includes(k)||url.searchParams.getAll(k).length!==1))throw Error('query')
 const page=Number(url.searchParams.get('page')??0),limit=Number(url.searchParams.get('limit')??50),actor=url.searchParams.get('actor')??''
 if(!Number.isSafeInteger(page)||page<0||page>10000||!Number.isSafeInteger(limit)||limit<1||limit>100||actor.length>240||actor!==actor.trim()||/[\u0000-\u001f\u007f]/.test(actor))throw Error('query')
 return {page,limit,actor}
}
export async function undoState(db,e){
 if(e.entity_type==='subject-category'&&e.action==='create')return {reason:'unsupported_resource'}
 let d=RESOURCES[e.entity_type];if(!d)return {reason:'unsupported_resource'}
 // Pre-0023 snapshots remain reversible; only newer events include structured fields.
 if(['author-override','central-author'].includes(e.entity_type)&&Object.prototype.hasOwnProperty.call(JSON.parse(e.after_json),'fields_json'))d={...d,fields:[...d.fields,'fields_json']}
 const current=await db.prepare(d.special?"SELECT role_version AS revision,json_object('role',"+effectiveRoleSql+") AS snapshot FROM accounts WHERE subject=?":'SELECT '+d.rev+' AS revision,'+snapshotSql(d)+' AS snapshot FROM '+d.table+' WHERE '+d.key+'=?').bind(e.entity_id).first()
 if(!current||current.revision!==e.revision||current.snapshot!==e.after_json)return {reason:'later_change'}
 if(await db.prepare('SELECT event_id FROM oversight_undos WHERE event_id=?').bind(e.id).first())return {reason:'already_undone'}
 // A creation spans review state and central metadata: do not hide after another edit.
 if(e.entity_type==='book-review'&&e.action==='create'&&await db.prepare('SELECT book_id FROM central_book_overrides WHERE book_id=?').bind(e.entity_id).first())return {reason:'later_change'}
 if(e.entity_type==='central-author'&&e.action==='create'&&await db.prepare('SELECT 1 AS linked WHERE '+activeAuthorBookSql).bind(e.entity_id).first())return {reason:'later_change'}
 return {d,current}
}
export const labels={'subject-category':'تصنيف موضوعي','book-review':'مراجعة كتاب','central-book':'بيانات كتاب','central-author':'مؤلف مركزي','author-override':'ترجمة مؤلف','account-role':'صلاحيات حساب','account-block':'حظر حساب'}
export const activeAuthorBookSql="EXISTS(SELECT 1 FROM user_book_metadata m JOIN user_books b ON b.id=m.book_id WHERE m.central_author_id=? AND b.visibility='public' AND b.review_status='approved' AND b.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM central_book_overrides o WHERE o.book_id=b.id AND (o.visibility<>'public' OR o.logically_deleted_at IS NOT NULL)))"
