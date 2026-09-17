type BookPreviewDynamicTemplates = {
  part: (number: string) => string
  pageRange: (start: string, end: string) => string
}

/** تسميات معاينة بنية الكتاب؛ عناوين الأجزاء ومقتطفات الصفحات تبقى محتوى أصليًا. */
export const REVIEWED_BOOK_PREVIEW_DYNAMIC_TEMPLATES: Readonly<Record<string, BookPreviewDynamicTemplates>> = {
  en: { part: number => `Part ${number}`, pageRange: (start, end) => `Pages ${start} to ${end}` },
  fr: { part: number => `Partie ${number}`, pageRange: (start, end) => `Des pages ${start} à ${end}` },
  ug: { part: number => `${number}-قىسىم`, pageRange: (start, end) => `${start}-بەتتىن ${end}-بەتكىچە` },
  ckb: { part: number => `بەشی ${number}`, pageRange: (start, end) => `لە پەڕەی ${start} تا ${end}` },
  ku: { part: number => `Beşa ${number}`, pageRange: (start, end) => `Ji rûpela ${start} heta ${end}` },
  tr: { part: number => `Bölüm ${number}`, pageRange: (start, end) => `${start}. sayfadan ${end}. sayfaya` },
  ur: { part: number => `حصہ ${number}`, pageRange: (start, end) => `صفحہ ${start} سے ${end} تک` },
  fa: { part: number => `بخش ${number}`, pageRange: (start, end) => `از صفحهٔ ${start} تا ${end}` },
  sw: { part: number => `Juzuu ${number}`, pageRange: (start, end) => `Kutoka ukurasa ${start} hadi ${end}` },
  hi: { part: number => `भाग ${number}`, pageRange: (start, end) => `पृष्ठ ${start} से ${end}` },
  hu: { part: number => `${number}. rész`, pageRange: (start, end) => `${start}–${end}. oldal` },
  id: { part: number => `Bagian ${number}`, pageRange: (start, end) => `Halaman ${start} sampai ${end}` },
  ms: { part: number => `Bahagian ${number}`, pageRange: (start, end) => `Halaman ${start} hingga ${end}` },
  bn: { part: number => `খণ্ড ${number}`, pageRange: (start, end) => `পৃষ্ঠা ${start} থেকে ${end}` },
  ps: { part: number => `${number} برخه`, pageRange: (start, end) => `له ${start} تر ${end} پاڼې` },
  so: { part: number => `Qaybta ${number}`, pageRange: (start, end) => `Bogga ${start} ilaa ${end}` },
  ha: { part: number => `Sashe ${number}`, pageRange: (start, end) => `Daga shafi ${start} zuwa ${end}` },
  ru: { part: number => `Часть ${number}`, pageRange: (start, end) => `Страницы ${start}–${end}` },
  uk: { part: number => `Частина ${number}`, pageRange: (start, end) => `Сторінки ${start}–${end}` },
  de: { part: number => `Teil ${number}`, pageRange: (start, end) => `Seiten ${start} bis ${end}` },
  es: { part: number => `Parte ${number}`, pageRange: (start, end) => `Páginas ${start} a ${end}` },
  pt: { part: number => `Parte ${number}`, pageRange: (start, end) => `Páginas ${start} a ${end}` },
  it: { part: number => `Parte ${number}`, pageRange: (start, end) => `Pagine da ${start} a ${end}` },
  nl: { part: number => `Deel ${number}`, pageRange: (start, end) => `Pagina ${start} tot ${end}` },
  sv: { part: number => `Del ${number}`, pageRange: (start, end) => `Sidorna ${start} till ${end}` },
  no: { part: number => `Del ${number}`, pageRange: (start, end) => `Side ${start} til ${end}` },
  pl: { part: number => `Część ${number}`, pageRange: (start, end) => `Strony od ${start} do ${end}` },
  ro: { part: number => `Partea ${number}`, pageRange: (start, end) => `Paginile ${start}–${end}` },
  bs: { part: number => `Dio ${number}`, pageRange: (start, end) => `Stranice ${start}–${end}` },
  sq: { part: number => `Pjesa ${number}`, pageRange: (start, end) => `Faqet ${start} deri ${end}` },
  az: { part: number => `${number}-ci hissə`, pageRange: (start, end) => `${start}–${end} səhifələr` },
  uz: { part: number => `${number}-qism`, pageRange: (start, end) => `${start}–${end}-sahifalar` },
  kk: { part: number => `${number}-бөлім`, pageRange: (start, end) => `${start}–${end}-беттер` },
  zh: { part: number => `第 ${number} 部分`, pageRange: (start, end) => `第 ${start} 至 ${end} 页` },
  ja: { part: number => `第 ${number} 部`, pageRange: (start, end) => `${start}～${end} ページ` },
  ko: { part: number => `${number}부`, pageRange: (start, end) => `${start}~${end}페이지` },
}
