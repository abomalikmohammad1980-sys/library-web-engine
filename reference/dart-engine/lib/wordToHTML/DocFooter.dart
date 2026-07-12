import 'package:archive/archive.dart';
import 'package:golden_shamela/wordToHTML/Paragraph.dart';
import 'package:golden_shamela/Models/WordDocument.dart';
import 'package:golden_shamela/wordToHTML/runT.dart';
import 'package:xml/xml.dart';

import '../Utils/ArchiveToXml.dart';
import '../core/app_state.dart';
import 'DocRelations.dart';
import 'FooterParagraph.dart';

XmlElement? getSectPrFooter(XmlElement sectPrElement,WordDocument? wordDocument) {
  String? rId =
      sectPrElement.getElement("w:footerReference")?.getAttribute("r:id");
  if (rId == null || wordDocument?.relIdList[rId] == null) return null;
      String footerPath = "word/${wordDocument?.relIdList[rId]?.Target}";
      ArchiveFile? archiveFile = AppState().docArchive.toMap()[footerPath];
      if (archiveFile == null) return null;
      if (!archiveFile.name.endsWith(".xml")) return null; // Add this check
      XmlDocument document = ArchiveToXml(archiveFile);
      XmlElement footer = document.getElement("w:ftr")!;
      return footer;}

XmlElement? getSectPrHeader(XmlElement sectPrElement,WordDocument? wordDoument, {String? type}) {
  if (type == null) type = "default";
  Map<String,XmlElement> headersMap = {};
  sectPrElement.findAllElements("w:headerReference").forEach((headerReference){
    headersMap[headerReference.getAttribute("w:type")!]=headerReference;
  });
  if (headersMap[type]==null) return null;
  String? rId =
      headersMap[type]?.getAttribute("r:id");
  if (rId == null || wordDoument?.relIdList[rId] == null) return null;
  String footerPath = "word/${wordDoument?.relIdList[rId]?.Target}";
  ArchiveFile? archiveFile = AppState().docArchive.toMap()[footerPath];
  if (archiveFile == null) return null;
  if (!archiveFile.name.endsWith(".xml")) return null; // Add this check
  XmlDocument document = ArchiveToXml(archiveFile);
  XmlElement headerXml = document.getElement("w:hdr")!;
  if(headerXml.text.isEmpty) return null;
  return headerXml;
}
