import 'package:archive/archive.dart';
import 'package:xml/xml.dart';

import '../Utils/ArchiveToXml.dart';
import '../Utils/WordUtils.dart';
import '../main.dart';
import 'SectPr.dart';
import '../Models/WordDocument.dart';
import '../Models/WordPage.dart';

Future<List<WordPage>> addWordPages(
  ArchiveFile archiveFile,
  WordDocument wordDocument, {
  Function(int current, int total)? onProgress,
}) async {
  XmlDocument document = ArchiveToXml(archiveFile);
  WordUtils wordUtils = WordUtils(wordDocument);
  XmlElement? body = wordUtils.getWordBody(document);

  wordDocument.sectpr = SectPr.fromDocument(document, wordDocument);
  // print(wordDocument.sectpr?.toString());
  return await wordUtils.addParagraphToDocument(body, onProgress: onProgress);
}
