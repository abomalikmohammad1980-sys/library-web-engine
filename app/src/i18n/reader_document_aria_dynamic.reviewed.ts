type ReaderDocumentAriaTemplates = {
  textPage: (page: string) => string
  titlePage: (title: string) => string
  pdfPages: (title: string) => string
  pdfPage: (page: string, total: string) => string
  originalCopy: (title: string) => string
}

/** تسميات وثيقة القارئ؛ title هوية منشور تحفظ حرفيًا. */
export const REVIEWED_READER_DOCUMENT_ARIA_DYNAMIC_TEMPLATES: Readonly<Record<string, ReaderDocumentAriaTemplates>> = {
  en:{textPage:page=>`Text page ${page}`,titlePage:title=>`${title} title page`,pdfPages:title=>`PDF pages from ${title}`,pdfPage:(page,total)=>`PDF page ${page} of ${total}`,originalCopy:title=>`Original copy of ${title}`},
  fr:{textPage:page=>`Page de texte ${page}`,titlePage:title=>`Page de titre de ${title}`,pdfPages:title=>`Pages PDF de ${title}`,pdfPage:(page,total)=>`Page PDF ${page} sur ${total}`,originalCopy:title=>`Copie originale de ${title}`},
  ug:{textPage:page=>`تېكىست بېتى ${page}`,titlePage:title=>`${title} ماۋزۇ بېتى`,pdfPages:title=>`${title} نىڭ PDF بەتلىرى`,pdfPage:(page,total)=>`PDF بېتى ${page} / ${total}`,originalCopy:title=>`${title} نىڭ ئەسلى نۇسخىسى`},
  ckb:{textPage:page=>`پەڕەی دەقی ${page}`,titlePage:title=>`پەڕەی ناونیشانی ${title}`,pdfPages:title=>`پەڕەکانی PDF ـی ${title}`,pdfPage:(page,total)=>`پەڕەی PDF ${page} لە ${total}`,originalCopy:title=>`وەشانی ڕەسەنی ${title}`},
  ku:{textPage:page=>`Rûpela nivîsê ${page}`,titlePage:title=>`Rûpela sernavê ${title}`,pdfPages:title=>`Rûpelên PDF yên ${title}`,pdfPage:(page,total)=>`Rûpela PDF ${page} ji ${total}`,originalCopy:title=>`Kopiya resen a ${title}`},
  tr:{textPage:page=>`Metin sayfası ${page}`,titlePage:title=>`${title} başlık sayfası`,pdfPages:title=>`${title} kitabının PDF sayfaları`,pdfPage:(page,total)=>`PDF sayfası ${page} / ${total}`,originalCopy:title=>`${title} kitabının özgün kopyası`},
  ur:{textPage:page=>`متنی صفحہ ${page}`,titlePage:title=>`${title} کا عنوانی صفحہ`,pdfPages:title=>`${title} کے PDF صفحات`,pdfPage:(page,total)=>`PDF صفحہ ${page} از ${total}`,originalCopy:title=>`${title} کی اصل نقل`},
  fa:{textPage:page=>`صفحهٔ متنی ${page}`,titlePage:title=>`صفحهٔ عنوان ${title}`,pdfPages:title=>`صفحه‌های PDF از ${title}`,pdfPage:(page,total)=>`صفحهٔ PDF ${page} از ${total}`,originalCopy:title=>`نسخهٔ اصلی ${title}`},
  sw:{textPage:page=>`Ukurasa wa maandishi ${page}`,titlePage:title=>`Ukurasa wa kichwa wa ${title}`,pdfPages:title=>`Kurasa za PDF za ${title}`,pdfPage:(page,total)=>`Ukurasa wa PDF ${page} kati ya ${total}`,originalCopy:title=>`Nakala asili ya ${title}`},
  hi:{textPage:page=>`पाठ पृष्ठ ${page}`,titlePage:title=>`${title} का शीर्षक पृष्ठ`,pdfPages:title=>`${title} के PDF पृष्ठ`,pdfPage:(page,total)=>`PDF पृष्ठ ${page} / ${total}`,originalCopy:title=>`${title} की मूल प्रति`},
  hu:{textPage:page=>`${page}. szövegoldal`,titlePage:title=>`${title} címoldala`,pdfPages:title=>`${title} PDF-oldalai`,pdfPage:(page,total)=>`${page}. PDF-oldal / ${total}`,originalCopy:title=>`${title} eredeti példánya`},
  id:{textPage:page=>`Halaman teks ${page}`,titlePage:title=>`Halaman judul ${title}`,pdfPages:title=>`Halaman PDF ${title}`,pdfPage:(page,total)=>`Halaman PDF ${page} dari ${total}`,originalCopy:title=>`Salinan asli ${title}`},
  ms:{textPage:page=>`Halaman teks ${page}`,titlePage:title=>`Halaman tajuk ${title}`,pdfPages:title=>`Halaman PDF ${title}`,pdfPage:(page,total)=>`Halaman PDF ${page} daripada ${total}`,originalCopy:title=>`Salinan asal ${title}`},
  bn:{textPage:page=>`পাঠ্য পৃষ্ঠা ${page}`,titlePage:title=>`${title}-এর শিরোনাম পৃষ্ঠা`,pdfPages:title=>`${title}-এর PDF পৃষ্ঠাগুলি`,pdfPage:(page,total)=>`PDF পৃষ্ঠা ${page} / ${total}`,originalCopy:title=>`${title}-এর মূল অনুলিপি`},
  ps:{textPage:page=>`متني مخ ${page}`,titlePage:title=>`د ${title} سرلیک مخ`,pdfPages:title=>`د ${title} PDF مخونه`,pdfPage:(page,total)=>`PDF مخ ${page} له ${total}`,originalCopy:title=>`د ${title} اصلي نسخه`},
  so:{textPage:page=>`Bogga qoraalka ${page}`,titlePage:title=>`Bogga cinwaanka ${title}`,pdfPages:title=>`Bogagga PDF ee ${title}`,pdfPage:(page,total)=>`Bogga PDF ${page} ka mid ah ${total}`,originalCopy:title=>`Nuqulka asalka ah ee ${title}`},
  ha:{textPage:page=>`Shafin rubutu ${page}`,titlePage:title=>`Shafin taken ${title}`,pdfPages:title=>`Shafukan PDF na ${title}`,pdfPage:(page,total)=>`Shafin PDF ${page} cikin ${total}`,originalCopy:title=>`Asalin kwafin ${title}`},
  ru:{textPage:page=>`Текстовая страница ${page}`,titlePage:title=>`Титульная страница ${title}`,pdfPages:title=>`Страницы PDF книги ${title}`,pdfPage:(page,total)=>`Страница PDF ${page} из ${total}`,originalCopy:title=>`Оригинальная копия ${title}`},
  uk:{textPage:page=>`Текстова сторінка ${page}`,titlePage:title=>`Титульна сторінка ${title}`,pdfPages:title=>`Сторінки PDF книги ${title}`,pdfPage:(page,total)=>`Сторінка PDF ${page} з ${total}`,originalCopy:title=>`Оригінальна копія ${title}`},
  de:{textPage:page=>`Textseite ${page}`,titlePage:title=>`Titelseite von ${title}`,pdfPages:title=>`PDF-Seiten von ${title}`,pdfPage:(page,total)=>`PDF-Seite ${page} von ${total}`,originalCopy:title=>`Originalausgabe von ${title}`},
  es:{textPage:page=>`Página de texto ${page}`,titlePage:title=>`Portada de ${title}`,pdfPages:title=>`Páginas PDF de ${title}`,pdfPage:(page,total)=>`Página PDF ${page} de ${total}`,originalCopy:title=>`Copia original de ${title}`},
  pt:{textPage:page=>`Página de texto ${page}`,titlePage:title=>`Página de título de ${title}`,pdfPages:title=>`Páginas PDF de ${title}`,pdfPage:(page,total)=>`Página PDF ${page} de ${total}`,originalCopy:title=>`Cópia original de ${title}`},
  it:{textPage:page=>`Pagina di testo ${page}`,titlePage:title=>`Frontespizio di ${title}`,pdfPages:title=>`Pagine PDF di ${title}`,pdfPage:(page,total)=>`Pagina PDF ${page} di ${total}`,originalCopy:title=>`Copia originale di ${title}`},
  nl:{textPage:page=>`Tekstpagina ${page}`,titlePage:title=>`Titelpagina van ${title}`,pdfPages:title=>`PDF-pagina's van ${title}`,pdfPage:(page,total)=>`PDF-pagina ${page} van ${total}`,originalCopy:title=>`Originele kopie van ${title}`},
  sv:{textPage:page=>`Textsida ${page}`,titlePage:title=>`Titelsida för ${title}`,pdfPages:title=>`PDF-sidor för ${title}`,pdfPage:(page,total)=>`PDF-sida ${page} av ${total}`,originalCopy:title=>`Originalkopia av ${title}`},
  no:{textPage:page=>`Tekstside ${page}`,titlePage:title=>`Tittelside for ${title}`,pdfPages:title=>`PDF-sider for ${title}`,pdfPage:(page,total)=>`PDF-side ${page} av ${total}`,originalCopy:title=>`Originalkopi av ${title}`},
  pl:{textPage:page=>`Strona tekstowa ${page}`,titlePage:title=>`Strona tytułowa ${title}`,pdfPages:title=>`Strony PDF książki ${title}`,pdfPage:(page,total)=>`Strona PDF ${page} z ${total}`,originalCopy:title=>`Oryginalna kopia ${title}`},
  ro:{textPage:page=>`Pagina de text ${page}`,titlePage:title=>`Pagina de titlu a ${title}`,pdfPages:title=>`Paginile PDF ale ${title}`,pdfPage:(page,total)=>`Pagina PDF ${page} din ${total}`,originalCopy:title=>`Copia originală a ${title}`},
  bs:{textPage:page=>`Tekstualna stranica ${page}`,titlePage:title=>`Naslovna stranica knjige ${title}`,pdfPages:title=>`PDF stranice knjige ${title}`,pdfPage:(page,total)=>`PDF stranica ${page} od ${total}`,originalCopy:title=>`Originalni primjerak knjige ${title}`},
  sq:{textPage:page=>`Faqja e tekstit ${page}`,titlePage:title=>`Faqja e titullit të ${title}`,pdfPages:title=>`Faqet PDF të ${title}`,pdfPage:(page,total)=>`Faqja PDF ${page} nga ${total}`,originalCopy:title=>`Kopja origjinale e ${title}`},
  az:{textPage:page=>`Mətn səhifəsi ${page}`,titlePage:title=>`${title} başlıq səhifəsi`,pdfPages:title=>`${title} kitabının PDF səhifələri`,pdfPage:(page,total)=>`PDF səhifəsi ${page} / ${total}`,originalCopy:title=>`${title} kitabının orijinal nüsxəsi`},
  uz:{textPage:page=>`Matn sahifasi ${page}`,titlePage:title=>`${title} sarlavha sahifasi`,pdfPages:title=>`${title} PDF sahifalari`,pdfPage:(page,total)=>`PDF sahifa ${page} / ${total}`,originalCopy:title=>`${title} asl nusxasi`},
  kk:{textPage:page=>`Мәтін беті ${page}`,titlePage:title=>`${title} титул беті`,pdfPages:title=>`${title} кітабының PDF беттері`,pdfPage:(page,total)=>`PDF беті ${page} / ${total}`,originalCopy:title=>`${title} кітабының түпнұсқасы`},
  zh:{textPage:page=>`文本第 ${page} 页`,titlePage:title=>`${title} 的标题页`,pdfPages:title=>`${title} 的 PDF 页面`,pdfPage:(page,total)=>`PDF 第 ${page} 页，共 ${total} 页`,originalCopy:title=>`${title} 的原始副本`},
  ja:{textPage:page=>`テキスト ${page} ページ`,titlePage:title=>`${title} のタイトルページ`,pdfPages:title=>`${title} の PDF ページ`,pdfPage:(page,total)=>`PDF ${page} / ${total} ページ`,originalCopy:title=>`${title} の原本`},
  ko:{textPage:page=>`텍스트 ${page}페이지`,titlePage:title=>`${title} 제목 페이지`,pdfPages:title=>`${title} PDF 페이지`,pdfPage:(page,total)=>`PDF ${page}/${total}페이지`,originalCopy:title=>`${title} 원본`},
}
