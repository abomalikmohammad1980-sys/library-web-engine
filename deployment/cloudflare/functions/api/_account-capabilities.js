export async function withAccountCapabilities(context,account){
 if(!account||account.role!=='user')return account
 try{const row=await context.env.VISITORS_DB.prepare('SELECT editorial FROM account_capabilities WHERE subject=?1').bind(account.subject).first();return Number(row?.editorial)===1?{...account,role:'editor'}:account}
 catch(error){if([error?.message,error?.cause?.message].some(m=>typeof m==='string'&&/\bno such table:\s*account_capabilities\b/i.test(m)))return account;throw error}
}
