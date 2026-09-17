type SearchDynamicTemplates = {
  summary: (occurrences: string, paragraphs: string, books: string) => string
  filteredSummary: (occurrences: string, books: string) => string
  optionLimit: (shown: string, total: string) => string
  shown: (loaded: string, total: string) => string
  complete: (paragraphs: string) => string
}

/** ملخصات البحث المتغيرة؛ لا تتضمن عنوان كتاب أو اسم مؤلف أو مقتطفًا. */
export const REVIEWED_SEARCH_DYNAMIC_F_TEMPLATES: Readonly<Record<string, SearchDynamicTemplates>> = {
  ckb: {
    summary: (occurrences, paragraphs, books) => `${occurrences} شوێنی هاوتا؛ کارتەکان ${paragraphs} بڕگە لە ${books} کتێب پیشان دەدەن · ژمارەکە لە کاتی گەڕاندا جێگیرە`,
    filteredSummary: (occurrences, books) => `${occurrences} شوێنی هاوتا دوای پاڵاوتن لە ${books} کتێب`,
    optionLimit: (shown, total) => `${shown} لە ${total} پیشان دەدرێت؛ بۆ هەڵبژاردەکانی تر دەستەواژەکە وردتر بکە.`,
    shown: (loaded, total) => `${loaded} لە ${total} پیشان درا — بەرەو خوارەوە بەردەوام بە`,
    complete: paragraphs => `${paragraphs} بڕگە تەواو بوو`,
  },
  ku: {
    summary: (occurrences, paragraphs, books) => `${occurrences} cihên lihevhatî; kart ${paragraphs} paragraf ji ${books} pirtûkan nîşan didin · hejmar di gerînê de sabît e`,
    filteredSummary: (occurrences, books) => `${occurrences} cihên lihevhatî piştî parzûnê di ${books} pirtûkan de`,
    optionLimit: (shown, total) => `${shown} ji ${total} tên nîşandan; ji bo vebijarkên mayî gotinê tengtir bike.`,
    shown: (loaded, total) => `${loaded} ji ${total} hatin nîşandan — ber bi jêr ve bidomîne`,
    complete: paragraphs => `${paragraphs} paragraf qediya`,
  },
  tr: {
    summary: (occurrences, paragraphs, books) => `${occurrences} eşleşen konum; kartlar ${books} kitaptan ${paragraphs} paragraf gösteriyor · sayı gezinirken sabit kalır`,
    filteredSummary: (occurrences, books) => `Filtrelemeden sonra ${books} kitapta ${occurrences} eşleşen konum`,
    optionLimit: (shown, total) => `${total} seçenekten ${shown} tanesi gösteriliyor; kalan seçenekler için ifadeyi daraltın.`,
    shown: (loaded, total) => `${total} sonuçtan ${loaded} tanesi gösterildi — aşağı inmeye devam edin`,
    complete: paragraphs => `${paragraphs} paragraf tamamlandı`,
  },
  ur: {
    summary: (occurrences, paragraphs, books) => `${occurrences} مطابق مقامات؛ کارڈز ${books} کتابوں سے ${paragraphs} پیراگراف دکھاتے ہیں · براؤزنگ کے دوران تعداد مستقل رہتی ہے`,
    filteredSummary: (occurrences, books) => `چھانٹنے کے بعد ${books} کتابوں میں ${occurrences} مطابق مقامات`,
    optionLimit: (shown, total) => `${total} میں سے ${shown} دکھائے جا رہے ہیں؛ باقی اختیارات کے لیے عبارت محدود کریں۔`,
    shown: (loaded, total) => `${total} میں سے ${loaded} دکھائے گئے — نیچے جاتے رہیں`,
    complete: paragraphs => `${paragraphs} پیراگراف مکمل`,
  },
  fa: {
    summary: (occurrences, paragraphs, books) => `${occurrences} موقعیت منطبق؛ کارت‌ها ${paragraphs} بند از ${books} کتاب نشان می‌دهند · شمار هنگام مرور ثابت است`,
    filteredSummary: (occurrences, books) => `${occurrences} موقعیت منطبق پس از پالایش در ${books} کتاب`,
    optionLimit: (shown, total) => `${shown} مورد از ${total} نمایش داده می‌شود؛ برای گزینه‌های دیگر عبارت را محدودتر کنید.`,
    shown: (loaded, total) => `${loaded} مورد از ${total} نمایش داده شد — به پایین‌رفتن ادامه دهید`,
    complete: paragraphs => `${paragraphs} بند کامل شد`,
  },
}
