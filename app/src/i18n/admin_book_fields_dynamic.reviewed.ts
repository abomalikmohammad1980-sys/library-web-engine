type AdminBookFieldsDynamicTemplates = {
  reviewNote: (title: string) => string
  titleField: (title: string) => string
  authorField: (title: string) => string
  categoryField: (title: string) => string
  visibilityField: (title: string) => string
}

/** تسميات وصول حقول الإدارة؛ عنوان الكتاب قيمة أصلية محفوظة حرفيًا. */
export const REVIEWED_ADMIN_BOOK_FIELDS_DYNAMIC_TEMPLATES: Readonly<Record<string, AdminBookFieldsDynamicTemplates>> = {
  en: { reviewNote: title => `Review note for ${title}`, titleField: title => `Title of ${title}`, authorField: title => `Author of ${title}`, categoryField: title => `Category of ${title}`, visibilityField: title => `Visibility of ${title}` },
  fr: { reviewNote: title => `Note de révision de ${title}`, titleField: title => `Titre de ${title}`, authorField: title => `Auteur de ${title}`, categoryField: title => `Catégorie de ${title}`, visibilityField: title => `Visibilité de ${title}` },
  ug: { reviewNote: title => `${title} نىڭ تەكشۈرۈش ئىزاھى`, titleField: title => `${title} نىڭ ماۋزۇسى`, authorField: title => `${title} نىڭ ئاپتورى`, categoryField: title => `${title} نىڭ تۈرى`, visibilityField: title => `${title} نىڭ كۆرۈنۈشى` },
  ckb: {
    reviewNote: title => `تێبینی پێداچوونەوەی ${title}`, titleField: title => `ناونیشانی ${title}`, authorField: title => `نووسەری ${title}`,
    categoryField: title => `پۆلێنی ${title}`, visibilityField: title => `دەرکەوتنی ${title}`,
  },
  ku: {
    reviewNote: title => `Nîşeya nirxandina ${title}`, titleField: title => `Sernavê ${title}`, authorField: title => `Nivîskarê ${title}`,
    categoryField: title => `Kategoriyê ${title}`, visibilityField: title => `Dîtbarîya ${title}`,
  },
  tr: {
    reviewNote: title => `${title} inceleme notu`, titleField: title => `${title} başlığı`, authorField: title => `${title} yazarı`,
    categoryField: title => `${title} kategorisi`, visibilityField: title => `${title} görünürlüğü`,
  },
  ur: {
    reviewNote: title => `${title} کا جائزہ نوٹ`, titleField: title => `${title} کا عنوان`, authorField: title => `${title} کا مصنف`,
    categoryField: title => `${title} کا زمرہ`, visibilityField: title => `${title} کی نمائش`,
  },
  fa: {
    reviewNote: title => `یادداشت بررسی ${title}`, titleField: title => `نام کتاب ${title}`, authorField: title => `نویسندهٔ ${title}`,
    categoryField: title => `دسته‌بندی ${title}`, visibilityField: title => `نمایانی ${title}`,
  },
  sw: { reviewNote: title => `Dokezo la ukaguzi la ${title}`, titleField: title => `Kichwa cha ${title}`, authorField: title => `Mwandishi wa ${title}`, categoryField: title => `Aina ya ${title}`, visibilityField: title => `Mwonekano wa ${title}` },
  hi: { reviewNote: title => `${title} की समीक्षा टिप्पणी`, titleField: title => `${title} का शीर्षक`, authorField: title => `${title} का लेखक`, categoryField: title => `${title} की श्रेणी`, visibilityField: title => `${title} की दृश्यता` },
  hu: { reviewNote: title => `${title} ellenőrzési megjegyzése`, titleField: title => `${title} címe`, authorField: title => `${title} szerzője`, categoryField: title => `${title} kategóriája`, visibilityField: title => `${title} láthatósága` },
  id: { reviewNote: title => `Catatan tinjauan ${title}`, titleField: title => `Judul ${title}`, authorField: title => `Penulis ${title}`, categoryField: title => `Kategori ${title}`, visibilityField: title => `Visibilitas ${title}` },
  ms: { reviewNote: title => `Nota semakan ${title}`, titleField: title => `Tajuk ${title}`, authorField: title => `Pengarang ${title}`, categoryField: title => `Kategori ${title}`, visibilityField: title => `Keterlihatan ${title}` },
  bn: { reviewNote: title => `${title}-এর পর্যালোচনা নোট`, titleField: title => `${title}-এর শিরোনাম`, authorField: title => `${title}-এর লেখক`, categoryField: title => `${title}-এর বিভাগ`, visibilityField: title => `${title}-এর দৃশ্যমানতা` },
  ps: { reviewNote: title => `د ${title} د بیاکتنې یادښت`, titleField: title => `د ${title} سرلیک`, authorField: title => `د ${title} لیکوال`, categoryField: title => `د ${title} ډلبندي`, visibilityField: title => `د ${title} لید` },
  so: { reviewNote: title => `Qoraalka dib-u-eegista ${title}`, titleField: title => `Cinwaanka ${title}`, authorField: title => `Qoraaga ${title}`, categoryField: title => `Qaybta ${title}`, visibilityField: title => `Muuqashada ${title}` },
  ha: { reviewNote: title => `Bayanin bitar ${title}`, titleField: title => `Sunan ${title}`, authorField: title => `Marubucin ${title}`, categoryField: title => `Rukunin ${title}`, visibilityField: title => `Bayyanar ${title}` },
  ru: { reviewNote: title => `Примечание к проверке «${title}»`, titleField: title => `Название «${title}»`, authorField: title => `Автор «${title}»`, categoryField: title => `Категория «${title}»`, visibilityField: title => `Видимость «${title}»` },
  uk: { reviewNote: title => `Примітка до перевірки «${title}»`, titleField: title => `Назва «${title}»`, authorField: title => `Автор «${title}»`, categoryField: title => `Категорія «${title}»`, visibilityField: title => `Видимість «${title}»` },
  de: { reviewNote: title => `Prüfnotiz für ${title}`, titleField: title => `Titel von ${title}`, authorField: title => `Autor von ${title}`, categoryField: title => `Kategorie von ${title}`, visibilityField: title => `Sichtbarkeit von ${title}` },
  es: { reviewNote: title => `Nota de revisión de ${title}`, titleField: title => `Título de ${title}`, authorField: title => `Autor de ${title}`, categoryField: title => `Categoría de ${title}`, visibilityField: title => `Visibilidad de ${title}` },
  pt: { reviewNote: title => `Nota de revisão de ${title}`, titleField: title => `Título de ${title}`, authorField: title => `Autor de ${title}`, categoryField: title => `Categoria de ${title}`, visibilityField: title => `Visibilidade de ${title}` },
  it: { reviewNote: title => `Nota di revisione di ${title}`, titleField: title => `Titolo di ${title}`, authorField: title => `Autore di ${title}`, categoryField: title => `Categoria di ${title}`, visibilityField: title => `Visibilità di ${title}` },
  nl: { reviewNote: title => `Beoordelingsnotitie voor ${title}`, titleField: title => `Titel van ${title}`, authorField: title => `Auteur van ${title}`, categoryField: title => `Categorie van ${title}`, visibilityField: title => `Zichtbaarheid van ${title}` },
  sv: { reviewNote: title => `Granskningsanteckning för ${title}`, titleField: title => `Titel för ${title}`, authorField: title => `Författare till ${title}`, categoryField: title => `Kategori för ${title}`, visibilityField: title => `Synlighet för ${title}` },
  no: { reviewNote: title => `Gjennomgangsnotat for ${title}`, titleField: title => `Tittel på ${title}`, authorField: title => `Forfatter av ${title}`, categoryField: title => `Kategori for ${title}`, visibilityField: title => `Synlighet for ${title}` },
  pl: { reviewNote: title => `Uwaga do przeglądu ${title}`, titleField: title => `Tytuł ${title}`, authorField: title => `Autor ${title}`, categoryField: title => `Kategoria ${title}`, visibilityField: title => `Widoczność ${title}` },
  ro: { reviewNote: title => `Notă de verificare pentru ${title}`, titleField: title => `Titlul ${title}`, authorField: title => `Autorul ${title}`, categoryField: title => `Categoria ${title}`, visibilityField: title => `Vizibilitatea ${title}` },
  bs: { reviewNote: title => `Napomena pregleda za ${title}`, titleField: title => `Naslov ${title}`, authorField: title => `Autor ${title}`, categoryField: title => `Kategorija ${title}`, visibilityField: title => `Vidljivost ${title}` },
  sq: { reviewNote: title => `Shënim shqyrtimi për ${title}`, titleField: title => `Titulli i ${title}`, authorField: title => `Autori i ${title}`, categoryField: title => `Kategoria e ${title}`, visibilityField: title => `Dukshmëria e ${title}` },
  az: { reviewNote: title => `${title} üçün yoxlama qeydi`, titleField: title => `${title} başlığı`, authorField: title => `${title} müəllifi`, categoryField: title => `${title} kateqoriyası`, visibilityField: title => `${title} görünüşü` },
  uz: { reviewNote: title => `${title} uchun tekshiruv qaydi`, titleField: title => `${title} sarlavhasi`, authorField: title => `${title} muallifi`, categoryField: title => `${title} turkumi`, visibilityField: title => `${title} ko‘rinishi` },
  kk: { reviewNote: title => `${title} тексеру ескертпесі`, titleField: title => `${title} атауы`, authorField: title => `${title} авторы`, categoryField: title => `${title} санаты`, visibilityField: title => `${title} көрінуі` },
  zh: { reviewNote: title => `${title} 的审核备注`, titleField: title => `${title} 的书名`, authorField: title => `${title} 的作者`, categoryField: title => `${title} 的分类`, visibilityField: title => `${title} 的可见性` },
  ja: { reviewNote: title => `${title} の審査メモ`, titleField: title => `${title} の書名`, authorField: title => `${title} の著者`, categoryField: title => `${title} のカテゴリ`, visibilityField: title => `${title} の公開範囲` },
  ko: { reviewNote: title => `${title} 검토 메모`, titleField: title => `${title} 제목`, authorField: title => `${title} 저자`, categoryField: title => `${title} 분류`, visibilityField: title => `${title} 공개 범위` },
}
