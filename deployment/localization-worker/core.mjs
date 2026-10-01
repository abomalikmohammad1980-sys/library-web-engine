/** Durable localization queue. No provider calls are made by reads. */
export const CONTRACT = 'khzanah-localization/1';
export const LANGUAGES = Object.freeze(['en','fr','ug','ckb','ku','tr','ur','fa','sw','hi','hu','id','ms','bn','ps','so','ha','ru','uk','de','es','pt','it','nl','sv','no','pl','ro','bs','sq','az','uz','kk','zh','ja','ko']);
export const KINDS = Object.freeze(['ui','book','author']);
export const normalize = value => String(value).normalize('NFC').replace(/\s+/gu, ' ').trim();
export const sha256 = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(v=>v.toString(16).padStart(2,'0')).join('');
export function placeholders(text) { return (text.match(/\{(?:p\d+|[A-Za-z_][\w.]*)\}|%\d*\$?[sdf]/g) || []).sort(); }
export function validateResult(source, value) {
  if (typeof value !== 'string' || !value.trim()) throw Error('empty_translation');
  if (value.length > 16000 || value.includes('\ufffd')) throw Error('invalid_translation');
  if (JSON.stringify(placeholders(source)) !== JSON.stringify(placeholders(value))) throw Error('placeholder_mismatch');
  if (/<\/?(?:script|iframe|object|style)\b/i.test(value)) throw Error('unexpected_markup');
  // A completeness signal, NOT a proof of semantic accuracy.
  const ratio = [...value.trim()].length / Math.max(1,[...source].length);
  if ([...source].length > 100 && (ratio < .12 || ratio > 8)) throw Error('suspicious_length');
  return value.trim();
}
export async function prepareSource(row) {
  if (!row || !KINDS.includes(row.kind) || typeof row.id !== 'string' || !row.id || row.id.length > 240 || /[\u0000-\u001f]/.test(row.id)) throw Error('invalid_identity');
  if (typeof row.source !== 'string') throw Error('invalid_source');
  const source=normalize(row.source), context=normalize(row.context || '');
  if (!source || [...source].length > 3000 || context.length > 240) throw Error('invalid_source_length');
  if (row.public !== true) throw Error('public_source_required');
  const unit=await sha256(JSON.stringify([CONTRACT,row.kind,context,source]));
  const idHash=await sha256(row.id);
  return { kind:row.kind,id:row.id,key:row.kind+':'+row.id,source,context,unit,shard:row.kind==='ui'?'0':idHash[0],active:row.active===false?0:1 };
}
const schema = [
  `CREATE TABLE IF NOT EXISTS sources (key TEXT PRIMARY KEY,kind TEXT NOT NULL,id TEXT NOT NULL,source TEXT NOT NULL,context TEXT NOT NULL,unit TEXT NOT NULL,shard TEXT NOT NULL,active INTEGER NOT NULL,revision INTEGER NOT NULL DEFAULT 1)`,
  `CREATE INDEX IF NOT EXISTS sources_unit ON sources(unit,active)`,
  `CREATE INDEX IF NOT EXISTS sources_shard ON sources(kind,shard,active)`,
  `CREATE TABLE IF NOT EXISTS memory (unit TEXT NOT NULL,locale TEXT NOT NULL,translation TEXT NOT NULL,reviewed INTEGER NOT NULL DEFAULT 0,provider TEXT NOT NULL,updated INTEGER NOT NULL,PRIMARY KEY(unit,locale))`,
  `CREATE TABLE IF NOT EXISTS jobs (unit TEXT NOT NULL,locale TEXT NOT NULL,kind TEXT NOT NULL,source TEXT NOT NULL,context TEXT NOT NULL,status TEXT NOT NULL,due INTEGER NOT NULL DEFAULT 0,lease INTEGER NOT NULL DEFAULT 0,token TEXT,attempts INTEGER NOT NULL DEFAULT 0,last_error TEXT,PRIMARY KEY(unit,locale))`,
  `CREATE INDEX IF NOT EXISTS jobs_due ON jobs(status,due,lease)`,
  `CREATE TABLE IF NOT EXISTS publication (locale TEXT NOT NULL,kind TEXT NOT NULL,shard TEXT NOT NULL,generation INTEGER NOT NULL DEFAULT 1,published INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(locale,kind,shard))`,
  `CREATE TABLE IF NOT EXISTS budget (period TEXT PRIMARY KEY,calls INTEGER NOT NULL DEFAULT 0,characters INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY,value TEXT NOT NULL)`
];
/** exec(query,...params) -> iterable rows; transaction(fn) must be synchronous. */
export class Store {
  constructor(exec,transaction,{languages=LANGUAGES,now=()=>Date.now()}={}) {
    if(!languages.length||languages.some(x=>!LANGUAGES.includes(x)))throw Error('invalid_languages');
    this.exec=exec;this.transaction=transaction;this.languages=[...new Set(languages)];this.now=now;
    for(const s of schema)this.exec(s);
  }
  rows(sql,...p){return Array.from(this.exec(sql,...p));}
  one(sql,...p){return this.rows(sql,...p)[0];}
  setting(key,fallback=null){return this.one('SELECT value FROM settings WHERE key=?',key)?.value??fallback;}
  set(key,value){this.exec('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',key,String(value));}
  dirty(locale,kind,shard){this.exec('INSERT INTO publication(locale,kind,shard) VALUES(?,?,?) ON CONFLICT(locale,kind,shard) DO UPDATE SET generation=generation+1',locale,kind,shard);}
  ingest(prepared) {
    return this.transaction(()=>{
      let changed=0,unchanged=0;
      for(const r of prepared) {
        const old=this.one('SELECT * FROM sources WHERE key=?',r.key);
        if(old && old.unit===r.unit && old.active===r.active){unchanged++;continue;}
        this.exec(`INSERT INTO sources(key,kind,id,source,context,unit,shard,active) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET source=excluded.source,context=excluded.context,unit=excluded.unit,active=excluded.active,revision=sources.revision+1`,r.key,r.kind,r.id,r.source,r.context,r.unit,r.shard,r.active);
        for(const locale of this.languages) {
          this.dirty(locale,r.kind,r.shard);
          if(!r.active||this.one('SELECT 1 FROM memory WHERE unit=? AND locale=?',r.unit,locale))continue;
          this.exec(`INSERT INTO jobs(unit,locale,kind,source,context,status) VALUES(?,?,?,?,?,'pending') ON CONFLICT(unit,locale) DO UPDATE SET status=CASE WHEN jobs.status='obsolete' THEN 'pending' ELSE jobs.status END,due=CASE WHEN jobs.status='obsolete' THEN 0 ELSE jobs.due END`,r.unit,locale,r.kind,r.source,r.context);
        }
        changed++;
      }
      return {changed,unchanged};
    });
  }
  seed(unit,locale,translation,{reviewed=false,provider='seed'}={}) {
    if(!this.languages.includes(locale))throw Error('invalid_locale');
    const source=this.one('SELECT source FROM sources WHERE unit=? LIMIT 1',unit);
    if(!source)throw Error('unknown_source');
    translation=validateResult(source.source,translation);
    return this.transaction(()=>{
      const existing=this.one('SELECT reviewed,translation FROM memory WHERE unit=? AND locale=?',unit,locale);
      if(existing?.reviewed && !reviewed)return false;
      if(existing && existing.translation===translation && existing.reviewed===(reviewed?1:0))return false;
      this.exec(`INSERT INTO memory(unit,locale,translation,reviewed,provider,updated) VALUES(?,?,?,?,?,?) ON CONFLICT(unit,locale) DO UPDATE SET translation=excluded.translation,reviewed=excluded.reviewed,provider=excluded.provider,updated=excluded.updated`,unit,locale,translation,reviewed?1:0,provider,this.now());
      this.exec("UPDATE jobs SET status='done',token=NULL,lease=0,last_error=NULL WHERE unit=? AND locale=?",unit,locale);
      for(const r of this.rows('SELECT DISTINCT kind,shard FROM sources WHERE unit=? AND active=1',unit))this.dirty(locale,r.kind,r.shard);
      return true;
    });
  }
  claim({dailyCalls=200,dailyCharacters=50000,monthlyCalls=5000,monthlyCharacters=1000000,authorMode='reviewed-only'}={}) {
    const now=this.now(), day=new Date(now).toISOString().slice(0,10),month=day.slice(0,7);
    return this.transaction(()=>{
      const job=this.one(`SELECT * FROM jobs WHERE ((status='pending' AND due<=?) OR (status='running' AND lease<=?)) AND (?='router-unreviewed' OR kind<>'author') ORDER BY CASE kind WHEN 'ui' THEN 0 WHEN 'author' THEN 1 ELSE 2 END,due,unit,locale LIMIT 1`,now,now,authorMode);
      if(!job)return {job:null,reason:'idle'};
      if(!this.one('SELECT 1 FROM sources WHERE unit=? AND active=1 LIMIT 1',job.unit)){
        this.exec("UPDATE jobs SET status='obsolete',token=NULL,lease=0 WHERE unit=? AND locale=?",job.unit,job.locale);
        return {job:null,reason:'obsolete'};
      }
      const chars=[...job.source].length;
      const limits=[['day:'+day,dailyCalls,dailyCharacters],['month:'+month,monthlyCalls,monthlyCharacters]];
      for(const [p,c,h]of limits){const used=this.one('SELECT * FROM budget WHERE period=?',p)||{calls:0,characters:0};if(used.calls>=c||used.characters+chars>h)return {job:null,reason:'budget',period:p};}
      for(const [p]of limits)this.exec('INSERT INTO budget(period,calls,characters) VALUES(?,1,?) ON CONFLICT(period) DO UPDATE SET calls=calls+1,characters=characters+excluded.characters',p,chars);
      const token=crypto.randomUUID();
      this.exec("UPDATE jobs SET status='running',lease=?,token=?,attempts=attempts+1 WHERE unit=? AND locale=?",now+120000,token,job.unit,job.locale);
      return {job:{...job,token,attempts:job.attempts+1}};
    });
  }
  complete(job,translation,provider='router') {
    translation=validateResult(job.source,translation);
    return this.transaction(()=>{
      const lease=this.one("SELECT token FROM jobs WHERE unit=? AND locale=? AND status='running'",job.unit,job.locale);
      if(lease?.token!==job.token)return false;
      // Cached memory is versioned by source; an old result never becomes a new title.
      if(!this.one('SELECT 1 FROM memory WHERE unit=? AND locale=?',job.unit,job.locale))
        this.exec('INSERT INTO memory(unit,locale,translation,reviewed,provider,updated) VALUES(?,?,?,0,?,?)',job.unit,job.locale,translation,provider,this.now());
      this.exec("UPDATE jobs SET status='done',token=NULL,lease=0,last_error=NULL WHERE unit=? AND locale=?",job.unit,job.locale);
      for(const r of this.rows('SELECT DISTINCT kind,shard FROM sources WHERE unit=? AND active=1',job.unit))this.dirty(job.locale,r.kind,r.shard);
      return true;
    });
  }
  fail(job,code,{retryAfter=60000,permanent=false}={}){
    this.exec("UPDATE jobs SET status=?,due=?,lease=0,token=NULL,last_error=? WHERE unit=? AND locale=? AND token=?",permanent?'blocked':'pending',this.now()+Math.max(60000,Math.min(86400000,retryAfter)),String(code).slice(0,100),job.unit,job.locale,job.token);
  }
  retryBlocked(){this.exec("UPDATE jobs SET status='pending',due=0,attempts=0 WHERE status='blocked'");}
  publicationRows(locale,kind,shard){return this.rows(`SELECT s.id,s.source,m.translation,m.reviewed FROM sources s JOIN memory m ON m.unit=s.unit AND m.locale=? WHERE s.kind=? AND s.shard=? AND s.active=1 ORDER BY s.id`,locale,kind,shard);}
  pendingPublications(limit=20){return this.rows('SELECT * FROM publication WHERE published<generation ORDER BY locale,kind,shard LIMIT ?',limit);}
  published(p){this.exec('UPDATE publication SET published=? WHERE locale=? AND kind=? AND shard=? AND generation=?',p.generation,p.locale,p.kind,p.shard,p.generation);}
  status(){return {contract:CONTRACT,enabled:this.setting('enabled','false')==='true',sources:this.rows('SELECT kind,active,COUNT(*) AS count FROM sources GROUP BY kind,active'),jobs:this.rows('SELECT kind,status,COUNT(*) AS count FROM jobs GROUP BY kind,status'),memory:this.rows('SELECT locale,reviewed,COUNT(*) AS count FROM memory GROUP BY locale,reviewed'),unpublished:this.one('SELECT COUNT(*) AS count FROM publication WHERE published<generation').count,budget:this.rows('SELECT * FROM budget ORDER BY period DESC LIMIT 4'),scan:this.setting('last_scan'),scanError:this.setting('scan_error')};}
}
