/** AST extraction, no application evaluation and no machine-translation call. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {prepareSource,LANGUAGES,normalize,sha256} from '../../deployment/localization-worker/core.mjs';
export function extract(ts,text,file){
 const ast=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true),labels=[],notes=[],seeds=[];
 const literal=n=>n&&(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n))?n.text:null;
 const key=n=>n.name?.getText(ast).replace(/^['"]|['"]$/g,'');
 const get=(o,k)=>o?.properties?.find(p=>ts.isPropertyAssignment(p)&&key(p)===k)?.initializer;
 const add=(n,s)=>{if(s&&/[\u0600-\u06ff]/.test(s))labels.push({source:normalize(s),file,line:ast.getLineAndCharacterOfPosition(n.getStart(ast)).line+1});};
 function protectedNode(n){for(let a=n;a;a=a.parent)if(ts.isCallExpression(a)&&a.expression.getText(ast)==='h'){const p=a.arguments[1];if(!p||!ts.isObjectLiteralExpression(p))continue;if(p.properties.some(v=>key(v)==='data-no-translate'))return true;const data=get(p,'dataset');if(data&&ts.isObjectLiteralExpression(data)&&data.properties.some(v=>key(v)==='noTranslate'))return true;if(/reading__page-slot|reader__pdf-viewport/.test(literal(get(p,'class'))||''))return true;}return false;}
 function visit(n){
  if(protectedNode(n))return;
  if(ts.isCallExpression(n)){
   const name=n.expression.getText(ast),args=name==='h'?n.arguments.slice(2):['toast','alert','confirm','setSourceDocumentTitle','uiLabelParameter'].includes(name)?n.arguments.slice(0,1):[];
   for(const x of args){const s=literal(x);if(s!==null)add(x,s);else if(ts.isTemplateExpression(x)&&/[\u0600-\u06ff]/.test(x.getText(ast)))notes.push({file,line:ast.getLineAndCharacterOfPosition(x.getStart(ast)).line+1,reason:'dynamic_template_requires_registration'});}
   if(name==='h'&&n.arguments[1]&&ts.isObjectLiteralExpression(n.arguments[1]))for(const p of n.arguments[1].properties)if(['title','placeholder','aria-label','alt','data-tooltip','data-ui-busy-label'].includes(key(p)))add(p,literal(p.initializer));
  }
  if(ts.isPropertyAssignment(n)&&file.includes('/i18n/')){
   const k=key(n);
   if(k==='source'&&literal(n.initializer)){const source=literal(n.initializer);add(n,source);const tr=get(n.parent,'translations');if(tr&&ts.isObjectLiteralExpression(tr))for(const p of tr.properties)if(LANGUAGES.includes(key(p))&&literal(p.initializer))seeds.push({source,locale:key(p),translation:literal(p.initializer),reviewed:file.includes('.reviewed')});}
   if(k&&/[\u0600-\u06ff]/.test(k)&&literal(n.initializer)!==null){add(n,k);const l=/(?:^|\/)([a-z]{2,3})[._-]/.exec(file)?.[1];if(LANGUAGES.includes(l))seeds.push({source:k,locale:l,translation:literal(n.initializer),reviewed:file.includes('.reviewed')});}
  }
  ts.forEachChild(n,visit);
 }
 visit(ast);return {labels,notes,seeds};
}
export async function collect(root){
 root=path.resolve(root);const require=createRequire(path.join(root,'app/package.json')),ts=require('typescript');
 const sources=new Map(),translations=new Map(),notes=[],provenance=[];
 const ui=async s=>({kind:'ui',id:'label:'+await sha256(normalize(s)),source:s,public:true});
 async function add(r){const p=await prepareSource(r),old=sources.get(p.key);if(old&&normalize(old.source)!==p.source)throw Error('conflicting_source_identity:'+p.key);sources.set(p.key,{...r,source:p.source});return p;}
 async function seed(r,l,text,reviewed){const p=await add(r),k=p.unit+':'+l,old=translations.get(k);if(old&&old.translation!==text){translations.set(k,{conflict:true});return;}translations.set(k,{unit:p.unit,locale:l,translation:text,reviewed});}
 async function walk(folder){for(const e of await fs.readdir(folder,{withFileTypes:true})){if(e.name.startsWith('.')||e.name==='node_modules')continue;const full=path.join(folder,e.name);if(e.isDirectory()){await walk(full);continue;}if(!e.isFile())continue;const rel=path.relative(root,full).split(path.sep).join('/');if(rel.endsWith('.vue')){notes.push({file:rel,reason:'vue_needs_template_adapter'});continue;}if(!/\.tsx?$/.test(rel)||/\.test\./.test(rel))continue;const x=extract(ts,await fs.readFile(full,'utf8'),rel);notes.push(...x.notes);for(const r of x.labels){await add(await ui(r.source));provenance.push(r);}for(const r of x.seeds)await seed(await ui(r.source),r.locale,r.translation,r.reviewed);}}
 await walk(path.join(root,'app/src'));
 for(const [kind,file]of [['book','en-book-titles.reviewed.json'],['author','en-author-names.reviewed.json']]){
  try{const p=JSON.parse(await fs.readFile(path.join(root,'app/src/i18n',file),'utf8'));if(!Array.isArray(p.rows))throw Error('invalid_reviewed_catalog');for(const r of p.rows){if(!Array.isArray(r)||r.length!==3||r.some(v=>typeof v!=='string'))throw Error('invalid_reviewed_row');await seed({kind,id:r[0],source:r[1],public:true},'en',r[2],true);}}
  catch(e){if(e.code!=='ENOENT')throw e;notes.push({file,reason:'no_reviewed_file'});}
 }
 const seeds=[...translations.values()].filter(x=>!x.conflict);for(const [key,r]of translations)if(r.conflict)notes.push({key,reason:'conflicting_seed_excluded'});
 return {contract:'khzanah-source-manifest/1',languages:LANGUAGES,rows:[...sources.values()].sort((a,b)=>(a.kind+a.id).localeCompare(b.kind+b.id)),seeds:seeds.sort((a,b)=>(a.unit+a.locale).localeCompare(b.unit+b.locale)),coverage:{notes,provenance}};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=path.resolve(process.argv[2]||'.'),out=path.join(root,'.localization');const x=await collect(root);await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'sources.json'),JSON.stringify({...x,coverage:undefined}));await fs.writeFile(path.join(out,'coverage.json'),JSON.stringify(x.coverage,null,2));console.log(`Sources: ${x.rows.length}; saved translations: ${x.seeds.length}; coverage notes: ${x.coverage.notes.length}`);if(process.argv.includes('--strict')&&x.coverage.notes.length)process.exitCode=2;
}
