import {readFile,mkdir,stat} from 'node:fs/promises'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {planFieldOverlay,transferFieldOverlay,PIN} from './field-overlay-upload-plan.mjs'
import {createFieldS3Transport} from './field-overlay-s3-transport.mjs'
import {parseR2Config,safeFailure,journalWriter} from './field-overlay-upload-state.mjs'
// Run every --execute invocation as the same Windows user. A sandbox-owned
// journal cannot safely be atomically replaced by that user's later process.
export const STATE=`.artifacts/field-overlay-transfer-${PIN}`
const CONFIG='C:/Users/Windows_OS/AppData/Roaming/rclone/rclone.conf'
let phase='arguments'
export async function runFieldUpload(args,{planLocal=planFieldOverlay,log=console.log}={}){
 const mode=args.shift();if(!['--plan','--execute'].includes(mode))throw Error('usage')
 const options={};for(let i=0;i<args.length;i+=2){if(!['--max-objects','--max-bytes','--max-seconds','--fresh-verify'].includes(args[i])||Object.hasOwn(options,args[i])||args[i+1]===undefined)throw Error('usage');options[args[i]]=args[i+1]}
 if(mode==='--plan'&&args.length)throw Error('usage')
 const maxObjects=Number(options['--max-objects']),maxBytes=Number(options['--max-bytes']),seconds=Number(options['--max-seconds'])
 if(mode==='--execute'&&(!Number.isSafeInteger(maxObjects)||maxObjects<1||maxObjects>8595||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>200000000||!Number.isSafeInteger(seconds)||seconds<1||seconds>3600||options['--fresh-verify']!==undefined&&options['--fresh-verify']!=='true'))throw Error('limits')
 phase='local_plan';const plan=await planLocal()
 // Planning is read-only, including error paths: no state, credentials or network.
 if(mode==='--plan'){const {jobs,...summary}=plan;log(JSON.stringify(summary));return}
 await mkdir(STATE,{recursive:true});await journalWriter(`${STATE}/plan.json`,plan)
 phase='credential_config';if((await stat(CONFIG)).size>1048576)throw Error('config_size');const config=parseR2Config(await readFile(CONFIG,'utf8'))
 const controller=new AbortController(),stop=()=>controller.abort(Error('stopped')),timer=setTimeout(stop,seconds*1000)
 process.once('SIGINT',stop);process.once('SIGTERM',stop)
 const transport=createFieldS3Transport({...config,signal:controller.signal,runTimeoutMs:seconds*1000})
 try{
  phase='journal_load';let journal={};try{if((await stat(`${STATE}/journal.json`)).size>8000000)throw Error('journal_size');journal=JSON.parse(await readFile(`${STATE}/journal.json`,'utf8'));if(!journal||Array.isArray(journal)||typeof journal!=='object')throw Error('journal_invalid')}catch(error){if(error.code!=='ENOENT')throw Error('journal_invalid')}
  await journalWriter(`${STATE}/status.json`,{complete:false,activated:false,manifestSha256:PIN})
  phase=options['--fresh-verify']==='true'?'fresh_verify':'transfer'
  const result=await transferFieldOverlay({plan,journal,transport,readLocal:async job=>{if((await stat(job.localPath)).size!==job.bytes)throw Error('local_sha');return readFile(job.localPath)},persist:value=>journalWriter(`${STATE}/journal.json`,value),signal:controller.signal,maxObjects,maxBytes,freshVerify:options['--fresh-verify']==='true'})
  await journalWriter(`${STATE}/status.json`,result);console.log(JSON.stringify(result))
 }finally{clearTimeout(timer);transport.close();process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop)}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)runFieldUpload(process.argv.slice(2)).catch(async error=>{const failure={complete:false,activated:false,error:'field_upload_stopped',failure:safeFailure(error,phase)};if(process.argv[2]==='--execute')try{await mkdir(STATE,{recursive:true});await journalWriter(`${STATE}/failure-status.json`,failure)}catch{}console.error(JSON.stringify(failure));process.exitCode=1})
