import 'package:archive/archive.dart';
import 'package:golden_shamela/wordToHTML/PPr.dart';
import 'package:golden_shamela/wordToHTML/Paragraph.dart';
import 'package:golden_shamela/wordToHTML/RPr.dart';
import 'package:golden_shamela/Models/WordDocument.dart';
import 'package:golden_shamela/Models/WordPage.dart';
import 'package:golden_shamela/wordToHTML/runT.dart';
import 'package:xml/xml.dart';

import '../Utils/ArchiveToXml.dart';

void addDefaults(ArchiveFile? archiveFile, WordDocument wordDocument) {
  if (archiveFile == null) return;
  XmlDocument document = ArchiveToXml(archiveFile);
  XmlElement? docDefaults =
      document.getElement("w:styles")?.getElement("w:docDefaults");
  if (docDefaults == null) return;

  wordDocument.defaultPPr = PPr(Paragraph.empty())
    ..fromXml(docDefaults.getElement("w:pPrDefault")?.getElement("w:pPr"));
  wordDocument.defaultRPr = RPr(wordDocument.defaultPPr!.getEmptyRun())
    ..fromXml(docDefaults.getElement("w:rPrDefault")?.getElement("w:rPr"));
}

runT createEmpty(WordDocument wordDocument) {
  return runT(Paragraph(WordPage(wordDocument)), prPr: null, pPr: null);
}
