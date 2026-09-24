import { describe,expect,it } from 'vitest';import type { StoredBook } from './engine/library_store';import { canonicalBookFingerprint,canonicalVisibleBooks } from './book_canonical_dedup';import { migrateBookLocalRelations } from './shamela_public_identity'
const book=(overrides:Partial<StoredBook>):StoredBook=>({id:'x',title:'توفيق الرب المنعم بشرح صحيح الإمام مسلم',author:'محمد بن علي بن آدم الإثيوبي',fileName:'x.json',fileSize:0,addedAt:1,data:new Uint8Array(),mimeType:'x',originalSha256:'x',pdfStatus:'pending',...overrides})
class MemoryStorage implements Storage {private v=new Map<string,string>();get length(){return this.v.size}clear(){this.v.clear()}getItem(k:string){return this.v.get(k)??null}key(i:number){return [...this.v.keys()][i]??null}removeItem(k:string){this.v.delete(k)}setItem(k:string,v:string){this.v.set(k,v)}}
describe('canonical book deduplication',()=>{
  it('preserves a Word original and multiple explicitly linked PDFs without requiring edition metadata on the original',()=>{
    const original=book({id:'word',sourceFormat:'word',data:new Uint8Array([1])})
    const first=book({id:'pdf-a',relatedWorkId:'word',sourceFormat:'pdf',edition:'الأولى',publisher:'ناشر'})
    const second=book({id:'pdf-b',relatedWorkId:'word',sourceFormat:'pdf',edition:'الأولى',publisher:'ناشر'})
    const result=canonicalVisibleBooks([original,first,second])
    expect(result.books).toEqual([original,first,second]);expect(result.aliases.size).toBe(0)
  })
  it('does not redirect a linked original to an unrelated stronger catalogue record',()=>{
    const original=book({id:'word'}),edition=book({id:'pdf',relatedWorkId:'word',title:'عنوان الطبعة',sourceFormat:'pdf'})
    const publicCopy=book({id:'public',managedSource:'published'})
    const result=canonicalVisibleBooks([original,publicCopy,edition])
    expect(new Set(result.books.map(b=>b.id))).toEqual(new Set(['word','public','pdf']));expect(result.aliases.has('word')).toBe(false)
  })
  it('keeps separately imported images even when their titles and authors match',()=>{
    const a=book({id:'image-a',sourceFormat:'jpeg'}),b=book({id:'image-b',sourceFormat:'jpeg'})
    expect(canonicalVisibleBooks([a,b]).books).toEqual([a,b])
    expect(canonicalBookFingerprint(a)).not.toBe(canonicalBookFingerprint(b))
  })
  it('shows one real Tawfiq record and selects the verified published v4 payload over a 99999 legacy record',()=>{const legacy=book({id:'legacy',publicationYearHijri:99999,data:new Uint8Array([1]),bokTextVersion:3}),published=book({id:'410000011',managedSource:'published',sourceKind:'shamela4.1',sourceBookId:'11',bokTextVersion:4,bokPages:[{id:1,text:'متن',part:1,page:1}],data:new Uint8Array([1,2,3]),publicationYearHijri:undefined});expect(canonicalBookFingerprint(legacy)).toBe(canonicalBookFingerprint(published));const result=canonicalVisibleBooks([legacy,published]);expect(result.books.map(x=>x.id)).toEqual(['410000011']);expect(result.aliases.get('legacy')).toBe('410000011')})
  it('keeps two genuinely documented editions',()=>{const first=book({id:'a',publisher:'دار أ',edition:'الأولى',publicationYearHijri:1430}),second=book({id:'b',publisher:'دار ب',edition:'الثانية',publicationYearHijri:1440});expect(canonicalVisibleBooks([first,second])).toEqual({books:[first,second],aliases:new Map()})})
  it('moves annotations, activity, shelves, positions, plans and quotes idempotently and fails closed on conflicting progress',()=>{const s=new MemoryStorage();for(const [key,value] of [['alkhizana:annotations:v1',{bookmarks:{old:[2]},notes:[{bookId:'old'}],highlights:[{bookId:'old'}]}],['alkhizana:reading-activity:v1',{lastBookId:'old',openedBookIds:['old'],openCounts:{old:2}}],['alkhizana:shelves:v1',[{bookIds:['old']}]],['alkhizana:reading-plans:v1',[{bookId:'old'}]],['alkhizana:quotes:v1',[{bookId:'old'}]]] as const)s.setItem(key,JSON.stringify(value));s.setItem('alkhizana:reading-position:old','7');migrateBookLocalRelations(s,'old','new','marker');migrateBookLocalRelations(s,'old','new','marker');expect([...Array(s.length)].map((_,i)=>`${s.key(i)} ${s.getItem(s.key(i)!)}`).join(' ')).not.toContain('old');expect(s.getItem('alkhizana:reading-position:new')).toBe('7');const collision=new MemoryStorage();collision.setItem('alkhizana:reading-position:old','1');collision.setItem('alkhizana:reading-position:new','2');expect(()=>migrateBookLocalRelations(collision,'old','new','m')).toThrow('book_relation_collision')})
  it('keeps the canonical card singular even when a local relation collision must be reviewed later',()=>{const legacy=book({id:'legacy-bok',data:new Uint8Array([1]),bokTextVersion:3}),published=book({id:'410000011',managedSource:'published',sourceKind:'shamela4.1',sourceBookId:'11',bokTextVersion:4,bokPages:[{id:1,text:'متن',part:1,page:1}],data:new Uint8Array([1,2])});const canonical=canonicalVisibleBooks([legacy,published]);const collision=new MemoryStorage();collision.setItem('alkhizana:reading-position:legacy-bok','1');collision.setItem('alkhizana:reading-position:410000011','2');expect(()=>migrateBookLocalRelations(collision,'legacy-bok','410000011','marker')).toThrow('book_relation_collision');expect(canonical.books.map(x=>x.id)).toEqual(['410000011']);expect(canonical.aliases.get('legacy-bok')).toBe('410000011')})
})
