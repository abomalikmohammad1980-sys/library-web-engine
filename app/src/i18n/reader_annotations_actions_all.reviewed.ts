/** أفعال لوحة المحفوظات؛ لا يشمل القاموس نص الملاحظة الذي يكتبه المستخدم. */
const keys=(noteText:string,save:string,required:string,saved:string,deleteNote:string,deleteHighlight:string)=>({'نص الملاحظة':noteText,'حفظ الملاحظة':save,'اكتب الملاحظة أولًا':required,'حُفظت الملاحظة':saved,'حذف الملاحظة':deleteNote,'حذف التظليل':deleteHighlight})
export const REVIEWED_READER_ANNOTATIONS_ACTIONS_ALL_UI={
en:keys('Note text','Save note','Write the note first','Note saved','Delete note','Delete highlight'),fr:keys('Texte de la note','Enregistrer la note','Écrivez d’abord la note','Note enregistrée','Supprimer la note','Supprimer le surlignage'),
ug:keys('ئىزاھات تېكىستى','ئىزاھاتنى ساقلاش','ئاۋۋال ئىزاھات يېزىڭ','ئىزاھات ساقلاندى','ئىزاھاتنى ئۆچۈرۈش','يورۇتۇشنى ئۆچۈرۈش'),ckb:keys('دەقی تێبینی','تێبینی پاشەکەوت بکە','سەرەتا تێبینییەکە بنووسە','تێبینییەکە پاشەکەوت کرا','تێبینی بسڕەوە','ڕەنگکردنەوە بسڕەوە'),
ku:keys('Metna notê','Notê tomar bike','Pêşî notê binivîse','Not hat tomarkirin','Notê jê bibe','Ronîkirinê jê bibe'),tr:keys('Not metni','Notu kaydet','Önce notu yazın','Not kaydedildi','Notu sil','Vurguyu sil'),
ur:keys('نوٹ کا متن','نوٹ محفوظ کریں','پہلے نوٹ لکھیں','نوٹ محفوظ ہو گیا','نوٹ حذف کریں','نمایاں حصہ حذف کریں'),fa:keys('متن یادداشت','ذخیرهٔ یادداشت','ابتدا یادداشت را بنویسید','یادداشت ذخیره شد','حذف یادداشت','حذف برجسته‌سازی'),
sw:keys('Maandishi ya dokezo','Hifadhi dokezo','Andika dokezo kwanza','Dokezo limehifadhiwa','Futa dokezo','Futa kivutio'),hi:keys('नोट का पाठ','नोट सहेजें','पहले नोट लिखें','नोट सहेजा गया','नोट हटाएँ','हाइलाइट हटाएँ'),
hu:keys('Jegyzet szövege','Jegyzet mentése','Előbb írja meg a jegyzetet','Jegyzet mentve','Jegyzet törlése','Kiemelés törlése'),id:keys('Teks catatan','Simpan catatan','Tulis catatan terlebih dahulu','Catatan disimpan','Hapus catatan','Hapus sorotan'),
ms:keys('Teks nota','Simpan nota','Tulis nota dahulu','Nota disimpan','Padam nota','Padam sorotan'),bn:keys('নোটের লেখা','নোট সংরক্ষণ করুন','আগে নোট লিখুন','নোট সংরক্ষিত হয়েছে','নোট মুছুন','হাইলাইট মুছুন'),
ps:keys('د یادښت متن','یادښت خوندي کړئ','لومړی یادښت ولیکئ','یادښت خوندي شو','یادښت حذف کړئ','روښانه کول حذف کړئ'),so:keys('Qoraalka xusuusta','Kaydi qoraalka','Marka hore qor xusuusta','Qoraalka waa la kaydiyay','Tirtir qoraalka','Tirtir muujinta'),
ha:keys('Rubutun bayanin kula','Ajiye bayanin kula','Fara rubuta bayanin kula','An ajiye bayanin kula','Goge bayanin kula','Goge haskakawa'),ru:keys('Текст заметки','Сохранить заметку','Сначала напишите заметку','Заметка сохранена','Удалить заметку','Удалить выделение'),
uk:keys('Текст нотатки','Зберегти нотатку','Спочатку напишіть нотатку','Нотатку збережено','Видалити нотатку','Видалити виділення'),de:keys('Notiztext','Notiz speichern','Schreiben Sie zuerst die Notiz','Notiz gespeichert','Notiz löschen','Hervorhebung löschen'),
es:keys('Texto de la nota','Guardar nota','Escribe primero la nota','Nota guardada','Eliminar nota','Eliminar resaltado'),pt:keys('Texto da nota','Guardar nota','Escreva primeiro a nota','Nota guardada','Eliminar nota','Eliminar destaque'),
it:keys('Testo della nota','Salva nota','Scrivi prima la nota','Nota salvata','Elimina nota','Elimina evidenziazione'),nl:keys('Notitietekst','Notitie opslaan','Schrijf eerst de notitie','Notitie opgeslagen','Notitie verwijderen','Markering verwijderen'),
sv:keys('Anteckningstext','Spara anteckning','Skriv anteckningen först','Anteckningen sparades','Ta bort anteckning','Ta bort markering'),no:keys('Notattekst','Lagre notat','Skriv notatet først','Notatet er lagret','Slett notat','Slett markering'),
pl:keys('Tekst notatki','Zapisz notatkę','Najpierw napisz notatkę','Notatka zapisana','Usuń notatkę','Usuń wyróżnienie'),ro:keys('Textul notiței','Salvează notița','Scrie mai întâi notița','Notiță salvată','Șterge notița','Șterge evidențierea'),
bs:keys('Tekst bilješke','Sačuvaj bilješku','Prvo napišite bilješku','Bilješka je sačuvana','Izbriši bilješku','Izbriši isticanje'),sq:keys('Teksti i shënimit','Ruaj shënimin','Shkruani më parë shënimin','Shënimi u ruajt','Fshi shënimin','Fshi theksimin'),
az:keys('Qeyd mətni','Qeydi saxla','Əvvəlcə qeydi yazın','Qeyd saxlanıldı','Qeydi sil','Vurğunu sil'),uz:keys('Qayd matni','Qaydni saqlash','Avval qaydni yozing','Qayd saqlandi','Qaydni o‘chirish','Ajratmani o‘chirish'),
kk:keys('Жазба мәтіні','Жазбаны сақтау','Алдымен жазбаны жазыңыз','Жазба сақталды','Жазбаны жою','Ерекшелеуді жою'),zh:keys('笔记文本','保存笔记','请先填写笔记','笔记已保存','删除笔记','删除高亮'),
ja:keys('メモの本文','メモを保存','先にメモを書いてください','メモを保存しました','メモを削除','ハイライトを削除'),ko:keys('메모 내용','메모 저장','먼저 메모를 작성하세요','메모가 저장되었습니다','메모 삭제','강조 표시 삭제'),
} as const

