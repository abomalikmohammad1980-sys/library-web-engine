export const SEO_ORIGIN='https://khzanah.com'
// Eight bounded shards per kind leave room below Pages' file-count limit.
export const SEO_SHARD_COUNT=8
export const PUBLIC_PAGE_META:Readonly<Record<string,readonly [string,string]>>={
 '/':['الخزانة: المكتبة الإسلامية الذكية','الخزانة مكتبة إسلامية ذكية لقراءة الكتب والبحث في المتون والعناوين وفهارس المحتويات، وتصفح القرآن الكريم والتفاسير والسنة النبوية وتراجم المؤلفين.'],
 '/features':['ميزات الخِزانة | مكتبة إسلامية للبحث والقراءة','تعرّف على البحث في الكتب والقراءة وتنظيم المكتبة الشخصية وأدوات القرآن والسنة في الخِزانة.'],
 '/quran':['القرآن الكريم والبحث في الآيات | الخِزانة','اقرأ القرآن الكريم وابحث في آياته وانتقل بين السور والتفاسير المرتبطة بالآيات في الخِزانة.'],
 '/sunnah':['السنة النبوية والبحث في الأحاديث | الخِزانة','ابحث في نصوص الأحاديث وكتب السنة، واقرأ النتائج مع مصادرها ومواضعها في مكتبة الخِزانة.'],
 '/authors':['مؤلفو المكتبة الإسلامية | الخِزانة','تصفح مؤلفي المكتبة الإسلامية وتراجمهم وكتبهم والروابط بين المؤلفين ومصنفاتهم.'],
 '/browse':['تصفح كتب المكتبة الإسلامية | الخِزانة','استكشف كتب الخِزانة بحسب أقسامها الموضوعية وانتقل إلى الكتب ومؤلفيها.'],
 '/new-books':['جديد الكتب | الخِزانة','تصفح الكتب المضافة إلى الخِزانة، وتعرّف على عناوينها ومؤلفيها وأقسامها.'],
 '/categories':['أقسام المكتبة الإسلامية | الخِزانة','تصفح أقسام الكتب العامة في الخِزانة وانتقل إلى كتب كل قسم.'],
}
export interface PublicSeoRecord{id:string;name?:string;title?:string;author?:string;authorId?:string;category?:string;deathYearHijri?:number;biography?:string;books?:Array<{id:string;title:string}>}
export interface PageMeta{title:string;description:string;canonicalPath?:string;robots?:string}
/** Only public canonical reader routes may acquire indexable cached metadata. */
export function loadedReaderPageMeta(path:string,title:string,author:string):PageMeta|undefined{
 const pathname=path.split(/[?#]/)[0]||'/'
 if(!/^\/books\/(?:\d{1,12}|public\/[A-Za-z0-9_-]{1,200})$/.test(pathname)||!title.trim()||!author.trim())return undefined
 return pageMetaFor(path,{id:pathname.split('/').at(-1)!,title,author})
}
export const plainSeoText=(value:string)=>value.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()
/** Keep complete words; never splice an Arabic word to satisfy the snippet budget. */
export function truncateSeoDescription(value:string,maxLength=155):string{
 const text=plainSeoText(value)
 if(text.length<=maxLength)return text
 const boundary=text.lastIndexOf(' ',maxLength)
 return boundary<0?'':text.slice(0,boundary).trimEnd()
}
export function buildBookDescription(record:PublicSeoRecord):string{
 const title=plainSeoText(record.title??'')
 const author=plainSeoText(record.author??'')
 const category=plainSeoText(record.category??'')
 const year=record.deathYearHijri
 const death=typeof year==='number'&&Number.isInteger(year)&&year>0?` (ت ${year} هـ)`:''
 return truncateSeoDescription(`${title} — المؤلف: ${author}${death}.${category?` القسم: ${category}.`:''} اقرأ الكتاب كاملًا وتصفح فهرس محتوياته في الخِزانة.`)
}
const PUBLIC_PAGE_HEADINGS:Readonly<Record<string,string>>={
 '/':'الخزانة', '/features':'ميزات الخِزانة', '/quran':'القرآن الكريم',
 '/sunnah':'السنة النبوية', '/authors':'المؤلفون', '/browse':'تصفح الكتب', '/new-books':'جديد الكتب', '/categories':'أقسام المكتبة',
}
/** Static headings are independent of the longer search-result title. */
export function publicPageHeading(path:string):string|undefined{
 return PUBLIC_PAGE_HEADINGS[path.split(/[?#]/)[0]||'/']
}
/** Shape validation only; caller must verify that the public category exists. */
export function categorySeoName(path:string):string|undefined{
 const match=/^\/categories\/([^/]+)$/.exec(path.split(/[?#]/)[0]??'')
 if(!match)return undefined
 try{const name=decodeURIComponent(match[1]!).trim();return name&&name.length<=500&&!/[\/\\\u0000-\u001f\u007f]/.test(name)?name:undefined}catch{return undefined}
}
/** Only real public listing routes retain their page state in canonicals.
 * Reader positions, search queries and unrelated filters never become canonical. */
export function publicPaginationCanonicalPath(path:string):string{
 const pathname=path.split(/[?#]/)[0]||'/'
 if(!/^\/(?:authors(?:\/\d{6,12})?|browse|new-books|categories(?:\/[^/?#]+)?)$/.test(pathname))return pathname
 const query=path.split('#')[0]!.split('?')[1]??'',values=new URLSearchParams(query).getAll('page')
 if(values.length!==1||!/^\d+$/.test(values[0]!))return pathname
 const page=Number(values[0])
 return Number.isSafeInteger(page)&&page>1&&page<=1000000?`${pathname}?page=${page}`:pathname
}
export function pageMetaFor(path:string,record?:PublicSeoRecord):PageMeta{
 const pathname=path.split(/[?#]/)[0]||'/',canonicalPath=publicPaginationCanonicalPath(path)
 if(new URLSearchParams(path.split('?')[1]??'').has('create'))return{title:'إضافة مؤلف | الخِزانة',description:'إدارة بيانات مؤلف في الخِزانة.',robots:'noindex, follow'}
 const fixed=PUBLIC_PAGE_META[pathname]
 if(fixed)return{title:fixed[0],description:fixed[1],canonicalPath,robots:'index, follow'}
 if(record?.category&&categorySeoName(pathname))return{title:`${plainSeoText(record.category)} | الخِزانة`,description:truncateSeoDescription(`تصفح الكتب العامة في قسم ${plainSeoText(record.category)} واقرأها في الخِزانة.`),canonicalPath,robots:'index, follow'}
 if(record?.name&&/^\/authors\//.test(canonicalPath))return{title:`${record.name}: سيرته وكتبه | الخِزانة`,description:plainSeoText(record.biography||`${record.name}${record.deathYearHijri?` (ت ${record.deathYearHijri} هـ)`:''}؛ سيرته وكتبه المتاحة في مكتبة الخِزانة.`).slice(0,220),canonicalPath,robots:'index, follow'}
 if(record?.title&&record.author&&/^\/books\//.test(canonicalPath))return{title:`${record.title} — ${record.author} | الخِزانة`,description:buildBookDescription(record),canonicalPath,robots:'index, follow'}
 return{title:'الخِزانة',description:'مكتبة الخِزانة للبحث والقراءة.',robots:'noindex, follow'}
}
export function seoShard(id:string):string{
 if(!/^\d{1,12}$/.test(id))throw Error('seo_id_invalid')
 return String(Number(id)%SEO_SHARD_COUNT).padStart(2,'0')
}
