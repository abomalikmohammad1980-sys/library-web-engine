import {SOURCE_EDITION_TAFSIRS, type SourceEditionTafsirDefinition} from './quran_source_editions'
export interface LinkedTafsirDefinition {
  name: string
  author: string
  bookId: number
  slug: string
  /** The one canonical identity shared by the tafsir panel, published library, and reader. */
  workId: `tafsir-${string}`
  category: 'التفسير'
  /** هوية فهرس المؤلفين المحلي حين تكون متاحة بيقين. */
  authorId?: string
}

export interface PendingTafsirDefinition { name: string }
export interface IndexedVerseBookDefinition {name:string;kind:'indexed-verse-book';slug:'istiab';readerId:'410014582'}
export const ISTIAB_READY:IndexedVerseBookDefinition={name:'الاستيعاب في بيان الأسباب',kind:'indexed-verse-book',slug:'istiab',readerId:'410014582'}
export function isIndexedVerseBook(value:unknown):value is IndexedVerseBookDefinition{return !!value&&typeof value==='object'&&'kind'in value&&value.kind==='indexed-verse-book'&&'slug'in value&&value.slug==='istiab'}
export interface ReadyBokDefinition {name:string;slug:'jalalayn'|'mujahid';readerId:'410012876'|'410012810';deathYearHijri:number;chronologyPolicy:string}
export const JALALAYN_READY:ReadyBokDefinition={name:'تفسير الجلالين',slug:'jalalayn',readerId:'410012876',deathYearHijri:911,chronologyPolicy:'ترتيب العمل المشترك بوفاة آخر مؤلفيه: المحلي864 والسيوطي911؛ فهرس المؤلفين المحلي للكتاب12876'}
export const MUJAHID_READY:ReadyBokDefinition={name:'تفسير مجاهد',slug:'mujahid',readerId:'410012810',deathYearHijri:104,chronologyPolicy:'مجاهد بن جبر ت104؛ فهرس المؤلف124 المرتبط بالمصدر المحلي12810'}
export function isReadyBokTafsir(value:unknown):value is ReadyBokDefinition{return !!value&&typeof value==='object'&&'readerId'in value&&'slug'in value&&((value.readerId==='410012876'&&value.slug==='jalalayn')||(value.readerId==='410012810'&&value.slug==='mujahid'))}

export type TafsirDefinition = LinkedTafsirDefinition | PendingTafsirDefinition | SourceEditionTafsirDefinition

export interface TafsirAuthorChronology {
  deathYearHijri?: number
  contemporaryInstitution?: true
  contemporaryCollective?: true
  contemporaryAuthor?: true
  evidence: string
}

/**
 * سجل زمني مركزي لأصحاب التفاسير المفعلة. لا تُستنتج السنوات من العناوين،
 * وتبقى المؤسسة المعاصرة معلّمة بوضوح بدل اختلاق سنة وفاة لها.
 */
