import {createHash} from 'node:crypto'
import {createRequire} from 'node:module'
const digest=bytes=>createHash('sha256').update(bytes).digest('hex')
const sha=/^[a-f0-9]{64}$/
export const READER_OPENING_CONTRACT='khizana-reader-opening/1'
/** Called in the existing bounded PDF child process, using its already-verified source bytes. */
export async function createPublicPdfReaderOpening(bytes,{sourceSha256=digest(bytes),PDFDocument}={}){
 if(!(bytes instanceof Uint8Array)||bytes.length<5||bytes.length>64*1024*1024||Buffer.from(bytes.subarray(0,5)).toString('ascii')!=='%PDF-'||!sha.test(sourceSha256)||digest(bytes)!==sourceSha256)throw Error('reader_opening_source_invalid')
 if(!PDFDocument){const require=createRequire(new URL('../app/package.json',import.meta.url));({PDFDocument}=require('pdf-lib'))}
 const source=await PDFDocument.load(bytes,{updateMetadata:false}),sourcePages=source.getPageCount()
 if(!Number.isSafeInteger(sourcePages)||sourcePages<1||sourcePages>100000)throw Error('reader_opening_page_bound')
 const target=await PDFDocument.create({updateMetadata:false}),[first]=await target.copyPages(source,[0]);target.addPage(first)
 const data=new Uint8Array(await target.save({useObjectStreams:false,addDefaultPage:false,updateFieldAppearances:false}))
 if(data.length<5||data.length>4*1024*1024)throw Error('reader_opening_size_bound')
 const check=await PDFDocument.load(data,{updateMetadata:false});if(check.getPageCount()!==1)throw Error('reader_opening_page_bound')
 const sha256=digest(data)
 return {contract:READER_OPENING_CONTRACT,sourceSha256,sha256,bytes:data.length,pages:sourcePages,format:'pdf',kind:'pdf',path:'/library/published/reader-opening/'+sha256+'.pdf',producer:'pdf-lib-copy-first-page/1',data}
}
export function admitPublicPdfReaderOpening(value,input,result){
 if(String(input?.mime).split(';',1)[0].trim().toLowerCase()!=='application/pdf'||!value||value.contract!==READER_OPENING_CONTRACT||!(value.data instanceof Uint8Array)||value.data.length<5||value.data.length>4*1024*1024||value.bytes!==value.data.length||!sha.test(value.sha256??'')||digest(value.data)!==value.sha256||value.sourceSha256!==digest(input.bytes)||!Number.isSafeInteger(value.pages)||value.pages<1||value.pages>100000||value.format!=='pdf'||value.kind!=='pdf'||value.path!=='/library/published/reader-opening/'+value.sha256+'.pdf'||Buffer.from(value.data.subarray(0,5)).toString('ascii')!=='%PDF-')throw Error('reader_opening_result_invalid')
 if(result?.pdfClassification?.pageCount!==undefined&&result.pdfClassification.pageCount!==value.pages)throw Error('reader_opening_page_identity')
 return value
}
/** Binary data stays outside extracted JSON and is uploaded through its scoped lease operation. */
export function readerOpeningGatewayPayload(value){
 const {data,...descriptor}=value
 return {descriptor,data:Buffer.from(data).toString('base64')}
}
