
import 'dart:typed_data';

import 'package:flutter/services.dart';

Future<String> addFontToHtml(
    String htmlContent, String fontAssetPath) async {
  try {
    final fontData = await rootBundle.load(fontAssetPath);
    if (fontData.lengthInBytes == 0) {
      throw Exception("Font data is empty");
    }
    final fontMime = getMimeType(fontAssetPath);
    final fontUri = getFontUri(fontData, fontMime).toString();
    final fontCss =
        '@font-face { font-family: customFont; src: url($fontUri); } * { font-family: customFont; }';
    return '<style>$fontCss</style>$htmlContent';
  } catch (e) {
    print('Error loading font: $e');
    return htmlContent; // Return original HTML if error occurs
  }
}
String getFontUri(ByteData data, String mime) {
  final buffer = data.buffer;
  return Uri.dataFromBytes(
      buffer.asUint8List(data.offsetInBytes, data.lengthInBytes),
      mimeType: mime)
      .toString();
}
String getMimeType(String filePath) {
  final extension = filePath.split('.').last.toLowerCase();

  switch (extension) {
    case 'ttf':
      return 'font/ttf';
    case 'otf':
      return 'font/otf';
    case 'woff':
      return 'font/woff';
    case 'woff2':
      return 'font/woff2';
    case 'eot':
      return 'application/vnd.ms-fontobject';
    case 'svg':
      return 'image/svg+xml';
  // يمكنك إضافة المزيد من الامتدادات حسب الحاجة
    default:
      return 'application/octet-stream'; // نوع MIME افتراضي
  }
}
