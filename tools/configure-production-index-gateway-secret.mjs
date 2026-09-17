// Dedicated gateway credential: memory/stdin only, never reused from preview.
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
if(process.argv.length!==3||process.argv[2]!=='--configure-production')throw Error('explicit_production_configuration_required');
const root=resolve(import.meta.dirname,'..'),token=randomBytes(48).toString('base64url');
function run(binary,args,label){
 const r=spawnSync(binary,args,{cwd:root,input:token+'\n',encoding:'utf8',timeout:90000,maxBuffer:1024*1024,env:{...process.env,WRANGLER_LOG_PATH:'D:/alkhizana/.wrangler-logs',CLOUDFLARE_ACCOUNT_ID:'db956e5187111b69e796e4a8e4c3fe36'}});
 if(r.status!==0)throw Error(label+'_failed');
 console.log(JSON.stringify({step:label,configured:true,secretPrinted:false}));
}
run(process.execPath,[resolve(root,'alpha-publish/node_modules/wrangler/bin/wrangler.js'),'pages','secret','put','PUBLIC_BOOK_INDEX_RUNNER_TOKEN','--project-name','khezana'],'production_pages_gateway');
run('C:/Program Files/GitHub CLI/gh.exe',['secret','set','PUBLIC_BOOK_INDEX_PRODUCTION_RUNNER_TOKEN','--repo','abomalikmohammad1980-sys/library-web-engine'],'production_actions_gateway');
