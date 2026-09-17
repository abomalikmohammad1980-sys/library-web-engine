type NewBooksDynamicTemplates = {
  day: (date: string) => string
  shown: (visible: string, total: string) => string
  complete: (total: string) => string
}

/** New-books feed counters; dates and counts remain opaque display values. */
export const REVIEWED_NEW_BOOKS_DYNAMIC_ALL_TEMPLATES: Readonly<Record<string, NewBooksDynamicTemplates>> = {
  en: {day:date=>`New on ${date}`,shown:(visible,total)=>`Showing ${visible} of ${total} books — keep scrolling`,complete:total=>`All new books shown: ${total} books`},
  fr: {day:date=>`Nouveautés du ${date}`,shown:(visible,total)=>`${visible} livres sur ${total} affichés — continuez à défiler`,complete:total=>`Tous les nouveaux livres sont affichés : ${total} livres`},
  ug: {day:date=>`${date} كۈنىدىكى يېڭى كىتابلار`,shown:(visible,total)=>`${total} كىتابتىن ${visible} دانە كۆرسىتىلدى — تۆۋەنگە سىيرىڭ`,complete:total=>`بارلىق يېڭى كىتاب كۆرسىتىلدى: ${total} كىتاب`},
  ckb: {day:date=>`نوێی ڕۆژی ${date}`,shown:(visible,total)=>`${visible} لە ${total} کتێب نیشان درا — بەرەو خوارەوە بەردەوام بە`,complete:total=>`هەموو ${total} کتێبە نوێیەکە نیشان دران`},
  ku: {day:date=>`Nû yên roja ${date}`,shown:(visible,total)=>`${visible} ji ${total} pirtûkan hatin nîşandan — ber bi jêr ve bidomîne`,complete:total=>`Hemû ${total} pirtûkên nû hatin nîşandan`},
  tr: {day:date=>`${date} tarihindeki yeniler`,shown:(visible,total)=>`${total} kitaptan ${visible} tanesi gösterildi — aşağı inmeye devam edin`,complete:total=>`${total} yeni kitabın tümü gösterildi`},
  ur: {day:date=>`${date} کے دن کی نئی کتب`,shown:(visible,total)=>`${total} میں سے ${visible} کتابیں دکھائی گئیں — نیچے جاتے رہیں`,complete:total=>`تمام ${total} نئی کتابیں دکھا دی گئیں`},
  fa: {day:date=>`تازه‌های روز ${date}`,shown:(visible,total)=>`${visible} از ${total} کتاب نمایش داده شد — به پایین‌رفتن ادامه دهید`,complete:total=>`همهٔ ${total} کتاب تازه نمایش داده شد`},
  sw: {day:date=>`Vitabu vipya vya ${date}`,shown:(visible,total)=>`Vitabu ${visible} kati ya ${total} vinaonyeshwa — endelea kushuka`,complete:total=>`Vitabu vyote vipya vimeonyeshwa: ${total}`},
  hi: {day:date=>`${date} को नया`,shown:(visible,total)=>`${total} में से ${visible} पुस्तकें दिखाई गईं — नीचे स्क्रॉल करते रहें`,complete:total=>`सभी नई पुस्तकें दिखाई गईं: ${total} पुस्तकें`},
  hu: {day:date=>`Újdonságok: ${date}`,shown:(visible,total)=>`${visible} / ${total} könyv látható — görgessen tovább`,complete:total=>`Minden új könyv megjelent: ${total} könyv`},
  id: {day:date=>`Buku baru pada ${date}`,shown:(visible,total)=>`Menampilkan ${visible} dari ${total} buku — terus gulir`,complete:total=>`Semua buku baru ditampilkan: ${total} buku`},
  ms: {day:date=>`Buku baharu pada ${date}`,shown:(visible,total)=>`Memaparkan ${visible} daripada ${total} buku — teruskan menatal`,complete:total=>`Semua buku baharu dipaparkan: ${total} buku`},
  bn: {day:date=>`${date}-এর নতুন বই`,shown:(visible,total)=>`${total}টির মধ্যে ${visible}টি বই দেখানো হয়েছে — নিচে স্ক্রল করুন`,complete:total=>`সব নতুন বই দেখানো হয়েছে: ${total}টি বই`},
  ps: {day:date=>`د ${date} نوي کتابونه`,shown:(visible,total)=>`له ${total} کتابونو څخه ${visible} ښکاره شول — ښکته لاړ شئ`,complete:total=>`ټول نوي کتابونه ښکاره شول: ${total} کتابونه`},
  so: {day:date=>`Buugaagta cusub ee ${date}`,shown:(visible,total)=>`Waxaa la muujiyey ${visible} ka mid ah ${total} buug — hoos u sii soco`,complete:total=>`Dhammaan buugaagta cusub waa la muujiyey: ${total} buug`},
  ha: {day:date=>`Sabbin littattafan ${date}`,shown:(visible,total)=>`An nuna littattafai ${visible} daga ${total} — ci gaba da gangarawa`,complete:total=>`An nuna duk sabbin littattafai: ${total}`},
  ru: {day:date=>`Новинки за ${date}`,shown:(visible,total)=>`Показано ${visible} из ${total} книг — продолжайте прокрутку`,complete:total=>`Показаны все новые книги: ${total}`},
  uk: {day:date=>`Новинки за ${date}`,shown:(visible,total)=>`Показано ${visible} із ${total} книг — прокручуйте далі`,complete:total=>`Показано всі нові книги: ${total}`},
  de: {day:date=>`Neu am ${date}`,shown:(visible,total)=>`${visible} von ${total} Büchern angezeigt — weiter scrollen`,complete:total=>`Alle neuen Bücher angezeigt: ${total} Bücher`},
  es: {day:date=>`Novedades del ${date}`,shown:(visible,total)=>`Se muestran ${visible} de ${total} libros — sigue desplazándote`,complete:total=>`Se mostraron todos los libros nuevos: ${total}`},
  pt: {day:date=>`Novidades de ${date}`,shown:(visible,total)=>`Exibindo ${visible} de ${total} livros — continue rolando`,complete:total=>`Todos os livros novos foram exibidos: ${total}`},
  it: {day:date=>`Novità del ${date}`,shown:(visible,total)=>`Visualizzati ${visible} di ${total} libri — continua a scorrere`,complete:total=>`Visualizzati tutti i nuovi libri: ${total}`},
  nl: {day:date=>`Nieuw op ${date}`,shown:(visible,total)=>`${visible} van ${total} boeken getoond — blijf scrollen`,complete:total=>`Alle nieuwe boeken getoond: ${total}`},
  sv: {day:date=>`Nytt den ${date}`,shown:(visible,total)=>`${visible} av ${total} böcker visas — fortsätt rulla`,complete:total=>`Alla nya böcker visas: ${total}`},
  no: {day:date=>`Nytt den ${date}`,shown:(visible,total)=>`${visible} av ${total} bøker vises — fortsett å rulle`,complete:total=>`Alle nye bøker vises: ${total}`},
  pl: {day:date=>`Nowości z ${date}`,shown:(visible,total)=>`Wyświetlono ${visible} z ${total} książek — przewijaj dalej`,complete:total=>`Wyświetlono wszystkie nowe książki: ${total}`},
  ro: {day:date=>`Noutăți din ${date}`,shown:(visible,total)=>`Sunt afișate ${visible} din ${total} cărți — continuă derularea`,complete:total=>`Au fost afișate toate cărțile noi: ${total}`},
  bs: {day:date=>`Novo za ${date}`,shown:(visible,total)=>`Prikazano ${visible} od ${total} knjiga — nastavite pomjerati`,complete:total=>`Prikazane su sve nove knjige: ${total}`},
  sq: {day:date=>`Të reja më ${date}`,shown:(visible,total)=>`Shfaqen ${visible} nga ${total} libra — vazhdo lëvizjen`,complete:total=>`U shfaqën të gjithë librat e rinj: ${total}`},
  az: {day:date=>`${date} tarixində yenilər`,shown:(visible,total)=>`${total} kitabdan ${visible} göstərilir — aşağı sürüşdürün`,complete:total=>`Bütün yeni kitablar göstərildi: ${total}`},
  uz: {day:date=>`${date} kungi yangilar`,shown:(visible,total)=>`${total} kitobdan ${visible} tasi ko‘rsatildi — pastga aylantiring`,complete:total=>`Barcha yangi kitoblar ko‘rsatildi: ${total}`},
  kk: {day:date=>`${date} күнгі жаңалықтар`,shown:(visible,total)=>`${total} кітаптың ${visible} көрсетілді — төмен жылжуды жалғастырыңыз`,complete:total=>`Барлық жаңа кітап көрсетілді: ${total}`},
  zh: {day:date=>`${date}的新书`,shown:(visible,total)=>`已显示 ${total} 本中的 ${visible} 本——继续向下滚动`,complete:total=>`已显示全部新书：${total} 本`},
  ja: {day:date=>`${date}の新着`,shown:(visible,total)=>`${total}冊中${visible}冊を表示 — さらにスクロール`,complete:total=>`新着本をすべて表示しました：${total}冊`},
  ko: {day:date=>`${date}의 새 책`,shown:(visible,total)=>`${total}권 중 ${visible}권 표시 — 계속 스크롤`,complete:total=>`새 책을 모두 표시했습니다: ${total}권`},
}
