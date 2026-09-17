export const REVIEWED_READING_PLANS_PROGRESS_UI = {
  ckb: {'خططك في مشهد واحد':'پلانتەکانت لە یەک دیمەندا','لا توجد خطة قراءة فعالة':'هیچ پلانی خوێندنەوەیەکی چالاک نییە','اختر كتابًا':'کتێبێک هەڵبژێرە'},
  ku: {'خططك في مشهد واحد':'Planên te di yek dîmenê de','لا توجد خطة قراءة فعالة':'Tu plana xwendinê ya çalak tune','اختر كتابًا':'Pirtûkek hilbijêre'},
  tr: {'خططك في مشهد واحد':'Planlarınız tek görünümde','لا توجد خطة قراءة فعالة':'Etkin bir okuma planı yok','اختر كتابًا':'Bir kitap seçin'},
  ur: {'خططك في مشهد واحد':'آپ کے منصوبے ایک ہی منظر میں','لا توجد خطة قراءة فعالة':'کوئی فعال مطالعہ منصوبہ نہیں','اختر كتابًا':'کتاب منتخب کریں'},
  fa: {'خططك في مشهد واحد':'برنامه‌های شما در یک نما','لا توجد خطة قراءة فعالة':'برنامهٔ مطالعهٔ فعالی وجود ندارد','اختر كتابًا':'کتابی انتخاب کنید'},
} as const

type ReadingPlanProgressTemplates = {
  reached: (page: string) => string
  daily: (pages: string) => string
  remaining: (days: string) => string
}

