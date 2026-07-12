
import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/services.dart' show rootBundle;

Future<String> imageToBase64(String imagePath) async {
  try {
    // تحميل الصورة من المسار المحدد (مجلد الأصول)
    final ByteData bytes = await rootBundle.load(imagePath);

    // تحويل بيانات الصورة إلى Uint8List
    final Uint8List buffer = bytes.buffer.asUint8List();

    // تحويل البيانات إلى سلسلة Base64
    String base64Image = base64Encode(buffer);

    // إرجاع سلسلة Base64
    return base64Image;
  } catch (e) {
    // معالجة الخطأ وإرجاع رسالة عند الفشل
    print('Error loading image: $e');
    return '';
  }
}
String convertImageToBase64(Uint8List imageBytes) {
  return base64Encode(imageBytes);
}