import {readFile} from 'node:fs/promises'
import {resolve} from 'node:path'
export function summarizeCatalog(catalog){
 const books=new Map();for(const batch of catalog.batches??[])for(const book of batch.books??[])books.set(String(book.bookId),book)
 const sum=key=>[...books.values()].every(b=>Number.isSafeInteger(b.counts?.[key])&&b.counts[key]>=0)?[...books.values()].reduce((n,b)=>n+b.counts[key],0):null
 return {books:books.size,pages:sum('pages'),headings:sum('titles')}
}
export async function homeLibraryStatistics(root){
 const read=async name=>JSON.parse(await readFile(resolve(root,'public/data',name+'.json'),'utf8'))
 const [catalog,authors,map,bios,translation]=await Promise.all([read('shamela-catalog.snapshot'),read('author-persons.release'),read('tarajm-author-map'),read('tarajm-biographies'),readFile(resolve(root,'src/translation.ts'),'utf8')])
 const normalize=v=>v.normalize('NFKD').replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/gu,'').replace(/[أإآٱ]/gu,'ا').replace(/ى/gu,'ي').replace(/ة/gu,'ه').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/gu,' ').trim().toLocaleLowerCase('ar')
 const places=new Set(map.mappings.flatMap(m=>bios.biographies[m.tarajmExternalId]?.places?.value??[]).map(normalize).filter(Boolean))
 const languageBlock=translation.split('export const TRANSLATION_LANGUAGES:')[1]?.split('= [')[1]?.split(']')[0]??''
 const languages=new Set([...languageBlock.matchAll(/code:\s*'([^']+)'/gu)].map(m=>m[1])).size
 if(!languages)throw Error('Missing translation language catalog')
 return {contract:'home-library-statistics/1',generatedAt:new Date().toISOString(),...summarizeCatalog(catalog),authors:authors.authorCount,places:places.size,languages}
}
