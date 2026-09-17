import {cleanProfileName} from './_access-profile-name.js'
export async function readProfile(db,subject){return db.prepare('SELECT a.display_name AS displayName,p.username,COALESCE(p.revision,0) AS revision FROM accounts a LEFT JOIN account_profiles p ON p.subject=a.subject WHERE a.subject=?1').bind(subject).first()}
export async function updateProviderName(db,subject,email,name){
 const clean=cleanProfileName(name);if(!clean)return
 // Legacy names other than the old email fallback are conservatively user-owned.
 await db.prepare("UPDATE accounts SET display_name=?1,updated_at=CURRENT_TIMESTAMP WHERE subject=?2 AND (display_name IS NULL OR display_name='' OR display_name=?3) AND NOT EXISTS(SELECT 1 FROM account_profiles WHERE subject=?2 AND display_name_custom=1)").bind(clean,subject,email.split('@')[0]).run()
}
export async function saveProfile(db,subject,input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['displayName','username','expectedVersion'].includes(k)))return {error:'invalid_profile',status:400}
 const displayName=cleanProfileName(input.displayName),username=typeof input.username==='string'?input.username.trim().toLowerCase():null,version=input.expectedVersion
 if(!displayName||username===null||(username!==''&&!/^[a-z][a-z0-9_]{2,29}$/.test(username))||['admin','administrator','support','root','system','alkhizana','khezana'].includes(username)||!Number.isSafeInteger(version)||version<0||version>=2147483647)return {error:'invalid_profile',status:400}
 try{
  const result=await db.batch([
   db.prepare('INSERT INTO account_profiles(subject,username,display_name_custom,revision) SELECT ?1,?2,1,?3 WHERE ?4=0 OR EXISTS(SELECT 1 FROM account_profiles WHERE subject=?1 AND revision=?4) ON CONFLICT(subject) DO UPDATE SET username=excluded.username,display_name_custom=1,revision=?3,updated_at=CURRENT_TIMESTAMP WHERE account_profiles.revision=?4').bind(subject,username||null,version+1,version),
   db.prepare('UPDATE accounts SET display_name=?1,updated_at=CURRENT_TIMESTAMP WHERE subject=?2 AND changes()=1').bind(displayName,subject)
  ])
  if(Number(result[0]?.meta?.changes)!==1)return {error:'profile_conflict',status:409}
  return {profile:{displayName,username:username||null,revision:version+1},status:200}
 }catch(error){if(String(error).includes('UNIQUE constraint failed: account_profiles.username'))return {error:'username_unavailable',status:409};throw error}
}
