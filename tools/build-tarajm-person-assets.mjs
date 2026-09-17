import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createHash} from 'node:crypto'
const hash=value=>createHash('sha256').update(value).digest('hex')
export async function buildTarajmPersonAssets(publicRoot){
 const data=resolve(publicRoot,'data'),raw=await readFile(resolve(data,'tarajm-biographies.json')),mapping=await readFile(resolve(data,'tarajm-author-map.json'))
 const generation=hash(Buffer.concat([raw,mapping])),payload=JSON.parse(raw),entries={}
 const dir=resolve(data,'tarajm-persons',generation);await mkdir(dir,{recursive:true})
 for(const [id,biography] of Object.entries(payload.biographies)){
  if(!/^\d+$/.test(id))throw Error('invalid biography ID')
  const bytes=Buffer.from(JSON.stringify({schemaVersion:1,biographies:{[id]:biography}})),sha256=hash(bytes),path=`tarajm-persons/${generation}/${id}.json`
  await writeFile(resolve(data,path),bytes);entries[id]={path,bytes:bytes.length,sha256}
 }
 const unavailableExternalIds=JSON.parse(mapping).mappings.filter(item=>!payload.biographies[item.tarajmExternalId]).map(item=>item.tarajmExternalId)
 const manifest={schemaVersion:1,contract:'tarajm-person-assets/1',generation,entries,unavailableExternalIds}
 await writeFile(resolve(data,'tarajm-persons.manifest.json'),JSON.stringify(manifest))
 return {generation,count:Object.keys(entries).length,totalBytes:Object.values(entries).reduce((sum,x)=>sum+x.bytes,0),maxBytes:Math.max(...Object.values(entries).map(x=>x.bytes))}
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename))console.log(JSON.stringify(await buildTarajmPersonAssets(resolve('app/public'))))
