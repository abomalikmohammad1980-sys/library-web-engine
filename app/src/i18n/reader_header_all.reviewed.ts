/** أدوات رأس القارئ وأسماؤها الميسرة؛ لا تتضمن أي محتوى للكتاب. */
const keys=(tools:string,search:string,changeMode:string,mode:string,focusMode:string,focus:string)=>({'قائمة أدوات القارئ':tools,'البحث داخل الكتاب':search,'تغيير نمط القراءة':changeMode,'نمط':mode,'وضع السكينة':focusMode,'سكينة':focus})
export const REVIEWED_READER_HEADER_ALL_UI={
en:keys('Reader tools menu','Search within book','Change reading mode','Mode','Focus mode','Focus'),fr:keys('Menu des outils de lecture','Rechercher dans le livre','Changer le mode de lecture','Mode','Mode concentration','Concentration'),
ug:keys('ئوقۇرمەن قوراللىرى تىزىملىكى','كىتابتىن ئىزدەش','ئوقۇش ھالىتىنى ئۆزگەرتىش','ھالەت','خاتىرجەملىك ھالىتى','خاتىرجەملىك'),ckb:keys('پێڕستی ئامرازەکانی خوێنەر','گەڕان لە ناو کتێب','گۆڕینی شێوازی خوێندنەوە','شێواز','دۆخی ئارامی','ئارامی'),
ku:keys('Lîsteya amûrên xwîner','Di pirtûkê de bigere','Şêwaza xwendinê biguherîne','Şêwaz','Moda aramiyê','Aramî'),tr:keys('Okuyucu araçları menüsü','Kitapta ara','Okuma modunu değiştir','Mod','Odak modu','Odak'),
ur:keys('قاری کے اوزار کی فہرست','کتاب میں تلاش','مطالعہ کا انداز بدلیں','انداز','یکسوئی کا انداز','یکسوئی'),fa:keys('فهرست ابزارهای خواننده','جست‌وجو در کتاب','تغییر حالت مطالعه','حالت','حالت تمرکز','تمرکز'),
sw:keys('Menyu ya zana za msomaji','Tafuta ndani ya kitabu','Badilisha hali ya kusoma','Hali','Hali ya umakini','Umakini'),hi:keys('पाठक उपकरण मेनू','पुस्तक में खोजें','पठन मोड बदलें','मोड','एकाग्रता मोड','एकाग्रता'),
hu:keys('Olvasói eszközök menü','Keresés a könyvben','Olvasási mód váltása','Mód','Fókusz mód','Fókusz'),id:keys('Menu alat pembaca','Cari dalam buku','Ubah mode baca','Mode','Mode fokus','Fokus'),
ms:keys('Menu alat pembaca','Cari dalam buku','Tukar mod bacaan','Mod','Mod fokus','Fokus'),bn:keys('পাঠক সরঞ্জাম মেনু','বইয়ে খুঁজুন','পঠন মোড বদলান','মোড','মনোযোগ মোড','মনোযোগ'),
ps:keys('د لوستونکي د وسایلو لړ','په کتاب کې لټون','د لوست بڼه بدله کړئ','بڼه','د تمرکز بڼه','تمرکز'),so:keys('Liiska qalabka akhristaha','Ka raadi buugga','Beddel habka akhriska','Hab','Habka diiradda','Diirad'),
ha:keys('Jerin kayan karatu','Bincika cikin littafi','Canza yanayin karatu','Yanayi','Yanayin mayar da hankali','Mayar da hankali'),ru:keys('Меню инструментов чтения','Поиск в книге','Изменить режим чтения','Режим','Режим фокусировки','Фокус'),
uk:keys('Меню інструментів читання','Пошук у книзі','Змінити режим читання','Режим','Режим зосередження','Зосередження'),de:keys('Lesewerkzeuge-Menü','Im Buch suchen','Lesemodus ändern','Modus','Fokusmodus','Fokus'),
es:keys('Menú de herramientas de lectura','Buscar en el libro','Cambiar modo de lectura','Modo','Modo de concentración','Concentración'),pt:keys('Menu de ferramentas de leitura','Pesquisar no livro','Alterar modo de leitura','Modo','Modo de foco','Foco'),
it:keys('Menu strumenti di lettura','Cerca nel libro','Cambia modalità di lettura','Modalità','Modalità concentrazione','Concentrazione'),nl:keys('Menu met leesgereedschap','Zoeken in boek','Leesmodus wijzigen','Modus','Focusmodus','Focus'),
sv:keys('Meny för läsarverktyg','Sök i boken','Byt läsläge','Läge','Fokusläge','Fokus'),no:keys('Meny for leseverktøy','Søk i boken','Endre lesemodus','Modus','Fokusmodus','Fokus'),
pl:keys('Menu narzędzi czytnika','Szukaj w książce','Zmień tryb czytania','Tryb','Tryb skupienia','Skupienie'),ro:keys('Meniul instrumentelor de lectură','Caută în carte','Schimbă modul de lectură','Mod','Mod focalizare','Focalizare'),
bs:keys('Meni čitalačkih alata','Pretraži knjigu','Promijeni način čitanja','Način','Način fokusa','Fokus'),sq:keys('Menyja e mjeteve të lexuesit','Kërko në libër','Ndrysho mënyrën e leximit','Mënyra','Mënyra e fokusit','Fokus'),
az:keys('Oxucu alətləri menyusu','Kitabda axtar','Oxu rejimini dəyiş','Rejim','Fokus rejimi','Fokus'),uz:keys('O‘quvchi vositalari menyusi','Kitobdan qidirish','O‘qish rejimini o‘zgartirish','Rejim','Diqqat rejimi','Diqqat'),
kk:keys('Оқырман құралдары мәзірі','Кітаптан іздеу','Оқу режимін өзгерту','Режим','Зейін режимі','Зейін'),zh:keys('阅读工具菜单','在书中搜索','更改阅读模式','模式','专注模式','专注'),
ja:keys('読書ツールメニュー','本の中を検索','読書モードを変更','モード','集中モード','集中'),ko:keys('읽기 도구 메뉴','책에서 검색','읽기 모드 변경','모드','집중 모드','집중'),
} as const
