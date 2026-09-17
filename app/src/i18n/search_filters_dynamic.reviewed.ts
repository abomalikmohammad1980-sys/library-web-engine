type SearchFilterDynamicTemplates = {
  removeFilter: (label: string) => string
  book: (value: string) => string
  author: (value: string) => string
  category: (value: string) => string
  deathFrom: (year: string) => string
  deathTo: (year: string) => string
}

/** قوالب أسماء المرشحات؛ label/value/year قيم حالة تحفظ حرفيًا. */
export const REVIEWED_SEARCH_FILTER_DYNAMIC_TEMPLATES: Readonly<Record<string, SearchFilterDynamicTemplates>> = {
  ckb: {
    removeFilter: label => `لابردنی پاڵاوتەری ${label}`,
    book: value => `کتێب: ${value}`,
    author: value => `نووسەر: ${value}`,
    category: value => `پۆل: ${value}`,
    deathFrom: year => `مردن لە ${year} کۆچییەوە`,
    deathTo: year => `مردن تا ${year} کۆچی`,
  },
  ku: {
    removeFilter: label => `Parzûna ${label} rake`,
    book: value => `Pirtûk: ${value}`,
    author: value => `Nivîskar: ${value}`,
    category: value => `Beş: ${value}`,
    deathFrom: year => `Mirin ji ${year} H`,
    deathTo: year => `Mirin heta ${year} H`,
  },
  tr: {
    removeFilter: label => `${label} filtresini kaldır`,
    book: value => `Kitap: ${value}`,
    author: value => `Yazar: ${value}`,
    category: value => `Kategori: ${value}`,
    deathFrom: year => `Ölüm başlangıcı: ${year} H`,
    deathTo: year => `Ölüm bitişi: ${year} H`,
  },
  ur: {
    removeFilter: label => `${label} کا فلٹر ہٹائیں`,
    book: value => `کتاب: ${value}`,
    author: value => `مصنف: ${value}`,
    category: value => `تصنیف: ${value}`,
    deathFrom: year => `وفات ${year}ھ سے`,
    deathTo: year => `وفات ${year}ھ تک`,
  },
  fa: {
    removeFilter: label => `حذف پالایهٔ ${label}`,
    book: value => `کتاب: ${value}`,
    author: value => `مؤلف: ${value}`,
    category: value => `دسته: ${value}`,
    deathFrom: year => `وفات از ${year} هـ`,
    deathTo: year => `وفات تا ${year} هـ`,
  },
}
