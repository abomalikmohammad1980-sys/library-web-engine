/**
 * عناصر فهرس القارئ الثابتة في جميع لغات الموقع.
 * لا تتضمن عناوين الفهرس نفسها لأنها جزء من محتوى الكتاب.
 */
const keys = (search: string, searchLabel: string, clearSearch: string, clear: string, hideToc: string, hide: string, noMatches: string, openToc: string) => ({
  'ابحث في عناوين الفهرس…': search,
  'البحث في عناوين الفهرس': searchLabel,
  'مسح بحث الفهرس': clearSearch,
  'مسح': clear,
  'إخفاء الفهرس': hideToc,
  'إخفاء': hide,
  'لا توجد عناوين مطابقة في الفهرس': noMatches,
  'فتح فهرس الكتاب': openToc,
})

export const REVIEWED_READER_TOC_ALL_UI = {
  en: keys('Search contents…','Search contents','Clear contents search','Clear','Hide contents','Hide','No matching headings in the contents','Open book contents'),
  fr: keys('Rechercher dans le sommaire…','Rechercher dans le sommaire','Effacer la recherche du sommaire','Effacer','Masquer le sommaire','Masquer','Aucun titre correspondant dans le sommaire','Ouvrir le sommaire du livre'),
  ug: keys('مۇندەرىجە ماۋزۇلىرىدىن ئىزدەڭ…','مۇندەرىجە ماۋزۇلىرىدىن ئىزدەش','مۇندەرىجە ئىزدەشنى تازىلاش','تازىلاش','مۇندەرىجىنى يوشۇرۇش','يوشۇرۇش','مۇندەرىجىدە ماس ماۋزۇ يوق','كىتاب مۇندەرىجىسىنى ئېچىش'),
  ckb: keys('لە ناونیشانەکانی پێڕست بگەڕێ…','گەڕان لە ناونیشانەکانی پێڕست','گەڕانی پێڕست بسڕەوە','سڕینەوە','پێڕست بشارەوە','شاردنەوە','هیچ ناونیشانێکی هاوتا لە پێڕست نییە','پێڕستی کتێب بکەرەوە'),
  ku: keys('Di sernavên naverokê de bigere…','Di sernavên naverokê de bigere','Lêgerîna naverokê paqij bike','Paqij bike','Naverokê veşêre','Veşêre','Di naverokê de sernavekî lihevhatî tune','Naveroka pirtûkê veke'),
  tr: keys('İçindekiler başlıklarında ara…','İçindekiler başlıklarında ara','İçindekiler aramasını temizle','Temizle','İçindekileri gizle','Gizle','İçindekilerde eşleşen başlık yok','Kitabın içindekilerini aç'),
  ur: keys('فہرست کے عنوانات میں تلاش کریں…','فہرست کے عنوانات میں تلاش','فہرست کی تلاش صاف کریں','صاف کریں','فہرست چھپائیں','چھپائیں','فہرست میں کوئی مماثل عنوان نہیں','کتاب کی فہرست کھولیں'),
  fa: keys('در عنوان‌های فهرست جست‌وجو کنید…','جست‌وجو در عنوان‌های فهرست','پاک‌کردن جست‌وجوی فهرست','پاک‌کردن','پنهان‌کردن فهرست','پنهان‌کردن','عنوان مطابقی در فهرست نیست','بازکردن فهرست کتاب'),
  sw: keys('Tafuta katika vichwa vya yaliyomo…','Tafuta katika vichwa vya yaliyomo','Futa utafutaji wa yaliyomo','Futa','Ficha yaliyomo','Ficha','Hakuna kichwa kinacholingana katika yaliyomo','Fungua yaliyomo ya kitabu'),
  hi: keys('विषय-सूची के शीर्षकों में खोजें…','विषय-सूची के शीर्षकों में खोजें','विषय-सूची खोज साफ़ करें','साफ़ करें','विषय-सूची छिपाएँ','छिपाएँ','विषय-सूची में कोई मिलता शीर्षक नहीं','पुस्तक की विषय-सूची खोलें'),
  hu: keys('Keresés a tartalomjegyzék címeiben…','Keresés a tartalomjegyzék címeiben','Tartalomjegyzék-keresés törlése','Törlés','Tartalomjegyzék elrejtése','Elrejtés','Nincs egyező cím a tartalomjegyzékben','Könyv tartalomjegyzékének megnyitása'),
  id: keys('Cari dalam judul daftar isi…','Cari dalam judul daftar isi','Hapus pencarian daftar isi','Hapus','Sembunyikan daftar isi','Sembunyikan','Tidak ada judul yang cocok dalam daftar isi','Buka daftar isi buku'),
  ms: keys('Cari dalam tajuk kandungan…','Cari dalam tajuk kandungan','Kosongkan carian kandungan','Kosongkan','Sembunyikan kandungan','Sembunyikan','Tiada tajuk sepadan dalam kandungan','Buka kandungan buku'),
  bn: keys('সূচিপত্রের শিরোনামে খুঁজুন…','সূচিপত্রের শিরোনামে খুঁজুন','সূচিপত্রের অনুসন্ধান মুছুন','মুছুন','সূচিপত্র লুকান','লুকান','সূচিপত্রে মিলযুক্ত শিরোনাম নেই','বইয়ের সূচিপত্র খুলুন'),
  ps: keys('د لړلیک په سرلیکونو کې ولټوئ…','د لړلیک په سرلیکونو کې لټون','د لړلیک لټون پاک کړئ','پاکول','لړلیک پټ کړئ','پټول','په لړلیک کې برابر سرلیک نشته','د کتاب لړلیک پرانیزئ'),
  so: keys('Ka raadi cinwaannada tusmada…','Ka raadi cinwaannada tusmada','Nadiifi raadinta tusmada','Nadiifi','Qari tusmada','Qari','Cinwaan u dhigma kuma jiro tusmada','Fur tusmada buugga'),
  ha: keys('Bincika cikin taken abubuwan ciki…','Bincika taken abubuwan ciki','Goge binciken abubuwan ciki','Goge','Ɓoye abubuwan ciki','Ɓoye','Babu take da ya dace a abubuwan ciki','Buɗe abubuwan cikin littafi'),
  ru: keys('Поиск по заголовкам оглавления…','Поиск по заголовкам оглавления','Очистить поиск по оглавлению','Очистить','Скрыть оглавление','Скрыть','В оглавлении нет совпадающих заголовков','Открыть оглавление книги'),
  uk: keys('Пошук у заголовках змісту…','Пошук у заголовках змісту','Очистити пошук у змісті','Очистити','Сховати зміст','Сховати','У змісті немає відповідних заголовків','Відкрити зміст книги'),
  de: keys('In Überschriften des Inhaltsverzeichnisses suchen…','In Überschriften des Inhaltsverzeichnisses suchen','Suche im Inhaltsverzeichnis löschen','Löschen','Inhaltsverzeichnis ausblenden','Ausblenden','Keine passenden Überschriften im Inhaltsverzeichnis','Inhaltsverzeichnis des Buchs öffnen'),
  es: keys('Buscar en los títulos del índice…','Buscar en los títulos del índice','Borrar búsqueda del índice','Borrar','Ocultar índice','Ocultar','No hay títulos coincidentes en el índice','Abrir índice del libro'),
  pt: keys('Pesquisar nos títulos do índice…','Pesquisar nos títulos do índice','Limpar pesquisa do índice','Limpar','Ocultar índice','Ocultar','Não há títulos correspondentes no índice','Abrir índice do livro'),
  it: keys('Cerca nei titoli dell’indice…','Cerca nei titoli dell’indice','Cancella ricerca nell’indice','Cancella','Nascondi indice','Nascondi','Nessun titolo corrispondente nell’indice','Apri indice del libro'),
  nl: keys('Zoeken in titels van de inhoudsopgave…','Zoeken in titels van de inhoudsopgave','Zoekopdracht in inhoud wissen','Wissen','Inhoudsopgave verbergen','Verbergen','Geen overeenkomende titels in de inhoudsopgave','Inhoudsopgave van boek openen'),
  sv: keys('Sök i innehållsrubriker…','Sök i innehållsrubriker','Rensa innehållssökning','Rensa','Dölj innehåll','Dölj','Inga matchande rubriker i innehållet','Öppna bokens innehåll'),
  no: keys('Søk i innholdsoverskrifter…','Søk i innholdsoverskrifter','Tøm innholdssøk','Tøm','Skjul innhold','Skjul','Ingen samsvarende overskrifter i innholdet','Åpne bokens innhold'),
  pl: keys('Szukaj w tytułach spisu treści…','Szukaj w tytułach spisu treści','Wyczyść wyszukiwanie w spisie','Wyczyść','Ukryj spis treści','Ukryj','Brak pasujących tytułów w spisie treści','Otwórz spis treści książki'),
  ro: keys('Caută în titlurile cuprinsului…','Caută în titlurile cuprinsului','Șterge căutarea în cuprins','Șterge','Ascunde cuprinsul','Ascunde','Niciun titlu corespunzător în cuprins','Deschide cuprinsul cărții'),
  bs: keys('Pretraži naslove sadržaja…','Pretraži naslove sadržaja','Očisti pretragu sadržaja','Očisti','Sakrij sadržaj','Sakrij','Nema odgovarajućih naslova u sadržaju','Otvori sadržaj knjige'),
  sq: keys('Kërko në titujt e përmbajtjes…','Kërko në titujt e përmbajtjes','Pastro kërkimin e përmbajtjes','Pastro','Fshih përmbajtjen','Fshih','Nuk ka tituj që përputhen në përmbajtje','Hap përmbajtjen e librit'),
  az: keys('Mündəricat başlıqlarında axtar…','Mündəricat başlıqlarında axtar','Mündəricat axtarışını təmizlə','Təmizlə','Mündəricatı gizlət','Gizlət','Mündəricatda uyğun başlıq yoxdur','Kitabın mündəricatını aç'),
  uz: keys('Mundarija sarlavhalaridan qidiring…','Mundarija sarlavhalaridan qidirish','Mundarija qidiruvini tozalash','Tozalash','Mundarijani yashirish','Yashirish','Mundarijada mos sarlavha yo‘q','Kitob mundarijasini ochish'),
  kk: keys('Мазмұн тақырыптарынан іздеу…','Мазмұн тақырыптарынан іздеу','Мазмұн іздеуін тазалау','Тазалау','Мазмұнды жасыру','Жасыру','Мазмұнда сәйкес тақырып жоқ','Кітап мазмұнын ашу'),
  zh: keys('搜索目录标题…','搜索目录标题','清除目录搜索','清除','隐藏目录','隐藏','目录中没有匹配的标题','打开图书目录'),
  ja: keys('目次の見出しを検索…','目次の見出しを検索','目次検索をクリア','クリア','目次を隠す','隠す','目次に一致する見出しがありません','本の目次を開く'),
  ko: keys('목차 제목 검색…','목차 제목 검색','목차 검색 지우기','지우기','목차 숨기기','숨기기','목차에 일치하는 제목이 없습니다','책 목차 열기'),
} as const

