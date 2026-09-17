type EditionsSeriesDynamicTemplates = {
  position: (offset: string) => string
  verifiedEditions: (count: string) => string
  books: (count: string) => string
}

/** عدادات مركز الطبعات والسلاسل؛ عناوين الأعمال وأسماء المؤلفين ليست جزءًا منها. */
export const REVIEWED_EDITIONS_SERIES_DYNAMIC_TEMPLATES: Readonly<Record<string, EditionsSeriesDynamicTemplates>> = {
  en: { position: offset => `Position ${offset}`, verifiedEditions: count => `${count} verified editions`, books: count => `${count} books` },
  fr: { position: offset => `Position ${offset}`, verifiedEditions: count => `${count} éditions vérifiées`, books: count => `${count} livres` },
  ug: { position: offset => `ئورۇن ${offset}`, verifiedEditions: count => `${count} دەلىللەنگەن نەشر`, books: count => `${count} كىتاب` },
  ckb: {
    position: offset => `شوێن ${offset}`,
    verifiedEditions: count => `${count} چاپی پشتڕاستکراو`,
    books: count => `${count} کتێب`,
  },
  ku: {
    position: offset => `Cih ${offset}`,
    verifiedEditions: count => `${count} çapên belgekirî`,
    books: count => `${count} pirtûk`,
  },
  tr: {
    position: offset => `Konum ${offset}`,
    verifiedEditions: count => `${count} doğrulanmış baskı`,
    books: count => `${count} kitap`,
  },
  ur: {
    position: offset => `مقام ${offset}`,
    verifiedEditions: count => `${count} مستند طبعات`,
    books: count => `${count} کتابیں`,
  },
  fa: {
    position: offset => `موقعیت ${offset}`,
    verifiedEditions: count => `${count} چاپ تأییدشده`,
    books: count => `${count} کتاب`,
  },
  sw: { position: offset => `Nafasi ${offset}`, verifiedEditions: count => `Matoleo ${count} yaliyothibitishwa`, books: count => `Vitabu ${count}` },
  hi: { position: offset => `स्थान ${offset}`, verifiedEditions: count => `${count} सत्यापित संस्करण`, books: count => `${count} पुस्तकें` },
  hu: { position: offset => `${offset}. hely`, verifiedEditions: count => `${count} ellenőrzött kiadás`, books: count => `${count} könyv` },
  id: { position: offset => `Posisi ${offset}`, verifiedEditions: count => `${count} edisi terverifikasi`, books: count => `${count} buku` },
  ms: { position: offset => `Kedudukan ${offset}`, verifiedEditions: count => `${count} edisi disahkan`, books: count => `${count} buku` },
  bn: { position: offset => `অবস্থান ${offset}`, verifiedEditions: count => `${count}টি যাচাইকৃত সংস্করণ`, books: count => `${count}টি বই` },
  ps: { position: offset => `ځای ${offset}`, verifiedEditions: count => `${count} تایید شوې چاپونه`, books: count => `${count} کتابونه` },
  so: { position: offset => `Booska ${offset}`, verifiedEditions: count => `${count} daabacaado la xaqiijiyey`, books: count => `${count} buug` },
  ha: { position: offset => `Matsayi ${offset}`, verifiedEditions: count => `Bugu ${count} da aka tabbatar`, books: count => `Littattafai ${count}` },
  ru: { position: offset => `Позиция ${offset}`, verifiedEditions: count => `${count} проверенных изданий`, books: count => `${count} книг` },
  uk: { position: offset => `Позиція ${offset}`, verifiedEditions: count => `${count} перевірених видань`, books: count => `${count} книг` },
  de: { position: offset => `Position ${offset}`, verifiedEditions: count => `${count} geprüfte Ausgaben`, books: count => `${count} Bücher` },
  es: { position: offset => `Posición ${offset}`, verifiedEditions: count => `${count} ediciones verificadas`, books: count => `${count} libros` },
  pt: { position: offset => `Posição ${offset}`, verifiedEditions: count => `${count} edições verificadas`, books: count => `${count} livros` },
  it: { position: offset => `Posizione ${offset}`, verifiedEditions: count => `${count} edizioni verificate`, books: count => `${count} libri` },
  nl: { position: offset => `Positie ${offset}`, verifiedEditions: count => `${count} geverifieerde edities`, books: count => `${count} boeken` },
  sv: { position: offset => `Position ${offset}`, verifiedEditions: count => `${count} verifierade utgåvor`, books: count => `${count} böcker` },
  no: { position: offset => `Posisjon ${offset}`, verifiedEditions: count => `${count} verifiserte utgaver`, books: count => `${count} bøker` },
  pl: { position: offset => `Pozycja ${offset}`, verifiedEditions: count => `${count} zweryfikowanych wydań`, books: count => `${count} książek` },
  ro: { position: offset => `Poziția ${offset}`, verifiedEditions: count => `${count} ediții verificate`, books: count => `${count} cărți` },
  bs: { position: offset => `Pozicija ${offset}`, verifiedEditions: count => `${count} provjerenih izdanja`, books: count => `${count} knjiga` },
  sq: { position: offset => `Pozicioni ${offset}`, verifiedEditions: count => `${count} botime të verifikuara`, books: count => `${count} libra` },
  az: { position: offset => `Mövqe ${offset}`, verifiedEditions: count => `${count} təsdiqlənmiş nəşr`, books: count => `${count} kitab` },
  uz: { position: offset => `${offset}-o‘rin`, verifiedEditions: count => `${count} ta tasdiqlangan nashr`, books: count => `${count} ta kitob` },
  kk: { position: offset => `${offset}-орын`, verifiedEditions: count => `${count} тексерілген басылым`, books: count => `${count} кітап` },
  zh: { position: offset => `位置 ${offset}`, verifiedEditions: count => `${count} 个已验证版本`, books: count => `${count} 本书` },
  ja: { position: offset => `位置 ${offset}`, verifiedEditions: count => `${count} 件の確認済み版`, books: count => `${count} 冊` },
  ko: { position: offset => `위치 ${offset}`, verifiedEditions: count => `검증된 판본 ${count}개`, books: count => `책 ${count}권` },
}
