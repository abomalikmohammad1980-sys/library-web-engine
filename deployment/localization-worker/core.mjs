/** Permanent, source-versioned memory. Reading never creates translation work. */
export const CONTRACT='khzanah-localization/1';
export const LANGUAGES=Object.freeze(['en','fr','ug','ckb','ku','tr','ur','fa','sw','hi','hu','id','ms','bn','ps','so','ha','ru','uk','de','es','pt','it','nl','sv','no','pl','ro','bs','sq','az','uz','kk','zh','ja','ko']);
export const normalize=v=>String(v).normalize('NFC').replace(/\s+/gu,' ').trim();
export const sha256=async v=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v))),b=>b.toString(16).padStart(2,'0')).join('');
export const slots=s=>(s.match(/\{(?:p\d+|[A-Za-z_][\w.]*)\}|%\d*\$?[sdf]/g)||[]).sort();
export function validateResult(source,text){
 if(typeof text!=='string'||!text.trim()||text.length>16000||text.includes('\ufffd'))throw Error('invalid_translation');
 if(JSON.stringify(slots(source))!==JSON.stringify(slots(text)))throw Error('placeholder_mismatch');
 if(/<\/?(?:script|iframe|object|style)\b/i.test(text))throw Error('unexpected_markup');
 const ratio=[...text.trim()].length/Math.max(1,[...source].length);
 if([...source].length>100&&(ratio<.12||ratio>8))throw Error('suspicious_length');
 return text.trim(); // These checks do not prove semantic accuracy.
}
export async function prepareSource(r){
 if(!r||!['ui','book','author'].includes(r.kind)||typeof r.id!=='string'||!r.id||r.id.length>240||/[\u0000-\u001f]/.test(r.id))throw Error('invalid_identity');
 if(r.public!==true||typeof r.source!=='string'||(r.context!==undefined&&typeof r.context!=='string'))throw Error('public_source_required');
 if(r.active!==undefined&&typeof r.active!=='boolean')throw Error('invalid_active');
 const source=normalize(r.source),context=normalize(r.context||'');
 if(!source||[...source].length>3000||context.length>240)throw Error('invalid_source_length');
 return {kind:r.kind,id:r.id,key:r.kind+':'+r.id,source,context,unit:await sha256(JSON.stringify([CONTRACT,r.kind,context,source])),shard:r.kind==='ui'?'0':(await sha256(r.id))[0],active:r.active===false?0:1};
}
const DDL=[
 'CREATE TABLE IF NOT EXISTS sources(key TEXT PRIMARY KEY,kind TEXT NOT NULL,id TEXT NOT NULL,source TEXT NOT NULL,context TEXT NOT NULL,unit TEXT NOT NULL,shard TEXT NOT NULL,active INTEGER NOT NULL,revision INTEGER NOT NULL DEFAULT 1)',
 'CREATE INDEX IF NOT EXISTS sources_unit ON sources(unit,active)',
 'CREATE INDEX IF NOT EXISTS sources_shard ON sources(kind,shard,active)',
 'CREATE TABLE IF NOT EXISTS memory(unit TEXT NOT NULL,locale TEXT NOT NULL,translation TEXT NOT NULL,reviewed INTEGER NOT NULL DEFAULT 0,provider TEXT NOT NULL,updated INTEGER NOT NULL,PRIMARY KEY(unit,locale))',
 'CREATE TABLE IF NOT EXISTS jobs(unit TEXT NOT NULL,locale TEXT NOT NULL,kind TEXT NOT NULL,source TEXT NOT NULL,context TEXT NOT NULL,status TEXT NOT NULL,due INTEGER NOT NULL DEFAULT 0,lease INTEGER NOT NULL DEFAULT 0,token TEXT,attempts INTEGER NOT NULL DEFAULT 0,last_error TEXT,PRIMARY KEY(unit,locale))',
 'CREATE INDEX IF NOT EXISTS jobs_due ON jobs(status,due,lease)',
 'CREATE TABLE IF NOT EXISTS publication(locale TEXT NOT NULL,kind TEXT NOT NULL,shard TEXT NOT NULL,generation INTEGER NOT NULL DEFAULT 1,published INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(locale,kind,shard))',
 'CREATE TABLE IF NOT EXISTS budget(period TEXT PRIMARY KEY,calls INTEGER NOT NULL DEFAULT 0,characters INTEGER NOT NULL DEFAULT 0)',
 'CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL)'
];
export class Store{
 constructor(exec,transaction,{languages=LANGUAGES,now=()=>Date.now(),maxSources=25000}={}){
  if(!languages.length||languages.some(x=>!LANGUAGES.includes(x)))throw Error('invalid_languages');
  this.exec=exec;this.transaction=transaction;this.languages=[...new Set(languages)];this.now=now;this.maxSources=maxSources;for(const q of DDL)exec(q);
 }
 rows(q,...p){return Array.from(this.exec(q,...p));}
 one(q,...p){return this.rows(q,...p)[0];}
 setting(k,fallback=null){return this.one('SELECT value FROM settings WHERE key=?',k)?.value??fallback;}
 set(k,v){this.exec('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',k,String(v));}
 dirty(l,k,s){this.exec('INSERT INTO publication(locale,kind,shard) VALUES(?,?,?) ON CONFLICT(locale,kind,shard) DO UPDATE SET generation=generation+1',l,k,s);}
 ingest(prepared){
  if(!Array.isArray(prepared)||prepared.length>128||new Set(prepared.map(r=>r.key)).size!==prepared.length)throw Error('invalid_batch');
  return this.transaction(()=>{
   const existing=this.one('SELECT COUNT(*) n FROM sources').n;
   const fresh=prepared.filter(r=>!this.one('SELECT 1 FROM sources WHERE key=?',r.key)).length;
   if(existing+fresh>this.maxSources)throw Error('source_limit');
   let changed=0,unchanged=0;
   for(const r of prepared){
    const old=this.one('SELECT * FROM sources WHERE key=?',r.key);
    if(old&&old.unit===r.unit&&old.active===r.active){unchanged++;continue;}
    this.exec('INSERT INTO sources(key,kind,id,source,context,unit,shard,active) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET source=excluded.source,context=excluded.context,unit=excluded.unit,active=excluded.active,revision=sources.revision+1',r.key,r.kind,r.id,r.source,r.context,r.unit,r.shard,r.active);
    for(const l of this.languages){
     this.dirty(l,r.kind,r.shard);
     if(!r.active||this.one('SELECT 1 FROM memory WHERE unit=? AND locale=?',r.unit,l))continue;
     this.exec("INSERT INTO jobs(unit,locale,kind,source,context,status) VALUES(?,?,?,?,?,'pending') ON CONFLICT(unit,locale) DO UPDATE SET status=CASE WHEN jobs.status='obsolete' THEN 'pending' ELSE jobs.status END,due=CASE WHEN jobs.status='obsolete' THEN 0 ELSE jobs.due END",r.unit,l,r.kind,r.source,r.context);
    }changed++;
   }return {changed,unchanged};
  });
 }
 seed(unit,locale,text,{reviewed=false,provider='owner-import'}={}){
  if(!this.languages.includes(locale)||typeof reviewed!=='boolean')throw Error('invalid_locale_or_review');
  const s=this.one('SELECT source FROM sources WHERE unit=? LIMIT 1',unit);if(!s)throw Error('unknown_source');text=validateResult(s.source,text);
  return this.transaction(()=>{
   const old=this.one('SELECT reviewed,translation FROM memory WHERE unit=? AND locale=?',unit,locale);
   if(old?.reviewed&&!reviewed)return false;
   if(old&&old.translation===text&&old.reviewed===(reviewed?1:0))return false;
   this.exec('INSERT INTO memory(unit,locale,translation,reviewed,provider,updated) VALUES(?,?,?,?,?,?) ON CONFLICT(unit,locale) DO UPDATE SET translation=excluded.translation,reviewed=excluded.reviewed,provider=excluded.provider,updated=excluded.updated',unit,locale,text,reviewed?1:0,provider,this.now());
   this.exec("UPDATE jobs SET status='done',token=NULL,lease=0,last_error=NULL WHERE unit=? AND locale=?",unit,locale);
   for(const r of this.rows('SELECT DISTINCT kind,shard FROM sources WHERE unit=? AND active=1',unit))this.dirty(locale,r.kind,r.shard);return true;
  });
 }
 claim({dailyCalls=200,dailyCharacters=50000,monthlyCalls=5000,monthlyCharacters=1000000,allowNames=false}={}){
  for(const x of [dailyCalls,dailyCharacters,monthlyCalls,monthlyCharacters])if(!Number.isSafeInteger(x)||x<0)throw Error('invalid_budget');
  const now=this.now(),day=new Date(now).toISOString().slice(0,10);
  return this.transaction(()=>{
   const j=this.one("SELECT * FROM jobs WHERE ((status='pending' AND due<=?) OR (status='running' AND lease<=?)) AND (?=1 OR kind<>'author') ORDER BY due,attempts,unit,locale LIMIT 1",now,now,allowNames?1:0);
   if(!j)return {job:null,reason:'idle'};
   if(!this.one('SELECT 1 FROM sources WHERE unit=? AND active=1 LIMIT 1',j.unit)){this.exec("UPDATE jobs SET status='obsolete',token=NULL,lease=0 WHERE unit=? AND locale=?",j.unit,j.locale);return {job:null,reason:'obsolete'};}
   const chars=[...j.source].length,limits=[['day:'+day,dailyCalls,dailyCharacters],['month:'+day.slice(0,7),monthlyCalls,monthlyCharacters]];
   for(const [p,c,h]of limits){const used=this.one('SELECT * FROM budget WHERE period=?',p)||{calls:0,characters:0};if(used.calls>=c||used.characters+chars>h)return {job:null,reason:'budget'};}
   for(const [p]of limits)this.exec('INSERT INTO budget(period,calls,characters) VALUES(?,1,?) ON CONFLICT(period) DO UPDATE SET calls=calls+1,characters=characters+excluded.characters',p,chars);
   const token=crypto.randomUUID();this.exec("UPDATE jobs SET status='running',lease=?,token=?,attempts=attempts+1 WHERE unit=? AND locale=?",now+120000,token,j.unit,j.locale);
   return {job:{...j,token,attempts:j.attempts+1}};
  });
 }
 complete(j,text,provider='router'){
  text=validateResult(j.source,text);return this.transaction(()=>{
   if(this.one("SELECT token FROM jobs WHERE unit=? AND locale=? AND status='running'",j.unit,j.locale)?.token!==j.token)return false;
   if(!this.one('SELECT 1 FROM memory WHERE unit=? AND locale=?',j.unit,j.locale))this.exec('INSERT INTO memory(unit,locale,translation,reviewed,provider,updated) VALUES(?,?,?,0,?,?)',j.unit,j.locale,text,provider,this.now());
   this.exec("UPDATE jobs SET status='done',token=NULL,lease=0,last_error=NULL WHERE unit=? AND locale=?",j.unit,j.locale);
   for(const r of this.rows('SELECT DISTINCT kind,shard FROM sources WHERE unit=? AND active=1',j.unit))this.dirty(j.locale,r.kind,r.shard);return true;
  });
 }
 fail(j,code,{retryAfter=60000,permanent=false}={}){this.exec("UPDATE jobs SET status=?,due=?,lease=0,token=NULL,last_error=? WHERE unit=? AND locale=? AND token=?",permanent?'blocked':'pending',this.now()+Math.max(60000,Math.min(86400000,retryAfter)),String(code).slice(0,100),j.unit,j.locale,j.token);}
 pendingPublications(limit=20){return this.rows('SELECT * FROM publication WHERE published<generation ORDER BY locale,kind,shard LIMIT ?',limit);}
 publicationRows(l,k,s){return this.rows('SELECT s.id,s.source,m.translation,m.reviewed FROM sources s JOIN memory m ON m.unit=s.unit AND m.locale=? WHERE s.kind=? AND s.shard=? AND s.active=1 ORDER BY s.id',l,k,s);}
 published(p){this.exec('UPDATE publication SET published=? WHERE locale=? AND kind=? AND shard=? AND generation=?',p.generation,p.locale,p.kind,p.shard,p.generation);}
 status(){return {contract:CONTRACT,enabled:this.setting('enabled','false')==='true',sources:this.rows('SELECT kind,active,COUNT(*) count FROM sources GROUP BY kind,active'),jobs:this.rows('SELECT kind,status,COUNT(*) count FROM jobs GROUP BY kind,status'),memory:this.rows('SELECT locale,reviewed,COUNT(*) count FROM memory GROUP BY locale,reviewed'),unpublished:this.one('SELECT COUNT(*) count FROM publication WHERE published<generation').count,budget:this.rows('SELECT * FROM budget ORDER BY period DESC LIMIT 4')};}
}
