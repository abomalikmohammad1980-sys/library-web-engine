type ReaderSearchDynamicTemplates = {
  progress: (current: string, total: string) => string
  results: (count: string) => string
  page: (page: string) => string
  resultLabel: (index: string, page: string, snippet: string) => string
}

/** قشرة بحث الكتاب؛ snippet مقتطف من المنشور ويحفظ حرفيًا. */
export const REVIEWED_READER_SEARCH_DYNAMIC_TEMPLATES: Readonly<Record<string, ReaderSearchDynamicTemplates>> = {
  en:{progress:(current,total)=>`${current} of ${total}`,results:count=>`${count} results`,page:page=>`Page ${page}`,resultLabel:(index,page,snippet)=>`Result ${index}, page ${page}, ${snippet}`},
  fr:{progress:(current,total)=>`${current} sur ${total}`,results:count=>`${count} résultats`,page:page=>`Page ${page}`,resultLabel:(index,page,snippet)=>`Résultat ${index}, page ${page}, ${snippet}`},
  ug:{progress:(current,total)=>`${total} دىن ${current}`,results:count=>`${count} نەتىجە`,page:page=>`${page}-بەت`,resultLabel:(index,page,snippet)=>`${index}-نەتىجە، ${page}-بەت، ${snippet}`},
  ckb: {
    progress: (current,total)=>`${current} لە ${total}`,
    results: count=>`${count} ئەنجام`,
    page: page=>`پەڕەی ${page}`,
    resultLabel: (index,page,snippet)=>`ئەنجامی ${index}، پەڕەی ${page}، ${snippet}`,
  },
  ku: {
    progress: (current,total)=>`${current} ji ${total}`,
    results: count=>`${count} encam`,
    page: page=>`Rûpel ${page}`,
    resultLabel: (index,page,snippet)=>`Encama ${index}, rûpel ${page}, ${snippet}`,
  },
  tr: {
    progress: (current,total)=>`${total} sonuçtan ${current}`,
    results: count=>`${count} sonuç`,
    page: page=>`Sayfa ${page}`,
    resultLabel: (index,page,snippet)=>`${index}. sonuç, sayfa ${page}, ${snippet}`,
  },
  ur: {
    progress: (current,total)=>`${total} میں سے ${current}`,
    results: count=>`${count} نتائج`,
    page: page=>`صفحہ ${page}`,
    resultLabel: (index,page,snippet)=>`نتیجہ ${index}، صفحہ ${page}، ${snippet}`,
  },
  fa: {
    progress: (current,total)=>`${current} از ${total}`,
    results: count=>`${count} نتیجه`,
    page: page=>`صفحهٔ ${page}`,
    resultLabel: (index,page,snippet)=>`نتیجهٔ ${index}، صفحهٔ ${page}، ${snippet}`,
  },
  sw:{progress:(current,total)=>`${current} kati ya ${total}`,results:count=>`Matokeo ${count}`,page:page=>`Ukurasa ${page}`,resultLabel:(index,page,snippet)=>`Tokeo ${index}, ukurasa ${page}, ${snippet}`},
  hi:{progress:(current,total)=>`${total} में से ${current}`,results:count=>`${count} परिणाम`,page:page=>`पृष्ठ ${page}`,resultLabel:(index,page,snippet)=>`परिणाम ${index}, पृष्ठ ${page}, ${snippet}`},
  hu:{progress:(current,total)=>`${current} / ${total}`,results:count=>`${count} találat`,page:page=>`${page}. oldal`,resultLabel:(index,page,snippet)=>`${index}. találat, ${page}. oldal, ${snippet}`},
  id:{progress:(current,total)=>`${current} dari ${total}`,results:count=>`${count} hasil`,page:page=>`Halaman ${page}`,resultLabel:(index,page,snippet)=>`Hasil ${index}, halaman ${page}, ${snippet}`},
  ms:{progress:(current,total)=>`${current} daripada ${total}`,results:count=>`${count} hasil`,page:page=>`Halaman ${page}`,resultLabel:(index,page,snippet)=>`Hasil ${index}, halaman ${page}, ${snippet}`},
  bn:{progress:(current,total)=>`${total}-এর মধ্যে ${current}`,results:count=>`${count}টি ফলাফল`,page:page=>`পৃষ্ঠা ${page}`,resultLabel:(index,page,snippet)=>`ফলাফল ${index}, পৃষ্ঠা ${page}, ${snippet}`},
  ps:{progress:(current,total)=>`له ${total} څخه ${current}`,results:count=>`${count} پایلې`,page:page=>`${page} مخ`,resultLabel:(index,page,snippet)=>`${index} پایله، ${page} مخ، ${snippet}`},
  so:{progress:(current,total)=>`${current} ka mid ah ${total}`,results:count=>`${count} natiijo`,page:page=>`Bogga ${page}`,resultLabel:(index,page,snippet)=>`Natiijada ${index}, bogga ${page}, ${snippet}`},
  ha:{progress:(current,total)=>`${current} cikin ${total}`,results:count=>`Sakamako ${count}`,page:page=>`Shafi ${page}`,resultLabel:(index,page,snippet)=>`Sakamako ${index}, shafi ${page}, ${snippet}`},
  ru:{progress:(current,total)=>`${current} из ${total}`,results:count=>`${count} результатов`,page:page=>`Страница ${page}`,resultLabel:(index,page,snippet)=>`Результат ${index}, страница ${page}, ${snippet}`},
  uk:{progress:(current,total)=>`${current} з ${total}`,results:count=>`${count} результатів`,page:page=>`Сторінка ${page}`,resultLabel:(index,page,snippet)=>`Результат ${index}, сторінка ${page}, ${snippet}`},
  de:{progress:(current,total)=>`${current} von ${total}`,results:count=>`${count} Ergebnisse`,page:page=>`Seite ${page}`,resultLabel:(index,page,snippet)=>`Ergebnis ${index}, Seite ${page}, ${snippet}`},
  es:{progress:(current,total)=>`${current} de ${total}`,results:count=>`${count} resultados`,page:page=>`Página ${page}`,resultLabel:(index,page,snippet)=>`Resultado ${index}, página ${page}, ${snippet}`},
  pt:{progress:(current,total)=>`${current} de ${total}`,results:count=>`${count} resultados`,page:page=>`Página ${page}`,resultLabel:(index,page,snippet)=>`Resultado ${index}, página ${page}, ${snippet}`},
  it:{progress:(current,total)=>`${current} di ${total}`,results:count=>`${count} risultati`,page:page=>`Pagina ${page}`,resultLabel:(index,page,snippet)=>`Risultato ${index}, pagina ${page}, ${snippet}`},
  nl:{progress:(current,total)=>`${current} van ${total}`,results:count=>`${count} resultaten`,page:page=>`Pagina ${page}`,resultLabel:(index,page,snippet)=>`Resultaat ${index}, pagina ${page}, ${snippet}`},
  sv:{progress:(current,total)=>`${current} av ${total}`,results:count=>`${count} resultat`,page:page=>`Sida ${page}`,resultLabel:(index,page,snippet)=>`Resultat ${index}, sida ${page}, ${snippet}`},
  no:{progress:(current,total)=>`${current} av ${total}`,results:count=>`${count} resultater`,page:page=>`Side ${page}`,resultLabel:(index,page,snippet)=>`Resultat ${index}, side ${page}, ${snippet}`},
  pl:{progress:(current,total)=>`${current} z ${total}`,results:count=>`${count} wyników`,page:page=>`Strona ${page}`,resultLabel:(index,page,snippet)=>`Wynik ${index}, strona ${page}, ${snippet}`},
  ro:{progress:(current,total)=>`${current} din ${total}`,results:count=>`${count} rezultate`,page:page=>`Pagina ${page}`,resultLabel:(index,page,snippet)=>`Rezultatul ${index}, pagina ${page}, ${snippet}`},
  bs:{progress:(current,total)=>`${current} od ${total}`,results:count=>`${count} rezultata`,page:page=>`Stranica ${page}`,resultLabel:(index,page,snippet)=>`Rezultat ${index}, stranica ${page}, ${snippet}`},
  sq:{progress:(current,total)=>`${current} nga ${total}`,results:count=>`${count} rezultate`,page:page=>`Faqja ${page}`,resultLabel:(index,page,snippet)=>`Rezultati ${index}, faqja ${page}, ${snippet}`},
  az:{progress:(current,total)=>`${total} nəticədən ${current}`,results:count=>`${count} nəticə`,page:page=>`Səhifə ${page}`,resultLabel:(index,page,snippet)=>`${index}-ci nəticə, səhifə ${page}, ${snippet}`},
  uz:{progress:(current,total)=>`${total} tadan ${current}`,results:count=>`${count} natija`,page:page=>`${page}-sahifa`,resultLabel:(index,page,snippet)=>`${index}-natija, ${page}-sahifa, ${snippet}`},
  kk:{progress:(current,total)=>`${total} ішінен ${current}`,results:count=>`${count} нәтиже`,page:page=>`${page}-бет`,resultLabel:(index,page,snippet)=>`${index}-нәтиже, ${page}-бет, ${snippet}`},
  zh:{progress:(current,total)=>`${current} / ${total}`,results:count=>`${count} 个结果`,page:page=>`第 ${page} 页`,resultLabel:(index,page,snippet)=>`结果 ${index}，第 ${page} 页，${snippet}`},
  ja:{progress:(current,total)=>`${current} / ${total}`,results:count=>`${count} 件`,page:page=>`${page} ページ`,resultLabel:(index,page,snippet)=>`結果 ${index}、${page} ページ、${snippet}`},
  ko:{progress:(current,total)=>`${current} / ${total}`,results:count=>`${count}개 결과`,page:page=>`${page}페이지`,resultLabel:(index,page,snippet)=>`결과 ${index}, ${page}페이지, ${snippet}`},
}
