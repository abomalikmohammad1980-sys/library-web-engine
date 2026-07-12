

import 'dart:typed_data';

import 'package:archive/archive.dart';

import '../Utils/assetsToBase64.dart';

// Map<String,String> docImages = {};
Map<String,Uint8List> _docImages2 = {};
Future<Map<String,Uint8List>> extractImagesFromDocx(Map<String, ArchiveFile> archiveMap) async {
 // docImages = {};
  _docImages2 = {};
  // فك ضغط الأرشيف باستخدام حزمة `archive`

  // التنقل عبر جميع الملفات في الأرشيف
  for (final file in archiveMap.values) {
    // توحيد الفواصل
    String normalizedName = file.name.replaceAll("\\", "/");
    
    // التحقق إذا كان الملف صورة داخل مجلد `word/media/`
    if (file.isFile && normalizedName.startsWith('word/media/')) {
      // قراءة بيانات الصورة كـ Uint8List
      Uint8List imageData = file.content as Uint8List;
      String name = normalizedName.replaceAll("word/", "");
      
      // print("Found image: $name (size: ${imageData.length})");

      // تحويل الصورة إلى Base64
      String base64Image = convertImageToBase64(imageData);

      // إضافة سلسلة Base64 إلى القائمة
      // docImages[name]=base64Image;
      _docImages2[name]=imageData;
    }
  }

  return _docImages2;
}
// String getImageByName(String imgName){
//   return docImages[imgName]??"";
// }
