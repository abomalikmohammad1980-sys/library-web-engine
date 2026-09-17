import {createRequire} from 'node:module'
import {createHash} from 'node:crypto'
import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {extractFromDocx} from '../packages/ooxml-model/dist/index.js'
import {extractPublicBookBounded} from './public-book-index-executor.mjs'
import {ISOLATED,assertIsolatedConfig,stageBSeedSql} from './prepare-stageb-format-fixtures.mjs'
const require=createRequire(new URL('../packages/ooxml-model/package.json',import.meta.url))
const {zipSync,strToU8}=require('fflate'),sha=b=>createHash('sha256').update(b).digest('hex')
const quote=s=>"'"+s.replaceAll("'","''")+"'"
export async function buildStageBWordFixture(){
 const bytes=Buffer.from(zipSync({'[Content_Types].xml':strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),'word/document.xml':strToU8('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:outlineLvl w:val="0"/></w:pPr><w:r><w:t>stagebwordheading</w:t></w:r></w:p><w:p><w:r><w:t>stagebwordbody Synthetic acceptance text.</w:t></w:r></w:p></w:body></w:document>')}))
 // Deliberately tiny single-page synthetic document; no user book or pagination claim for arbitrary files.
 const paragraphs=extractFromDocx(bytes).paragraphs.map(p=>({paragraphIndex:p.index,text:p.text,physicalPage:1}))
 const map={totalPages:1,paragraphCount:paragraphs.length,paragraphs},mapBytes=Buffer.from(JSON.stringify(map))
 const f={kind:'word',id:'codex-stageb-word',title:'قبول صيغة Word',author:'قبول تقني معزول',category:'اختبارات الفهرسة المعزولة',mime:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',file:'word.docx',key:'ingestion-acceptance/stageb-word/word.docx',bytes,bodyQuery:'stagebwordbody',headingQuery:'stagebwordheading',expectedStatus:'ready'}
 const extracted=await extractPublicBookBounded({mime:f.mime,bytes,map})
 if(extracted.rows.length!==2||extracted.headings[0]?.value!==f.headingQuery)throw Error('fixture_parser_mismatch')
 const manifest={contract:'khizana-word-bundle/1',sourceSha256:sha(bytes),mapSha256:sha(mapBytes),totalPages:1}
 const mapKey='ingestion-acceptance/stageb-word/word-map.json'
 const sql=stageBSeedSql([f])+`INSERT INTO user_book_word_bundles(book_id,manifest_json,object_key,byte_length,sha256) VALUES('codex-stageb-word',${quote(JSON.stringify(manifest))},${quote(mapKey)},${mapBytes.length},'${sha(mapBytes)}') ON CONFLICT(book_id) DO NOTHING;\n`
 const objects=[{file:f.file,key:f.key,bytes},{file:'word-map.json',key:mapKey,bytes:mapBytes}]
 return {objects,sql,plan:{isolated:ISOLATED,id:f.id,mime:f.mime,bodyQuery:f.bodyQuery,headingQuery:f.headingQuery,expectedStatus:'ready',manifest,objects:objects.map(({bytes,...o})=>({...o,byteLength:bytes.length,sha256:sha(bytes)})),bok:{id:'codex-stageb-bok',status:'not_prepared',prerequisite:'A synthetic Jet BOK fixture or an explicitly licensed test BOK. Existing real book fixtures were not copied or included.'},notes:['Upload both immutable objects, then apply both seed statements atomically via D1 batch before waking jobs.','No cloud writes or commands performed. Validate isolated bindings before upload.','Existing IDs are no-op; this plan must not reset user data or completed jobs.','This single-page map is source/parser-bound synthetic data, not proof of arbitrary Word pagination.']}}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const args=process.argv.slice(2);if(args.length!==2||args[0]!=='--config')throw Error('usage_config_required')
 assertIsolatedConfig(await readFile(args[1],'utf8'))
 const out=resolve('.artifacts/stageb-word-fixture'),fixture=await buildStageBWordFixture();await mkdir(out,{recursive:true})
 for(const o of fixture.objects)await writeFile(resolve(out,o.file),o.bytes,{flag:'wx'})
 await writeFile(resolve(out,'seed.sql'),fixture.sql,{flag:'wx'});await writeFile(resolve(out,'plan.json'),JSON.stringify(fixture.plan,null,2),{flag:'wx'})
 console.log(JSON.stringify({directory:out,objects:fixture.objects.length,cloudWrites:0}))
}
