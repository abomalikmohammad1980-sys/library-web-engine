type SearchCoverageDynamicTemplates = {
  unavailableEmpty: (books: string) => string
  unavailablePartial: (books: string) => string
  pending: (books: string) => string
}

/** حالات اكتمال الفهرس؛ قيمة books عدّاد واجهة محفوظ حرفيًا. */
export const REVIEWED_SEARCH_COVERAGE_DYNAMIC_TEMPLATES: Readonly<Record<string, SearchCoverageDynamicTemplates>> = {
  ckb: {
    unavailableEmpty: books => `گەڕان لە ${books} کتێب ئەنجام نەدرا؛ تا فهرستەکان تەواو نەبن ناتوانرێت دڵنیابین کە هیچ ئەنجامێک نییە.`,
    unavailablePartial: books => `ئەنجامی بەشەکی: گەڕان لە ${books} کتێب ئەنجام نەدرا؛ ئەوەی لە خوارەوە دەردەکەوێت لە کتێبە تەواوفهرستکراوەکانە.`,
    pending: books => `ئەنجامی سەرەتایی خێرا؛ ${books} کتێب ماوە بۆ تەواوکردنی داپۆشین.`,
  },
  ku: {
    unavailableEmpty: books => `Lêgerîn di ${books} pirtûkan de nehat temamkirin; heta ku pêrist temam bibin, nayê piştrastkirin ku encam tune ye.`,
    unavailablePartial: books => `Encamên qismî: lêgerîn di ${books} pirtûkan de nehat temamkirin; yên li jêr ji pirtûkên bi pêrista temam in.`,
    pending: books => `Encamên destpêkê yên bilez; ${books} pirtûk mane ku vegirtin temam bibe.`,
  },
  tr: {
    unavailableEmpty: books => `${books} kitapta arama tamamlanamadı; dizinler tamamlanana kadar sonuç bulunmadığı kesinleştirilemez.`,
    unavailablePartial: books => `Kısmi sonuçlar: ${books} kitapta arama tamamlanamadı; aşağıdakiler dizini tamamlanan kitaplardandır.`,
    pending: books => `Hızlı ön sonuçlar; kapsamın tamamlanması için ${books} kitap kaldı.`,
  },
  ur: {
    unavailableEmpty: books => `${books} کتابوں میں تلاش مکمل نہ ہو سکی؛ فہرستیں مکمل ہونے تک نتائج نہ ہونے کی تصدیق نہیں کی جا سکتی۔`,
    unavailablePartial: books => `جزوی نتائج: ${books} کتابوں میں تلاش مکمل نہ ہو سکی؛ ذیل میں وہ کتابیں ہیں جن کی فہرست مکمل ہے۔`,
    pending: books => `فوری ابتدائی نتائج؛ مکمل احاطے کے لیے ${books} کتابیں باقی ہیں۔`,
  },
  fa: {
    unavailableEmpty: books => `جست‌وجو در ${books} کتاب کامل نشد؛ تا تکمیل نمایه‌ها نمی‌توان از نبود نتیجه مطمئن شد.`,
    unavailablePartial: books => `نتایج جزئی: جست‌وجو در ${books} کتاب کامل نشد؛ موارد زیر از کتاب‌هایی است که نمایه‌شان کامل شده است.`,
    pending: books => `نتایج اولیهٔ سریع؛ ${books} کتاب برای تکمیل پوشش باقی مانده است.`,
  },
}
