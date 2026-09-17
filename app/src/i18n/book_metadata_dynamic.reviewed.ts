type BookMetadataDynamicTemplates = {
  deathYear: (year: string) => string
  wordPagination: (pages: string, wordMaximum: string) => string
  addedToShelf: (shelf: string) => string
  removedFromShelf: (shelf: string) => string
}

/** بيانات وصفية متغيرة ورسائل رفوف؛ اسم الرف قيمة مستخدم محفوظة حرفيًا. */
export const REVIEWED_BOOK_METADATA_DYNAMIC_TEMPLATES: Readonly<Record<string, BookMetadataDynamicTemplates>> = {
  en: { deathYear: year => `Died in ${year} AH`, wordPagination: (pages, wordMaximum) => `${pages} · Word pagination up to ${wordMaximum}`, addedToShelf: shelf => `Added to “${shelf}”`, removedFromShelf: shelf => `Removed from “${shelf}”` },
  fr: { deathYear: year => `Décédé en ${year} H`, wordPagination: (pages, wordMaximum) => `${pages} · Pagination Word jusqu’à ${wordMaximum}`, addedToShelf: shelf => `Ajouté à « ${shelf} »`, removedFromShelf: shelf => `Retiré de « ${shelf} »` },
  ug: { deathYear: year => `${year}-ھىجرىيەدە ۋاپات بولغان`, wordPagination: (pages, wordMaximum) => `${pages} · Word بەت نومۇرى ${wordMaximum} گىچە`, addedToShelf: shelf => `«${shelf}» جازىسىغا قوشۇلدى`, removedFromShelf: shelf => `«${shelf}» جازىسىدىن چىقىرىلدى` },
  ckb: {
    deathYear: year => `لە ساڵی ${year} کۆچی دوایی کرد`,
    wordPagination: (pages, wordMaximum) => `${pages} · ژمارەکردنی Word تا ${wordMaximum}`,
    addedToShelf: shelf => `زیاد کرا بۆ «${shelf}»`,
    removedFromShelf: shelf => `لە «${shelf}» لابرا`,
  },
  ku: {
    deathYear: year => `Di sala ${year} hicrî de wefat kir`,
    wordPagination: (pages, wordMaximum) => `${pages} · Hejmara Word heta ${wordMaximum}`,
    addedToShelf: shelf => `Li «${shelf}» hate zêdekirin`,
    removedFromShelf: shelf => `Ji «${shelf}» hate rakirin`,
  },
  tr: {
    deathYear: year => `Hicri ${year} yılında vefat etti`,
    wordPagination: (pages, wordMaximum) => `${pages} · Word numaralandırması ${wordMaximum} sayfasına kadar`,
    addedToShelf: shelf => `“${shelf}” rafına eklendi`,
    removedFromShelf: shelf => `“${shelf}” rafından çıkarıldı`,
  },
  ur: {
    deathYear: year => `وفات ${year}ھ`,
    wordPagination: (pages, wordMaximum) => `${pages} · Word ترقیم ${wordMaximum} تک`,
    addedToShelf: shelf => `”${shelf}“ میں شامل ہوگئی`,
    removedFromShelf: shelf => `”${shelf}“ سے ہٹا دی گئی`,
  },
  fa: {
    deathYear: year => `در سال ${year} هجری درگذشت`,
    wordPagination: (pages, wordMaximum) => `${pages} · شماره‌گذاری Word تا ${wordMaximum}`,
    addedToShelf: shelf => `به «${shelf}» افزوده شد`,
    removedFromShelf: shelf => `از «${shelf}» حذف شد`,
  },
  sw: { deathYear: year => `Alifariki mwaka ${year} H`, wordPagination: (pages, wordMaximum) => `${pages} · Kurasa za Word hadi ${wordMaximum}`, addedToShelf: shelf => `Kimeongezwa kwenye “${shelf}”`, removedFromShelf: shelf => `Kimeondolewa kwenye “${shelf}”` },
  hi: { deathYear: year => `${year} हिजरी में निधन`, wordPagination: (pages, wordMaximum) => `${pages} · Word पृष्ठांकन ${wordMaximum} तक`, addedToShelf: shelf => `“${shelf}” में जोड़ा गया`, removedFromShelf: shelf => `“${shelf}” से हटाया गया` },
  hu: { deathYear: year => `Elhunyt ${year} hidzsri évben`, wordPagination: (pages, wordMaximum) => `${pages} · Word-oldalszámozás ${wordMaximum}-ig`, addedToShelf: shelf => `Hozzáadva: „${shelf}”`, removedFromShelf: shelf => `Eltávolítva innen: „${shelf}”` },
  id: { deathYear: year => `Wafat pada ${year} H`, wordPagination: (pages, wordMaximum) => `${pages} · Penomoran Word hingga ${wordMaximum}`, addedToShelf: shelf => `Ditambahkan ke “${shelf}”`, removedFromShelf: shelf => `Dihapus dari “${shelf}”` },
  ms: { deathYear: year => `Wafat pada ${year} H`, wordPagination: (pages, wordMaximum) => `${pages} · Penomboran Word hingga ${wordMaximum}`, addedToShelf: shelf => `Ditambah ke “${shelf}”`, removedFromShelf: shelf => `Dialih keluar daripada “${shelf}”` },
  bn: { deathYear: year => `${year} হিজরিতে মৃত্যু`, wordPagination: (pages, wordMaximum) => `${pages} · Word পৃষ্ঠা নম্বর ${wordMaximum} পর্যন্ত`, addedToShelf: shelf => `“${shelf}”-এ যোগ হয়েছে`, removedFromShelf: shelf => `“${shelf}” থেকে সরানো হয়েছে` },
  ps: { deathYear: year => `په ${year} هـ کال وفات شو`, wordPagination: (pages, wordMaximum) => `${pages} · د Word مخ شمېرنه تر ${wordMaximum}`, addedToShelf: shelf => `“${shelf}” ته زیات شو`, removedFromShelf: shelf => `له “${shelf}” لرې شو` },
  so: { deathYear: year => `Wuxuu dhintay ${year} H`, wordPagination: (pages, wordMaximum) => `${pages} · Bog-tirinta Word ilaa ${wordMaximum}`, addedToShelf: shelf => `Lagu daray “${shelf}”`, removedFromShelf: shelf => `Laga saaray “${shelf}”` },
  ha: { deathYear: year => `Ya rasu a ${year} H`, wordPagination: (pages, wordMaximum) => `${pages} · Lambobin Word zuwa ${wordMaximum}`, addedToShelf: shelf => `An ƙara zuwa “${shelf}”`, removedFromShelf: shelf => `An cire daga “${shelf}”` },
  ru: { deathYear: year => `Умер в ${year} г. х.`, wordPagination: (pages, wordMaximum) => `${pages} · Нумерация Word до ${wordMaximum}`, addedToShelf: shelf => `Добавлено на полку «${shelf}»`, removedFromShelf: shelf => `Удалено с полки «${shelf}»` },
  uk: { deathYear: year => `Помер у ${year} р. г.`, wordPagination: (pages, wordMaximum) => `${pages} · Нумерація Word до ${wordMaximum}`, addedToShelf: shelf => `Додано на полицю «${shelf}»`, removedFromShelf: shelf => `Вилучено з полиці «${shelf}»` },
  de: { deathYear: year => `Gestorben ${year} n. H.`, wordPagination: (pages, wordMaximum) => `${pages} · Word-Seitenzählung bis ${wordMaximum}`, addedToShelf: shelf => `Zu „${shelf}“ hinzugefügt`, removedFromShelf: shelf => `Aus „${shelf}“ entfernt` },
  es: { deathYear: year => `Falleció en ${year} H`, wordPagination: (pages, wordMaximum) => `${pages} · Paginación de Word hasta ${wordMaximum}`, addedToShelf: shelf => `Añadido a «${shelf}»`, removedFromShelf: shelf => `Eliminado de «${shelf}»` },
  pt: { deathYear: year => `Faleceu em ${year} H`, wordPagination: (pages, wordMaximum) => `${pages} · Paginação Word até ${wordMaximum}`, addedToShelf: shelf => `Adicionado a «${shelf}»`, removedFromShelf: shelf => `Removido de «${shelf}»` },
  it: { deathYear: year => `Morto nel ${year} H`, wordPagination: (pages, wordMaximum) => `${pages} · Numerazione Word fino a ${wordMaximum}`, addedToShelf: shelf => `Aggiunto a “${shelf}”`, removedFromShelf: shelf => `Rimosso da “${shelf}”` },
  nl: { deathYear: year => `Overleden in ${year} H`, wordPagination: (pages, wordMaximum) => `${pages} · Word-paginering tot ${wordMaximum}`, addedToShelf: shelf => `Toegevoegd aan ‘${shelf}’`, removedFromShelf: shelf => `Verwijderd uit ‘${shelf}’` },
  sv: { deathYear: year => `Avled år ${year} H`, wordPagination: (pages, wordMaximum) => `${pages} · Word-sidnumrering till ${wordMaximum}`, addedToShelf: shelf => `Tillagd i ”${shelf}”`, removedFromShelf: shelf => `Borttagen från ”${shelf}”` },
  no: { deathYear: year => `Døde i ${year} H`, wordPagination: (pages, wordMaximum) => `${pages} · Word-sidenummerering til ${wordMaximum}`, addedToShelf: shelf => `Lagt til i «${shelf}»`, removedFromShelf: shelf => `Fjernet fra «${shelf}»` },
  pl: { deathYear: year => `Zmarł w ${year} r. hidżry`, wordPagination: (pages, wordMaximum) => `${pages} · Numeracja Word do ${wordMaximum}`, addedToShelf: shelf => `Dodano do „${shelf}”`, removedFromShelf: shelf => `Usunięto z „${shelf}”` },
  ro: { deathYear: year => `A murit în anul ${year} H`, wordPagination: (pages, wordMaximum) => `${pages} · Numerotare Word până la ${wordMaximum}`, addedToShelf: shelf => `Adăugat la „${shelf}”`, removedFromShelf: shelf => `Eliminat din „${shelf}”` },
  bs: { deathYear: year => `Preselio ${year}. h.`, wordPagination: (pages, wordMaximum) => `${pages} · Word numeracija do ${wordMaximum}`, addedToShelf: shelf => `Dodano na „${shelf}”`, removedFromShelf: shelf => `Uklonjeno sa „${shelf}”` },
  sq: { deathYear: year => `Vdiq në vitin ${year} H`, wordPagination: (pages, wordMaximum) => `${pages} · Numërimi Word deri në ${wordMaximum}`, addedToShelf: shelf => `U shtua te “${shelf}”`, removedFromShelf: shelf => `U hoq nga “${shelf}”` },
  az: { deathYear: year => `${year} hicri ilində vəfat edib`, wordPagination: (pages, wordMaximum) => `${pages} · Word nömrələnməsi ${wordMaximum}-dək`, addedToShelf: shelf => `“${shelf}” rəfinə əlavə edildi`, removedFromShelf: shelf => `“${shelf}” rəfindən çıxarıldı` },
  uz: { deathYear: year => `${year} hijriy yilda vafot etgan`, wordPagination: (pages, wordMaximum) => `${pages} · Word raqamlashi ${wordMaximum} gacha`, addedToShelf: shelf => `“${shelf}” javoniga qo‘shildi`, removedFromShelf: shelf => `“${shelf}” javonidan olib tashlandi` },
  kk: { deathYear: year => `${year} хижри жылы қайтыс болған`, wordPagination: (pages, wordMaximum) => `${pages} · Word нөмірлеуі ${wordMaximum}-ге дейін`, addedToShelf: shelf => `«${shelf}» сөресіне қосылды`, removedFromShelf: shelf => `«${shelf}» сөресінен алынды` },
  zh: { deathYear: year => `卒于伊历 ${year} 年`, wordPagination: (pages, wordMaximum) => `${pages} · Word 页码至 ${wordMaximum}`, addedToShelf: shelf => `已添加到“${shelf}”`, removedFromShelf: shelf => `已从“${shelf}”移除` },
  ja: { deathYear: year => `ヒジュラ暦 ${year} 年没`, wordPagination: (pages, wordMaximum) => `${pages} · Word ページ番号は ${wordMaximum} まで`, addedToShelf: shelf => `「${shelf}」に追加しました`, removedFromShelf: shelf => `「${shelf}」から削除しました` },
  ko: { deathYear: year => `히즈라력 ${year}년 사망`, wordPagination: (pages, wordMaximum) => `${pages} · Word 페이지 번호 ${wordMaximum}까지`, addedToShelf: shelf => `“${shelf}”에 추가됨`, removedFromShelf: shelf => `“${shelf}”에서 제거됨` },
}
