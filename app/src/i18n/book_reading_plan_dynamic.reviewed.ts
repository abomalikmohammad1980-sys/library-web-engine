type BookReadingPlanDynamicTemplates = {
  pace: (minutes: string, pages: string) => string
  reachedPercent: (percent: string) => string
  todayTarget: (page: string) => string
  remainingDays: (days: string) => string
}

/** قوالب خطة القراءة داخل صفحة الكتاب؛ جميع القيم أرقام حالة وليست محتوى كتاب. */
export const REVIEWED_BOOK_READING_PLAN_DYNAMIC_TEMPLATES: Readonly<Record<string, BookReadingPlanDynamicTemplates>> = {
  en: { pace: (minutes, pages) => `${minutes} minutes daily · ${pages} pages`, reachedPercent: percent => `You reached ${percent}%`, todayTarget: page => `Today's target: page ${page}`, remainingDays: days => `About ${days} days to finish` },
  fr: { pace: (minutes, pages) => `${minutes} minutes par jour · ${pages} pages`, reachedPercent: percent => `Vous avez atteint ${percent} %`, todayTarget: page => `Objectif du jour : page ${page}`, remainingDays: days => `Environ ${days} jours avant la fin` },
  ug: { pace: (minutes, pages) => `كۈنىگە ${minutes} مىنۇت · ${pages} بەت`, reachedPercent: percent => `${percent}٪ كە يەتتىڭىز`, todayTarget: page => `بۈگۈنكى نىشان: ${page}-بەت`, remainingDays: days => `تاماملاشقا تەخمىنەن ${days} كۈن` },
  ckb: {
    pace: (minutes, pages) => `${minutes} خولەک ڕۆژانە · ${pages} پەڕە`,
    reachedPercent: percent => `گەیشتیتە ${percent}٪`,
    todayTarget: page => `ئامانجی ئەمڕۆ: پەڕەی ${page}`,
    remainingDays: days => `نزیکەی ${days} ڕۆژ بۆ تەواوکردن`,
  },
  ku: {
    pace: (minutes, pages) => `Rojane ${minutes} deqîqe · ${pages} rûpel`,
    reachedPercent: percent => `Tu gihîştî ${percent}٪`,
    todayTarget: page => `Armanca îro: rûpela ${page}`,
    remainingDays: days => `Nêzî ${days} roj ji bo qedandinê`,
  },
  tr: {
    pace: (minutes, pages) => `Günde ${minutes} dakika · ${pages} sayfa`,
    reachedPercent: percent => `%${percent} seviyesine ulaştınız`,
    todayTarget: page => `Bugünkü hedef: ${page}. sayfa`,
    remainingDays: days => `Tamamlanmasına yaklaşık ${days} gün`,
  },
  ur: {
    pace: (minutes, pages) => `روزانہ ${minutes} منٹ · ${pages} صفحات`,
    reachedPercent: percent => `آپ ${percent}٪ تک پہنچے`,
    todayTarget: page => `آج کا ہدف: صفحہ ${page}`,
    remainingDays: days => `مکمل ہونے میں تقریباً ${days} دن`,
  },
  fa: {
    pace: (minutes, pages) => `روزانه ${minutes} دقیقه · ${pages} صفحه`,
    reachedPercent: percent => `به ${percent}٪ رسیده‌اید`,
    todayTarget: page => `هدف امروز: صفحهٔ ${page}`,
    remainingDays: days => `حدود ${days} روز تا پایان`,
  },
  sw: { pace: (minutes, pages) => `Dakika ${minutes} kila siku · kurasa ${pages}`, reachedPercent: percent => `Umefikia ${percent}%`, todayTarget: page => `Lengo la leo: ukurasa ${page}`, remainingDays: days => `Takriban siku ${days} kumaliza` },
  hi: { pace: (minutes, pages) => `प्रतिदिन ${minutes} मिनट · ${pages} पृष्ठ`, reachedPercent: percent => `आप ${percent}% तक पहुँचे`, todayTarget: page => `आज का लक्ष्य: पृष्ठ ${page}`, remainingDays: days => `पूरा होने में लगभग ${days} दिन` },
  hu: { pace: (minutes, pages) => `Napi ${minutes} perc · ${pages} oldal`, reachedPercent: percent => `Elérte a(z) ${percent}%-ot`, todayTarget: page => `Mai cél: ${page}. oldal`, remainingDays: days => `Körülbelül ${days} nap van hátra` },
  id: { pace: (minutes, pages) => `${minutes} menit per hari · ${pages} halaman`, reachedPercent: percent => `Anda mencapai ${percent}%`, todayTarget: page => `Target hari ini: halaman ${page}`, remainingDays: days => `Sekitar ${days} hari untuk selesai` },
  ms: { pace: (minutes, pages) => `${minutes} minit sehari · ${pages} halaman`, reachedPercent: percent => `Anda mencapai ${percent}%`, todayTarget: page => `Sasaran hari ini: halaman ${page}`, remainingDays: days => `Kira-kira ${days} hari untuk selesai` },
  bn: { pace: (minutes, pages) => `প্রতিদিন ${minutes} মিনিট · ${pages} পৃষ্ঠা`, reachedPercent: percent => `আপনি ${percent}% পৌঁছেছেন`, todayTarget: page => `আজকের লক্ষ্য: পৃষ্ঠা ${page}`, remainingDays: days => `শেষ করতে প্রায় ${days} দিন` },
  ps: { pace: (minutes, pages) => `هره ورځ ${minutes} دقیقې · ${pages} پاڼې`, reachedPercent: percent => `تاسو ${percent}٪ ته رسېدلي یاست`, todayTarget: page => `د نن هدف: ${page} پاڼه`, remainingDays: days => `د بشپړېدو لپاره شاوخوا ${days} ورځې` },
  so: { pace: (minutes, pages) => `${minutes} daqiiqo maalintii · ${pages} bog`, reachedPercent: percent => `Waxaad gaartay ${percent}%`, todayTarget: page => `Hadafka maanta: bogga ${page}`, remainingDays: days => `Qiyaastii ${days} maalmood ayaa haray` },
  ha: { pace: (minutes, pages) => `Minti ${minutes} kullum · shafuka ${pages}`, reachedPercent: percent => `Ka kai ${percent}%`, todayTarget: page => `Burin yau: shafi ${page}`, remainingDays: days => `Kimanin kwanaki ${days} don kammalawa` },
  ru: { pace: (minutes, pages) => `${minutes} минут в день · ${pages} страниц`, reachedPercent: percent => `Прочитано ${percent}%`, todayTarget: page => `Цель на сегодня: страница ${page}`, remainingDays: days => `До завершения около ${days} дней` },
  uk: { pace: (minutes, pages) => `${minutes} хвилин на день · ${pages} сторінок`, reachedPercent: percent => `Прочитано ${percent}%`, todayTarget: page => `Ціль на сьогодні: сторінка ${page}`, remainingDays: days => `До завершення близько ${days} днів` },
  de: { pace: (minutes, pages) => `${minutes} Minuten täglich · ${pages} Seiten`, reachedPercent: percent => `${percent} % erreicht`, todayTarget: page => `Heutiges Ziel: Seite ${page}`, remainingDays: days => `Noch etwa ${days} Tage` },
  es: { pace: (minutes, pages) => `${minutes} minutos al día · ${pages} páginas`, reachedPercent: percent => `Has alcanzado el ${percent} %`, todayTarget: page => `Objetivo de hoy: página ${page}`, remainingDays: days => `Unos ${days} días para terminar` },
  pt: { pace: (minutes, pages) => `${minutes} minutos por dia · ${pages} páginas`, reachedPercent: percent => `Atingiu ${percent}%`, todayTarget: page => `Objetivo de hoje: página ${page}`, remainingDays: days => `Cerca de ${days} dias para terminar` },
  it: { pace: (minutes, pages) => `${minutes} minuti al giorno · ${pages} pagine`, reachedPercent: percent => `Hai raggiunto il ${percent}%`, todayTarget: page => `Obiettivo di oggi: pagina ${page}`, remainingDays: days => `Circa ${days} giorni al termine` },
  nl: { pace: (minutes, pages) => `${minutes} minuten per dag · ${pages} pagina's`, reachedPercent: percent => `${percent}% bereikt`, todayTarget: page => `Doel van vandaag: pagina ${page}`, remainingDays: days => `Nog ongeveer ${days} dagen` },
  sv: { pace: (minutes, pages) => `${minutes} minuter dagligen · ${pages} sidor`, reachedPercent: percent => `Du har nått ${percent}%`, todayTarget: page => `Dagens mål: sida ${page}`, remainingDays: days => `Cirka ${days} dagar kvar` },
  no: { pace: (minutes, pages) => `${minutes} minutter daglig · ${pages} sider`, reachedPercent: percent => `Du har nådd ${percent}%`, todayTarget: page => `Dagens mål: side ${page}`, remainingDays: days => `Omtrent ${days} dager igjen` },
  pl: { pace: (minutes, pages) => `${minutes} minut dziennie · ${pages} stron`, reachedPercent: percent => `Osiągnięto ${percent}%`, todayTarget: page => `Cel na dziś: strona ${page}`, remainingDays: days => `Około ${days} dni do końca` },
  ro: { pace: (minutes, pages) => `${minutes} minute zilnic · ${pages} pagini`, reachedPercent: percent => `Ați ajuns la ${percent}%`, todayTarget: page => `Obiectivul de azi: pagina ${page}`, remainingDays: days => `Aproximativ ${days} zile până la final` },
  bs: { pace: (minutes, pages) => `${minutes} minuta dnevno · ${pages} stranica`, reachedPercent: percent => `Dostigli ste ${percent}%`, todayTarget: page => `Današnji cilj: stranica ${page}`, remainingDays: days => `Oko ${days} dana do završetka` },
  sq: { pace: (minutes, pages) => `${minutes} minuta në ditë · ${pages} faqe`, reachedPercent: percent => `Keni arritur ${percent}%`, todayTarget: page => `Synimi i sotëm: faqja ${page}`, remainingDays: days => `Rreth ${days} ditë deri në fund` },
  az: { pace: (minutes, pages) => `Gündə ${minutes} dəqiqə · ${pages} səhifə`, reachedPercent: percent => `${percent}%-ə çatdınız`, todayTarget: page => `Bugünkü hədəf: ${page}-ci səhifə`, remainingDays: days => `Bitirməyə təxminən ${days} gün` },
  uz: { pace: (minutes, pages) => `Kuniga ${minutes} daqiqa · ${pages} sahifa`, reachedPercent: percent => `${percent}% ga yetdingiz`, todayTarget: page => `Bugungi maqsad: ${page}-sahifa`, remainingDays: days => `Tugatishga taxminan ${days} kun` },
  kk: { pace: (minutes, pages) => `Күніне ${minutes} минут · ${pages} бет`, reachedPercent: percent => `${percent}%-ға жеттіңіз`, todayTarget: page => `Бүгінгі мақсат: ${page}-бет`, remainingDays: days => `Аяқтауға шамамен ${days} күн` },
  zh: { pace: (minutes, pages) => `每天 ${minutes} 分钟 · ${pages} 页`, reachedPercent: percent => `已完成 ${percent}%`, todayTarget: page => `今日目标：第 ${page} 页`, remainingDays: days => `约 ${days} 天后完成` },
  ja: { pace: (minutes, pages) => `1日 ${minutes} 分 · ${pages} ページ`, reachedPercent: percent => `${percent}% に到達`, todayTarget: page => `今日の目標: ${page} ページ`, remainingDays: days => `完了まで約 ${days} 日` },
  ko: { pace: (minutes, pages) => `매일 ${minutes}분 · ${pages}페이지`, reachedPercent: percent => `${percent}% 달성`, todayTarget: page => `오늘의 목표: ${page}페이지`, remainingDays: days => `완료까지 약 ${days}일` },
}
