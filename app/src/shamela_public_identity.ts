const SHAMELA_41_OFFSET = 410_000_000
const MAX_SOURCE_BOOK_ID = Number.MAX_SAFE_INTEGER - SHAMELA_41_OFFSET
export const LEGACY_SHAMELA_ID = /^shamela-(\d+)$/u

export function shamelaPublicBookId(sourceBookId: string | number): string {
  const value=typeof sourceBookId==='number'?sourceBookId:Number(sourceBookId)
  if(!Number.isSafeInteger(value)||value<1||value>MAX_SOURCE_BOOK_ID)throw new Error('shamela_public_id_source_invalid')
  return String(SHAMELA_41_OFFSET+value)
}
export function shamelaSourceBookId(publicOrLegacyId:string):string|undefined {
  const legacy=LEGACY_SHAMELA_ID.exec(publicOrLegacyId);if(legacy)return legacy[1]
  if(!/^\d+$/u.test(publicOrLegacyId))return
  const value=Number(publicOrLegacyId)-SHAMELA_41_OFFSET
  return Number.isSafeInteger(value)&&value>0&&value<=MAX_SOURCE_BOOK_ID?String(value):undefined
}
export function canonicalShamelaBookId(id:string):string {const source=shamelaSourceBookId(id);return source?shamelaPublicBookId(source):id}

const JSON_KEYS=['alkhizana:annotations:v1','alkhizana:reading-activity:v1','alkhizana:shelves:v1','alkhizana:reading-plans:v1','alkhizana:quotes:v1'] as const
const PREFIXES=['alkhizana:reading-position:','alkhizana:reader-page-count:'] as const
function replaceDeep(value:unknown,oldId:string,newId:string):unknown {
  if(typeof value==='string')return value===oldId?newId:value
  if(Array.isArray(value))return value.map(item=>replaceDeep(item,oldId,newId))
  if(!value||typeof value!=='object')return value
  return Object.fromEntries(Object.entries(value).map(([key,item])=>[key===oldId?newId:key,replaceDeep(item,oldId,newId)]))
}
export function migrateBookLocalRelations(storage:Storage,oldId:string,newId:string,marker:string):void {
  if(storage.getItem(marker)==='done')return
  const writes=new Map<string,string>(),removes:string[]=[]
  for(const key of JSON_KEYS){const raw=storage.getItem(key);if(raw==null)continue;let parsed:unknown;try{parsed=JSON.parse(raw)}catch{throw new Error('book_relation_json_invalid')}writes.set(key,JSON.stringify(replaceDeep(parsed,oldId,newId)))}
  for(const prefix of PREFIXES){const oldKey=prefix+oldId,newKey=prefix+newId,oldValue=storage.getItem(oldKey),newValue=storage.getItem(newKey);if(oldValue==null)continue;if(newValue!=null&&newValue!==oldValue)throw new Error('book_relation_collision');writes.set(newKey,oldValue);removes.push(oldKey)}
  for(const [key,value] of writes)storage.setItem(key,value);for(const key of removes)storage.removeItem(key);storage.setItem(marker,'done')
}
export function migrateShamelaLocalRelations(storage:Storage,sourceBookId:string|number):void {
  const oldId=`shamela-${sourceBookId}`,newId=shamelaPublicBookId(sourceBookId),marker=`alkhizana:shamela-id-migration:${sourceBookId}`
  try{migrateBookLocalRelations(storage,oldId,newId,marker)}catch(error){if(error instanceof Error&&error.message==='book_relation_json_invalid')throw new Error('shamela_public_id_relation_json_invalid');if(error instanceof Error&&error.message==='book_relation_collision')throw new Error('shamela_public_id_relation_collision');throw error}
}
