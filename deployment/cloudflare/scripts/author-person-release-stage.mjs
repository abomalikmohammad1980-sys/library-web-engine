import {readFile,mkdir,writeFile,readdir} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {createHash} from 'node:crypto'
const hex=/^[a-f0-9]{64}$/,hash=b=>createHash('sha256').update(b).digest('hex')
/** Source is the selected dist, never app/public or a different generation. */
export async function stageAuthorPersonRelease(source,destination,{verifyOnly=false}={}){
 const name='data/author-persons.release.json';let raw
 try{raw=await readFile(resolve(source,name))}catch(e){if(e.code==='ENOENT')return{files:[]};throw e}
 if(raw.length>32768)throw Error('author_person_descriptor')
 const release=JSON.parse(raw)
 if(release.contract!=='khizana-author-person-release/1'||!hex.test(release.generation)||!Number.isInteger(release.authorCount)||release.authorCount<1||release.authorCount>10000||Object.keys(release.shards??{}).length!==64||Array.from({length:64},(_,i)=>i).some(i=>!release.shards[i]))throw Error('author_person_descriptor')
 const root=`data/author-persons/${release.generation}/`,files=new Map(),ids=new Set()
 async function verified(asset,kind){
  if(!asset||!hex.test(asset.sha256)||asset.path!==`${kind}/${asset.sha256}.json`||!Number.isInteger(asset.bytes)||asset.bytes<1||asset.bytes>(kind==='indexes'?32768:512*1024))throw Error('author_person_descriptor')
  const path=root+asset.path,bytes=await readFile(resolve(source,path));if(bytes.length!==asset.bytes||hash(bytes)!==asset.sha256)throw Error('author_person_integrity');files.set(path,bytes);return JSON.parse(bytes)
 }
 for(let key=0;key<64;key++){
  const shard=await verified(release.shards[key],'indexes')
  if(shard.contract!=='khizana-author-person-shard/1'||shard.generation!==release.generation||!shard.entries||Array.isArray(shard.entries))throw Error('author_person_descriptor')
  for(const [id,asset]of Object.entries(shard.entries)){
   if(!/^[1-9]\d{0,5}$/.test(id)||Number(id)%64!==key||ids.has(id))throw Error('author_person_descriptor');ids.add(id)
   const person=await verified(asset,'persons');if(person.contract!=='khizana-author-person/1'||person.generation!==release.generation||person.entry?.authorId!==id)throw Error('author_person_descriptor')
  }
 }
 if(ids.size!==release.authorCount)throw Error('author_person_descriptor')
 files.set(name,raw)
 // Validate the complete release before copying any file.
 if(!verifyOnly)for(const [path,bytes]of files){const target=resolve(destination,path);await mkdir(dirname(target),{recursive:true});await writeFile(target,bytes)}
 const actual=[]
 async function inventory(path){for(const entry of await readdir(resolve(destination,path),{withFileTypes:true})){const next=`${path}/${entry.name}`;if(entry.isDirectory())await inventory(next);else if(entry.isFile())actual.push(next);else throw Error('author_person_inventory')}}
 await inventory('data/author-persons')
 const expected=[...files.keys()].filter(path=>path!==name).sort()
 if(JSON.stringify(actual.sort())!==JSON.stringify(expected))throw Error('author_person_inventory')
 // copy-public-app's gate compares immediate names under data/, not resources.
 // Preserve that contract while separately verifying the full nested inventory.
 return{files:['author-persons','author-persons.release.json'],resourceFiles:[...files.keys()],authors:ids.size,generation:release.generation}
}
