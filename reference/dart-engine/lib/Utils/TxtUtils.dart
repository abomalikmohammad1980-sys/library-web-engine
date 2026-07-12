import 'dart:io';

const SEPERATOR = "*#*#*#*#*";
Future<String> readTextFile(String filePath) async {
  try {
    final file = File(filePath);
    // Read the file
    String fileContents = await file.readAsString();
    return fileContents;
  } catch (e) {
    // Handle the error
    return 'Error reading file: $e';
  }
}

List<String> convertToPageContents(String fileContent) {
  fileContent = fileContent.replaceAll("", '\n').replaceAll("\u0007", "\n");
  return fileContent.split(SEPERATOR);
}

String removeDiacriticsAndSpaces(String input) {
  // إزالة الحركات باستخدام التعبير العادي
  String result = input.replaceAll(
    RegExp(r'[^a-zA-Z0-9\u0621-\u064A0-9 ]'),
    '',
  );
  result = result.replaceAll("\n", "");
  result = result.replaceAll(" ", "");
  return result;
}

String removeDiacritics(String input) {
  // نطاق الحركات العربية:  064B إلى 0652
  return input.replaceAll(RegExp(r'[\u064B-\u0652]'), '');
}

String shortenTitle(String title, {int maxLength = 15, int? maxWords}) {
  if (maxWords != null) {
    final words = title.trim().split(RegExp(r'\s+'));
    if (words.length > maxWords) {
      return '${words.take(maxWords).join(' ')}...';
    }
    return title;
  }

  if (title.length <= maxLength) return title;

  int keepChars = (maxLength ~/ 2) - 2; // عدد الأحرف من البداية والنهاية
  return title.substring(0, keepChars) +
      " ... " +
      title.substring(title.length - keepChars);
}

String toArabicNumbers(String input) {
  const western = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const arabicIndic = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

  String result = input;
  for (int i = 0; i < western.length; i++) {
    result = result.replaceAll(western[i], arabicIndic[i]);
  }
  return result;
}

bool isArabicText(String text) {
  final arabicRegex = RegExp(r'[\u0600-\u06FF]');
  return arabicRegex.hasMatch(text);
}
