import { describe,expect,it,vi } from 'vitest'
import { catalogEntryMatchesStoredBook, catalogEntryWithVerifiedTitleFallback, catalogMetadataTokenMatches, catalogReadyToken, isPlaceholderShamelaTitle, materializeAvailableShamelaCatalogBooks, materializeShamelaCatalogBook, materializeShamelaPackBook, selectShamelaEntriesForDownload, verifiedShamelaTitle, type LocatedShamelaPackBook } from './shamela_pack_seed'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('Shamela SQLite pack importer',()=>{it('maps metadata, real pages, explicit hadith number and hierarchy into the reader contract',()=>{const raw={contract:'shamela-sqlite-pack/book-1' as const,workId:'shamela4_1:1001',metadata:{bookName:'كتاب',bookDate:1440,categoryId:'1',metaDataRaw:'بطاقة'},authors:[{authorId:'7',authorName:'مؤلف',role:'main',deathNumber:300}],category:{categoryName:'فقه'},pages:[{sourceRowId:'1',sequence:0,part:'2',page:5,number:42,body:'متن الصفحة',foot:'حاشية'}],titles:[{sourceRowId:'10',pageSourceRowId:'1',parentSourceRowId:null,title:'الباب'}]};const packed=new TextEncoder().encode(JSON.stringify(raw));const book=materializeShamelaPackBook(raw,packed,'abc');expect(book).toMatchObject({id:'410001001',sourceKind:'shamela4.1',sourceBookId:'1001'});expect(book.bokPages).toEqual([{id:1,text:'متن الصفحة\n_________\nحاشية',part:2,page:5,hadithNumber:42}]);expect(book.bokToc?.[0]).toMatchObject({id:1,title:'الباب',level:1});expect(book.extractedText).toContain('حاشية');expect(book.physicalPageCount).toBe(1)})})

it('recovers legacy hr/sN controls while keeping their raw tags out of reader text',()=>{const raw={contract:'shamela-sqlite-pack/book-1' as const,workId:'shamela4_1:1002',metadata:{bookName:'كتاب',bookDate:null,categoryId:null,metaDataRaw:null},authors:[],category:null,pages:[{sourceRowId:'1',sequence:0,part:'1',page:1,body:'صدر<hr><s3>تفصيل',foot:null}],titles:[]};const packed=new TextEncoder().encode(JSON.stringify(raw));const page=materializeShamelaPackBook(raw,packed,'abc').bokPages?.[0];expect(page?.text).toBe('صدر\nتفصيل');expect(page?.controls).toEqual([{kind:'separator',offset:3},{kind:'style',level:3,offset:4}])})

it('uses supplied structural offsets without changing cleaned body or foot text',()=>{const raw={contract:'shamela-sqlite-pack/book-1' as const,workId:'shamela4_1:1003',metadata:{bookName:'كتاب',bookDate:null,categoryId:null,metaDataRaw:null},authors:[],category:null,pages:[{sourceRowId:'1',sequence:0,part:'1',page:1,body:'صدر<hr>تفصيل',foot:'(١) شرح <s2>الحاشية',inlineControls:[{kind:'separator' as const,field:'body' as const,offset:3},{kind:'style' as const,field:'foot' as const,offset:8,level:2}]}],titles:[]};const page=materializeShamelaPackBook(raw,new TextEncoder().encode(JSON.stringify(raw)),'abc').bokPages?.[0];expect(page?.text).toBe('صدر\nتفصيل\n_________\n(١) شرح\nالحاشية');expect(page?.controls).toEqual([{kind:'separator',field:'body',offset:3},{kind:'style',field:'foot',offset:28,level:2}])})

it('keeps authoritative death metadata on the lightweight catalog card',()=>{const book=materializeShamelaCatalogBook({bookId:'1186',workId:'shamela4_1:1186',file:'books/1186.json',byteLength:1,sha256:'a',counts:{pages:1,titles:0},categoryId:null,contentSha256:'b',catalog:{title:'فتح الباري',author:'ابن حجر العسقلاني',authorId:'82',deathYearHijri:852,category:'الحديث',publicationYearHijri:null,rawSourceMetadata:null}});expect(book).toMatchObject({author:'ابن حجر العسقلاني',deathYearHijri:852})})

