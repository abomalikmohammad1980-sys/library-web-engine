import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {gzipSync,gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
const sha=b=>createHash('sha256').update(b).digest('hex')
export function encodeHeadingDictionary(entries){
 if(!Array.isArray(entries))throw Error('dictionary_array');let values=0,wordBytes=0
 for(const entry of entries){if(!Array.isArray(entry)||typeof entry[0]!=='string'||!entry[0]||entry[0].includes('\0')||!Array.isArray(entry[1]))throw Error('dictionary_word');wordBytes+=Buffer.byteLength(entry[0])+1
  for(const s of entry[1]){if(!Array.isArray(s)||s.length!==4||s.some(n=>!Number.isSafeInteger(n)||n<0||n>0xffffffff))throw Error('dictionary_segment');values+=4}}
 const bytes=20+(entries.length+1)*4+values*4+wordBytes;if(bytes>32*1024*1024)throw Error('dictionary_binary_budget')
 const out=Buffer.alloc(bytes);out.write('KHZDICT1');out.writeUInt32LE(entries.length,8);out.writeUInt32LE(values,12);out.writeUInt32LE(wordBytes,16)
 let valueAt=0,textAt=20+(entries.length+1)*4+values*4;const valuesStart=20+(entries.length+1)*4
 for(let i=0;i<entries.length;i++){const [word,segments]=entries[i];out.writeUInt32LE(valueAt,20+i*4);for(const s of segments)for(const n of s){out.writeUInt32LE(n,valuesStart+valueAt*4);valueAt++}textAt+=out.write(word,textAt);out[textAt++]=0}
 out.writeUInt32LE(valueAt,20+entries.length*4);return out
}
export async function buildHeadingDictionaryBinary(sourceDirectory,outputDirectory){
 const source=resolve(sourceDirectory),output=resolve(outputDirectory),manifestBytes=await readFile(resolve(source,'manifest.json')),manifest=JSON.parse(manifestBytes),d=manifest.dictionary
 if(!/^dictionary\/[a-f0-9]{64}\.json\.gz$/.test(d.path))throw Error('dictionary_source_path')
 const compressed=await readFile(resolve(source,d.path));if(compressed.length!==d.gzipBytes||sha(compressed)!==d.gzipSha256)throw Error('dictionary_source_gzip_sha')
 const plain=gunzipSync(compressed,{maxOutputLength:32*1024*1024});if(plain.length!==d.bytes||sha(plain)!==d.sha256)throw Error('dictionary_source_sha')
 const entries=JSON.parse(plain);if(entries.length!==d.wordCount)throw Error('dictionary_source_words')
 const binary=encodeHeadingDictionary(entries),gzip=gzipSync(binary,{level:9}),path=`dictionary/${sha(gzip)}.compact.bin.gz`
 const descriptor={encoding:'khizana-heading-dictionary-binary/1',path,bytes:binary.length,sha256:sha(binary),gzipBytes:gzip.length,gzipSha256:sha(gzip),wordCount:entries.length,sourceDictionarySha256:d.sha256,sourceManifestSha256:sha(manifestBytes)}
 // Deliberately refuses an existing output directory: never overwrites an artifact.
 await mkdir(output);await mkdir(resolve(output,'dictionary'));await writeFile(resolve(output,path),gzip,{flag:'wx'});await writeFile(resolve(output,'descriptor.json'),JSON.stringify(descriptor,null,2),{flag:'wx'})
 return descriptor
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){if(process.argv.length!==4)throw Error('usage: source-directory new-output-directory');console.log(JSON.stringify(await buildHeadingDictionaryBinary(process.argv[2],process.argv[3]),null,2))}