export const REVIEWED_READING_PLAN_PROGRESS_TEMPLATES: Readonly<Record<string, ReadingPlanProgressTemplates>> = {
  en: { reached: page => `You reached page ${page}`, daily: pages => `Today’s reading: ${pages} pages to catch up with the target`, remaining: days => `About ${days} days remaining` },
  fr: { reached: page => `Vous avez atteint la page ${page}`, daily: pages => `Lecture du jour : ${pages} pages pour rattraper l’objectif`, remaining: days => `Environ ${days} jours restants` },
  ug: { reached: page => `${page}-بەتكە يەتتىڭىز`, daily: pages => `بۈگۈنكى ئوقۇش: نىشانغا يېتىش ئۈچۈن ${pages} بەت`, remaining: days => `تەخمىنەن ${days} كۈن قالدى` },
  ckb: { reached: page => `گەیشتیتە پەڕەی ${page}`, daily: pages => `وردی ئەمڕۆ: ${pages} پەڕە بۆ گەیشتن بە ئامانج`, remaining: days => `نزیکەی ${days} ڕۆژ ماوە` },
  ku: { reached: page => `Tu gihîştî rûpela ${page}`, daily: pages => `Xwendina îro: ${pages} rûpel ji bo gihîştina armancê`, remaining: days => `Nêzî ${days} roj mane` },
  tr: { reached: page => `${page}. sayfaya ulaştınız`, daily: pages => `Bugünkü okuma: hedefe yetişmek için ${pages} sayfa`, remaining: days => `Yaklaşık ${days} gün kaldı` },
  ur: { reached: page => `آپ صفحہ ${page} تک پہنچے`, daily: pages => `آج کا مطالعہ: ہدف تک پہنچنے کے لیے ${pages} صفحات`, remaining: days => `تقریباً ${days} دن باقی` },
  fa: { reached: page => `به صفحهٔ ${page} رسیده‌اید`, daily: pages => `مطالعهٔ امروز: ${pages} صفحه برای رسیدن به هدف`, remaining: days => `حدود ${days} روز باقی مانده` },
  sw: { reached: page => `Umefika ukurasa wa ${page}`, daily: pages => `Usomaji wa leo: kurasa ${pages} kufikia lengo`, remaining: days => `Takribani siku ${days} zimesalia` },
  hi: { reached: page => `आप पृष्ठ ${page} पर पहुँचे`, daily: pages => `आज का पठन: लक्ष्य तक पहुँचने के लिए ${pages} पृष्ठ`, remaining: days => `लगभग ${days} दिन शेष` },
  hu: { reached: page => `Elérte a(z) ${page}. oldalt`, daily: pages => `Mai olvasás: ${pages} oldal a cél eléréséhez`, remaining: days => `Körülbelül ${days} nap van hátra` },
  id: { reached: page => `Anda mencapai halaman ${page}`, daily: pages => `Bacaan hari ini: ${pages} halaman untuk mengejar target`, remaining: days => `Sekitar ${days} hari tersisa` },
  ms: { reached: page => `Anda sampai ke halaman ${page}`, daily: pages => `Bacaan hari ini: ${pages} halaman untuk mengejar sasaran`, remaining: days => `Kira-kira ${days} hari berbaki` },
  bn: { reached: page => `আপনি ${page} পৃষ্ঠায় পৌঁছেছেন`, daily: pages => `আজকের পাঠ: লক্ষ্য পূরণে ${pages} পৃষ্ঠা`, remaining: days => `প্রায় ${days} দিন বাকি` },
  ps: { reached: page => `تاسو ${page} مخ ته ورسېدئ`, daily: pages => `د نن ورځې لوستل: هدف ته د رسېدو لپاره ${pages} مخونه`, remaining: days => `شاوخوا ${days} ورځې پاتې دي` },
  so: { reached: page => `Waxaad gaartay bogga ${page}`, daily: pages => `Akhriska maanta: ${pages} bog si loo gaaro yoolka`, remaining: days => `Qiyaastii ${days} maalmood ayaa haray` },
  ha: { reached: page => `Ka kai shafi na ${page}`, daily: pages => `Karatun yau: shafuka ${pages} domin cimma buri`, remaining: days => `Kimanin kwanaki ${days} suka rage` },
  ru: { reached: page => `Вы дошли до страницы ${page}`, daily: pages => `Сегодня: ${pages} страниц, чтобы достичь цели`, remaining: days => `Осталось около ${days} дней` },
  uk: { reached: page => `Ви дійшли до сторінки ${page}`, daily: pages => `На сьогодні: ${pages} сторінок, щоб наздогнати ціль`, remaining: days => `Залишилося близько ${days} днів` },
  de: { reached: page => `Sie haben Seite ${page} erreicht`, daily: pages => `Heutige Lektüre: ${pages} Seiten bis zum Ziel`, remaining: days => `Noch etwa ${days} Tage` },
  es: { reached: page => `Has llegado a la página ${page}`, daily: pages => `Lectura de hoy: ${pages} páginas para alcanzar el objetivo`, remaining: days => `Quedan unos ${days} días` },
  pt: { reached: page => `Você chegou à página ${page}`, daily: pages => `Leitura de hoje: ${pages} páginas para alcançar a meta`, remaining: days => `Restam cerca de ${days} dias` },
  it: { reached: page => `Hai raggiunto la pagina ${page}`, daily: pages => `Lettura di oggi: ${pages} pagine per raggiungere l’obiettivo`, remaining: days => `Restano circa ${days} giorni` },
  nl: { reached: page => `U hebt pagina ${page} bereikt`, daily: pages => `Vandaag: ${pages} pagina's om het doel te halen`, remaining: days => `Nog ongeveer ${days} dagen` },
  sv: { reached: page => `Du har nått sida ${page}`, daily: pages => `Dagens läsning: ${pages} sidor för att nå målet`, remaining: days => `Cirka ${days} dagar återstår` },
  no: { reached: page => `Du har nådd side ${page}`, daily: pages => `Dagens lesing: ${pages} sider for å nå målet`, remaining: days => `Omtrent ${days} dager gjenstår` },
  pl: { reached: page => `Dotarłeś do strony ${page}`, daily: pages => `Na dziś: ${pages} stron, aby osiągnąć cel`, remaining: days => `Pozostało około ${days} dni` },
  ro: { reached: page => `Ai ajuns la pagina ${page}`, daily: pages => `Lectura de azi: ${pages} pagini pentru a atinge obiectivul`, remaining: days => `Au rămas aproximativ ${days} zile` },
  bs: { reached: page => `Stigli ste do stranice ${page}`, daily: pages => `Današnje čitanje: ${pages} stranica do cilja`, remaining: days => `Preostalo je oko ${days} dana` },
  sq: { reached: page => `Arrite në faqen ${page}`, daily: pages => `Leximi i sotëm: ${pages} faqe për të arritur synimin`, remaining: days => `Kanë mbetur rreth ${days} ditë` },
  az: { reached: page => `${page}-ci səhifəyə çatdınız`, daily: pages => `Bugünkü oxu: hədəfə çatmaq üçün ${pages} səhifə`, remaining: days => `Təxminən ${days} gün qalıb` },
  uz: { reached: page => `${page}-sahifaga yetdingiz`, daily: pages => `Bugungi o‘qish: maqsadga yetish uchun ${pages} sahifa`, remaining: days => `Taxminan ${days} kun qoldi` },
  kk: { reached: page => `${page}-бетке жеттіңіз`, daily: pages => `Бүгінгі оқу: мақсатқа жету үшін ${pages} бет`, remaining: days => `Шамамен ${days} күн қалды` },
  zh: { reached: page => `您已读到第${page}页`, daily: pages => `今日阅读：为赶上目标需读${pages}页`, remaining: days => `约剩${days}天` },
  ja: { reached: page => `${page}ページまで読みました`, daily: pages => `今日の読書：目標に追いつくまで${pages}ページ`, remaining: days => `残り約${days}日` },
  ko: { reached: page => `${page}페이지까지 읽었습니다`, daily: pages => `오늘의 독서: 목표까지 ${pages}페이지`, remaining: days => `약 ${days}일 남음` },
}