it('never invents a numeric title and uses the verified catalog title for a sparse payload',()=>{
  expect(()=>verifiedShamelaTitle(null,'  ')).toThrow('shamela_pack_book_title_missing')
  expect(verifiedShamelaTitle('كتاب الشاملة 96492','سيرة الشاب الصالح')).toBe('سيرة الشاب الصالح')
  expect(verifiedShamelaTitle('كتاب الشاملة رقم ٩٦٤٩٢','سيرة الشاب الصالح')).toBe('سيرة الشاب الصالح')
  expect(()=>verifiedShamelaTitle('كتاب الشاملة 96492','كتاب الشاملة رقم ٩٦٤٩٢')).toThrow('shamela_pack_book_title_missing')
  const raw={contract:'shamela-sqlite-pack/book-1' as const,workId:'shamela4_1:96492',metadata:{bookName:null,bookDate:null,categoryId:null,metaDataRaw:null},authors:[],category:null,pages:[{sourceRowId:'1',sequence:0,part:'1',page:1,body:'متن',foot:null}],titles:[]}
  expect(materializeShamelaPackBook(raw,new Uint8Array([1]),'abc','سيرة الشاب الصالح')).toMatchObject({title:'سيرة الشاب الصالح',author:'المؤلف مجهول'})
  expect(materializeShamelaPackBook({...raw,metadata:{...raw.metadata,bookName:'كتاب الشاملة 96492'}},new Uint8Array([1]),'abc','سيرة الشاب الصالح').title).toBe('سيرة الشاب الصالح')
  expect(()=>materializeShamelaPackBook(raw,new Uint8Array([1]),'abc')).toThrow('shamela_pack_book_title_missing')
  expect(()=>materializeShamelaCatalogBook({bookId:'96492',workId:'shamela4_1:96492',file:'books/96492.json',byteLength:1,sha256:'a',counts:{pages:1,titles:0},categoryId:null,contentSha256:'b',catalog:{title:'كتاب الشاملة رقم 96492',author:null,authorId:null,category:null,publicationYearHijri:null,rawSourceMetadata:null}})).toThrow('shamela_pack_book_title_missing')
})

it('recovers only an explicit title field from legacy raw source metadata',()=>{
  const base={bookId:'77',workId:'shamela4_1:77',file:'books/77.json',byteLength:1,sha256:'a',counts:{pages:1,titles:0},categoryId:null,contentSha256:'b',catalog:{title:null,author:null,authorId:null,category:null,publicationYearHijri:null,rawSourceMetadata:'{"metadata":{"bookName":"  عنوان\\n موثوق  "}}'}}
  const repaired=catalogEntryWithVerifiedTitleFallback(base)
  expect(repaired.catalog.title).toBe('عنوان موثوق')
  expect(materializeAvailableShamelaCatalogBooks([base])).toEqual([expect.objectContaining({id:'410000077',title:'عنوان موثوق'})])
  expect(()=>catalogEntryWithVerifiedTitleFallback({...base,catalog:{...base.catalog,rawSourceMetadata:'{"date":"1440"}'}})).toThrow('shamela_pack_book_title_missing')
  expect(()=>catalogEntryWithVerifiedTitleFallback({...base,catalog:{...base.catalog,rawSourceMetadata:'{"title":77}'}})).toThrow('shamela_pack_book_title_missing')
})

it('does not report a catalog entry unavailable when its legacy source metadata has a verified title',()=>{
  const warning=vi.spyOn(console,'warn').mockImplementation(()=>undefined)
  try {
    const entry={bookId:'78',workId:'shamela4_1:78',file:'books/78.json',byteLength:1,sha256:'a',counts:{pages:1,titles:0},categoryId:null,contentSha256:'b',catalog:{title:null,author:null,authorId:null,category:null,publicationYearHijri:null,rawSourceMetadata:'{"book_name":"عنوان المصدر القديم"}'}}
    expect(materializeAvailableShamelaCatalogBooks([entry])).toEqual([expect.objectContaining({title:'عنوان المصدر القديم'})])
    expect(warning).not.toHaveBeenCalled()
  } finally { warning.mockRestore() }
})

it('normalizes control characters in a source title without changing its identity',()=>{expect(verifiedShamelaTitle('  فقه\u0000 السيرة\n النبوية  ')).toBe('فقه السيرة النبوية')})

it('labels missing catalog authors without inventing a person or death year',()=>{
  const book=materializeShamelaCatalogBook({bookId:'96492',workId:'shamela4_1:96492',file:'books/96492.json',byteLength:1,sha256:'a',counts:{pages:1,titles:0},categoryId:null,contentSha256:'b',catalog:{title:'سيرة الشاب الصالح',author:null,authorId:null,deathYearHijri:99999,category:null,publicationYearHijri:null,rawSourceMetadata:null}})
  expect(book).toMatchObject({author:'المؤلف مجهول'})
  expect(book).not.toHaveProperty('deathYearHijri')
  expect(book).not.toHaveProperty('authorId')
})

