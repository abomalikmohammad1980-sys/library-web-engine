/** A live database check also applies to existing sessions and Access assertions. */
export async function isAccountBlocked(context,subject){
  const row=await context.env.VISITORS_DB.prepare('SELECT blocked FROM account_blocks WHERE subject=?1').bind(subject).first()
  return Number(row?.blocked)===1
}
