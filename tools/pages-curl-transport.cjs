// Same Cloudflare endpoints and JWT as Wrangler; native HTTPS transport only.
// Credentials travel over the child's stdin, never argv, files, or log output.
const {spawn}=require('node:child_process')
const {mkdir,writeFile,unlink}=require('node:fs/promises')
const {resolve}=require('node:path')
const {randomUUID}=require('node:crypto')
function quote(value){return '"'+String(value).replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\r/g,'\\r').replace(/\n/g,'\\n')+'"'}
function configFor(endpoint,jwt,payload,payloadFile){
 if(!['/pages/assets/upload','/pages/assets/upsert-hashes'].includes(endpoint))throw Error('asset_endpoint_not_allowed')
 if(!/^[A-Za-z0-9._-]+$/.test(jwt))throw Error('invalid_asset_token')
 return ['silent','show-error','ipv4','connect-timeout = 20','max-time = 600',
  'url = '+quote('https://api.cloudflare.com/client/v4'+endpoint),'request = "POST"',
  'header = '+quote('Content-Type: application/json'),'header = '+quote('Authorization: Bearer '+jwt),
  'data-binary = '+quote(payloadFile?'@'+payloadFile:JSON.stringify(payload)),'write-out = "\\nKHIZANA_STATUS:%{http_code}"'].join('\n')+'\n'
}
async function transfer(endpoint,jwt,payload){
 // curl limits a config line to 10 MB. Only public asset bytes go into this
 // transient body file; the credential still travels exclusively over stdin.
 const directory=resolve(__dirname,'../.artifacts/reader-upload-resumable-20260924/transport-temp')
 await mkdir(directory,{recursive:true})
 const payloadFile=resolve(directory,process.pid+'-'+randomUUID()+'.json')
 await writeFile(payloadFile,JSON.stringify(payload),{flag:'wx'})
 const config=configFor(endpoint,jwt,payload,payloadFile)
 try{
 const {code,output,diagnostic}=await new Promise((done,reject)=>{
  const p=spawn('curl.exe',['--config','-'],{windowsHide:true,stdio:['pipe','pipe','pipe']})
  let output='';p.stdout.on('data',b=>{output+=b.toString();if(output.length>2*1024*1024)p.kill()})
  let diagnostic='';p.stderr.on('data',b=>{diagnostic=(diagnostic+b.toString()).slice(-500)})
  p.stdin.on('error',()=>{});p.on('error',()=>reject(Error('native_asset_transport_start_failed')))
  p.on('close',code=>done({code,output,diagnostic:diagnostic.replaceAll(jwt,'[redacted]').replace(/[\r\n]+/g,' ')}));p.stdin.end(config)
 })
 if(code!==0)throw Error('native_asset_transport_failed:'+code+': '+diagnostic)
 const match=/\nKHIZANA_STATUS:(\d{3})$/.exec(output)
 if(!match)throw Error('native_asset_status_missing')
 if(Number(match[1])<200||Number(match[1])>=300)throw Error('native_asset_http:'+match[1])
 let result;try{result=JSON.parse(output.slice(0,match.index))}catch{throw Error('native_asset_response_invalid')}
 if(result.success!==true)throw Error('native_asset_api_failed')
 return result.result
 }finally{await unlink(payloadFile)}
}
module.exports={configFor,transfer}
