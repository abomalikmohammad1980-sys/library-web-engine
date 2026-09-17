import {h} from './ui'
export function wordCompanionHelp():HTMLElement {
 const windows=/Windows/i.test(navigator.userAgent)
 return h('section',{class:'import-manual-pdf','aria-label':'مطابقة صفحات Word'},
  h('h3',null,'مطابقة صفحات Word من جهازك'),
  h('p',null,'للحفاظ على شكل الصفحات وترقيمها، أنشئ حزمة الكتاب بواسطة Word على جهازك ثم ارفعها هنا. الأداة تعالج ملفك وحده، ولا تحتاج اتصالًا بالإنترنت أثناء المعالجة.'),
  h('ol',null,h('li',null,'نزّل الأداة وفك ضغطها، واحفظ الكتاب المطلوب. يمكنك متابعة العمل في Word؛ الأداة تستخدم نسخة مستقلة من آخر حفظ.'),h('li',null,'افتح Start.cmd، واختر DOCX أو DOC أو RTF ثم مكان حفظ الحزمة؛ تُحوّل الصيغ القديمة إلى DOCX تلقائيًا دون تغيير الأصل.'),h('li',null,'بعد نجاح المعالجة، اختر ملف .khizana-word من زر إضافة ملفات.')),
  h('a',{class:'btn btn--secondary',href:'/downloads/khizana-word-companion-windows.zip'},'تنزيل أداة Word — Windows'),
  h('small',null,windows?'نسخة محمولة تجريبية؛ تحتاج Microsoft Word المكتبي، ولا تتطلب تثبيت خدمة أو صلاحيات مدير.':'الأداة الحالية تدعم Windows فقط. دعم Mac لم يُختبر بعد؛ لا تثبت نسخة Windows عليه.'),
  h('p',null,'يتحقق الموقع من الحزمة قبل قبولها. رفع Word وحده دون معالجة موثقة يبقى تقديريًا؛ وإرفاق PDF يدويًا ليس بديلًا عن خريطة الصفحات.'),
 )
}
