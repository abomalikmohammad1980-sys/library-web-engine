export function bookLoadFailureDescription(error:unknown):string{
 let current=error
 for(let depth=0;depth<4&&current instanceof Error;depth++,current=current.cause){
  if(/storage_full/.test(current.message)||current.name==='QuotaExceededError')return 'مساحة التخزين المتاحة للموقع ممتلئة. حرّر مساحة في جهازك ثم أعد المحاولة. لا تحذف بيانات الموقع حتى لا تفقد كتبك أو ملاحظاتك المحلية.'
  if(/storage_failed/.test(current.message))return 'تعذّر حفظ الكتاب في هذا المتصفح. أعد المحاولة، وتأكد من السماح للموقع بالتخزين. لم نحذف كتبك أو ملاحظاتك.'
  if(/integrity|checksum|size_mismatch|count_mismatch/.test(current.message))return 'لم تجتز حزمة الكتاب فحص الاكتمال؛ أعد المحاولة لتنزيل نسخة سليمة. لم نغيّر النص أو نتجاوز التحقق.'
  if(/http_404|not_mapped/.test(current.message))return 'حزمة الكتاب غير متاحة في مصدر التنزيل حاليًا. أعد المحاولة لاحقًا أو أبلغ الإدارة باسم الكتاب.'
 }
 return 'تعذّر تنزيل بيانات الكتاب كاملة. تحقّق من الاتصال ثم اضغط إعادة المحاولة؛ لن تحتاج إلى مغادرة الصفحة.'
}
