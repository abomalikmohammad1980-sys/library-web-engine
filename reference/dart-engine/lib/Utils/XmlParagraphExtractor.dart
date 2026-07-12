import 'package:xml/xml.dart';
import 'package:golden_shamela/Utils/FldCharTocMarker.dart';

List<XmlElement> getAllXmlParagraphs(XmlElement? body) {
  if (body == null) return [];
  List<XmlElement> allPs = [];
  int k = 0;
  List<XmlElement> xmlElements = body.childElements.toList();
  List foundHeadings = [];
  // body.findAllElements("w:bookmarkStart").forEach((e){
  //   print("bookmarkStart: ${e.toXmlString()}");
  // });

  for (int i = 0; i < xmlElements.length; i++) {
    XmlElement element = xmlElements[i];

    // print("xmlElement $i \n ${element.toXmlString(pretty: true)}");

    bool isParagraph = element.name.local == "p";
    if (isParagraph) {
      if (element.findAllElements("w:bookmarkStart").isNotEmpty) {
        // print(element.toXmlString());
      }
      allPs.add(element);
    } else if (element.name.local == "tbl") {
      allPs.add(element);
    } else if (element.name.local == "sdt") {
      // sdt is فهرس
      // print("isSdt $k");
      // print("isSdt ${element.toXmlString(pretty: true)}");

      List<XmlElement> indexPs = getIndexParagrphXmls(element);
      allPs.addAll(indexPs);
    } else if (element.name.local == "sectPr") {
      // sectPr at body level is document's final section properties
      // This is the LAST section's sectPr and may contain footerReference
      // We MUST add it to allPs so it gets processed by addPsToPage
      // which calls wordDocument.addSectPr()
      allPs.add(element);
    } else {
      // print("addParagraphToPage: new Type:" + element.name.local);
      // print("addParagraphToPage: new Type:" + element.toXmlString(pretty: true));
    }
    // if(k>41&&k<45) {
    //   print("$k"+element.text);
    //   print("$k"+element.toXmlString());
    // }
    k++;
  }
  // body?.childElements.forEach((element) {
  //
  //
  // });
  // print("foundHeadings $foundHeadings");

  // Mark fldChar-based TOC paragraphs with isSdtRow (same as w:sdt-based TOCs)
  markFldCharTocParagraphs(allPs);

  return allPs;
}

List<XmlElement> getIndexParagrphXmls(XmlElement element) {
  List<XmlElement> ps = [];
  XmlElement? sdt = element.getElement("w:sdtContent");

  if (sdt != null) {
    sdt.lastElementChild?.setAttribute("isLastPageLine", "true");

    for (XmlElement element0 in sdt.childElements) {
      element0.setAttribute("isSdtRow", "True");
      ps.add(element0);
    }
  }
  return ps;
}
