import 'dart:convert';
import 'dart:io';

readJsonFile(String? filePath) async {
  if (filePath == null) return;
  try {
    final file = File(filePath);
    final gzFile = File(filePath + '.gz');

    // Case 1: File path explicitly points to a .gz file
    if (filePath.endsWith('.gz') && file.existsSync()) {
      final compressedBytes = await file.readAsBytes();
      final decodedBytes = GZipCodec().decode(compressedBytes);
      final jsonString = utf8.decode(decodedBytes);
      Map<String, dynamic> jsonData = jsonDecode(jsonString);
      return jsonData['pages'];
    }

    // Case 2: File path points to .json but a .gz version exists (implicit compression)
    if (gzFile.existsSync()) {
      final compressedBytes = await gzFile.readAsBytes();
      final decodedBytes = GZipCodec().decode(compressedBytes);
      final jsonString = utf8.decode(decodedBytes);
      Map<String, dynamic> jsonData = jsonDecode(jsonString);
      return jsonData['pages'];
    }
    // Fallback to normal JSON
    else if (file.existsSync()) {
      // قراءة محتويات الملف
      String contents = await file.readAsString();

      // تحويل المحتوى من JSON إلى خريطة (Map)
      Map<String, dynamic> jsonData = jsonDecode(contents);
      return jsonData['pages'];
    } else {
      print("File does not exist: $filePath (or .gz)");
    }
  } catch (e) {
    print("Error reading JSON file: $e");
  }
}
