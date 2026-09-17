import {readFile,writeFile,mkdir,realpath,lstat,unlink} from 'node:fs/promises'
import {resolve,relative,isAbsolute} from 'node:path'
import {createHash} from 'node:crypto'
export const HEADING_CONFIG_SHA='62f0baee0d621d7b45335244bd2a2de4f654a6525a66e83d59b21eb2d646a837'
const NAME='heading-release.json'
async function info(path){try{return await lstat(path)}catch(error){if(error.code==='ENOENT')return null;throw error}}
function inside(root,path){const rel=relative(root,path);if(!rel||rel==='..'||rel.startsWith('../')||rel.startsWith('..\\')||isAbsolute(rel))throw Error('heading_config_path_escape')}
async function dataDirectory(root,create){const realRoot=await realpath(root),data=resolve(root,'data'),entry=await info(data);if(entry?.isSymbolicLink()||entry&&!entry.isDirectory())throw Error('heading_config_data_invalid');if(!entry){if(!create)return null;await mkdir(data)}inside(realRoot,await realpath(data));return data}
/** Presence in the chosen build source is the only opt-in; no fallback to artifacts or app/public. */
export async function stageOptionalHeadingRelease(sourceRoot,destinationRoot){
 const sourceData=await dataDirectory(resolve(sourceRoot),false),source=sourceData?resolve(sourceData,NAME):null,entry=source?await info(source):null;let bytes
 if(entry){if(entry.isSymbolicLink()||!entry.isFile()||entry.size<1||entry.size>100000)throw Error('heading_config_file_invalid');inside(await realpath(sourceRoot),await realpath(source));bytes=await readFile(source);if(bytes.length!==entry.size||createHash('sha256').update(bytes).digest('hex')!==HEADING_CONFIG_SHA)throw Error('heading_config_integrity')}
 await mkdir(resolve(destinationRoot),{recursive:true});const destinationData=await dataDirectory(resolve(destinationRoot),true),destination=resolve(destinationData,NAME),old=await info(destination)
 if(old&&(old.isSymbolicLink()||!old.isFile()))throw Error('heading_config_destination_invalid')
 if(!bytes){if(old)await unlink(destination);return{files:[],enabled:false}}
 await writeFile(destination,bytes);return{files:[NAME],enabled:true,sha256:HEADING_CONFIG_SHA,bytes:bytes.length}
}