const dynamic:Record<string,readonly[string,string,string,string]>={
en:['Write a note on page {n}…','Bookmarks · {n}','Notes · {n}','Highlights · {n}'],fr:['Écrire une note à la page {n}…','Signets · {n}','Notes · {n}','Surlignages · {n}'],
ug:['{n}-بەتكە ئىزاھات يېزىڭ…','بەلگىلەر · {n}','ئىزاھاتلار · {n}','يورۇتۇلغانلار · {n}'],ckb:['تێبینی لە پەڕەی {n} بنووسە…','نیشانەکان · {n}','تێبینییەکان · {n}','ڕەنگکردنەوەکان · {n}'],
ku:['Li rûpela {n} notekê binivîse…','Nîşan · {n}','Not · {n}','Ronîkirin · {n}'],tr:['{n}. sayfaya not yaz…','İşaretler · {n}','Notlar · {n}','Vurgular · {n}'],
ur:['صفحہ {n} پر نوٹ لکھیں…','نشانات · {n}','نوٹس · {n}','نمایاں حصے · {n}'],fa:['در صفحهٔ {n} یادداشت بنویسید…','نشان‌ها · {n}','یادداشت‌ها · {n}','برجسته‌سازی‌ها · {n}'],
sw:['Andika dokezo kwenye ukurasa {n}…','Alama · {n}','Madokezo · {n}','Vivutio · {n}'],hi:['पृष्ठ {n} पर नोट लिखें…','चिह्न · {n}','नोट्स · {n}','हाइलाइट · {n}'],
hu:['Jegyzet írása a(z) {n}. oldalhoz…','Könyvjelzők · {n}','Jegyzetek · {n}','Kiemelések · {n}'],id:['Tulis catatan di halaman {n}…','Penanda · {n}','Catatan · {n}','Sorotan · {n}'],
ms:['Tulis nota pada halaman {n}…','Penanda · {n}','Nota · {n}','Sorotan · {n}'],bn:['পৃষ্ঠা {n}-এ নোট লিখুন…','চিহ্ন · {n}','নোট · {n}','হাইলাইট · {n}'],
ps:['په {n} پاڼه یادښت ولیکئ…','نښې · {n}','یادښتونه · {n}','روښانه برخې · {n}'],so:['Qor xusuus bogga {n}…','Calaamado · {n}','Qoraallo · {n}','Muujin · {n}'],
ha:['Rubuta bayani a shafi {n}…','Alamomi · {n}','Bayanan kula · {n}','Haskakawa · {n}'],ru:['Напишите заметку на странице {n}…','Закладки · {n}','Заметки · {n}','Выделения · {n}'],
uk:['Напишіть нотатку на сторінці {n}…','Закладки · {n}','Нотатки · {n}','Виділення · {n}'],de:['Notiz auf Seite {n} schreiben…','Lesezeichen · {n}','Notizen · {n}','Hervorhebungen · {n}'],
es:['Escribe una nota en la página {n}…','Marcadores · {n}','Notas · {n}','Resaltados · {n}'],pt:['Escreva uma nota na página {n}…','Marcadores · {n}','Notas · {n}','Destaques · {n}'],
it:['Scrivi una nota a pagina {n}…','Segnalibri · {n}','Note · {n}','Evidenziazioni · {n}'],nl:['Schrijf een notitie op pagina {n}…','Bladwijzers · {n}','Notities · {n}','Markeringen · {n}'],
sv:['Skriv en anteckning på sida {n}…','Bokmärken · {n}','Anteckningar · {n}','Markeringar · {n}'],no:['Skriv et notat på side {n}…','Bokmerker · {n}','Notater · {n}','Markeringer · {n}'],
pl:['Napisz notatkę na stronie {n}…','Zakładki · {n}','Notatki · {n}','Wyróżnienia · {n}'],ro:['Scrie o notiță la pagina {n}…','Semne de carte · {n}','Notițe · {n}','Evidențieri · {n}'],
bs:['Napišite bilješku na stranici {n}…','Oznake · {n}','Bilješke · {n}','Isticanja · {n}'],sq:['Shkruani një shënim në faqen {n}…','Faqeshënues · {n}','Shënime · {n}','Theksime · {n}'],
az:['{n}-ci səhifədə qeyd yazın…','Nişanlar · {n}','Qeydlər · {n}','Vurğular · {n}'],uz:['{n}-sahifaga qayd yozing…','Belgilar · {n}','Qaydlar · {n}','Ajratmalar · {n}'],
kk:['{n}-бетке жазба жазыңыз…','Бетбелгілер · {n}','Жазбалар · {n}','Ерекшелеулер · {n}'],zh:['在第 {n} 页写笔记…','书签 · {n}','笔记 · {n}','高亮 · {n}'],
ja:['{n} ページにメモを書く…','しおり · {n}','メモ · {n}','ハイライト · {n}'],ko:['{n}페이지에 메모 작성…','책갈피 · {n}','메모 · {n}','강조 표시 · {n}'],
}

export function translateReaderAnnotationsDynamic(source:string,language:string):string|undefined{
const t=dynamic[language];if(!t)return undefined
const note=source.match(/^اكتب ملاحظة على الصفحة\s+([0-9٠-٩]+)…$/u)
const notePage=note?.[1]
if(notePage)return t[0].replace('{n}',notePage)
const patterns:readonly (readonly [RegExp,1|2|3])[]=[[/^العلامات\s*·\s*([0-9٠-٩]+)$/u,1],[/^الملاحظات\s*·\s*([0-9٠-٩]+)$/u,2],[/^التظليلات\s*·\s*([0-9٠-٩]+)$/u,3]]
for(const[p,i]of patterns){const count=source.match(p)?.[1];if(count)return t[i].replace('{n}',count)}return undefined
}
