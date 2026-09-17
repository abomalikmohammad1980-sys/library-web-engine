type SearchQueryDynamicTemplates = {
  noResults: (query: string) => string
  modeNoResults: (effective: string) => string
}

/** رسائل فراغ البحث؛ query/effective محتوى مستخدم أو ناتج تحليل محفوظ حرفيًا. */
export const REVIEWED_SEARCH_QUERY_DYNAMIC_TEMPLATES: Readonly<Record<string, SearchQueryDynamicTemplates>> = {
  ckb: {
    noResults: query => `هیچ ئەنجامێک بۆ «${query}» نییە`,
    modeNoResults: effective => `دۆخی هەڵبژێردراو هیچ شوێنێکی بۆ دەستەواژەی «${effective}» نەدۆزییەوە.`,
  },
  ku: {
    noResults: query => `Ji bo «${query}» encam tune`,
    modeNoResults: effective => `Moda hilbijartî ji bo gotina «${effective}» tu cih nedît.`,
  },
  tr: {
    noResults: query => `“${query}” için sonuç bulunamadı`,
    modeNoResults: effective => `Seçilen mod “${effective}” ifadesi için eşleşen konum üretmedi.`,
  },
  ur: {
    noResults: query => `”${query}“ کے لیے کوئی نتیجہ نہیں`,
    modeNoResults: effective => `منتخب طریقے کو عبارت ”${effective}“ کے لیے کوئی مقام نہیں ملا۔`,
  },
  fa: {
    noResults: query => `نتیجه‌ای برای «${query}» نیست`,
    modeNoResults: effective => `حالت انتخاب‌شده برای عبارت «${effective}» موقعیتی پیدا نکرد.`,
  },
}
