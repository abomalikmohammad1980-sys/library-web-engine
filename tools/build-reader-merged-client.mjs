// Freeze current reader fixes together with the batch89 import/performance work.
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises'
import {resolve,relative,dirname} from 'node:path'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
import {build,loadConfigFromFile} from 'vite'
const root=resolve(import.meta.dirname,'..'),out=resolve(root,'.artifacts/reader-merged-client-20260925-v8')
await mkdir(out) // Never overwrite a frozen candidate.
const snapshot=new Map(),rows=[]
async function collect(dir){for(const e of await readdir(resolve(root,dir),{withFileTypes:true})){
 const path=dir+'/'+e.name
 if(e.isDirectory()){if(!['node_modules','dist','.git'].includes(e.name))await collect(path)}
 else if(/\.(ts|json|css)$/.test(path)){
  const bytes=await readFile(resolve(root,path));snapshot.set(path,bytes.toString())
  rows.push({path,sha256:createHash('sha256').update(bytes).digest('hex')})
  const target=resolve(out,'source',path);await mkdir(dirname(target),{recursive:true});await writeFile(target,bytes)
 }
}}
await collect('app/src');await collect('packages')
const overlay=JSON.parse(await readFile(resolve(root,'.artifacts/import-dialog-20260924/frontend-overlay.json'),'utf8'))
for(const row of overlay.filter(x=>!['app/src/book_import.ts','app/vite.config.ts','app/src/quick_book_import.ts','app/src/word_upload_setup.ts','app/src/styles/components.css','app/src/header_book_add.ts'].includes(x.path))){
 assert.equal(rows.find(x=>x.path===row.path)?.sha256,row.sha256,'batch89 regression: '+row.path)
}
// Batch91's reviewed import UI is retained. The two merged files additionally
// contain the tested HTML/JPEG intake and JPEG identity changes; neither drops
// the independent-PDF workflow introduced by batch91.
for(const name of ['word_import_progress.ts','import_pdf_edition.ts','styles/components.css']){
 const reviewed=await readFile(resolve(root,'.artifacts/import-review-20260924/source/app/src',name),'utf8')
 assert.equal(snapshot.get('app/src/'+name)?.replaceAll('\r\n','\n'),reviewed.replaceAll('\r\n','\n'),'batch91 regression: '+name)
}
for(const token of ['importPdfEdition','syncIndependentPdfEdition','linkExistingCloudPdf','saveJpegBook','saveHtmlBook'])assert(snapshot.get('app/src/book_import.ts').includes(token),'merged intake missing '+token)
// The concurrent import-paste candidate changes these files over batch89.
// Pin its exact reviewed implementation; main/background search additionally
// contain our previously tested deferred indexing and reader work.
for(const path of ['quick_book_import.ts','word_upload_setup.ts','background_data_scheduler.ts','local_index_status.ts','engine/local_index_jobs.ts','engine/local_index_resume.ts']){
 const bytes=await readFile(resolve(root,'.artifacts/import-paste-20260924/source/app/src',path))
 assert.equal(snapshot.get('app/src/'+path)?.replaceAll('\r\n','\n'),bytes.toString().replaceAll('\r\n','\n'),'import paste candidate drift: '+path)
}
await writeFile(resolve(out,'source-snapshot.json'),JSON.stringify(rows,null,2))
const frozen=()=>({name:'frozen-merged-reader-source',enforce:'pre',load(id){const value=snapshot.get(relative(root,id.split('?')[0]).replaceAll('\\','/'));return value===undefined?null:id.endsWith('?raw')?'export default '+JSON.stringify(value):value}})
const {config}=await loadConfigFromFile({command:'build',mode:'production'},resolve(root,'app/vite.config.ts'))
config.plugins=config.plugins.flat(Infinity).filter(p=>p?.name!=='emit-essential-public-assets')
config.build.rollupOptions.output.manualChunks=id=>{
 const p=id.replaceAll('\\','/')
 // Coalesce tiny shared helpers, not parsers, dictionaries or book payloads.
 if(/\/src\/(?:book_ordering_chronology|library_card_state|engine\/scoped_content_matches|pdf_heading_index|text_import|annotation_accessibility|rich_clipboard|reader_in_book_search|quote_store|reading_plan|shelf_store|book_ordering|library_author_chronology)\.ts$/.test(p))return 'reader-shared-utils'
 if(/\/src\/(?:icons|html_decode|html_source_limits|edition_metadata|bok_active_release|textual_quran_style|import_style_security)\.ts$/.test(p))return 'interface-primitives'
 if(/\/src\/(?:background_data_scheduler|book_format|session_identity|ui|path_location|engine\/word_volume_identity)\.ts$/.test(p))return 'interface-primitives'
 if(/\/src\/(runtime_capabilities|word_upload_setup|word_connected_client)\.ts$/.test(p))return 'word-connection'
 if(/\/src\/(reader_page_authority|pdf_import|pdfjs_assets)\.ts$/.test(p))return 'reader-shared-utils'
 if(/\/src\/(components|page_jump|silent_skeleton|public_page_hero|section_service_hero)\.ts$/.test(p))return 'shared-route-view'
 if(/\/(?:app\/src\/word_cover_payload|packages\/word-cover\/src\/index)\.ts$/.test(p))return 'word-cover-decoder'
 if(/\/src\/(artifact_download|hash_query_state|recommendation_preferences)\.ts$/.test(p))return 'reader-shared-utils'
}
await build({...config,configFile:false,plugins:[frozen(),...config.plugins],worker:{...config.worker,plugins:()=>[frozen()]},build:{...config.build,outDir:resolve(out,'compiled'),emptyOutDir:false,manifest:true}})
console.log('Merged client frozen and built: '+out)
