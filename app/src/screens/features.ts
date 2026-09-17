import { h, arabicNum } from '../ui'
import {uiTemplateText} from '../ui_template_binding'

type FeatureStatus = 'available' | 'developing' | 'vision'
interface FeatureItem { title: string; description: string; status: FeatureStatus; label?: string }

const STATUS: Record<FeatureStatus, string> = { available: 'متاح الآن', developing: 'قيد التطوير', vision: 'رؤية مستهدفة' }

const FEATURES: readonly FeatureItem[] = [
  { status: 'available', title: 'مكتبة شخصية متعددة الصيغ', description: 'استيراد وقراءة أنواع النصوص والكتب، ومنها Word وPDF وEPUB وكتب الشاملة BOK، مع حفظ الأصل داخل مكتبتك المحلية، وقراءته بتنسيق احترافي، وربطه بمؤلفيه وموضوعاته.' },
  { status: 'available', title: 'المصحف وخدمات التفسير', description: 'نص حفص كامل، مع القراءة بالرسم العثماني، والنسخ العثماني والإملائي، والبحث الدقيق في الآيات، وخدمات التفاسير والغريب والقراءات والصرف والتلاوة الصوتية. ويستهدف المشروع إضافة سائر القراءات تباعًا.' },
  { status: 'available', title: 'السنة النبوية', description: 'بحث في متون الحديث، وتصفح للمصادر، وعرض درجة الحديث ومخرّجه عندما تتوفر بيانات موثقة منسوبة إلى أهل العلم.' },
  { status: 'available', title: 'جميع كتب المكتبة الشاملة', description: 'أُضيفت جميع كتب المكتبة الشاملة إلى الخِزانة، مع بيانات مؤلفيها وتصنيفاتها وصفحاتها وفهارسها.' },
  { status: 'available', title: 'قارئ عربي يحترم بنية الكتاب وروحه وفهارسه', description: 'عرض طباعي وانسيابي، مع فهرس قابل للبحث، وانتقال سلس بين الصفحات، وسمات قراءة متنوعة، وتحكم في حجم الخط ونوعه، ووضع سكينة مريح.' },
  { status: 'available', title: 'البحث العربي في المكتبة', description: 'بحث فوري في النصوص والعناوين والمؤلفين، مع مراعاة خصائص العربية، والفلاتر، وفتح النتائج في مواضعها، والترتيب بحسب وفاة المؤلفين أو الترتيب الأبجدي.' },
  { status: 'available', title: 'العلامات والملاحظات والتظليل', description: 'فواصل صفحات، تظليل بألوان ذات معنى، ملاحظات، نسخ منسق ونسخ موثق باسم الكتاب والمؤلف والصفحة.' },
  { status: 'available', label: 'متاح ويجري تطويره', title: 'المطابقة الكاملة مع نصوص Word وخرائط الصفحات', description: 'أضف كتابًا بصيغة Word ليُعرض بخطوطه الأصلية وصوره وجداوله وحواشيه قدر الإمكان، مع تطوير مستمر للمطابقة الآلية، ومن دون ترقيعات بصرية تخص كتابًا واحدًا.' },
  { status: 'available', title: 'تنظيم القراءة والبحث', description: 'رفوف وخطط قراءة واقتباسات ومراجعة للمقتطفات، ومشاريع بحثية ودفتر ملاحظات، مع التصدير والنسخ الاحتياطي المحلي.' },
  { status: 'available', title: 'الوصول والعمل المحلي', description: 'واجهة عربية متجاوبة، وتنقل بلوحة المفاتيح، وتقليل للحركة، وسمات متعددة، وسياسات واضحة للعمل دون اتصال.' },
  { status: 'available', label: 'متاح ويجري تطويره', title: 'اللغات', description: 'واجهة قابلة للعمل بأكثر من ثلاثين لغة حية من أشهر اللغات التي يستعملها المسلمون، مع إمكان ترجمة النصوص المختارة، وتطوير مستمر لجودة الترجمات.' },
  { status: 'developing', title: 'محرك البحث المجزأ للكتب الكبيرة', description: 'ربط نواة البحث العربية الجديدة بالكتب الفعلية عبر Web Worker وحزم فهرس مجزأة، بهدف إظهار أول النتائج خلال أقل من ثانية ولو اتسعت المكتبة إلى عشرات آلاف الكتب.' },
  { status: 'developing', title: 'جودة الطبعات وعلاقات الكتب', description: 'بيان المصدر ودقة النص وسجل التغييرات، وربط الأصل بالشروح والمختصرات والسلاسل والطبعات.' },
  { status: 'developing', title: 'الروابط العلمية داخل المتن', description: 'تمييز الآيات والأحاديث والأعلام والغريب والإحالات من مصادر موثقة، مع كثافة روابط يختارها القارئ.' },
  { status: 'vision', title: 'أكثر من ١٠٠ ألف كتاب بكل الصيغ', description: 'الهدف بعيد المدى مكتبة تتجاوز ١٠٠ ألف كتاب نصي ومصور وWord وPDF وEPUB وBOK؛ هذا هدف توسع وليس وصفًا لحجم المكتبة المتاح الآن.' },
  { status: 'vision', title: 'صفحات علمية مترابطة', description: 'صفحات كاملة للآية والحديث والعَلَم والمكان واللفظة، وشروح متقابلة وشجرة إسناد وعائلة كتاب، كل حكم فيها منسوب لمصدره.' },
  { status: 'vision', title: 'مزامنة اختيارية متعددة الأجهزة', description: 'حساب اختياري يحافظ على الملكية المحلية والخصوصية، مع مزامنة قابلة للاستئناف وحل تعارضات معلن، من دون رفع ملفات المستخدم خفية.' },
  { status: 'vision', title: 'الباحث الذكي', description: 'بحث مساعد بالذكاء الاصطناعي في محتويات المكتبة، يجيب عن الأسئلة ويساعد على حل الإشكالات، مع عزو كل معلومة إلى موضعها ومصدرها، وإظهار حدود الإجابة بوضوح.' },
]

