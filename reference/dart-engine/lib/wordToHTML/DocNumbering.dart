
import 'package:archive/archive.dart';
import 'package:xml/xml.dart';

import '../Models/WordDocument.dart';
import '../Utils/ArchiveToXml.dart';
import '../main.dart';
import 'Num.dart';
import 'abstractNum.dart';

List<Map> addNumbering(ArchiveFile? archiveFile, {WordDocument? wordDocument}) {
  if (archiveFile == null) return[{},{}];
  XmlDocument xmlDocument = ArchiveToXml(archiveFile);
  XmlElement numbering = xmlDocument.getElement("w:numbering")!;
  Map<int, AbstractNum> abstractNumMap = {};
  Map<int, Num> numsMap = {};

  numbering.childElements.forEach((item) {
    if (item.name.local == "abstractNum") {
      final abstractNum = AbstractNum.fromXml(item, wordDocument: wordDocument);
      abstractNumMap[abstractNum.abstractNumId] = abstractNum;
    } else if (item.name.local == "num") {
      Num num = Num.fromXml(item);
      numsMap[num.numId] = num;
    } else {
      // print("_addNumbering" + item.name.toXmlString(pretty: true));
      //print("_addNumbering" + item  .toXmlString(pretty: true));
    }
  });

  return [abstractNumMap,numsMap];
}
