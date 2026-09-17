const downloadOriginal: Readonly<Record<string, (format: string) => string>> = {
  en: f => `Download original ${f}`, fr: f => `Télécharger le ${f} original`, ug: f => `ئەسلى ${f} نى چۈشۈرۈش`,
  ckb: f => `داگرتنی ${f}ی ڕەسەن`, ku: f => `${f}-a resen daxîne`, tr: f => `Orijinal ${f} dosyasını indir`,
  ur: f => `اصل ${f} ڈاؤن لوڈ کریں`, fa: f => `دریافت ${f} اصلی`, sw: f => `Pakua ${f} asili`,
  hi: f => `मूल ${f} डाउनलोड करें`, hu: f => `Eredeti ${f} letöltése`, id: f => `Unduh ${f} asli`,
  ms: f => `Muat turun ${f} asal`, bn: f => `মূল ${f} ডাউনলোড করুন`, ps: f => `اصلي ${f} ښکته کړئ`,
  so: f => `Soo dejiso ${f}-ga asalka ah`, ha: f => `Sauke ${f} na asali`, ru: f => `Скачать исходный ${f}`,
  uk: f => `Завантажити оригінальний ${f}`, de: f => `Original-${f} herunterladen`, es: f => `Descargar ${f} original`,
  pt: f => `Baixar ${f} original`, it: f => `Scarica il ${f} originale`, nl: f => `Originele ${f} downloaden`,
  sv: f => `Ladda ner ursprunglig ${f}`, no: f => `Last ned opprinnelig ${f}`, pl: f => `Pobierz oryginalny ${f}`,
  ro: f => `Descarcă ${f}-ul original`, bs: f => `Preuzmi izvorni ${f}`, sq: f => `Shkarko ${f}-un origjinal`,
  az: f => `Orijinal ${f}-u endir`, uz: f => `Asl ${f} faylini yuklab olish`, kk: f => `Түпнұсқа ${f} файлын жүктеп алу`,
  zh: f => `下载原始 ${f}`, ja: f => `元の${f}をダウンロード`, ko: f => `원본 ${f} 다운로드`,
}

const sourceFormats = { 'تنزيل BOK الأصلي': 'BOK', 'تنزيل EPUB الأصلي': 'EPUB', 'تنزيل Word الأصلي': 'Word', 'تنزيل النص الأصلي': 'TXT' } as const

/** Reader original-file download actions; concrete filenames remain outside this dictionary. */
export const REVIEWED_READER_ORIGINAL_DOWNLOADS_ALL_UI: Readonly<Record<string, Readonly<Record<string, string>>>> = Object.fromEntries(
  Object.entries(downloadOriginal).map(([code, render]) => [code, Object.fromEntries(Object.entries(sourceFormats).map(([source, format]) => [source, render(format)]))]),
)
