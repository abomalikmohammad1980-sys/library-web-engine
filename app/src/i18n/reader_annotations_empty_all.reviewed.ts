/** عناوين لوحة المحفوظات وحالات فراغها؛ لا تتضمن نص ملاحظة أو مقتطفًا. */
const keys=(reading:string,title:string,noBookmarks:string,noNotes:string,noHighlights:string)=>({'قراءتي':reading,'العلامات والملاحظات':title,'لا توجد علامات بعد':noBookmarks,'لا توجد ملاحظات بعد':noNotes,'لا توجد تظليلات بعد':noHighlights})
export const REVIEWED_READER_ANNOTATIONS_EMPTY_ALL_UI={
en:keys('My reading','Bookmarks and notes','No bookmarks yet','No notes yet','No highlights yet'),fr:keys('Ma lecture','Signets et notes','Aucun signet pour le moment','Aucune note pour le moment','Aucun surlignage pour le moment'),
ug:keys('ئوقۇشۇم','بەلگە ۋە ئىزاھات','تېخى بەلگە يوق','تېخى ئىزاھات يوق','تېخى يورۇتۇلغان جاي يوق'),ckb:keys('خوێندنەوەم','نیشانە و تێبینییەکان','هێشتا هیچ نیشانەیەک نییە','هێشتا هیچ تێبینییەک نییە','هێشتا هیچ ڕەنگکردنەوەیەک نییە'),
ku:keys('Xwendina min','Nîşan û not','Hê nîşan tune','Hê not tune','Hê ronîkirin tune'),tr:keys('Okumam','İşaretler ve notlar','Henüz işaret yok','Henüz not yok','Henüz vurgu yok'),
ur:keys('میرا مطالعہ','نشانات اور نوٹس','ابھی کوئی نشان نہیں','ابھی کوئی نوٹ نہیں','ابھی کوئی نمایاں حصہ نہیں'),fa:keys('مطالعهٔ من','نشان‌ها و یادداشت‌ها','هنوز نشانی نیست','هنوز یادداشتی نیست','هنوز برجسته‌سازی‌ای نیست'),
sw:keys('Usomaji wangu','Alama na madokezo','Bado hakuna alama','Bado hakuna madokezo','Bado hakuna vivutio'),hi:keys('मेरा पठन','चिह्न और नोट्स','अभी कोई चिह्न नहीं','अभी कोई नोट नहीं','अभी कोई हाइलाइट नहीं'),
hu:keys('Olvasásom','Könyvjelzők és jegyzetek','Még nincs könyvjelző','Még nincs jegyzet','Még nincs kiemelés'),id:keys('Bacaan saya','Penanda dan catatan','Belum ada penanda','Belum ada catatan','Belum ada sorotan'),
ms:keys('Bacaan saya','Penanda dan nota','Belum ada penanda','Belum ada nota','Belum ada sorotan'),bn:keys('আমার পাঠ','চিহ্ন ও নোট','এখনও কোনো চিহ্ন নেই','এখনও কোনো নোট নেই','এখনও কোনো হাইলাইট নেই'),
ps:keys('زما لوستل','نښې او یادښتونه','تر اوسه نښه نشته','تر اوسه یادښت نشته','تر اوسه روښانه شوی متن نشته'),so:keys('Akhriskayga','Calaamado iyo qoraallo','Weli calaamad ma jirto','Weli qoraal ma jiro','Weli muujin ma jirto'),
ha:keys('Karatuna','Alamomi da bayanin kula','Babu alama tukuna','Babu bayanin kula tukuna','Babu haskakawa tukuna'),ru:keys('Моё чтение','Закладки и заметки','Закладок пока нет','Заметок пока нет','Выделений пока нет'),
uk:keys('Моє читання','Закладки й нотатки','Закладок ще немає','Нотаток ще немає','Виділень ще немає'),de:keys('Meine Lektüre','Lesezeichen und Notizen','Noch keine Lesezeichen','Noch keine Notizen','Noch keine Hervorhebungen'),
es:keys('Mi lectura','Marcadores y notas','Aún no hay marcadores','Aún no hay notas','Aún no hay resaltados'),pt:keys('A minha leitura','Marcadores e notas','Ainda não há marcadores','Ainda não há notas','Ainda não há destaques'),
it:keys('La mia lettura','Segnalibri e note','Nessun segnalibro','Nessuna nota','Nessuna evidenziazione'),nl:keys('Mijn leeswerk','Bladwijzers en notities','Nog geen bladwijzers','Nog geen notities','Nog geen markeringen'),
sv:keys('Min läsning','Bokmärken och anteckningar','Inga bokmärken ännu','Inga anteckningar ännu','Inga markeringar ännu'),no:keys('Min lesing','Bokmerker og notater','Ingen bokmerker ennå','Ingen notater ennå','Ingen markeringer ennå'),
pl:keys('Moje czytanie','Zakładki i notatki','Brak zakładek','Brak notatek','Brak wyróżnień'),ro:keys('Lectura mea','Semne de carte și notițe','Niciun semn de carte încă','Nicio notiță încă','Nicio evidențiere încă'),
bs:keys('Moje čitanje','Oznake i bilješke','Još nema oznaka','Još nema bilješki','Još nema isticanja'),sq:keys('Leximi im','Faqeshënues dhe shënime','Ende pa faqeshënues','Ende pa shënime','Ende pa theksime'),
az:keys('Oxuduqlarım','Nişanlar və qeydlər','Hələ nişan yoxdur','Hələ qeyd yoxdur','Hələ vurğulama yoxdur'),uz:keys('O‘qishim','Belgilar va qaydlar','Hali belgi yo‘q','Hali qayd yo‘q','Hali ajratma yo‘q'),
kk:keys('Менің оқуым','Бетбелгілер мен жазбалар','Әзірге бетбелгі жоқ','Әзірге жазба жоқ','Әзірге ерекшелеу жоқ'),zh:keys('我的阅读','书签和笔记','暂无书签','暂无笔记','暂无高亮'),
ja:keys('自分の読書','しおりとメモ','しおりはまだありません','メモはまだありません','ハイライトはまだありません'),ko:keys('내 독서','책갈피와 메모','아직 책갈피가 없습니다','아직 메모가 없습니다','아직 강조 표시가 없습니다'),
} as const