export const TAFSIR_AUTHOR_CHRONOLOGY: Readonly<Record<LinkedTafsirDefinition['slug'], TafsirAuthorChronology>> = {
  mawardi:{deathYearHijri:450,evidence:'بيانات مؤلف المصدر المحلي8346؛ إصدار التفاسير المنشور25'},
  'ibn-arabi-ahkam':{deathYearHijri:543,evidence:'بيانات مؤلف المصدر المحلي1464؛ إصدار التفاسير المنشور25'},
  'durr-masun':{deathYearHijri:756,evidence:'بيانات مؤلف المصدر المحلي9057؛ إصدار التفاسير المنشور25'},
  'nazm-durar':{deathYearHijri:885,evidence:'بيانات مؤلف المصدر المحلي9098؛ إصدار التفاسير المنشور25'},
  'abu-saud':{deathYearHijri:982,evidence:'بيانات مؤلف المصدر المحلي1429؛ إصدار التفاسير المنشور25'},
  tarifi:{contemporaryAuthor:true,evidence:'بيانات مؤلف المصدر المحلي151179؛ إصدار التفاسير المنشور25'},
  tabari: { deathYearHijri: 310, evidence: 'ترجمة محمد بن جرير الطبري في فهرس المؤلفين المحلي' },
  baghawi: { deathYearHijri: 516, evidence: 'ترجمة الحسين بن مسعود البغوي في فهرس المؤلفين المحلي' },
  'ibn-kathir': { deathYearHijri: 774, evidence: 'ترجمة إسماعيل بن عمر ابن كثير في فهرس المؤلفين المحلي' },
  saadi: { deathYearHijri: 1376, evidence: 'ترجمة عبد الرحمن بن ناصر السعدي في فهرس المؤلفين المحلي' },
  'adwa-al-bayan': { deathYearHijri: 1393, evidence: 'ترجمة محمد الأمين الشنقيطي في فهرس المؤلفين المحلي' },
  'fi-zilal': { deathYearHijri: 1385, evidence: 'بيانات المؤلف الصريحة في مصدر BOK المحلي لكتاب في ظلال القرآن' },
  qurtubi: { deathYearHijri: 671, evidence: 'ترجمة محمد بن أحمد القرطبي في فهرس المؤلفين المحلي' },
  'mokhtasar-tafsir': { contemporaryInstitution: true, evidence: 'الناشر والمؤلف المؤسسي: مركز تفسير للدراسات القرآنية' },
  'tahrir-tanwir': {deathYearHijri:1393,evidence:'فهرس المؤلفين المحلي: ابن عاشور77'},
  manar: {deathYearHijri:1354,evidence:'فهرس المؤلفين المحلي: محمد رشيد رضا482'},
  'ibn-uthaymin': {deathYearHijri:1421,evidence:'فهرس المؤلفين المحلي: محمد بن صالح العثيمين57'},
  'ruh-al-maani': {deathYearHijri:1270,evidence:'فهرس المؤلفين المحلي: الألوسي98'},
  'wasit-tantawi': {deathYearHijri:1431,evidence:'سيرة المؤلف المحلية118: الوفاة24 ربيع الأول1431'},
  'bahr-muhit': {deathYearHijri:745,evidence:'فهرس المؤلفين المحلي: أبو حيان99'},
  'qurani-lil-quran': {deathYearHijri:1406,evidence:'جامعة آل البيت، المنهج العقدي عند عبد الكريم الخطيب1406ه: https://web2.aabu.edu.jo/thesis_site/thes_dtl.jsp?thes_no=7480؛ بعد1390 في الفهرس القديم ليس سنة وفاة'},
  'fath-al-qadir': {deathYearHijri:1250,evidence:'فهرس المؤلفين المحلي: الشوكاني100'},
  'ibn-juzayy': {deathYearHijri:741,evidence:'فهرس المؤلفين المحلي: ابن جزي1332'},
  kashshaf: {deathYearHijri:538,evidence:'فهرس المؤلفين المحلي: الزمخشري108'},
  'muharrar-wajiz': {deathYearHijri:542,evidence:'فهرس المؤلفين المحلي: ابن عطية133'},
  'shuoun-wahidy': {deathYearHijri:468,evidence:'كتاب الشاملة المحلي2547، المؤلف1 الواحدي: deathNumber468'},
  'shuoun-zad': {deathYearHijri:597,evidence:'كتاب الشاملة المحلي23619، المؤلف51 ابن الجوزي: الوفاة597هـ'},
  'shuoun-nasafy': {deathYearHijri:710,evidence:'كتاب الشاملة المحلي1394، المؤلف105 حافظ الدين أبو البركات النسفي: الوفاة710هـ'},
  'shuoun-zamanen': {deathYearHijri:399,evidence:'كتاب الشاملة المحلي2154، المؤلف181 ابن أبي زمنين: الوفاة399هـ'},
  'shuoun-alrazy': {deathYearHijri:606,evidence:'كتاب الشاملة المحلي23635، المؤلف55 الفخر الرازي: الوفاة606هـ'},
  'shuoun-baidawy': {deathYearHijri:685,evidence:'كتاب الشاملة المحلي23588، المؤلف104 ناصر الدين البيضاوي: الوفاة685هـ'},
  'shuoun-mathoor': {contemporaryCollective:true,evidence:'موسوعة التفسير المأثور، كتاب الشاملة المحلي639، المؤلف208 مجموعة من المؤلفين؛99999 قيمة اصطناعية وليست سنة وفاة'},
  'shuoun-qatada': {deathYearHijri:118,evidence:'فهرس المؤلفين المحلي، المؤلف46 قتادة:118هـ، وهو تاريخ سيرته المنقولة عن الأعلام في shamela.ws/author/46؛ وصف كتاب الناسخ والمنسوخ في الصفحة نفسها يذكر117هـ، فلا يُدّعى الاتفاق. كتاب8491 شاهد هوية المؤلف لا أصل التفسير المستورد'},
}

