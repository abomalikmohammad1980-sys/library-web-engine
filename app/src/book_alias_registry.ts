import {migrateBookLocalRelations} from './shamela_public_identity'

export const BOOK_ALIAS_REGISTRY_KEY='alkhizana:book-id-aliases:v1'
interface AliasRegistry {schemaVersion:1;aliases:Record<string,string>}
type AliasStorage=Pick<Storage,'getItem'|'setItem'>
const validId=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=240&&!/[\u0000-\u001f]/u.test(value)&&value===value.trim()

export function readBookAliasRegistry(storage:Pick<Storage,'getItem'>):AliasRegistry{
  const raw=storage.getItem(BOOK_ALIAS_REGISTRY_KEY)
  if(raw===null)return{schemaVersion:1,aliases:{}}
  let parsed:unknown
  try{parsed=JSON.parse(raw)}catch{throw new Error('book_alias_registry_json_invalid')}
  if(!parsed||typeof parsed!=='object'||(parsed as {schemaVersion?:unknown}).schemaVersion!==1)return fail('book_alias_registry_schema_invalid')
  const aliases=(parsed as {aliases?:unknown}).aliases
  if(!aliases||typeof aliases!=='object'||Array.isArray(aliases))return fail('book_alias_registry_schema_invalid')
  for(const [oldId,newId] of Object.entries(aliases))if(!validId(oldId)||!validId(newId)||oldId===newId)return fail('book_alias_registry_entry_invalid')
  return{schemaVersion:1,aliases:{...(aliases as Record<string,string>)}}
}

function fail(code:string):never{throw new Error(code)}

export function resolveBookAlias(storage:Pick<Storage,'getItem'>,id:string,maximumHops=8):string{
  if(!validId(id)||!Number.isSafeInteger(maximumHops)||maximumHops<1||maximumHops>32)throw new Error('book_alias_resolve_input_invalid')
  const {aliases}=readBookAliasRegistry(storage),seen=new Set<string>([id]);let current=id
  for(let hop=0;hop<maximumHops;hop++){
    const next=Object.hasOwn(aliases,current)?aliases[current]:undefined
    if(next===undefined)return current
    if(seen.has(next))throw new Error('book_alias_cycle')
    seen.add(next);current=next
  }
  if(Object.hasOwn(aliases,current))throw new Error('book_alias_hop_limit')
  return current
}

function nextRegistry(storage:Pick<Storage,'getItem'>,oldId:string,newId:string):AliasRegistry{
  if(!validId(oldId)||!validId(newId)||oldId===newId)throw new Error('book_alias_entry_invalid')
  const registry=readBookAliasRegistry(storage),existing=Object.hasOwn(registry.aliases,oldId)?registry.aliases[oldId]:undefined
  if(existing!==undefined&&existing!==newId)throw new Error('book_alias_conflict')
  const target=resolveBookAlias({getItem:()=>JSON.stringify(registry)},newId)
  if(target===oldId)throw new Error('book_alias_cycle')
  return{schemaVersion:1,aliases:{...registry.aliases,[oldId]:newId}}
}

export function registerBookAlias(storage:AliasStorage,oldId:string,newId:string):void{
  const registry=nextRegistry(storage,oldId,newId)
  storage.setItem(BOOK_ALIAS_REGISTRY_KEY,JSON.stringify(registry))
}

/** Preflights the alias, migrates relations without overwrite, then commits the route alias. */
export function migrateAndRegisterBookAlias(storage:Storage,oldId:string,newId:string,marker:string):void{
  const registry=nextRegistry(storage,oldId,newId)
  migrateBookLocalRelations(storage,oldId,newId,marker)
  storage.setItem(BOOK_ALIAS_REGISTRY_KEY,JSON.stringify(registry))
}

export function canonicalReaderHash(bookId:string,query=''):string{
  if(!validId(bookId))throw new Error('book_alias_entry_invalid')
  return `#/reader/${encodeURIComponent(bookId)}${query?`?${query.replace(/^\?/u,'')}`:''}`
}
