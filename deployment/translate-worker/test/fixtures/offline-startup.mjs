let pulls=0;
globalThis.fetch=async url=>{
 const path=new URL(url).pathname;
 if(path==='/health')return Response.json({status:'ok'});
 if(path==='/props')return Response.json({total_slots:1,default_generation_settings:{n_ctx:2048}});
 if(path==='/v1/models')return Response.json({data:[{id:'Hy-MT2-7B-Q4_K_M.gguf'}]});
 if(path.endsWith('/pull')){
  pulls++;
  if(pulls===1)throw new TypeError('Offline simulation');
  console.log('TEST_RECONNECTED_AFTER_OFFLINE');
  return Response.json({job:null,nextShard:0});
 }
 if(path.endsWith('/status')){
  setTimeout(()=>process.emit('SIGINT'),50);
  return Response.json({utf8Probe:'مرحبا بالعالم',completed:1,pending:0,processing:0,failed:0,completedLastMinute:0,failedItems:[]});
 }
 throw Error('Unexpected request '+path);
};
