type ShelvesDynamicTemplates = {
  chooseBook: (shelf: string) => string
  availableBooks: (shelf: string) => string
  deleteShelf: (shelf: string) => string
  removeBook: (book: string, shelf: string) => string
}

/** تسميات وصول ديناميكية؛ أسماء الرفوف والكتب قيم مستخدم لا تُترجم. */
export const REVIEWED_SHELVES_DYNAMIC_TEMPLATES: Readonly<Record<string, ShelvesDynamicTemplates>> = {
  en: { chooseBook: shelf => `Choose a book to add to shelf ${shelf}`, availableBooks: shelf => `Available library books for shelf ${shelf}`, deleteShelf: shelf => `Delete shelf ${shelf}`, removeBook: (book, shelf) => `Remove ${book} from shelf ${shelf}` },
  fr: { chooseBook: shelf => `Choisir un livre à ajouter à l’étagère ${shelf}`, availableBooks: shelf => `Livres disponibles pour l’étagère ${shelf}`, deleteShelf: shelf => `Supprimer l’étagère ${shelf}`, removeBook: (book, shelf) => `Retirer ${book} de l’étagère ${shelf}` },
  ug: { chooseBook: shelf => `${shelf} جازىسىغا قوشىدىغان كىتابنى تاللاڭ`, availableBooks: shelf => `${shelf} جازىسى ئۈچۈن بار كىتابلار`, deleteShelf: shelf => `${shelf} جازىسىنى ئۆچۈرۈش`, removeBook: (book, shelf) => `${book} نى ${shelf} جازىسىدىن چىقىرىش` },
  ckb: {
    chooseBook: shelf => `کتێبێک هەڵبژێرە بۆ زیادکردن بۆ ڕەفی ${shelf}`,
    availableBooks: shelf => `کتێبە بەردەستەکانی کتێبخانە بۆ ڕەفی ${shelf}`,
    deleteShelf: shelf => `سڕینەوەی ڕەفی ${shelf}`,
    removeBook: (book, shelf) => `لابردنی ${book} لە ڕەفی ${shelf}`,
  },
  ku: {
    chooseBook: shelf => `Pirtûkek hilbijêre ku li refa ${shelf} zêde bikî`,
    availableBooks: shelf => `Pirtûkên pirtûkxaneyê yên berdest ji bo refa ${shelf}`,
    deleteShelf: shelf => `Refa ${shelf} jê bibe`,
    removeBook: (book, shelf) => `${book} ji refa ${shelf} rake`,
  },
  tr: {
    chooseBook: shelf => `${shelf} rafına eklenecek kitabı seç`,
    availableBooks: shelf => `${shelf} rafı için kullanılabilir kitaplık kitapları`,
    deleteShelf: shelf => `${shelf} rafını sil`,
    removeBook: (book, shelf) => `${book} kitabını ${shelf} rafından çıkar`,
  },
  ur: {
    chooseBook: shelf => `${shelf} شیلف میں شامل کرنے کے لیے کتاب منتخب کریں`,
    availableBooks: shelf => `${shelf} شیلف کے لیے دستیاب کتب خانے کی کتابیں`,
    deleteShelf: shelf => `${shelf} شیلف حذف کریں`,
    removeBook: (book, shelf) => `${book} کو ${shelf} شیلف سے ہٹائیں`,
  },
  fa: {
    chooseBook: shelf => `کتابی برای افزودن به قفسهٔ ${shelf} انتخاب کنید`,
    availableBooks: shelf => `کتاب‌های موجود کتابخانه برای قفسهٔ ${shelf}`,
    deleteShelf: shelf => `حذف قفسهٔ ${shelf}`,
    removeBook: (book, shelf) => `حذف ${book} از قفسهٔ ${shelf}`,
  },
  sw: { chooseBook: shelf => `Chagua kitabu cha kuongeza kwenye rafu ${shelf}`, availableBooks: shelf => `Vitabu vinavyopatikana kwa rafu ${shelf}`, deleteShelf: shelf => `Futa rafu ${shelf}`, removeBook: (book, shelf) => `Ondoa ${book} kwenye rafu ${shelf}` },
  hi: { chooseBook: shelf => `${shelf} शेल्फ़ में जोड़ने के लिए पुस्तक चुनें`, availableBooks: shelf => `${shelf} शेल्फ़ के लिए उपलब्ध पुस्तकें`, deleteShelf: shelf => `${shelf} शेल्फ़ हटाएँ`, removeBook: (book, shelf) => `${book} को ${shelf} शेल्फ़ से हटाएँ` },
  hu: { chooseBook: shelf => `Válasszon könyvet a(z) ${shelf} polchoz`, availableBooks: shelf => `Elérhető könyvek a(z) ${shelf} polchoz`, deleteShelf: shelf => `A(z) ${shelf} polc törlése`, removeBook: (book, shelf) => `${book} eltávolítása a(z) ${shelf} polcról` },
  id: { chooseBook: shelf => `Pilih buku untuk ditambahkan ke rak ${shelf}`, availableBooks: shelf => `Buku yang tersedia untuk rak ${shelf}`, deleteShelf: shelf => `Hapus rak ${shelf}`, removeBook: (book, shelf) => `Hapus ${book} dari rak ${shelf}` },
  ms: { chooseBook: shelf => `Pilih buku untuk ditambah ke rak ${shelf}`, availableBooks: shelf => `Buku tersedia untuk rak ${shelf}`, deleteShelf: shelf => `Padam rak ${shelf}`, removeBook: (book, shelf) => `Alih keluar ${book} daripada rak ${shelf}` },
  bn: { chooseBook: shelf => `${shelf} তাকে যোগ করার বই বেছে নিন`, availableBooks: shelf => `${shelf} তাকের জন্য উপলভ্য বই`, deleteShelf: shelf => `${shelf} তাক মুছুন`, removeBook: (book, shelf) => `${shelf} তাক থেকে ${book} সরান` },
  ps: { chooseBook: shelf => `${shelf} المارۍ ته د زیاتولو لپاره کتاب وټاکئ`, availableBooks: shelf => `د ${shelf} المارۍ لپاره شته کتابونه`, deleteShelf: shelf => `${shelf} المارۍ ړنګه کړئ`, removeBook: (book, shelf) => `${book} له ${shelf} المارۍ لرې کړئ` },
  so: { chooseBook: shelf => `Dooro buug lagu daro shelf-ka ${shelf}`, availableBooks: shelf => `Buugaagta u diyaarsan shelf-ka ${shelf}`, deleteShelf: shelf => `Tirtir shelf-ka ${shelf}`, removeBook: (book, shelf) => `Ka saar ${book} shelf-ka ${shelf}` },
  ha: { chooseBook: shelf => `Zaɓi littafi don ƙarawa kan shiryayyen ${shelf}`, availableBooks: shelf => `Littattafan da ake da su don shiryayyen ${shelf}`, deleteShelf: shelf => `Goge shiryayyen ${shelf}`, removeBook: (book, shelf) => `Cire ${book} daga shiryayyen ${shelf}` },
  ru: { chooseBook: shelf => `Выбрать книгу для полки «${shelf}»`, availableBooks: shelf => `Доступные книги для полки «${shelf}»`, deleteShelf: shelf => `Удалить полку «${shelf}»`, removeBook: (book, shelf) => `Убрать «${book}» с полки «${shelf}»` },
  uk: { chooseBook: shelf => `Вибрати книгу для полиці «${shelf}»`, availableBooks: shelf => `Доступні книги для полиці «${shelf}»`, deleteShelf: shelf => `Видалити полицю «${shelf}»`, removeBook: (book, shelf) => `Прибрати «${book}» з полиці «${shelf}»` },
  de: { chooseBook: shelf => `Buch für das Regal „${shelf}“ auswählen`, availableBooks: shelf => `Verfügbare Bücher für das Regal „${shelf}“`, deleteShelf: shelf => `Regal „${shelf}“ löschen`, removeBook: (book, shelf) => `${book} aus dem Regal „${shelf}“ entfernen` },
  es: { chooseBook: shelf => `Elegir un libro para la estantería «${shelf}»`, availableBooks: shelf => `Libros disponibles para la estantería «${shelf}»`, deleteShelf: shelf => `Eliminar la estantería «${shelf}»`, removeBook: (book, shelf) => `Quitar ${book} de la estantería «${shelf}»` },
  pt: { chooseBook: shelf => `Escolher um livro para a estante «${shelf}»`, availableBooks: shelf => `Livros disponíveis para a estante «${shelf}»`, deleteShelf: shelf => `Eliminar a estante «${shelf}»`, removeBook: (book, shelf) => `Remover ${book} da estante «${shelf}»` },
  it: { chooseBook: shelf => `Scegli un libro per lo scaffale “${shelf}”`, availableBooks: shelf => `Libri disponibili per lo scaffale “${shelf}”`, deleteShelf: shelf => `Elimina lo scaffale “${shelf}”`, removeBook: (book, shelf) => `Rimuovi ${book} dallo scaffale “${shelf}”` },
  nl: { chooseBook: shelf => `Kies een boek voor plank ‘${shelf}’`, availableBooks: shelf => `Beschikbare boeken voor plank ‘${shelf}’`, deleteShelf: shelf => `Plank ‘${shelf}’ verwijderen`, removeBook: (book, shelf) => `${book} van plank ‘${shelf}’ verwijderen` },
  sv: { chooseBook: shelf => `Välj en bok för hyllan ”${shelf}”`, availableBooks: shelf => `Tillgängliga böcker för hyllan ”${shelf}”`, deleteShelf: shelf => `Ta bort hyllan ”${shelf}”`, removeBook: (book, shelf) => `Ta bort ${book} från hyllan ”${shelf}”` },
  no: { chooseBook: shelf => `Velg en bok for hyllen «${shelf}»`, availableBooks: shelf => `Tilgjengelige bøker for hyllen «${shelf}»`, deleteShelf: shelf => `Slett hyllen «${shelf}»`, removeBook: (book, shelf) => `Fjern ${book} fra hyllen «${shelf}»` },
  pl: { chooseBook: shelf => `Wybierz książkę na półkę „${shelf}”`, availableBooks: shelf => `Dostępne książki na półkę „${shelf}”`, deleteShelf: shelf => `Usuń półkę „${shelf}”`, removeBook: (book, shelf) => `Usuń ${book} z półki „${shelf}”` },
  ro: { chooseBook: shelf => `Alegeți o carte pentru raftul „${shelf}”`, availableBooks: shelf => `Cărți disponibile pentru raftul „${shelf}”`, deleteShelf: shelf => `Ștergeți raftul „${shelf}”`, removeBook: (book, shelf) => `Eliminați ${book} de pe raftul „${shelf}”` },
  bs: { chooseBook: shelf => `Izaberite knjigu za policu „${shelf}”`, availableBooks: shelf => `Dostupne knjige za policu „${shelf}”`, deleteShelf: shelf => `Izbriši policu „${shelf}”`, removeBook: (book, shelf) => `Ukloni ${book} s police „${shelf}”` },
  sq: { chooseBook: shelf => `Zgjidhni një libër për raftin “${shelf}”`, availableBooks: shelf => `Librat e disponueshëm për raftin “${shelf}”`, deleteShelf: shelf => `Fshini raftin “${shelf}”`, removeBook: (book, shelf) => `Hiqni ${book} nga rafti “${shelf}”` },
  az: { chooseBook: shelf => `${shelf} rəfinə əlavə etmək üçün kitab seçin`, availableBooks: shelf => `${shelf} rəfi üçün mövcud kitablar`, deleteShelf: shelf => `${shelf} rəfini silin`, removeBook: (book, shelf) => `${book} kitabını ${shelf} rəfindən çıxarın` },
  uz: { chooseBook: shelf => `${shelf} javoniga qo‘shish uchun kitob tanlang`, availableBooks: shelf => `${shelf} javoni uchun mavjud kitoblar`, deleteShelf: shelf => `${shelf} javonini o‘chiring`, removeBook: (book, shelf) => `${book} kitobini ${shelf} javonidan olib tashlang` },
  kk: { chooseBook: shelf => `${shelf} сөресіне қосу үшін кітап таңдаңыз`, availableBooks: shelf => `${shelf} сөресіне қолжетімді кітаптар`, deleteShelf: shelf => `${shelf} сөресін жою`, removeBook: (book, shelf) => `${book} кітабын ${shelf} сөресінен алып тастау` },
  zh: { chooseBook: shelf => `选择要添加到“${shelf}”书架的图书`, availableBooks: shelf => `“${shelf}”书架可用的图书`, deleteShelf: shelf => `删除“${shelf}”书架`, removeBook: (book, shelf) => `从“${shelf}”书架移除 ${book}` },
  ja: { chooseBook: shelf => `「${shelf}」本棚に追加する書籍を選択`, availableBooks: shelf => `「${shelf}」本棚に追加できる書籍`, deleteShelf: shelf => `「${shelf}」本棚を削除`, removeBook: (book, shelf) => `「${shelf}」本棚から ${book} を削除` },
  ko: { chooseBook: shelf => `“${shelf}” 서가에 추가할 책 선택`, availableBooks: shelf => `“${shelf}” 서가에 추가할 수 있는 책`, deleteShelf: shelf => `“${shelf}” 서가 삭제`, removeBook: (book, shelf) => `“${shelf}” 서가에서 ${book} 제거` },
}
