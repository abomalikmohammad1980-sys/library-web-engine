import {expect,it} from 'vitest'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {parseVerifiedShamelaPack} from './shamela_pack_prepare'
it.runIf(process.env.KHIZANA_REAL_BOOK_CHECK==='1')('prepares the actual 7996-page Fath al-Bari source without changing its identities',async()=>{
 const root='app/public/library/shamela/batches/batch-0014'
 const manifest=JSON.parse(await readFile(root+'/manifest.json','utf8')),entry=manifest.books.find((b:any)=>b.bookId==='1673')
 const bytes=await readFile(process.env.KHIZANA_REAL_BOOK_PATH??root+'/'+entry.file)
 expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256)
 const start=performance.now(),book=parseVerifiedShamelaPack(bytes,entry)
 expect(book.bokPages).toHaveLength(7996);expect(book.bokToc).toHaveLength(5110)
 expect(book.originalSha256).toBe(entry.sha256);expect(book.data).toBe(bytes)
 expect(new Set(book.bokPages!.map(p=>p.id)).size).toBe(7996)
 expect(book.bokPages![0]!.text.length).toBeGreaterThan(0)
 console.log(JSON.stringify({bookId:1673,bytes:bytes.length,pages:book.bokPages!.length,titles:book.bokToc!.length,prepareMs:Math.round(performance.now()-start),scope:'local CPU only; not physical phone or network'}))
},120000)