export function featuresScreen(): HTMLElement {
  const sections = (['available', 'developing', 'vision'] as FeatureStatus[]).map(status => {
    const items = FEATURES.filter(item => item.status === status)
    return h('section', { class: `features-report__section features-report__section--${status}`, 'aria-labelledby': `features-${status}` },
      h('div', { class: 'features-report__section-head' },
        h('h2', { id: `features-${status}` }, STATUS[status]),
        h('span', { class: `features-status features-status--${status}` }, uiTemplateText('34d91a83ac06428b',{p1:items.length})),
      ),
      h('ol', { class: 'features-report__list' }, ...items.map(item => {
        const number = FEATURES.findIndex(candidate => candidate === item) + 1
        return h('li', { class: 'features-report__item' },
          h('span', { class: 'features-report__number', 'aria-hidden': 'true' }, arabicNum(number)),
          h('div', null,
            h('div', { class: 'features-report__title-row' }, h('h3', null, item.title), h('span', { class: `features-status features-status--${status}` }, item.label ?? STATUS[status])),
            h('p', null, item.description),
          ),
        )
      })),
    )
  })

  return h('div', { class: 'page features-report' },
    h('header', { class: 'features-report__hero' },
      h('img', { class: 'features-report__brand', src: './brand-logo-color.png', alt: 'شعار الخِزانة', dataset: { uiText: '' } }),
      h('h1', { class: 'page-title' }, 'ميزات الخِزانة ورؤيتها'),
    ),
    h('aside', { class: 'features-report__notice', role: 'note', dataset: { uiText: '' } }, h('strong', null, 'ملاحظة:'), ' يتغير هذا التقرير مع تقدم التنفيذ والتحقق. وستُنشر الكتب دوريًا في المكتبة، مع إتاحة الاستيراد الشخصي للمستخدمين حاليًا. ويظل عدد الكتب المتاح فعليًا هو العدد المنشور في المكتبة، لا الأهداف المستقبلية.'),
    ...sections,
  )
}
