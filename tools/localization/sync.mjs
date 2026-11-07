/** Publish already-owned source manifest; no secrets in command arguments/logs. */
import fs from 'node:fs/promises';
const [file,url]=process.argv.slice(2),token=process.env.LOCALIZATION_ADMIN_TOKEN;
if(!file||!url||!token||token.length<32)throw Error('Usage: node tools/localization/sync.mjs .localization/sources.json https://<new-worker>/api/localization; supply LOCALIZATION_ADMIN_TOKEN in environment');
const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||!(u.hostname==='khzanah.com'||/^khezana-localization-engine\.[a-z0-9-]+\.workers\.dev$/.test(u.hostname)))throw Error('untrusted_endpoint');
const data=JSON.parse(await fs.readFile(file,'utf8'));if(data.contract!=='khzanah-source-manifest/1'||!Array.isArray(data.rows)||!Array.isArray(data.seeds))throw Error('invalid_manifest');
async function send(route,rows){const r=await fetch(url.replace(/\/$/,'')+'/admin/'+route,{method:'POST',redirect:'error',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({rows}),signal:AbortSignal.timeout(60000)});if(!r.ok){await r.body?.cancel();throw Error(route+' HTTP '+r.status);}await r.body?.cancel();}
for(const [name,rows]of [['sources',data.rows],['seed',data.seeds]])for(let i=0;i<rows.length;i+=64){await send(name,rows.slice(i,i+64));console.log(name+': '+Math.min(i+64,rows.length)+'/'+rows.length);}
console.log('Synced registered source/seed rows only. Processing was not enabled; removed sources require explicit active:false events.');
