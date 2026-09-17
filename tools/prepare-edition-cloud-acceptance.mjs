import {readFile,writeFile} from 'node:fs/promises'
import {randomBytes,createHash} from 'node:crypto'
const root='.artifacts/bok-cloud-acceptance-20260917',sha=x=>createHash('sha256').update(x).digest('hex'),token=randomBytes(32).toString('hex'),device=randomBytes(32).toString('hex')
let sql='';for(const name of ['0004_central_book_overrides','0009_account_book_deletion','0018_central_authors','0019_book_intake_metadata','0031_independent_pdf_editions'])sql+=await readFile(`alpha-publish/migrations/${name}.sql`,'utf8')+'\n'
sql+=`INSERT INTO accounts(subject,email,role) VALUES('edition-foreign','edition-foreign@isolated.invalid','user');
INSERT INTO account_devices(owner_subject,device_id,label,platform) VALUES('edition-foreign','${sha(device)}','test','test');
INSERT INTO account_access_sessions(token_hash,subject,device_id,expires_at) VALUES('${sha(token)}','edition-foreign','${sha(device)}',unixepoch()+900);\n`
for(const [id,mime,pub] of [['edition-word','application/vnd.openxmlformats-officedocument.wordprocessingml.document',false],['edition-pdf','application/pdf',false],['edition-public-parent','text/plain',true],['edition-private-sibling','application/pdf',false]])sql+=`INSERT INTO user_books(id,owner_subject,title,author,object_key,mime_type,byte_length,visibility,review_status) VALUES('${id}','isolated-editor','كتاب اختبار معزول','مؤلف اختبار','isolated/${id}','${mime}',10,'${pub?'public':'private'}','${pub?'approved':'pending'}');
INSERT INTO user_book_metadata(book_id,metadata_json,storage_bytes) VALUES('${id}','{"edition":"طبعة ثانية","publisher":"ناشر اختبار"}',10);\n`
await writeFile(root+'/edition-seed.sql',sql,{flag:'wx'})
await writeFile(root+'/private-edition-foreign-session.json',JSON.stringify({cookie:`__Host-khizana-access-session=${token}; __Host-khizana-device=${device}`}),{flag:'wx'})
console.log('Prepared isolated edition metadata only; no file upload or production rows.')
