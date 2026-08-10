export interface RemembranceEntry {
  id: string
  text: string
  sourceUrl: string | null
  sourceLabel: string
  kind: 'authentic-remembrance' | 'general-prayer'
}
const M = 'https://dorar.net/azkar/mukhtasar', S = `${M}/216`, F = `${M}/218`, R = `${M}/220`
const authentic = (id: string, text: string, sourceUrl = M): RemembranceEntry => ({
  id, text, sourceUrl, sourceLabel: 'الدرر السنية — مختصر الأذكار والأدعية', kind: 'authentic-remembrance',
})
// لا تُنسب الأدعية المنشأة للغرض العام إلى حديث أو إلى موقع الدرر.
const general = (id: string, text: string): RemembranceEntry => ({
  id, text, sourceUrl: null, sourceLabel: 'دعاء عام — غير منسوب إلى حديث', kind: 'general-prayer',
})

/** صيغ وجيزة مكتملة المعنى؛ مصدر كل صيغة محفوظ ولا تُعرض الأسانيد في التذكير الخاطف. */
export const REMEMBRANCES: readonly RemembranceEntry[] = [
  authentic('r001', 'سبحان الله وبحمده، سبحان الله العظيم'), authentic('r002', 'لا إله إلا الله وحده لا شريك له'),
  authentic('r003', 'الحمد لله رب العالمين'), authentic('r004', 'لا حول ولا قوة إلا بالله'),
  authentic('r005', 'أستغفر الله وأتوب إليه'), authentic('r006', 'سبحان الله، والحمد لله، والله أكبر'),
  authentic('r007', 'اللهم صل وسلم على نبينا محمد'), authentic('r008', 'حسبي الله لا إله إلا هو'),
  authentic('r009', 'سبحان الله عدد خلقه ورضا نفسه'), authentic('r010', 'رضيت بالله ربًا وبالإسلام دينًا'),
  authentic('r011', 'يا حي يا قيوم برحمتك أستغيث'), authentic('r012', 'رب اغفر لي وتب علي'),
  authentic('r013', 'اللهم أعني على ذكرك وشكرك'), authentic('r014', 'اللهم اهدني وسددني', S),
  authentic('r015', 'اللهم إني أسألك الهدى والسداد', S), authentic('r016', 'اللهم اغفر لي وارحمني وعافني وارزقني', S),
  authentic('r017', 'اللهم اغفر لي وارحمني واهدني وارزقني', S), authentic('r018', 'اللهم مصرف القلوب صرف قلوبنا على طاعتك', S),
  authentic('r019', 'اللهم إني أسألك علمًا نافعًا', S), authentic('r020', 'وأعوذ بك من علم لا ينفع', S),
  authentic('r021', 'اللهم جنبني منكرات الأخلاق والأهواء', S), authentic('r022', 'اللهم اغفر لي خطيئتي وجهلي', S),
  authentic('r023', 'اللهم اغفر لي جدي وهزلي', S), authentic('r024', 'اللهم اغفر لي خطئي وعمدي', S),
  authentic('r025', 'اللهم متعني بسمعي وبصري', S), authentic('r026', 'اللهم اجعل الحياة زيادة لي في الخير', S),
  authentic('r027', 'اللهم اجعل الموت راحة لي من الشر', S), authentic('r028', 'رب أعني ولا تعن علي', S),
  authentic('r029', 'رب اهدني ويسر الهدى لي', S), authentic('r030', 'رب اجعلني لك شكارًا ذكارًا', S),
  authentic('r031', 'رب تقبل توبتي واغسل حوبتي', S), authentic('r032', 'رب أجب دعوتي وثبت حجتي', S),
  authentic('r033', 'رب سدد لساني واهد قلبي', S), authentic('r034', 'اللهم أستَهديك لأرشد أمري', S),
  authentic('r035', 'وأعوذ بك من شر نفسي', S), authentic('r036', 'اللهم إني أسألك العفو والعافية', F),
  authentic('r037', 'اللهم آت نفسي تقواها', F), authentic('r038', 'اللهم زك نفسي أنت خير من زكاها', F),
  authentic('r039', 'اللهم إنك عفو تحب العفو فاعف عني', F), authentic('r040', 'يا مقلب القلوب ثبت قلبي على دينك', F),
  authentic('r041', 'ربنا آتنا في الدنيا حسنة'), authentic('r042', 'وفي الآخرة حسنة وقنا عذاب النار'),
  authentic('r043', 'ربنا لا تزغ قلوبنا بعد إذ هديتنا'), authentic('r044', 'وهب لنا من لدنك رحمة'),
  authentic('r045', 'ربنا ظلمنا أنفسنا فاغفر لنا'), authentic('r046', 'رب اشرح لي صدري ويسر لي أمري'),
  authentic('r047', 'رب زدني علمًا'), authentic('r048', 'رب إني لما أنزلت إلي من خير فقير'),
  authentic('r049', 'رب لا تذرني فردًا وأنت خير الوارثين'), authentic('r050', 'رب إني مسني الضر وأنت أرحم الراحمين'),
  authentic('r051', 'لا إله إلا أنت سبحانك إني كنت ظالمًا'), authentic('r052', 'ربنا أفرغ علينا صبرًا وثبت أقدامنا'),
  authentic('r053', 'ربنا اغفر لنا وارحمنا وأنت خير الراحمين'), authentic('r054', 'ربنا تقبل منا إنك أنت السميع العليم'),
  authentic('r055', 'رب اجعلني مقيم الصلاة ومن ذريتي'), authentic('r056', 'رب اغفر لي ولوالدي وللمؤمنين'),
  authentic('r057', 'رب أعوذ بك من همزات الشياطين', R), authentic('r058', 'وأعوذ بك رب أن يحضرون', R),
  authentic('r059', 'أعوذ بكلمات الله التامات من شر خلقه', R), authentic('r060', 'اللهم إني أعوذ بك من الهم والحزن', R),
  authentic('r061', 'اللهم إني أعوذ بك من العجز والكسل', R), authentic('r062', 'اللهم إني أعوذ بك من الجبن والبخل', R),
  authentic('r063', 'اللهم إني أعوذ بك من غلبة الدين', R), authentic('r064', 'اللهم إني أعوذ بك من عذاب القبر', R),
  authentic('r065', 'اللهم إني أعوذ بك من فتنة المحيا', R), authentic('r066', 'اللهم إني أعوذ بك من فتنة الممات', R),
  authentic('r067', 'باسمك اللهم أموت وأحيا'), authentic('r068', 'الحمد لله الذي أحيانا بعدما أماتنا'),
  authentic('r069', 'غفرانك'), authentic('r070', 'بسم الله توكلت على الله'),
  authentic('r071', 'اللهم بارك لهم فيما رزقتهم'), authentic('r072', 'الحمد لله الذي أطعمنا وسقانا'),
  general('g001', 'اللهم انصر المستضعفين من المسلمين'), general('g002', 'اللهم فرج كرب المستضعفين'),
  general('g003', 'اللهم احفظ المجاهدين في سبيل الله'), general('g004', 'اللهم ثبت المجاهدين على الحق'),
  general('g005', 'اللهم اشف جرحى المسلمين'), general('g006', 'اللهم ارحم موتى المسلمين'),
  general('g007', 'اللهم أطعم جائع المسلمين'), general('g008', 'اللهم آمن خوف المسلمين'),
] as const

export const remembranceWordCount = (text: string): number => text.trim().split(/\s+/u).filter(Boolean).length

export function chooseRemembrance(random = Math.random): RemembranceEntry {
  const key = 'khizana:remembrance-recent:v2'; let recent: string[] = []
  try { recent = JSON.parse(localStorage.getItem(key) ?? '[]') as string[] } catch { /* سجل تالف */ }
  const available = REMEMBRANCES.filter(entry => !recent.includes(entry.id)), pool = available.length ? available : [...REMEMBRANCES]
  const selected = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))] ?? REMEMBRANCES[0]!
  try { localStorage.setItem(key, JSON.stringify([...recent.filter(id => id !== selected.id), selected.id].slice(-24))) } catch { /* تحسين اختياري */ }
  return selected
}