const dynamic: Record<string, readonly [string, string]> = {
  en:['headings in contents','results in contents'], fr:['titres dans le sommaire','résultats dans le sommaire'], ug:['مۇندەرىجە ماۋزۇسى','مۇندەرىجە نەتىجىسى'],
  ckb:['ناونیشان لە پێڕست','ئەنجام لە پێڕست'], ku:['sernav di naverokê de','encam di naverokê de'], tr:['içindekiler başlığı','içindekiler sonucu'], ur:['فہرست کے عنوان','فہرست کے نتائج'], fa:['عنوان در فهرست','نتیجه در فهرست'],
  sw:['vichwa katika yaliyomo','matokeo katika yaliyomo'], hi:['विषय-सूची में शीर्षक','विषय-सूची में परिणाम'], hu:['cím a tartalomjegyzékben','találat a tartalomjegyzékben'],
  id:['judul dalam daftar isi','hasil dalam daftar isi'], ms:['tajuk dalam kandungan','hasil dalam kandungan'], bn:['সূচিপত্রে শিরোনাম','সূচিপত্রে ফলাফল'], ps:['په لړلیک کې سرلیکونه','په لړلیک کې پایلې'],
  so:['cinwaan oo tusmada ku jira','natiijo oo tusmada ku jira'], ha:['take a abubuwan ciki','sakamako a abubuwan ciki'], ru:['заголовков в оглавлении','результатов в оглавлении'], uk:['заголовків у змісті','результатів у змісті'],
  de:['Überschriften im Inhaltsverzeichnis','Ergebnisse im Inhaltsverzeichnis'], es:['títulos en el índice','resultados en el índice'], pt:['títulos no índice','resultados no índice'], it:['titoli nell’indice','risultati nell’indice'],
  nl:['titels in de inhoudsopgave','resultaten in de inhoudsopgave'], sv:['rubriker i innehållet','resultat i innehållet'], no:['overskrifter i innholdet','resultater i innholdet'], pl:['tytułów w spisie treści','wyników w spisie treści'],
  ro:['titluri în cuprins','rezultate în cuprins'], bs:['naslova u sadržaju','rezultata u sadržaju'], sq:['tituj në përmbajtje','rezultate në përmbajtje'], az:['mündəricat başlığı','mündəricat nəticəsi'],
  uz:['mundarija sarlavhasi','mundarija natijasi'], kk:['мазмұн тақырыбы','мазмұн нәтижесі'], zh:['个目录标题','个目录结果'], ja:['件の目次見出し','件の目次結果'], ko:['개의 목차 제목','개의 목차 결과'],
}

/** يترجم عدّادات الفهرس الديناميكية، ولا يمرّر عنوانًا مأخوذًا من الكتاب. */
export function translateReaderTocDynamic(source: string, language: string): string | undefined {
  const terms = dynamic[language]
  if (!terms) return undefined
  const headings = source.match(/^([0-9٠-٩]+)\s+عنوانًا في الفهرس$/u)
  if (headings) return `${headings[1]} ${terms[0]}`
  const results = source.match(/^([0-9٠-٩]+)\s+نتيجة في الفهرس$/u)
  if (results) return `${results[1]} ${terms[1]}`
  return undefined
}
