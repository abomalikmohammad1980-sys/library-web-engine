const labels = (values: string[]) => Object.fromEntries([
  'ملف الكتاب', 'عنوان الكتاب', 'المؤلف', 'مؤلف الكتاب', 'التصنيف', 'تصنيف الكتاب',
  'حفظ الكتاب في حسابي', 'حذف', 'لا توجد كتب محفوظة في الحساب بعد.', 'تحميل كتب أقدم',
  'تعذّر تحميل كتب الحساب.', 'تعذّر تحميل الكتب الأقدم؛ بقيت كتبك الظاهرة كما هي.',
  'إضافة كتاب إلى حسابي', 'حُفظ الكتاب خاصًا وأُرسل للمراجعة', 'تعذّر حفظ الكتاب.',
  'حُذف الكتاب من الحساب', 'تعذّر حذف الكتاب.', 'كتب حسابي',
  'تبقى خاصة حتى يقرر المدير نشرها للعامة.', 'بانتظار المراجعة', 'منشور', 'خاص',
].map((key, index) => [key, values[index]!]))

/** قشرة إدارة كتب الحساب فقط؛ عناوين الكتب والمؤلفون وقيم الحقول مستثناة. */
export const REVIEWED_ME_ACCOUNT_BOOKS_UI: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  ckb: labels(['پەڕگەی کتێب','ناونیشانی کتێب','نووسەر','نووسەری کتێب','پۆل','پۆلی کتێب','کتێبەکە لە هەژمارم پاشەکەوت بکە','سڕینەوە','هێشتا هیچ کتێبێک لە هەژمارەکەدا پاشەکەوت نەکراوە.','بارکردنی کتێبی کۆنتر','بارکردنی کتێبەکانی هەژمار سەرکەوتوو نەبوو.','بارکردنی کتێبە کۆنترەکان سەرکەوتوو نەبوو؛ کتێبە دیارەکانت هەر ماون.','زیادکردنی کتێب بۆ هەژمارم','کتێبەکە بە تایبەتی پاشەکەوت و بۆ پێداچوونەوە نێردرا','پاشەکەوتکردنی کتێب سەرکەوتوو نەبوو.','کتێبەکە لە هەژمار سڕایەوە','سڕینەوەی کتێب سەرکەوتوو نەبوو.','کتێبەکانی هەژمارم','تا بەڕێوەبەر بڕیاری بڵاوکردنەوەیان دەدات بە تایبەتی دەمێننەوە.','چاوەڕێی پێداچوونەوە','بڵاوکراوە','تایبەت']),
  ku: labels(['Pelê pirtûkê','Sernavê pirtûkê','Nivîskar','Nivîskarê pirtûkê','Beş','Beşa pirtûkê','Pirtûkê di hesabê min de biparêze','Jê bibe','Hê pirtûk di hesabê de nehat parastin.','Pirtûkên kevntir bar bike','Pirtûkên hesabê nehatin barkirin.','Pirtûkên kevntir nehatin barkirin; pirtûkên xuya dimînin.','Pirtûkek li hesabê min zêde bike','Pirtûk taybet hate parastin û ji bo nirxandinê hat şandin','Pirtûk nehat parastin.','Pirtûk ji hesabê hate jêbirin','Pirtûk nehat jêbirin.','Pirtûkên hesabê min','Heta rêveber biryara weşandina giştî bide taybet dimînin.','Li benda nirxandinê','Weşandî','Taybet']),
  tr: labels(['Kitap dosyası','Kitap başlığı','Yazar','Kitabın yazarı','Kategori','Kitap kategorisi','Kitabı hesabıma kaydet','Sil','Hesapta henüz kayıtlı kitap yok.','Daha eski kitapları yükle','Hesap kitapları yüklenemedi.','Eski kitaplar yüklenemedi; görünen kitaplarınız korundu.','Hesabıma kitap ekle','Kitap özel olarak kaydedildi ve incelemeye gönderildi','Kitap kaydedilemedi.','Kitap hesaptan silindi','Kitap silinemedi.','Hesabımdaki kitaplar','Yönetici herkese yayımlamaya karar verene kadar özel kalırlar.','İnceleme bekliyor','Yayımlanmış','Özel']),
  ur: labels(['کتاب کی فائل','کتاب کا عنوان','مصنف','کتاب کا مصنف','تصنیف','کتاب کی تصنیف','کتاب میرے اکاؤنٹ میں محفوظ کریں','حذف کریں','اکاؤنٹ میں ابھی کوئی کتاب محفوظ نہیں۔','پرانی کتابیں لوڈ کریں','اکاؤنٹ کی کتابیں لوڈ نہ ہو سکیں۔','پرانی کتابیں لوڈ نہ ہو سکیں؛ نظر آنے والی کتابیں برقرار ہیں۔','میرے اکاؤنٹ میں کتاب شامل کریں','کتاب ذاتی طور پر محفوظ اور جائزے کے لیے بھیج دی گئی','کتاب محفوظ نہ ہو سکی۔','کتاب اکاؤنٹ سے حذف ہوگئی','کتاب حذف نہ ہو سکی۔','میرے اکاؤنٹ کی کتابیں','منتظم کے عوامی اشاعت کے فیصلے تک ذاتی رہیں گی۔','جائزے کی منتظر','شائع شدہ','ذاتی']),
  fa: labels(['پروندهٔ کتاب','عنوان کتاب','مؤلف','مؤلف کتاب','دسته','دستهٔ کتاب','ذخیرهٔ کتاب در حساب من','پاک کردن','هنوز کتابی در حساب ذخیره نشده است.','بارگذاری کتاب‌های قدیمی‌تر','بارگذاری کتاب‌های حساب ممکن نشد.','بارگذاری کتاب‌های قدیمی‌تر ممکن نشد؛ کتاب‌های نمایان باقی ماندند.','افزودن کتاب به حساب من','کتاب به‌صورت خصوصی ذخیره و برای بررسی فرستاده شد','ذخیرهٔ کتاب ممکن نشد.','کتاب از حساب حذف شد','حذف کتاب ممکن نشد.','کتاب‌های حساب من','تا تصمیم مدیر برای انتشار عمومی، خصوصی می‌مانند.','در انتظار بررسی','منتشرشده','خصوصی']),
}

type AccountBookDynamicTemplates = { deleteLabel: (title: string) => string; confirmDelete: (title: string) => string }
export const REVIEWED_ME_ACCOUNT_BOOK_DYNAMIC_TEMPLATES: Readonly<Record<string, AccountBookDynamicTemplates>> = {
  ckb:{deleteLabel:title=>`سڕینەوەی ${title}`,confirmDelete:title=>`«${title}» لە هەژمارەکەت بسڕیتەوە؟`},
  ku:{deleteLabel:title=>`${title} jê bibe`,confirmDelete:title=>`“${title}” ji hesabê te were jêbirin?`},
  tr:{deleteLabel:title=>`${title} kitabını sil`,confirmDelete:title=>`“${title}” hesabınızdan silinsin mi?`},
  ur:{deleteLabel:title=>`${title} حذف کریں`,confirmDelete:title=>`”${title}“ اپنے اکاؤنٹ سے حذف کریں؟`},
  fa:{deleteLabel:title=>`پاک کردن ${title}`,confirmDelete:title=>`«${title}» از حساب شما حذف شود؟`},
}
