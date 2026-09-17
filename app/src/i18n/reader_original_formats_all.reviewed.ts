const originalFormat: Readonly<Record<string, (format: string) => string>> = {
  en:f=>`Original ${f}`, fr:f=>`${f} original`, ug:f=>`ئەسلى ${f}`, ckb:f=>`${f}ی ڕەسەن`, ku:f=>`${f} ya resen`, tr:f=>`Orijinal ${f}`,
  ur:f=>`اصل ${f}`, fa:f=>`${f} اصلی`, sw:f=>`${f} asili`, hi:f=>`मूल ${f}`, hu:f=>`Eredeti ${f}`, id:f=>`${f} asli`, ms:f=>`${f} asal`,
  bn:f=>`মূল ${f}`, ps:f=>`اصلي ${f}`, so:f=>`${f}-ga asalka ah`, ha:f=>`${f} na asali`, ru:f=>`Исходный ${f}`, uk:f=>`Оригінальний ${f}`,
  de:f=>`Original-${f}`, es:f=>`${f} original`, pt:f=>`${f} original`, it:f=>`${f} originale`, nl:f=>`Originele ${f}`, sv:f=>`Ursprunglig ${f}`,
  no:f=>`Opprinnelig ${f}`, pl:f=>`Oryginalny ${f}`, ro:f=>`${f} original`, bs:f=>`Izvorni ${f}`, sq:f=>`${f} origjinal`, az:f=>`Orijinal ${f}`,
  uz:f=>`Asl ${f}`, kk:f=>`Түпнұсқа ${f}`, zh:f=>`原始 ${f}`, ja:f=>`元の${f}`, ko:f=>`원본 ${f}`,
}

const sources = { 'BOK الأصلي':'BOK', 'EPUB الأصلي':'EPUB', 'Markdown الأصلي':'Markdown', 'Word الأصلي':'Word' } as const

/** Original-format badges; concrete source filenames remain outside this dictionary. */
export const REVIEWED_READER_ORIGINAL_FORMATS_ALL_UI: Readonly<Record<string, Readonly<Record<string, string>>>> = Object.fromEntries(
  Object.entries(originalFormat).map(([code, render]) => [code, Object.fromEntries(Object.entries(sources).map(([source, format]) => [source, render(format)]))]),
)
