/** Applies minimal hooks to a working copy; never deploys, pushes or edits a database. */
import fs from 'node:fs/promises';import path from 'node:path';
const root=path.resolve(process.argv[2]||'.');
if(!process.argv.includes('--apply'))throw Error('Use --apply in your isolated localization working copy.');
const updates=[];
function once(raw,anchor,replacement,file){if(raw.split(anchor).length!==2)throw Error('Source changed; review '+file+' before applying');return raw.replace(anchor,replacement);}
async function change(file,fn){const full=path.join(root,file),before=await fs.readFile(full,'utf8'),after=fn(before);if(before!==after)updates.push({file,full,before,after});}
await change('app/src/ui_dictionary_loader.ts',s=>{
 if(s.includes("from './persistent_locales'"))return s;
 s="import { permanentUiLabel } from './persistent_locales'\n"+s;
 s=once(s,'return dictionary?.translateUiLabel(source, language)','return dictionary?.translateUiLabel(source, language) ?? permanentUiLabel(source, language)','ui_dictionary_loader.ts');
 s=once(s,'try { return (await this.ready()).translateUiLabel(source, language) ?? source }','try { await this.ready(); return this.translate(source, language) ?? source }','ui_dictionary_loader.ts');return s;
});
await change('app/src/book_locale_display.ts',s=>{
 if(s.includes("from './persistent_locales'"))return s;
 s="import { permanentCatalogLabel } from './persistent_locales'\n"+s;
 s=once(s,"if (locale.toLowerCase().split('-')[0] !== 'en') return canonicalTitle","if (locale.toLowerCase().split('-')[0] !== 'en') return permanentCatalogLabel('book', id, canonicalTitle, locale) ?? canonicalTitle",'book_locale_display.ts');
 return once(s,'return row?.source === canonicalTitle ? row.display : canonicalTitle',"return row?.source === canonicalTitle ? row.display : permanentCatalogLabel('book', id, canonicalTitle, locale) ?? canonicalTitle",'book_locale_display.ts');
});
await change('app/src/author_locale_display.ts',s=>{
 if(s.includes("from './persistent_locales'"))return s;
 s="import { permanentCatalogLabel } from './persistent_locales'\n"+s;
 s=once(s,"if (locale.toLowerCase().split('-')[0] !== 'en') return canonicalName","if (locale.toLowerCase().split('-')[0] !== 'en') return permanentCatalogLabel('author', identity(authorIdentity), canonicalName, locale) ?? canonicalName",'author_locale_display.ts');
 return once(s,'return row?.source === canonicalName ? row.display : canonicalName',"return row?.source === canonicalName ? row.display : permanentCatalogLabel('author', identity(authorIdentity), canonicalName, locale) ?? canonicalName",'author_locale_display.ts');
});
await change('app/package.json',s=>{const p=JSON.parse(s);if(!p.scripts?.build)throw Error('Missing app build');if(p.scripts.build.includes('tools/localization/collect.mjs'))return s;p.scripts.build='node ../tools/localization/collect.mjs .. && '+p.scripts.build;return JSON.stringify(p,null,2)+'\n';});
// Opt-in marker is separate: activate only after /api/localization/* serves the new worker.
if(process.argv.includes('--enable-client'))await change('app/index.html',s=>s.includes('name="khzanah-localization"')?s:once(s,'</head>','<meta name="khzanah-localization" content="v1">\n</head>','index.html'));
const backup=path.join(root,'.localization','backups',new Date().toISOString().replace(/[:.]/g,'-'));
for(const u of updates){const b=path.join(backup,u.file);await fs.mkdir(path.dirname(b),{recursive:true});await fs.writeFile(b,u.before);}
for(const u of updates){await fs.writeFile(u.full,u.after);console.log('PATCHED '+u.file);}
console.log('Local hooks installed. Original copies: '+backup+'; no network or production writes.');
