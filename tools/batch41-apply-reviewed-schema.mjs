import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
assert(process.argv.includes('--apply-reviewed-production'));
const pre=JSON.parse(await readFile('.artifacts/batch41/production-preflight.json','utf8'));
assert(pre.bookmark&&pre.d1.VISITORS_DB.id==='aeb2bf7d-bfc5-4ec1-9ef5-a81371efe800');
const names=['0032_bok_release_pointer','0033_public_book_index_jobs','0034_bok_publication_jobs','0035_public_book_search','0036_public_book_event_outbox','0037_public_book_queue_receipts','0038_public_book_indexnow','0039_public_pdf_classification','0040_public_book_metadata_aliases','0041_public_book_actions_dispatch'];
const report={startedAt:new Date().toISOString(),bookmark:pre.bookmark,activation:false,migrations:[]};
for(const name of names){
 const file=`deployment/cloudflare/migrations/${name}.sql`;
 const hash=createHash('sha256').update(await readFile(file)).digest('hex');
 const r=spawnSync(process.execPath,['alpha-publish/node_modules/wrangler/bin/wrangler.js','d1','execute','khezana-visitors','--remote','--config','alpha-publish/wrangler.toml','--file',file,'--yes','--json'],{encoding:'utf8',env:{...process.env,WRANGLER_LOG_PATH:'D:/alkhizana/.wrangler-logs',CLOUDFLARE_ACCOUNT_ID:'db956e5187111b69e796e4a8e4c3fe36'}});
 report.migrations.push({name,sha256:hash,exit:r.status,output:r.stdout,stderr:r.stderr});
 await writeFile('.artifacts/batch41/schema-receipt.json',JSON.stringify(report,null,2));
 console.log(name+': '+r.status);
 if(r.status!==0){console.log(r.stdout,r.stderr);process.exit(1);}
}
