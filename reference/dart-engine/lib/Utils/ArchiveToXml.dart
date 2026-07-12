
import 'dart:convert';
import 'dart:typed_data';

import 'package:archive/archive.dart';
import 'package:xml/xml.dart';

const WORD_DOCUMENT = "word/document.xml";
const WORD_THEME1 = "word/theme/theme1.xml";
const WORD_NUMBERING = "word/numbering.xml";

XmlDocument ArchiveToXml(ArchiveFile archiveFile) {
  // print("ArchiveToXml: archiveFile.name = ${archiveFile.name}");
  // print("ArchiveToXml: archiveFile.content.runtimeType = ${archiveFile.content.runtimeType}");
  // if (archiveFile.content is Uint8List) {
  //   print("ArchiveToXml: First 10 bytes of content: ${archiveFile.content.sublist(0, (archiveFile.content as Uint8List).length > 10 ? 10 : (archiveFile.content as Uint8List).length)}");
  // }
  String xmlContent = utf8.decode(archiveFile.content);
  return XmlDocument.parse(xmlContent);
}


extension ArchiveExts on Archive {
  Map<String, ArchiveFile> toMap() {
    Map<String, ArchiveFile> map = {};
    this.forEach((archiveFile) {
      map[archiveFile.name] = archiveFile;
    });
    return map;
  }
}