export const LINKED_TAFSIRS: readonly LinkedTafsirDefinition[] = [
  { name: 'المختصر في التفسير', author: 'مركز تفسير للدراسات القرآنية', bookId: 2003, slug: 'mokhtasar-tafsir', workId: 'tafsir-mokhtasar-tafsir', category: 'التفسير' },
  { name: 'تفسير الطبري', author: 'محمد بن جرير الطبري', authorId: '59', bookId: 4, slug: 'tabari', workId: 'tafsir-tabari', category: 'التفسير' },
  { name: 'تفسير البغوي', author: 'الحسين بن مسعود البغوي', authorId: '4', bookId: 2, slug: 'baghawi', workId: 'tafsir-baghawi', category: 'التفسير' },
  { name: 'تفسير السعدي', author: 'عبد الرحمن بن ناصر السعدي', authorId: '128', bookId: 3, slug: 'saadi', workId: 'tafsir-saadi', category: 'التفسير' },
  { name: 'تفسير ابن كثير', author: 'إسماعيل بن عمر ابن كثير', authorId: '3', bookId: 136, slug: 'ibn-kathir', workId: 'tafsir-ibn-kathir', category: 'التفسير' },
  { name: 'تفسير القرطبي', author: 'محمد بن أحمد القرطبي', authorId: '115', bookId: 2556, slug: 'qurtubi', workId: 'tafsir-qurtubi', category: 'التفسير' },
  { name: 'أضواء البيان', author: 'محمد الأمين الشنقيطي', authorId: '114', bookId: 308, slug: 'adwa-al-bayan', workId: 'tafsir-adwa-al-bayan', category: 'التفسير' },
  { name: 'في ظلال القرآن', author: 'سيد قطب', bookId: 66703, slug: 'fi-zilal', workId: 'tafsir-fi-zilal', category: 'التفسير' },
] as const

const TAFSIR_SHORT_AUTHORS:Readonly<Record<string,string>>={
 mawardi:'الماوردي','ibn-arabi-ahkam':'ابن العربي','durr-masun':'السمين الحلبي','nazm-durar':'البقاعي','abu-saud':'أبو السعود',tarifi:'الطريفي',
 'mokhtasar-tafsir':'مركز تفسير',
 tabari:'الطبري',baghawi:'البغوي','ibn-kathir':'ابن كثير',saadi:'السعدي',qurtubi:'القرطبي',
 'adwa-al-bayan':'الشنقيطي','fi-zilal':'سيد قطب','tahrir-tanwir':'ابن عاشور',manar:'رشيد رضا',
 'ibn-uthaymin':'ابن عثيمين','ruh-al-maani':'الألوسي','wasit-tantawi':'محمد سيد طنطاوي',
 'bahr-muhit':'أبو حيان','qurani-lil-quran':'عبد الكريم الخطيب','fath-al-qadir':'الشوكاني',
 'ibn-juzayy':'ابن جزي',kashshaf:'الزمخشري','muharrar-wajiz':'ابن عطية',
 'shuoun-wahidy':'الواحدي','shuoun-zad':'ابن الجوزي','shuoun-nasafy':'النسفي',
 'shuoun-zamanen':'ابن أبي زمنين','shuoun-baidawy':'البيضاوي','shuoun-alrazy':'الرازي','shuoun-qatada':'قتادة',
}
export function tafsirTitleWithAuthor(definition:TafsirDefinition|ReadyBokDefinition|IndexedVerseBookDefinition):string{
 if(!('author' in definition)||!('slug' in definition))return definition.name
 const shortTitles:Readonly<Record<string,string>>={kashshaf:'الكشاف - الزمخشري','muharrar-wajiz':'المحرر الوجيز - ابن عطية','fath-al-qadir':'فتح القدير - الشوكاني','tahrir-tanwir':'التحرير والتنوير - ابن عاشور'}
 const shortTitle=shortTitles[definition.slug]
 if(shortTitle)return shortTitle
 const author=TAFSIR_SHORT_AUTHORS[definition.slug]??definition.author
 const normalize=(value:string)=>value.normalize('NFKD').replace(/[\u064B-\u065F\u0670\u0640]/gu,'').replace(/[أإآٱ]/gu,'ا').replace(/\s+/gu,' ').trim()
 return author&&!normalize(definition.name).includes(normalize(author))?`${definition.name} - ${author}`:definition.name
}

