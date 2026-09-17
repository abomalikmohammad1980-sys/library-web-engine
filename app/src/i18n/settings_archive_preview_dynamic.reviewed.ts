type SettingsArchivePreviewDynamicTemplates = {
  preview: (total: string, conflicts: string, replaceSame: boolean) => string
}

/** معاينة استعادة الأرشيف؛ total/conflicts عدّادان آتيان من ملف المستخدم ويحفظان حرفيًا. */
export const REVIEWED_SETTINGS_ARCHIVE_PREVIEW_DYNAMIC_TEMPLATES: Readonly<Record<string, SettingsArchivePreviewDynamicTemplates>> = {
  en: { preview: (total, conflicts, replaceSame) => `Preview: ${total} books, ${conflicts} conflicts.${replaceSame ? ' Each conflicting book will be replaced in a separate operation.' : ''} Reading data is not imported from this ZIP. Continue?` },
  fr: { preview: (total, conflicts, replaceSame) => `Aperçu : ${total} livres, dont ${conflicts} en conflit.${replaceSame ? ' Chaque livre en conflit sera remplacé séparément.' : ''} Les données de lecture ne sont pas importées depuis ce ZIP. Continuer ?` },
  ug: { preview: (total, conflicts, replaceSame) => `ئالدىن كۆرۈش: ${total} كىتاب، ${conflicts} توقۇنۇش.${replaceSame ? ' ھەر بىر توقۇنۇشقان كىتاب ئايرىم مەشغۇلاتتا ئالماشتۇرۇلىدۇ.' : ''} ئوقۇش سانلىق مەلۇماتى بۇ ZIPتىن ئەكىرىلمەيدۇ. داۋاملاشتۇرامسىز؟` },
  ckb: {
    preview: (total, conflicts, replaceSame) => `پێشبینین: ${total} کتێب، ${conflicts} لەوانە دژبەرن.${replaceSame ? ' کتێبە دژبەرەکان یەک بە یەک جێگەیان دەگیرێتەوە.' : ''} داتای خوێندنەوە لەم ZIPە هاوردە ناکرێت. بەردەوام بیت؟`,
  },
  ku: {
    preview: (total, conflicts, replaceSame) => `Pêşdîtin: ${total} pirtûk, ${conflicts} nakok.${replaceSame ? ' Her pirtûka nakok bi danûstendineke serbixwe tê guhertin.' : ''} Daneyên xwendinê ji vê ZIP nayên têxistin. Bidomîne?`,
  },
  tr: {
    preview: (total, conflicts, replaceSame) => `Önizleme: ${total} kitap, ${conflicts} çakışma.${replaceSame ? ' Çakışan kitapların her biri ayrı bir işlemle değiştirilecek.' : ''} Okuma verileri bu ZIP dosyasından içe aktarılmaz. Devam edilsin mi?`,
  },
  ur: {
    preview: (total, conflicts, replaceSame) => `پیش منظر: ${total} کتابیں، ان میں ${conflicts} متصادم ہیں۔${replaceSame ? ' ہر متصادم کتاب الگ کارروائی میں بدلی جائے گی۔' : ''} اس ZIP سے مطالعے کا ڈیٹا درآمد نہیں ہوگا۔ جاری رکھیں؟`,
  },
  fa: {
    preview: (total, conflicts, replaceSame) => `پیش‌نمایش: ${total} کتاب، شامل ${conflicts} مورد ناسازگار.${replaceSame ? ' هر کتاب ناسازگار در عملیاتی جداگانه جایگزین می‌شود.' : ''} داده‌های مطالعه از این ZIP وارد نمی‌شود. ادامه می‌دهید؟`,
  },
  sw: { preview: (total, conflicts, replaceSame) => `Onyesho la awali: vitabu ${total}, migongano ${conflicts}.${replaceSame ? ' Kila kitabu chenye mgongano kitabadilishwa kwa operesheni tofauti.' : ''} Data ya usomaji haiingizwi kutoka ZIP hii. Uendelee?` },
  hi: { preview: (total, conflicts, replaceSame) => `पूर्वावलोकन: ${total} पुस्तकें, ${conflicts} विरोध.${replaceSame ? ' प्रत्येक विरोधी पुस्तक अलग प्रक्रिया में बदली जाएगी।' : ''} इस ZIP से पठन डेटा आयात नहीं होगा। जारी रखें?` },
  hu: { preview: (total, conflicts, replaceSame) => `Előnézet: ${total} könyv, ${conflicts} ütközés.${replaceSame ? ' Minden ütköző könyv külön művelettel lesz lecserélve.' : ''} Az olvasási adatok nem kerülnek importálásra ebből a ZIP-ből. Folytatja?` },
  id: { preview: (total, conflicts, replaceSame) => `Pratinjau: ${total} buku, ${conflicts} konflik.${replaceSame ? ' Setiap buku yang berkonflik akan diganti melalui operasi terpisah.' : ''} Data bacaan tidak diimpor dari ZIP ini. Lanjutkan?` },
  ms: { preview: (total, conflicts, replaceSame) => `Pratonton: ${total} buku, ${conflicts} konflik.${replaceSame ? ' Setiap buku berkonflik akan diganti melalui operasi berasingan.' : ''} Data bacaan tidak diimport daripada ZIP ini. Teruskan?` },
  bn: { preview: (total, conflicts, replaceSame) => `পূর্বরূপ: ${total}টি বই, ${conflicts}টি দ্বন্দ্ব.${replaceSame ? ' প্রতিটি দ্বন্দ্বপূর্ণ বই আলাদা প্রক্রিয়ায় প্রতিস্থাপিত হবে।' : ''} এই ZIP থেকে পাঠের তথ্য আমদানি হবে না। চালিয়ে যাবেন?` },
  ps: { preview: (total, conflicts, replaceSame) => `مخکتنه: ${total} کتابونه، ${conflicts} ټکرونه.${replaceSame ? ' هر ټکر لرونکی کتاب به په جلا عملیاتو کې بدل شي.' : ''} د لوست معلومات له دې ZIP څخه نه راوړل کېږي. دوام ورکړئ؟` },
  so: { preview: (total, conflicts, replaceSame) => `Hordhac: ${total} buug, ${conflicts} is-khilaaf.${replaceSame ? ' Buug kasta oo is-khilaafsan si gaar ah ayaa loo beddeli doonaa.' : ''} Xogta akhriska lagama soo dejinayo ZIP-kan. Sii wad?` },
  ha: { preview: (total, conflicts, replaceSame) => `Dubawa: littattafai ${total}, rikice-rikice ${conflicts}.${replaceSame ? ' Za a maye gurbin kowane littafi mai rikici a aiki daban.' : ''} Ba a shigo da bayanan karatu daga wannan ZIP ba. A ci gaba?` },
  ru: { preview: (total, conflicts, replaceSame) => `Предпросмотр: ${total} книг, конфликтов: ${conflicts}.${replaceSame ? ' Каждая конфликтующая книга будет заменена отдельной операцией.' : ''} Данные чтения из этого ZIP не импортируются. Продолжить?` },
  uk: { preview: (total, conflicts, replaceSame) => `Попередній перегляд: ${total} книг, конфліктів: ${conflicts}.${replaceSame ? ' Кожну конфліктну книгу буде замінено окремою операцією.' : ''} Дані читання з цього ZIP не імпортуються. Продовжити?` },
  de: { preview: (total, conflicts, replaceSame) => `Vorschau: ${total} Bücher, ${conflicts} Konflikte.${replaceSame ? ' Jedes konfliktbehaftete Buch wird in einem eigenen Vorgang ersetzt.' : ''} Lesedaten werden aus diesem ZIP nicht importiert. Fortfahren?` },
  es: { preview: (total, conflicts, replaceSame) => `Vista previa: ${total} libros, ${conflicts} conflictos.${replaceSame ? ' Cada libro en conflicto se reemplazará en una operación independiente.' : ''} Los datos de lectura no se importan desde este ZIP. ¿Continuar?` },
  pt: { preview: (total, conflicts, replaceSame) => `Pré-visualização: ${total} livros, ${conflicts} conflitos.${replaceSame ? ' Cada livro em conflito será substituído numa operação separada.' : ''} Os dados de leitura não são importados deste ZIP. Continuar?` },
  it: { preview: (total, conflicts, replaceSame) => `Anteprima: ${total} libri, ${conflicts} conflitti.${replaceSame ? ' Ogni libro in conflitto verrà sostituito con un’operazione separata.' : ''} I dati di lettura non vengono importati da questo ZIP. Continuare?` },
  nl: { preview: (total, conflicts, replaceSame) => `Voorbeeld: ${total} boeken, ${conflicts} conflicten.${replaceSame ? ' Elk conflicterend boek wordt in een afzonderlijke bewerking vervangen.' : ''} Leesgegevens worden niet uit deze ZIP geïmporteerd. Doorgaan?` },
  sv: { preview: (total, conflicts, replaceSame) => `Förhandsvisning: ${total} böcker, ${conflicts} konflikter.${replaceSame ? ' Varje bok med konflikt ersätts i en separat åtgärd.' : ''} Läsdata importeras inte från denna ZIP. Fortsätta?` },
  no: { preview: (total, conflicts, replaceSame) => `Forhåndsvisning: ${total} bøker, ${conflicts} konflikter.${replaceSame ? ' Hver bok med konflikt erstattes i en separat operasjon.' : ''} Lesedata importeres ikke fra denne ZIP-filen. Fortsette?` },
  pl: { preview: (total, conflicts, replaceSame) => `Podgląd: ${total} książek, ${conflicts} konfliktów.${replaceSame ? ' Każda konfliktowa książka zostanie zastąpiona w osobnej operacji.' : ''} Dane czytania nie są importowane z tego ZIP. Kontynuować?` },
  ro: { preview: (total, conflicts, replaceSame) => `Previzualizare: ${total} cărți, ${conflicts} conflicte.${replaceSame ? ' Fiecare carte în conflict va fi înlocuită printr-o operațiune separată.' : ''} Datele de lectură nu sunt importate din acest ZIP. Continuați?` },
  bs: { preview: (total, conflicts, replaceSame) => `Pregled: ${total} knjiga, ${conflicts} sukoba.${replaceSame ? ' Svaka knjiga u sukobu bit će zamijenjena zasebnom radnjom.' : ''} Podaci o čitanju ne uvoze se iz ovog ZIP-a. Nastaviti?` },
  sq: { preview: (total, conflicts, replaceSame) => `Pamje paraprake: ${total} libra, ${conflicts} konflikte.${replaceSame ? ' Çdo libër në konflikt do të zëvendësohet me një veprim të veçantë.' : ''} Të dhënat e leximit nuk importohen nga ky ZIP. Të vazhdohet?` },
  az: { preview: (total, conflicts, replaceSame) => `Ön baxış: ${total} kitab, ${conflicts} ziddiyyət.${replaceSame ? ' Hər ziddiyyətli kitab ayrıca əməliyyatla əvəz ediləcək.' : ''} Oxu məlumatları bu ZIP-dən idxal edilmir. Davam edilsin?` },
  uz: { preview: (total, conflicts, replaceSame) => `Ko‘rib chiqish: ${total} ta kitob, ${conflicts} ta ziddiyat.${replaceSame ? ' Har bir ziddiyatli kitob alohida amal bilan almashtiriladi.' : ''} O‘qish maʼlumotlari bu ZIPdan import qilinmaydi. Davom etilsinmi?` },
  kk: { preview: (total, conflicts, replaceSame) => `Алдын ала қарау: ${total} кітап, ${conflicts} қайшылық.${replaceSame ? ' Әр қайшылықты кітап бөлек әрекетпен ауыстырылады.' : ''} Оқу деректері бұл ZIP-тен импортталмайды. Жалғастыру керек пе?` },
  zh: { preview: (total, conflicts, replaceSame) => `预览：${total} 本书，${conflicts} 个冲突。${replaceSame ? ' 每本冲突图书将通过单独操作替换。' : ''}不会从此 ZIP 导入阅读数据。继续吗？` },
  ja: { preview: (total, conflicts, replaceSame) => `プレビュー: ${total} 冊、競合 ${conflicts} 件。${replaceSame ? ' 競合する各書籍は個別の操作で置き換えられます。' : ''}この ZIP から読書データはインポートされません。続行しますか？` },
  ko: { preview: (total, conflicts, replaceSame) => `미리보기: 책 ${total}권, 충돌 ${conflicts}건.${replaceSame ? ' 충돌하는 각 책은 별도 작업으로 교체됩니다.' : ''} 이 ZIP에서는 읽기 데이터를 가져오지 않습니다. 계속할까요?` },
}
