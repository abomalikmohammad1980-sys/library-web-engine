import 'package:archive/archive.dart';
import 'package:golden_shamela/main.dart';
import 'package:golden_shamela/wordToHTML/Paragraph.dart';
import 'package:xml/xml.dart';

import '../Utils/ArchiveToXml.dart';

const WORD_FONTS_TABLE = "word/fontTable.xml";
List<String> addDocFonts(ArchiveFile? archiveFile) {
  if (archiveFile == null) return [];
  // تحويل ArchiveFile إلى XmlDocument
  XmlDocument document = ArchiveToXml(archiveFile);
  // print("document.toXmlString(pretty: true)");
  int i = 0;
  List<String> fonts = [];
  document.getElement("w:fonts")?.childElements.forEach((e) {
    String? fontName = e.getAttribute("w:name");
    // if(!isIgnored(fontName)) {
    fonts.add(fontName!);
    // }
  });
  return fonts;
}

List<String> ignoreList = [
  "Courier New",
  "Wingdings",
  "Symbol",
  "Cambria",
  "Arial",
  "Tahoma",
  "Fabian",
  "بدر مفتاح خليفة",
];
bool isIgnored(String? fontName) {
  if (fontName == null) return true;
  if (ignoreList.contains(fontName)) return true;
  if (fontName.contains("HFS_P")) return true;
  return false;
}
