// History contains only books that have actually been public; private-only IDs
// have no tombstone and must not reveal existence through a 410 response.
export async function publicBookRemovalStatus(db,id){
 if(!db||typeof id!=='string'||!/^[-_A-Za-z0-9]{1,200}$/.test(id))return 404
 const session=typeof db.withSession==='function'?db.withSession('first-primary'):db
 const row=await session.prepare("SELECT visibility FROM public_book_event_state WHERE book_id=?1").bind(id).first()
 return row?.visibility==='removed'?410:404
}
