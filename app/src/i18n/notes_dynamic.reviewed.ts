type NotesDynamicTemplates = {
  items: (count: string) => string
  nextReview: (date: string) => string
}

/** حالات ذاكرة القراءة الديناميكية؛ التاريخ والعدد يبقيان كما ولدتهما الواجهة. */
export const REVIEWED_NOTES_DYNAMIC_TEMPLATES: Readonly<Record<string, NotesDynamicTemplates>> = {
  en: { items: count => `${count} items`, nextReview: date => `Next review: ${date}` },
  fr: { items: count => `${count} éléments`, nextReview: date => `Prochaine révision : ${date}` },
  ug: { items: count => `${count} تۈر`, nextReview: date => `كېيىنكى تەكرارلاش: ${date}` },
  ckb: { items: count => `${count} دانە`, nextReview: date => `پێداچوونەوەی داهاتوو: ${date}` },
  ku: { items: count => `${count} hêman`, nextReview: date => `Pêdaçûna din: ${date}` },
  tr: { items: count => `${count} öğe`, nextReview: date => `Sonraki inceleme: ${date}` },
  ur: { items: count => `${count} اشیا`, nextReview: date => `اگلا جائزہ: ${date}` },
  fa: { items: count => `${count} مورد`, nextReview: date => `مرور بعدی: ${date}` },
  sw: { items: count => `${count} vipengee`, nextReview: date => `Marudio yajayo: ${date}` },
  hi: { items: count => `${count} आइटम`, nextReview: date => `अगली समीक्षा: ${date}` },
  hu: { items: count => `${count} elem`, nextReview: date => `Következő áttekintés: ${date}` },
  id: { items: count => `${count} item`, nextReview: date => `Tinjauan berikutnya: ${date}` },
  ms: { items: count => `${count} item`, nextReview: date => `Ulasan seterusnya: ${date}` },
  bn: { items: count => `${count}টি আইটেম`, nextReview: date => `পরবর্তী পর্যালোচনা: ${date}` },
  ps: { items: count => `${count} توکي`, nextReview: date => `راتلونکې بیاکتنه: ${date}` },
  so: { items: count => `${count} qodob`, nextReview: date => `Dib-u-eegista xigta: ${date}` },
  ha: { items: count => `${count} abubuwa`, nextReview: date => `Bita na gaba: ${date}` },
  ru: { items: count => `${count} элементов`, nextReview: date => `Следующее повторение: ${date}` },
  uk: { items: count => `${count} елементів`, nextReview: date => `Наступне повторення: ${date}` },
  de: { items: count => `${count} Einträge`, nextReview: date => `Nächste Wiederholung: ${date}` },
  es: { items: count => `${count} elementos`, nextReview: date => `Próximo repaso: ${date}` },
  pt: { items: count => `${count} itens`, nextReview: date => `Próxima revisão: ${date}` },
  it: { items: count => `${count} elementi`, nextReview: date => `Prossimo ripasso: ${date}` },
  nl: { items: count => `${count} items`, nextReview: date => `Volgende herhaling: ${date}` },
  sv: { items: count => `${count} objekt`, nextReview: date => `Nästa repetition: ${date}` },
  no: { items: count => `${count} elementer`, nextReview: date => `Neste gjennomgang: ${date}` },
  pl: { items: count => `${count} elementów`, nextReview: date => `Następna powtórka: ${date}` },
  ro: { items: count => `${count} elemente`, nextReview: date => `Următoarea recapitulare: ${date}` },
  bs: { items: count => `${count} stavki`, nextReview: date => `Sljedeće ponavljanje: ${date}` },
  sq: { items: count => `${count} artikuj`, nextReview: date => `Rishikimi i ardhshëm: ${date}` },
  az: { items: count => `${count} element`, nextReview: date => `Növbəti təkrar: ${date}` },
  uz: { items: count => `${count} ta element`, nextReview: date => `Keyingi takrorlash: ${date}` },
  kk: { items: count => `${count} элемент`, nextReview: date => `Келесі қайталау: ${date}` },
  zh: { items: count => `${count} 项`, nextReview: date => `下次复习：${date}` },
  ja: { items: count => `${count} 件`, nextReview: date => `次回の復習: ${date}` },
  ko: { items: count => `${count}개 항목`, nextReview: date => `다음 복습: ${date}` },
}
