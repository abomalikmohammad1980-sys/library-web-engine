type ResearchDynamicTemplates = {
  page: (page: string) => string
  selected: (count: string) => string
  confirmDelete: (title: string) => string
}

export const REVIEWED_RESEARCH_DYNAMIC_TEMPLATES: Readonly<Record<string, ResearchDynamicTemplates>> = {
  en: { page: page => `Page ${page}`, selected: count => `${count} selected benefits`, confirmDelete: title => `Delete project “${title}”? Notes and highlights will not be deleted.` },
  fr: { page: page => `Page ${page}`, selected: count => `${count} extraits sélectionnés`, confirmDelete: title => `Supprimer le projet « ${title} » ? Les notes et surlignages ne seront pas supprimés.` },
  ug: { page: page => `${page}-بەت`, selected: count => `${count} تاللانغان پايدا`, confirmDelete: title => `«${title}» تۈرى ئۆچۈرۈلسۇنمۇ؟ ئىزاھلار ۋە بەلگىلەشلەر ئۆچۈرۈلمەيدۇ.` },
  ckb: { page: page => `پەڕە ${page}`, selected: count => `${count} سوودی هەڵبژێردراو`, confirmDelete: title => `پڕۆژەی «${title}» بسڕدرێتەوە؟ تێبینی و دیاریکراوەکان ناسڕدرێنەوە.` },
  ku: { page: page => `Rûpel ${page}`, selected: count => `${count} feyde hatin hilbijartin`, confirmDelete: title => `Projeya «${title}» were jêbirin? Not û nîşankirin dê neyên jêbirin.` },
  tr: { page: page => `Sayfa ${page}`, selected: count => `${count} seçili not`, confirmDelete: title => `“${title}” projesi silinsin mi? Notlar ve vurgular silinmeyecek.` },
  ur: { page: page => `صفحہ ${page}`, selected: count => `${count} منتخب فوائد`, confirmDelete: title => `منصوبہ ”${title}“ حذف کریں؟ نوٹس اور نمایاں متن حذف نہیں ہوں گے۔` },
  fa: { page: page => `صفحهٔ ${page}`, selected: count => `${count} یادداشت انتخاب‌شده`, confirmDelete: title => `پروژهٔ «${title}» حذف شود؟ یادداشت‌ها و برجسته‌سازی‌ها حذف نمی‌شوند.` },
  sw: { page: page => `Ukurasa ${page}`, selected: count => `Manufaa ${count} yaliyochaguliwa`, confirmDelete: title => `Ufute mradi “${title}”? Madokezo na uangaziaji havitafutwa.` },
  hi: { page: page => `पृष्ठ ${page}`, selected: count => `${count} चुने हुए लाभ`, confirmDelete: title => `प्रोजेक्ट “${title}” हटाएँ? नोट और हाइलाइट नहीं हटेंगे।` },
  hu: { page: page => `${page}. oldal`, selected: count => `${count} kijelölt részlet`, confirmDelete: title => `Törli a(z) „${title}” projektet? A jegyzetek és kiemelések nem törlődnek.` },
  id: { page: page => `Halaman ${page}`, selected: count => `${count} faedah dipilih`, confirmDelete: title => `Hapus proyek “${title}”? Catatan dan sorotan tidak akan dihapus.` },
  ms: { page: page => `Halaman ${page}`, selected: count => `${count} faedah dipilih`, confirmDelete: title => `Padam projek “${title}”? Nota dan sorotan tidak akan dipadam.` },
  bn: { page: page => `পৃষ্ঠা ${page}`, selected: count => `${count}টি নির্বাচিত উপকার`, confirmDelete: title => `“${title}” প্রকল্প মুছবেন? নোট ও হাইলাইট মুছবে না।` },
  ps: { page: page => `پاڼه ${page}`, selected: count => `${count} ټاکل شوې ګټې`, confirmDelete: title => `د “${title}” پروژه ړنګه شي؟ یادښتونه او روښانه شوې برخې به نه ړنګېږي.` },
  so: { page: page => `Bogga ${page}`, selected: count => `${count} faa'iido oo la doortay`, confirmDelete: title => `Ma tirtirtaa mashruuca “${title}”? Qoraallada iyo calaamadayntu ma tirmayaan.` },
  ha: { page: page => `Shafi ${page}`, selected: count => `Fa'idodi ${count} da aka zaɓa`, confirmDelete: title => `A goge aikin “${title}”? Ba za a goge bayanai da haskakawa ba.` },
  ru: { page: page => `Страница ${page}`, selected: count => `Выбрано фрагментов: ${count}`, confirmDelete: title => `Удалить проект «${title}»? Заметки и выделения не будут удалены.` },
  uk: { page: page => `Сторінка ${page}`, selected: count => `Вибрано уривків: ${count}`, confirmDelete: title => `Видалити проєкт «${title}»? Нотатки та виділення не буде видалено.` },
  de: { page: page => `Seite ${page}`, selected: count => `${count} ausgewählte Fundstellen`, confirmDelete: title => `Projekt „${title}“ löschen? Notizen und Markierungen werden nicht gelöscht.` },
  es: { page: page => `Página ${page}`, selected: count => `${count} fragmentos seleccionados`, confirmDelete: title => `¿Eliminar el proyecto «${title}»? Las notas y los resaltados no se eliminarán.` },
  pt: { page: page => `Página ${page}`, selected: count => `${count} excertos selecionados`, confirmDelete: title => `Eliminar o projeto «${title}»? As notas e os destaques não serão eliminados.` },
  it: { page: page => `Pagina ${page}`, selected: count => `${count} estratti selezionati`, confirmDelete: title => `Eliminare il progetto “${title}”? Note ed evidenziazioni non saranno eliminate.` },
  nl: { page: page => `Pagina ${page}`, selected: count => `${count} geselecteerde fragmenten`, confirmDelete: title => `Project ‘${title}’ verwijderen? Notities en markeringen worden niet verwijderd.` },
  sv: { page: page => `Sida ${page}`, selected: count => `${count} valda utdrag`, confirmDelete: title => `Ta bort projektet ”${title}”? Anteckningar och markeringar tas inte bort.` },
  no: { page: page => `Side ${page}`, selected: count => `${count} valgte utdrag`, confirmDelete: title => `Slette prosjektet «${title}»? Notater og markeringer blir ikke slettet.` },
  pl: { page: page => `Strona ${page}`, selected: count => `${count} wybranych fragmentów`, confirmDelete: title => `Usunąć projekt „${title}”? Notatki i wyróżnienia nie zostaną usunięte.` },
  ro: { page: page => `Pagina ${page}`, selected: count => `${count} fragmente selectate`, confirmDelete: title => `Ștergeți proiectul „${title}”? Notițele și evidențierile nu vor fi șterse.` },
  bs: { page: page => `Stranica ${page}`, selected: count => `${count} odabranih izvoda`, confirmDelete: title => `Izbrisati projekat „${title}”? Bilješke i isticanja neće biti izbrisani.` },
  sq: { page: page => `Faqja ${page}`, selected: count => `${count} pjesë të zgjedhura`, confirmDelete: title => `Të fshihet projekti “${title}”? Shënimet dhe theksimet nuk do të fshihen.` },
  az: { page: page => `Səhifə ${page}`, selected: count => `${count} seçilmiş fayda`, confirmDelete: title => `“${title}” layihəsi silinsin? Qeydlər və vurğulamalar silinməyəcək.` },
  uz: { page: page => `${page}-sahifa`, selected: count => `${count} ta tanlangan parcha`, confirmDelete: title => `“${title}” loyihasi o‘chirilsinmi? Qaydlar va belgilashlar o‘chirilmaydi.` },
  kk: { page: page => `${page}-бет`, selected: count => `${count} таңдалған үзінді`, confirmDelete: title => `«${title}» жобасы жойылсын ба? Жазбалар мен ерекшелеулер жойылмайды.` },
  zh: { page: page => `第 ${page} 页`, selected: count => `已选 ${count} 条摘录`, confirmDelete: title => `删除项目“${title}”？笔记和高亮不会被删除。` },
  ja: { page: page => `${page} ページ`, selected: count => `${count} 件の選択済み抜粋`, confirmDelete: title => `プロジェクト「${title}」を削除しますか？メモとハイライトは削除されません。` },
  ko: { page: page => `${page}페이지`, selected: count => `선택한 발췌 ${count}개`, confirmDelete: title => `“${title}” 프로젝트를 삭제할까요? 메모와 강조 표시는 삭제되지 않습니다.` },
}
