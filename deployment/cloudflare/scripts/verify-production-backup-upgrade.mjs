import {DatabaseSync} from 'node:sqlite'
import {readFile,writeFile,readdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'

// The export remains private. Only integrity metadata leaves this process.
const backup=new URL('../.artifacts/production-before-batch-20260912.sql',import.meta.url)
const bytes=await readFile(backup)
const reportName=process.argv[2]??'production-backup-upgrade-20260912.json'
if(!/^[a-z0-9-]+\.json$/.test(reportName))throw Error('unsafe_report_name')
const db=new DatabaseSync(':memory:')
const hash=value=>createHash('sha256').update(value).digest('hex')
try{
 db.exec(bytes.toString('utf8'))
 const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(x=>x.name)
 const quote=name=>'"'+name.replaceAll('"','""')+'"'
 const digest=name=>hash(JSON.stringify(db.prepare(`SELECT * FROM ${quote(name)}`).all()))
 const before=new Map(tables.map(name=>[name,digest(name)]))
 const foreignKeysBefore=db.prepare('PRAGMA foreign_key_check').all()
 const directory=new URL('../ops/batch-20260912-migrations/',import.meta.url)
 const migrations=(await readdir(directory)).filter(x=>x.endsWith('.sql')).sort()
 assert.equal(migrations.length,3)
 for(const migration of migrations)db.exec(await readFile(new URL(migration,directory),'utf8'))
 for(const [table,checksum] of before)assert.equal(digest(table),checksum,'Existing rows changed during upgrade')
 assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),foreignKeysBefore,'Upgrade introduced a foreign-key violation')
 assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok')
 for(const name of ['user_book_word_bundles','bok_text_drafts','bok_text_draft_history'])assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name))
 const report={passed:true,completedAt:new Date().toISOString(),backupBytes:bytes.length,backupSha256:hash(bytes),preservedTables:tables.length,migrations,integrity:'ok',newForeignKeyViolations:0,productionModified:false}
 await writeFile(new URL('../.artifacts/'+reportName,import.meta.url),JSON.stringify(report,null,2)+'\n')
 console.log(JSON.stringify(report))
}finally{db.close()}
