type MeSummaryDynamicTemplates = {
  identity: (value: string) => string
  sessionIdentity: (value: string) => string
  ratio: (value: string, total: string) => string
  activePlan: (count: string, singular: boolean) => string
  annotations: (bookmarks: string, notes: string, highlights: string) => string
  activeDays: (count: string) => string
  bookOpens: (count: string) => string
  completion: (percent: string) => string
  heatmap: (active: string, days: string) => string
}

/** ملخص «أنا»؛ value هوية جلسة، وبقية القيم عدادات تحفظ حرفيًا. */
export const REVIEWED_ME_SUMMARY_DYNAMIC_TEMPLATES: Readonly<Record<string, MeSummaryDynamicTemplates>> = {
  ckb:{identity:value=>`بە ناسنامەی ${value} چوویتە ژوورەوە`,sessionIdentity:value=>`بۆ ئەم دانیشتنە بە ناسنامەی ${value} چوویتە ژوورەوە`,ratio:(value,total)=>`${value} لە ${total}`,activePlan:(count,singular)=>`${count} ${singular?'پلانی چالاک':'پلانی چالاک'}`,annotations:(bookmarks,notes,highlights)=>`${bookmarks} نیشانە · ${notes} تێبینی · ${highlights} دیاریکردن`,activeDays:count=>`${count} ڕۆژی چالاک`,bookOpens:count=>`${count} کردنەوەی کتێب`,completion:percent=>`${percent}٪ لە ڕۆژەکان`,heatmap:(active,days)=>`${active} ڕۆژی خوێندنەوە لە دوا ${days} ڕۆژدا`},
  ku:{identity:value=>`Tu bi nasnameya ${value} têketî`,sessionIdentity:value=>`Tu ji bo vê danişînê bi nasnameya ${value} têketî`,ratio:(value,total)=>`${value} ji ${total}`,activePlan:(count,singular)=>`${count} ${singular?'plana çalak':'planên çalak'}`,annotations:(bookmarks,notes,highlights)=>`${bookmarks} nîşan · ${notes} not · ${highlights} ronîkirin`,activeDays:count=>`${count} rojên çalak`,bookOpens:count=>`${count} vekirina pirtûkê`,completion:percent=>`${percent}٪ ji rojan`,heatmap:(active,days)=>`${active} rojên xwendinê ji ${days} rojên dawî`},
  tr:{identity:value=>`${value} olarak giriş yaptınız`,sessionIdentity:value=>`Bu oturum için ${value} olarak giriş yaptınız`,ratio:(value,total)=>`${total} içinden ${value}`,activePlan:(count,singular)=>`${count} ${singular?'etkin plan':'etkin plan'}`,annotations:(bookmarks,notes,highlights)=>`${bookmarks} işaret · ${notes} not · ${highlights} vurgu`,activeDays:count=>`${count} etkin gün`,bookOpens:count=>`${count} kitap açılışı`,completion:percent=>`Günlerin %${percent} kadarı`,heatmap:(active,days)=>`Son ${days} günde ${active} okuma günü`},
  ur:{identity:value=>`آپ ${value} کی حیثیت سے داخل ہیں`,sessionIdentity:value=>`آپ اس نشست کے لیے ${value} کی حیثیت سے داخل ہیں`,ratio:(value,total)=>`${total} میں سے ${value}`,activePlan:(count,singular)=>`${count} ${singular?'فعال منصوبہ':'فعال منصوبے'}`,annotations:(bookmarks,notes,highlights)=>`${bookmarks} نشانات · ${notes} نوٹس · ${highlights} نمایاں حصے`,activeDays:count=>`${count} فعال دن`,bookOpens:count=>`${count} کتاب کھولنا`,completion:percent=>`${percent}٪ دن`,heatmap:(active,days)=>`گزشتہ ${days} دنوں میں ${active} مطالعہ کے دن`},
  fa:{identity:value=>`با عنوان ${value} وارد شده‌اید`,sessionIdentity:value=>`برای این نشست با عنوان ${value} وارد شده‌اید`,ratio:(value,total)=>`${value} از ${total}`,activePlan:(count,singular)=>`${count} ${singular?'برنامهٔ فعال':'برنامهٔ فعال'}`,annotations:(bookmarks,notes,highlights)=>`${bookmarks} نشان · ${notes} یادداشت · ${highlights} برجسته‌سازی`,activeDays:count=>`${count} روز فعال`,bookOpens:count=>`${count} بار گشودن کتاب`,completion:percent=>`${percent}٪ از روزها`,heatmap:(active,days)=>`${active} روز مطالعه از ${days} روز اخیر`},
}
