// Stage the exact reviewed source without replacing newer working-tree edits.
import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
const root=resolve(import.meta.dirname,'..'),base=resolve(root,'.artifacts/batch33')
const git=(args,options={})=>execFileSync('git',args,{cwd:root,encoding:'utf8',...options}).trim()
assert.equal(git(['diff','--cached','--name-only']),'','preserve_existing_staging')
const files=JSON.parse(readFileSync(resolve(base,'source-snapshot.json'))).files
const updates=[]
for(const file of files){
 assert(/^(app\/src|packages)\//.test(file.path)&&!file.path.includes('..'))
 const path=resolve(base,file.path),bytes=readFileSync(path)
 assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256)
 const hash=git(['hash-object','-w','--',path])
 updates.push(`100644 ${hash}\t${file.path}`)
}
git(['update-index','--index-info'],{input:updates.join('\n')+'\n'})
console.log(JSON.stringify({stagedFrozenFiles:files.length}))
