import 'dart:math';

import 'package:golden_shamela/wordToHTML/Paragraph.dart';
import 'package:xml/xml.dart';

String extractTextFromXmlElement(XmlElement element, {String? seperator}) {
  // البحث عن جميع عناصر <w:t> داخل العنصر
  final texts = element
      .findAllElements('w:t')
      .map((t) => t.text.trim()) // الحصول على النص داخل العنصر <w:t>
      .where((text) => text.isNotEmpty) // تجاهل النصوص الفارغة
      .toList()
      .join(seperator ?? ' '); // دمج النصوص بفاصل مسافة

  return texts;
}


