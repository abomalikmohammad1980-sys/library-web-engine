type PdfDownloadLabels = { download: string; original: string }

/** Reader PDF download actions; concrete PDF filenames remain outside this dictionary. */
const labels: Readonly<Record<string, PdfDownloadLabels>> = {
  en:{download:'Download PDF',original:'Download original PDF'}, fr:{download:'Télécharger le PDF',original:'Télécharger le PDF original'},
  ug:{download:'PDF نى چۈشۈرۈش',original:'ئەسلى PDF نى چۈشۈرۈش'}, ckb:{download:'داگرتنی PDF',original:'داگرتنی PDFی ڕەسەن'},
  ku:{download:'PDF daxîne',original:'PDF-a resen daxîne'}, tr:{download:'PDF indir',original:'Orijinal PDF dosyasını indir'},
  ur:{download:'PDF ڈاؤن لوڈ کریں',original:'اصل PDF ڈاؤن لوڈ کریں'}, fa:{download:'دریافت PDF',original:'دریافت PDF اصلی'},
  sw:{download:'Pakua PDF',original:'Pakua PDF asili'}, hi:{download:'PDF डाउनलोड करें',original:'मूल PDF डाउनलोड करें'},
  hu:{download:'PDF letöltése',original:'Eredeti PDF letöltése'}, id:{download:'Unduh PDF',original:'Unduh PDF asli'},
  ms:{download:'Muat turun PDF',original:'Muat turun PDF asal'}, bn:{download:'PDF ডাউনলোড করুন',original:'মূল PDF ডাউনলোড করুন'},
  ps:{download:'PDF ښکته کړئ',original:'اصلي PDF ښکته کړئ'}, so:{download:'Soo dejiso PDF',original:'Soo dejiso PDF-ga asalka ah'},
  ha:{download:'Sauke PDF',original:'Sauke PDF na asali'}, ru:{download:'Скачать PDF',original:'Скачать исходный PDF'},
  uk:{download:'Завантажити PDF',original:'Завантажити оригінальний PDF'}, de:{download:'PDF herunterladen',original:'Original-PDF herunterladen'},
  es:{download:'Descargar PDF',original:'Descargar PDF original'}, pt:{download:'Baixar PDF',original:'Baixar PDF original'},
  it:{download:'Scarica PDF',original:'Scarica il PDF originale'}, nl:{download:'PDF downloaden',original:'Originele PDF downloaden'},
  sv:{download:'Ladda ner PDF',original:'Ladda ner ursprunglig PDF'}, no:{download:'Last ned PDF',original:'Last ned opprinnelig PDF'},
  pl:{download:'Pobierz PDF',original:'Pobierz oryginalny PDF'}, ro:{download:'Descarcă PDF',original:'Descarcă PDF-ul original'},
  bs:{download:'Preuzmi PDF',original:'Preuzmi izvorni PDF'}, sq:{download:'Shkarko PDF',original:'Shkarko PDF-në origjinal'},
  az:{download:'PDF-i endir',original:'Orijinal PDF-i endir'}, uz:{download:'PDF-ni yuklab olish',original:'Asl PDF-ni yuklab olish'},
  kk:{download:'PDF жүктеп алу',original:'Түпнұсқа PDF жүктеп алу'}, zh:{download:'下载 PDF',original:'下载原始 PDF'},
  ja:{download:'PDFをダウンロード',original:'元のPDFをダウンロード'}, ko:{download:'PDF 다운로드',original:'원본 PDF 다운로드'},
}

export const REVIEWED_READER_PDF_DOWNLOADS_ALL_UI: Readonly<Record<string, Readonly<Record<string, string>>>> = Object.fromEntries(
  Object.entries(labels).map(([code, value]) => [code, { 'تحميل PDF': value.download, 'تحميل PDF الأصلي': value.original }]),
)
