import { shamelaSourceBookId } from './shamela_public_identity'

/** يوحّد رقم نتيجة الشاملة سواء جاء مصدرًا أو عامًا أو بأصفار بادئة. */
export function shamelaSearchMetadataKey(value:string):string{
  const trimmed=value.trim(),source=shamelaSourceBookId(trimmed)
  if(source)return source
  if(/^\d+$/u.test(trimmed)){const numeric=Number(trimmed);if(Number.isSafeInteger(numeric)&&numeric>0)return String(numeric)}
  return trimmed
}
