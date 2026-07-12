
import 'package:xml/xml.dart';

import '../wordToHTML/Paragraph.dart';
import '../wordToHTML/runT.dart';
import 'TxtUtils.dart';

String? firstPartOfParagraph(String pc, XmlElement element) {
  List<String> pcPs = pc.split(RegExp(r'[\n\r\u000B\u000C]+'));
  pcPs.removeWhere((txt) => txt.isEmpty);
  if (pcPs.length == 0) return null;

  if (removeDiacriticsAndSpaces(element.text).contains(removeDiacriticsAndSpaces(pcPs.last)) &&
      pcPs.last.isNotEmpty) {
    //print("this paragrph contains last line of page"+pcPs.last);
    return pcPs.last;
  }
  return null;
}

String? secondPartOfParagraph(String pc, XmlElement element) {
  List<String> pcPs = pc.split(RegExp(r'[\n\r\u000B\u000C]+'));
  pcPs.removeWhere((txt) => txt.isEmpty);
  if (pcPs.length == 0) return null;
  if (removeDiacriticsAndSpaces(element.text).contains(removeDiacriticsAndSpaces(pcPs.first)) &&
      pcPs.first.isNotEmpty) {
    // print("this paragrph contains last first of page"+ pcPs.last);
    return pcPs.first;
  }

  return null;
}

// Paragraph getSecondParagraphPart(String pc, XmlElement element) {
//   String pageStartTxt = secondPartOfParagraph(pc, element) ?? "";
//   Paragraph paragraph = Paragraph().fromXml(element);
//   String joinedText = "";
//   List<runT> newRuns = [];
//   for (runT run in paragraph.runs.reversed) {
//     joinedText = (run.text ?? "") + joinedText;
//     if (removeDiacriticsAndSpaces(pageStartTxt).contains(removeDiacriticsAndSpaces(joinedText))) {
//       newRuns.add(run);
//     } else {
//       break;
//     }
//   }
//   paragraph.runs = newRuns.reversed.toList();
//   return paragraph;
// }

void removeUnwantedGraphTxt(String pc, XmlElement element) {
  String pagePart = firstPartOfParagraph(pc, element)!;
  List<XmlElement> lastOfPageElements =
  getLastOfPageElements(pagePart, element);
  removeUnwantedTxtParts(lastOfPageElements, element);
}


void removeUnwantedTxtParts(
    List<XmlElement> lastOfPageElements, XmlElement element) {
  for (XmlElement xmlElement in element.findAllElements("w:t")) {
    if (!lastOfPageElements.contains(xmlElement)) {
      xmlElement.innerText = "";
    }
  }
}


List<XmlElement> getLastOfPageElements(String pagePart, XmlElement element) {
  List<XmlElement> list = [];
  for (XmlElement xmlElement in element.findAllElements("w:t")) {
    String joinedText = list.map((e) => e.text).join("");

    if (removeDiacriticsAndSpaces(pagePart)
        .contains(removeDiacriticsAndSpaces(joinedText + xmlElement.text))) {
      list.add(xmlElement);
    } else {
      // print((xmlElement.text));
      // print((pagePart));
      // print(removeDiacriticsAndSpaces(xmlElement.text));
      // print(removeDiacriticsAndSpaces(pagePart));
      // print(removeDiacriticsAndSpaces(pagePart).contains(removeDiacriticsAndSpaces(xmlElement.text)));
      break;
    }
  }
  return list;
}