export function tafsirDisplayName(definition: TafsirDefinition|ReadyBokDefinition|IndexedVerseBookDefinition): string {
  if ('slug' in definition && definition.slug==='shuoun-mathoor') return 'موسوعة التفسير بالمأثور - مركز الشاطبي (معاصر)'
  if(isIndexedVerseBook(definition))return `${definition.name} (معاصر)`
  if(isReadyBokTafsir(definition))return definition.slug==='jalalayn'?`${definition.name} (المحلي ت864؛ السيوطي ت911 هـ)`:`${definition.name} (ت ${definition.deathYearHijri} هـ)`
  if (!('slug' in definition)) return definition.name
  const title=tafsirTitleWithAuthor(definition)
  const chronology = TAFSIR_AUTHOR_CHRONOLOGY[definition.slug]
  if (chronology?.deathYearHijri) return `${title} (ت ${chronology.deathYearHijri} هـ)`
  if (chronology?.contemporaryInstitution) return `${title} (معاصر)`
  if (chronology?.contemporaryCollective) return `${title} (عمل جماعي معاصر)`
  if (chronology?.contemporaryAuthor) return `${title} (معاصر)`
  return title
}

export function tafsirDeathYear(definition:TafsirDefinition|ReadyBokDefinition|IndexedVerseBookDefinition):number {
  return isReadyBokTafsir(definition)?definition.deathYearHijri:'slug' in definition?TAFSIR_AUTHOR_CHRONOLOGY[definition.slug]?.deathYearHijri??Infinity:Infinity
}
const chronological=(a:TafsirDefinition|ReadyBokDefinition|IndexedVerseBookDefinition,b:TafsirDefinition|ReadyBokDefinition|IndexedVerseBookDefinition)=>tafsirDeathYear(a)-tafsirDeathYear(b)||a.name.localeCompare(b.name,'ar')


export const TAFSIRS: readonly TafsirDefinition[] = [
  ...LINKED_TAFSIRS,
  ...SOURCE_EDITION_TAFSIRS,
].sort(chronological)
export const SELECTABLE_TAFSIRS:readonly(TafsirDefinition|ReadyBokDefinition|IndexedVerseBookDefinition)[]=[
 ...LINKED_TAFSIRS,JALALAYN_READY,MUJAHID_READY,
 ISTIAB_READY,
 ...SOURCE_EDITION_TAFSIRS,
].sort(chronological)

export function isLinkedTafsir(definition: TafsirDefinition | undefined): definition is LinkedTafsirDefinition {
  return Boolean(definition && 'workId' in definition && definition.workId === `tafsir-${definition.slug}`)
}

export function tafsirReaderHref(definition: LinkedTafsirDefinition, surah: number, ayah: number): string {
  if (!Number.isInteger(surah) || surah < 1 || surah > 114 || !Number.isInteger(ayah) || ayah < 1) throw new Error('tafsir_reader_position_invalid')
  if (definition.workId !== `tafsir-${definition.slug}`) throw new Error('tafsir_reader_identity_invalid')
  return `#/reader/${definition.workId}?surah=${surah}&ayah=${ayah}`
}

export function linkedTafsirBySlug(slug: string): LinkedTafsirDefinition | undefined {
  return LINKED_TAFSIRS.find(definition => definition.slug === slug)
}
