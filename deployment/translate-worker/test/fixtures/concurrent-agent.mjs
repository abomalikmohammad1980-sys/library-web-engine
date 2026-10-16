import os from 'node:os'
os.freemem=()=>3*1024**3
let pulls=0,active=0,peak=0,completed=0
const saved=new Set()
globalThis.fetch=async (url,options={})=>{
 const path=new URL(url).pathname
 const body=options.body?JSON.parse(options.body.toString()):{}
 if(path==='/health')return Response.json({status:'ok'})
 if(path==='/props')return Response.json({total_slots:4,default_generation_settings:{n_ctx:2048}})
 if(path==='/v1/models')return Response.json({data:[{id:'Hy-MT2-7B-Q4_K_M.gguf'}]})
 if(path.endsWith('/pull')){const n=++pulls;return Response.json({nextShard:n%4,job:n>4?null:{id:String(n).repeat(64),token:'lease-'+n,target:'en',sourceType:'title',mode:'local',units:[{index:0,text:'المجلد '+n}]}})}
 if(path.endsWith('/status'))return Response.json({utf8Probe:'مرحبا بالعالم',completed,pending:0,processing:active,failed:0,completedLastMinute:0,failedItems:[]})
 if(path.endsWith('/prepare'))return Response.json({needed:true,unit:{index:0,text:'المجلد '+body.id[0]}})
 if(path==='/apply-template')return Response.json({prompt:body.messages[0].content})
 if(path==='/tokenize')return Response.json({tokens:[1,2,3]})
 if(path==='/v1/chat/completions'){
  const n=body.messages[0].content.match(/المجلد (\d)/)[1]
  active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,150));active--
  return Response.json({choices:[{finish_reason:'stop',message:{content:'Volume '+n}}]})
 }
 if(path.endsWith('/result')){if(body.token!=='lease-'+body.id[0] || body.translation!=='Volume '+body.id[0])throw Error('Mixed lease or translation');saved.add(body.id);return Response.json({accepted:true})}
 if(path.endsWith('/complete')){if(!saved.has(body.id))throw Error('Completed before saved');completed++;if(completed===4){console.log('CONCURRENT_PEAK='+peak+' SAVED='+saved.size);setTimeout(()=>process.emit('SIGINT'),20)}return Response.json({completed:true})}
 throw Error('Unexpected request '+path)
}
