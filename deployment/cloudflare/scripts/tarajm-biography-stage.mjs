import {access,mkdir,readFile,readdir,rm,writeFile,realpath} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {resolve} from 'node:path'

const SINGLE='tarajm-biographies.json'
const MANIFEST='tarajm-biographies.manifest.json'
const PART=/^tarajm-biographies-\d{4}\.json$/u
const utf8=value=>Buffer.byteLength(value,'utf8')

export async function stageTarajmPersonAssets(sourceData,destinationData){
 const name='tarajm-persons.manifest.json',manifestBytes=await readFile(resolve(sourceData,name))
 if(manifestBytes.length>1024*1024)throw Error('tarajm_person_manifest_budget')
 const manifest=JSON.parse(manifestBytes),generation=manifest.generation
 if(manifest.contract!=='tarajm-person-assets/1'||!/^[a-f0-9]{64}$/.test(generation)||!manifest.entries||Array.isArray(manifest.entries))throw Error('tarajm_person_manifest_invalid')
 const root=await realpath(sourceData),verified=[]
 for(const [id,asset] of Object.entries(manifest.entries)){
  if(!/^[1-9]\d*$/.test(id)||asset.path!==`tarajm-persons/${generation}/${id}.json`||!Number.isSafeInteger(asset.bytes)||asset.bytes<1||asset.bytes>500000||!/^[a-f0-9]{64}$/.test(asset.sha256))throw Error('tarajm_person_asset_invalid')
  const path=await realpath(resolve(sourceData,asset.path));if(!path.startsWith(root+'\\')&&!path.startsWith(root+'/'))throw Error('tarajm_person_path_escape')
  const bytes=await readFile(path);if(bytes.length!==asset.bytes||createHash('sha256').update(bytes).digest('hex')!==asset.sha256)throw Error('tarajm_person_integrity')
  const payload=JSON.parse(bytes);if(payload.schemaVersion!==1||Object.keys(payload.biographies??{}).length!==1||!payload.biographies[id])throw Error('tarajm_person_record_invalid')
  verified.push({id,bytes})
 }
 if(!verified.length)throw Error('tarajm_person_empty')
 // Only this generated subtree is replaced; never copy the surrounding data.
 const output=resolve(destinationData,'tarajm-persons');if(output!==resolve(destinationData)+'/tarajm-persons'&&output!==resolve(destinationData)+'\\tarajm-persons')throw Error('tarajm_person_destination_invalid')
 await rm(output,{recursive:true,force:true});await mkdir(resolve(output,generation),{recursive:true})
 for(const {id,bytes} of verified)await writeFile(resolve(output,generation,`${id}.json`),bytes)
 await writeFile(resolve(destinationData,name),manifestBytes)
 return {recordCount:verified.length,generation,files:[name,'tarajm-persons']}
}

async function exists(path){try{await access(path);return true}catch(error){if(error?.code==='ENOENT')return false;throw error}}
function payload(value,label){if(!value||value.schemaVersion!==1||!value.biographies||typeof value.biographies!=='object'||Array.isArray(value.biographies))throw new Error(`tarajm_stage_invalid_${label}`);return value.biographies}

export async function stageTarajmBiographyBundle(sourceData,destinationData,{maxPartBytes=3*1024*1024}={}){
  if(!Number.isSafeInteger(maxPartBytes)||maxPartBytes<256)throw new Error('tarajm_stage_invalid_part_limit')
  await mkdir(destinationData,{recursive:true})
  for(const name of await readdir(destinationData).catch(error=>error?.code==='ENOENT'?[]:Promise.reject(error)))if(name===SINGLE||name===MANIFEST||PART.test(name))await rm(resolve(destinationData,name),{force:true})
  let entries
  if(await exists(resolve(sourceData,SINGLE))){const source=JSON.parse(await readFile(resolve(sourceData,SINGLE),'utf8'));entries=Object.entries(payload(source,'single'))}
  else{
    const manifest=JSON.parse(await readFile(resolve(sourceData,MANIFEST),'utf8'))
    if(manifest.schemaVersion!==1||!Number.isSafeInteger(manifest.recordCount)||manifest.recordCount<0||!Array.isArray(manifest.parts)||!manifest.parts.length||manifest.parts.some(name=>typeof name!=='string'||!PART.test(name)))throw new Error('tarajm_stage_invalid_manifest')
    const merged={}
    for(const name of manifest.parts){const text=await readFile(resolve(sourceData,name),'utf8');if(utf8(text)>=maxPartBytes)throw new Error(`tarajm_stage_oversized_source_part:${name}`);for(const [id,biography] of Object.entries(payload(JSON.parse(text),name))){if(Object.hasOwn(merged,id))throw new Error(`tarajm_stage_duplicate_record:${id}`);merged[id]=biography}}
    entries=Object.entries(merged);if(entries.length!==manifest.recordCount)throw new Error(`tarajm_stage_record_count_drift:${manifest.recordCount}:${entries.length}`)
  }
  const prefix='{"schemaVersion":1,"biographies":{',suffix='}}',parts=[]
  let fields=[],bytes=utf8(prefix)+utf8(suffix)
  for(const [id,biography] of entries){const field=`${JSON.stringify(id)}:${JSON.stringify(biography)}`,addition=utf8(field)+(fields.length?1:0);if(utf8(prefix)+utf8(field)+utf8(suffix)>=maxPartBytes)throw new Error(`tarajm_stage_record_too_large:${id}`);if(fields.length&&bytes+addition>=maxPartBytes){parts.push(fields);fields=[];bytes=utf8(prefix)+utf8(suffix)}fields.push(field);bytes+=utf8(field)+(fields.length>1?1:0)}
  if(fields.length)parts.push(fields)
  if(!parts.length)throw new Error('tarajm_stage_empty_biographies')
  const names=[]
  for(let index=0;index<parts.length;index++){const name=`tarajm-biographies-${String(index+1).padStart(4,'0')}.json`,text=`${prefix}${parts[index].join(',')}${suffix}`;if(utf8(text)>=maxPartBytes)throw new Error(`tarajm_stage_part_limit_exceeded:${name}`);await writeFile(resolve(destinationData,name),text);names.push(name)}
  await writeFile(resolve(destinationData,MANIFEST),JSON.stringify({schemaVersion:1,recordCount:entries.length,parts:names}))
  return{recordCount:entries.length,parts:names,files:[MANIFEST,...names]}
}
