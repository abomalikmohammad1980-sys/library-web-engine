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
export function pageMetaFor(path:string,record?:PublicSeoRecord):PageMeta{
 const canonicalPath=path.split(/[?#]/)[0]||'/'
 if(new URLSearchParams(path.split('?')[1]??'').has('create'))return{title:'إضافة مؤلف | الخِزانة',description:'إدارة بيانات مؤلف في الخِزانة.',robots:'noindex, follow'}
 const fixed=PUBLIC_PAGE_META[canonicalPath]
 if(fixed)return{title:fixed[0],description:fixed[1],canonicalPath,robots:'index, follow'}
 if(record?.name&&/^\/authors\//.test(canonicalPath))return{title:`${record.name}: سيرته وكتبه | الخِزانة`,description:plainSeoText(record.biography||`${record.name}${record.deathYearHijri?` (ت ${record.deathYearHijri} هـ)`:''}؛ سيرته وكتبه المتاحة في مكتبة الخِزانة.`).slice(0,220),canonicalPath,robots:'index, follow'}
 if(record?.title&&record.author&&/^\/books\//.test(canonicalPath))return{title:`${record.title} — ${record.author} | الخِزانة`,description:plainSeoText(`${record.title}، تأليف ${record.author}${record.deathYearHijri?` (ت ${record.deathYearHijri} هـ)`:''}${record.category?`، من كتب ${record.category}`:''}. اقرأ الكتاب وفهرس محتوياته في الخِزانة.`).slice(0,240),canonicalPath,robots:'index, follow'}
 return{title:'الخِزانة',description:'مكتبة الخِزانة للبحث والقراءة.',robots:'noindex, follow'}
}
export function seoShard(id:string):string{
 if(!/^\d{1,12}$/.test(id))throw Error('seo_id_invalid')
 return String(Number(id)%SEO_SHARD_COUNT).padStart(2,'0')
}
