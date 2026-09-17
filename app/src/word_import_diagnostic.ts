export function wordMapImportFailure(error:unknown,modelParagraphs:number,mapParagraphs:number):Error{
 if(!(error instanceof Error)||error.name!=='WordPageMapMismatchError')return error instanceof Error?error:new Error(String(error))
 const failure=new Error(`تعذّر التحقق من تطابق فقرات المستند مع خريطة Word (النص: ${modelParagraphs}، الخريطة: ${mapParagraphs}). لم يُحفظ الكتاب ولم يُنشر. أعد إنشاء الحزمة من الملف الأصلي؛ وإذا تكرر الخطأ أرفق ملف DOCX وحزمة المساعد لفحص السبب.`,{cause:error})
 failure.name='WordPageMapMismatchError';return failure
}