it('invalidates the old catalog-ready marker so stale numeric titles are reconciled once',()=>{
  const catalog=[
    {entry:{bookId:'1',sha256:'first'}},
    {entry:{bookId:'96492',sha256:'last'}},
  ] as LocatedShamelaPackBook[]
  const current=catalogReadyToken(catalog)
  expect(current).toBe('catalog-metadata-v5:2:1:first:96492:last')
  expect(catalogMetadataTokenMatches('2:1:first:96492:last',catalog)).toBe(false)
  expect(catalogMetadataTokenMatches(current,catalog)).toBe(true)
})

it('treats the source dash as an unknown author without inventing an identity',()=>{
  const book=materializeShamelaCatalogBook({bookId:'429',workId:'shamela4_1:429',file:'books/429.json',byteLength:1,sha256:'a',counts:{pages:1,titles:0},categoryId:null,contentSha256:'b',catalog:{title:'تعريف بالأماكن الواردة في البداية والنهاية لابن كثير',author:'-',authorId:'601',deathYearHijri:99999,category:'التاريخ',publicationYearHijri:null,rawSourceMetadata:null}})
  expect(book.author).toBe('المؤلف مجهول')
  expect(book).not.toHaveProperty('authorId')
  expect(book).not.toHaveProperty('deathYearHijri')
})

it('accepts both a reconciled lightweight card and a hydrated book as current metadata',()=>{
  const entry={bookId:'1186',workId:'shamela4_1:1186',file:'books/1186.json',byteLength:1,sha256:'authoritative-sha',counts:{pages:1,titles:0},categoryId:null,contentSha256:'body',catalog:{title:'فتح الباري',author:'ابن حجر العسقلاني',authorId:'82',deathYearHijri:852,category:'الحديث',publicationYearHijri:null,rawSourceMetadata:null}}
  const card=materializeShamelaCatalogBook(entry)
  expect(catalogEntryMatchesStoredBook(card,entry)).toBe(true)
  expect(catalogEntryMatchesStoredBook({...card,originalSha256:entry.sha256},entry)).toBe(true)
  expect(catalogEntryMatchesStoredBook({...card,originalSha256:'stale'},entry)).toBe(false)
})

describe('published Shamela sample integration',()=>{const root=resolve(process.cwd(),'app/public/library/shamela-sample'),manifest=JSON.parse(readFileSync(resolve(root,'manifest.json'),'utf8'));it('keeps startup and PDF routes catalog-only and downloads one requested Shamela book',()=>{expect(selectShamelaEntriesForDownload(manifest)).toEqual([]);expect(selectShamelaEntriesForDownload(manifest,'published-pdf-1')).toEqual([]);expect(selectShamelaEntriesForDownload(manifest,'shamela-1').map(x=>x.file)).toEqual(['books/1.json']);const card=materializeShamelaCatalogBook(manifest.books[0]);expect(card.data.byteLength).toBe(0);expect(card.bokPages).toBeUndefined();expect(card.title.length).toBeGreaterThan(0)});it('materializes all ten verified package books for library and reader',()=>{expect(manifest.books).toHaveLength(10);for(const entry of manifest.books){const packed=readFileSync(resolve(root,entry.file)),raw=JSON.parse(packed.toString('utf8')),book=materializeShamelaPackBook(raw,new Uint8Array(packed),entry.sha256);expect(book.bokPages).toHaveLength(entry.counts.pages);expect(book.bokToc).toHaveLength(raw.titles.filter((x:{title:string|null})=>x.title!=null).length);expect(book.extractedText?.length).toBeGreaterThan(0);expect(book.readerPageCount).toBe(entry.counts.pages)}})})

it('materializes the reported final-batch cards from authoritative metadata only',()=>{
  const manifest=JSON.parse(readFileSync(resolve(process.cwd(),'app/public/library/shamela/batches/batch-0085/manifest.json'),'utf8'))
  const expected=new Map([
    ['151110','شرح حديث «ما ذئبان جائعان»'],['151111','شرح حديث «لبيك اللهم لبيك»'],
    ['151112','شرح حديث عمار بن ياسر - رضي الله عنه -'],['151113','شرح حديث «مثل الإسلام»'],
  ])
  for(const entry of manifest.books.filter((book:{bookId:string})=>expected.has(book.bookId))){
    const card=materializeShamelaCatalogBook(entry)
    expect(card).toMatchObject({title:expected.get(entry.bookId),author:'ابن رجب الحنبلي',category:'شروح الحديث'})
    expect(isPlaceholderShamelaTitle(card.title)).toBe(false)
  }
  expect(expected.size).toBe(4)
})
