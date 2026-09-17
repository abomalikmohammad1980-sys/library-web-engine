const textVersion: Readonly<Record<string, (format: string) => string>> = {
  en:f=>`Text version of the original ${f} file`, fr:f=>`Version texte du fichier ${f} original`, ug:f=>`ئەسلى ${f} ھۆججىتىنىڭ تېكىست نۇسخىسى`,
  ckb:f=>`وەشانی دەقی فایلی ${f}ی ڕەسەن`, ku:f=>`Guhertoya nivîsê ya pelê ${f} yê resen`, tr:f=>`Orijinal ${f} dosyasının metin sürümü`,
  ur:f=>`اصل ${f} فائل کا متنی نسخہ`, fa:f=>`نسخهٔ متنی فایل ${f} اصلی`, sw:f=>`Toleo la maandishi la faili asili ya ${f}`,
  hi:f=>`मूल ${f} फ़ाइल का पाठ संस्करण`, hu:f=>`Az eredeti ${f}-fájl szöveges változata`, id:f=>`Versi teks dari berkas ${f} asli`,
  ms:f=>`Versi teks fail ${f} asal`, bn:f=>`মূল ${f} ফাইলের পাঠ সংস্করণ`, ps:f=>`د اصلي ${f} فایل متني بڼه`,
  so:f=>`Nooca qoraalka ee faylka ${f} asalka ah`, ha:f=>`Sigar rubutu na fayil ɗin ${f} na asali`, ru:f=>`Текстовая версия исходного файла ${f}`,
  uk:f=>`Текстова версія оригінального файла ${f}`, de:f=>`Textfassung der ursprünglichen ${f}-Datei`, es:f=>`Versión de texto del archivo ${f} original`,
  pt:f=>`Versão em texto do arquivo ${f} original`, it:f=>`Versione testuale del file ${f} originale`, nl:f=>`Tekstversie van het oorspronkelijke ${f}-bestand`,
  sv:f=>`Textversion av den ursprungliga ${f}-filen`, no:f=>`Tekstversjon av den opprinnelige ${f}-filen`, pl:f=>`Wersja tekstowa oryginalnego pliku ${f}`,
  ro:f=>`Versiune text a fișierului ${f} original`, bs:f=>`Tekstualna verzija izvorne ${f} datoteke`, sq:f=>`Version tekst i skedarit origjinal ${f}`,
  az:f=>`Orijinal ${f} faylının mətn versiyası`, uz:f=>`Asl ${f} faylining matnli nusxasi`, kk:f=>`Түпнұсқа ${f} файлының мәтіндік нұсқасы`,
  zh:f=>`原始 ${f} 文件的文本版本`, ja:f=>`元の${f}ファイルのテキスト版`, ko:f=>`원본 ${f} 파일의 텍스트 버전`,
}

const sources = { 'نسخة نصية من ملف BOK الأصلي': 'BOK', 'نسخة نصية من ملف EPUB الأصلي': 'EPUB' } as const

/** Reader fallback labels; extracted book text and concrete filenames stay outside this dictionary. */
export const REVIEWED_READER_TEXT_FALLBACKS_ALL_UI: Readonly<Record<string, Readonly<Record<string, string>>>> = Object.fromEntries(
  Object.entries(textVersion).map(([code, render]) => [code, Object.fromEntries(Object.entries(sources).map(([source, format]) => [source, render(format)]))]),
)
