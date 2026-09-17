import {it,expect} from 'vitest'
import {zipSync,strToU8} from 'fflate'
import {readWordCompanionPackage} from './word_companion_package'
import {fingerprintBytes} from './word_import_authority'
async function fixture(){const files={'source.docx':strToU8('source'),'reference.pdf':strToU8('%PDF-1.7'),'pages.json':strToU8(JSON.stringify({totalPages:1}))};const sha256=Object.fromEntries(await Promise.all(Object.entries(files).map(async([k,v])=>[k,await fingerprintBytes(v)])));return {...files,'manifest.json':strToU8(JSON.stringify({contract:'khizana-word-package/1',platform:'windows',fileName:'كتاب.docx',sha256}))}}
it('binds the selected source, PDF and page map without rewriting bytes',async()=>{const files=await fixture(),result=await readWordCompanionPackage(zipSync(files));expect(result.source).toEqual(files['source.docx']);expect(result.fileName).toBe('كتاب.docx')})
it('rejects substituted output',async()=>{const files=await fixture();files['reference.pdf']=strToU8('%PDF-other');await expect(readWordCompanionPackage(zipSync(files))).rejects.toThrow('غير متطابقة')})
it('rejects missing files and extra paths',async()=>{const files=await fixture();await expect(readWordCompanionPackage(zipSync({...files,'../x':strToU8('x')}))).rejects.toThrow('بنية');const {['pages.json']:_,...missing}=files;await expect(readWordCompanionPackage(zipSync(missing))).rejects.toThrow('ناقصة')})
