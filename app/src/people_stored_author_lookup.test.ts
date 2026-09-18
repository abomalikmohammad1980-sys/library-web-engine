import {readFileSync} from 'node:fs'
import {transformSync} from 'esbuild'
import {expect,it,vi} from 'vitest'
import {currentAuthorName} from './author_display_names'
function harness(){
 const text=readFileSync(new URL('./engine/library_store.ts',import.meta.url),'utf8')
 const from=text.indexOf('export async function listAuthorRecords('),to=text.indexOf('/** الكتب حسب المؤلف */',from)
 const canonicalStart=text.indexOf('export function canonicalAuthorName('),canonicalEnd=text.indexOf('function authorIdFromName(',canonicalStart)
 const js=transformSync((text.slice(canonicalStart,canonicalEnd)+text.slice(from,to)).replaceAll('export ',''),{loader:'ts',format:'cjs'}).code
 const row={id:'shamela-384',name:'هشام بن عمار',canonicalName:'هشام بن عمار',aliases:['خطيب دمشق'],biography:'local retained',deathYearHijri:245}
 const listBooks=vi.fn(async()=>[]),ensureAuthorRecord=vi.fn(),transaction=vi.fn((name:string,mode:string)=>({objectStore:()=>({getAll:()=>{const request:any={result:[row]};queueMicrotask(()=>request.onsuccess());return request}})}))
 const lookup=new Function('openDb','AUTHORS_STORE','listBooks','ensureAuthorRecord','currentAuthorName',js+';return getAuthorRecord')(async()=>({transaction}),'authors',listBooks,ensureAuthorRecord,currentAuthorName)
 return{lookup,listBooks,ensureAuthorRecord,transaction,row:{...row,aliases:[...row.aliases,row.name]}}
}
it.each(['shamela-384','هشام بِن عَمّار','  خَطيب   دِمشق  '])('stored-only lookup keeps id/name/alias semantics: %s',async(query)=>{
 const h=harness();expect(await h.lookup(query,false)).toEqual(h.row);expect(h.listBooks).not.toHaveBeenCalled();expect(h.ensureAuthorRecord).not.toHaveBeenCalled();expect(h.transaction).toHaveBeenCalledWith('authors','readonly')
})
it('stored-only absence does not create an author or synchronize the book catalog',async()=>{
 const h=harness();expect(await h.lookup('missing',false)).toBeUndefined();expect(h.listBooks).not.toHaveBeenCalled();expect(h.ensureAuthorRecord).not.toHaveBeenCalled()
})
it('default lookup preserves existing catalog-sync behavior outside peopleScreen',async()=>{
 const h=harness();expect(await h.lookup('shamela-384')).toEqual(h.row);expect(h.listBooks).toHaveBeenCalledOnce()
})
it('all person-screen local-record reads opt out, including canonical alias fallback',()=>{
 const source=readFileSync(new URL('./screens/library.ts',import.meta.url),'utf8'),body=source.slice(source.indexOf('export function peopleScreen('),source.indexOf('function renderPeoplePage('))
 expect(body).toContain('getAuthorRecord(localAuthorId, false)')
 expect(body).toContain("getAuthorRecord(peopleId.startsWith('local:') ? peopleId.slice(6) : entry.id, false)")
 expect(body).toContain('getAuthorRecord(entry.id, false)')
})
