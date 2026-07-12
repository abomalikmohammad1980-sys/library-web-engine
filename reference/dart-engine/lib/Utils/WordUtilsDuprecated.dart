// import 'dart:convert';
//
// import 'package:golden_shamela/Utils/XmlElementClone.dart';
// import 'package:golden_shamela/main.dart';
// import 'package:golden_shamela/wordToHTML/FootNote.dart';
// import 'package:golden_shamela/wordToHTML/Paragraph.dart';
// import 'package:golden_shamela/wordToHTML/WordPage.dart';
// import 'package:golden_shamela/wordToHTML/runT.dart';
// import 'package:xml/xml.dart';
//
// import 'TxtUtils.dart';
// import 'XmlGraphSplitter.dart';
// import 'XmlParagraphExtractor.dart';
//
// class WordUtilsDuprecated {
//   XmlElement? getWordBody(XmlDocument document) {
//     return document.getElement("w:document")?.getElement("w:body");
//   }
//
//
//   addParagraphToDocument(XmlElement? body) async {
//     wordDocument.pages.clear();
//     List<XmlElement> allPs = getAllXmlParagraphs(body);
//
//     for (int i = 0; i < 40; i++) {
//       WordPage wordPage =
//       await getPage(wordDocument.pageContents[i], allPs, j: i);
//       wordDocument.pages.add(wordPage);
//       // if(i==3)
//       //   break;
//     }
//   }
//
//   getPage(String pc, List<XmlElement> allPs, {int? j}) async {
//     List<XmlElement> pagePs = getPageXmlPs(pc, allPs);
//     WordPage wordPage = WordPage();
//     addPsToPage(wordPage, pagePs, pc);
//     addFnToPage(wordPage);
//     print(j);
//     await Future.delayed(Duration(milliseconds: 200), () {});
//     return wordPage;
//   }
//
//   void addFnToPage(WordPage wordPage) {
//     int i = 1;
//     for (Paragraph p in wordPage.ps) {
//       for (runT run in p.runs) {
//         if (run.footNoteId != null) {
//           FootNote footNote = wordDocument.docFootNotes[run.footNoteId]!;
//           footNote.updateDisplayNumber(i.toString());
//           run.fnDisplayNum = i.toString();
//           run.updateFnDisplayNumber();
//           wordPage.fns.add(footNote);
//           i++;
//         }
//       }
//     }
//   }
//
//   addPsToPage(WordPage wordPage, List<XmlElement> pagePs, String pc) {
//     for (XmlElement element in pagePs) {
//       // if(element.text.contains("وعدها"))
//       // print("pageBr:"+element.findAllElements("w:lastRenderedPageBreak").length.toString());
//
//       if (element.name.local == "p") {
//         if (element.getAttribute(DUPLICATED) == DUPLICATED)
//           wordPage.ps.add(getSecondParagraphPart(pc, element));
//         else
//           wordPage.addParagraph(element);
//       } else if (element.name.local == "tbl")
//         addTableToPage(wordPage, element);
//     }
//   }
//
//
//   List<XmlElement> getPageXmlPs(String pc, List<XmlElement> allPs) {
//     XmlElement? element2;
//     int i = 0;
//     List<XmlElement> pagePs = [];
//     for (XmlElement element in allPs) {
//       if (isFromPage(pc, element) ||
//           secondPartOfParagraph(pc, element) != null) {
//         pagePs.add(element);
//         i++;
//         if (isLastPageLine(element)) break;
//       } else if (firstPartOfParagraph(pc, element) != null) {
//         element2 = element.clone(setDublicated: true);
//         removeUnwantedGraphTxt(pc, element);
//
//         pagePs.add(element);
//         i++;
//         if (isLastPageLine(element)) break;
//       } else {
//         break;
//       }
//     }
//     updateAllPs(allPs, i, element2);
//
//     return pagePs;
//   }
//
//   bool hasBr(XmlElement element) {
//     int brL = element
//         .findAllElements("w:lastRenderedPageBreak")
//         .length;
//     return brL > 0;
//   }
//
//   void updateAllPs(List<XmlElement> allPs, int i, XmlElement? element2) {
//     allPs.removeRange(0, i);
//     if (element2 != null) {
//       allPs.insert(0, element2);
//     }
//   }
//
//
//   bool isLastPageLine(XmlElement element) {
//     return element.getAttribute("isLastPageLine") == "true";
//   }
//
//   void addTableToPage(WordPage wordPage, XmlElement element) {
//     element.text.split("\n").forEach((rowTxt) {
//       Paragraph paragraph = Paragraph();
//       runT r = runT(prPr: null, pPr: null);
//       paragraph.text = rowTxt;
//       rowTxt =
//       '''<pre><p style="text-align: right;direction: rtl; ">$rowTxt</p></pre>''';
//       r.text = rowTxt;
//       paragraph.runs.add(r);
//       //  print(paragraph.toHTML());
//       wordPage.ps.add(paragraph);
//     });
//   }
//
//   bool isFromPage(String pc, XmlElement element) {
//     bool contains = removeDiacriticsAndSpaces(pc)
//         .contains(removeDiacriticsAndSpaces(element.text));
//     if (contains) return true;
//
//     return false;
//   }
//
//
//
//   XmlElement? getFontScheme(XmlDocument document) {
//     return document
//         .getElement("a:theme")
//         ?.getElement("a:themeElements")
//         ?.getElement("a:fontScheme");
//   }
//
//   String? getMajorFont(XmlElement? fontScheme) {
//     return fontScheme
//         ?.getElement("a:majorFont")
//         ?.getElement("a:latin")
//         ?.getAttribute("typeface");
//   }
//
//   String? getMinorFont(XmlElement? fontScheme) {
//     return fontScheme
//         ?.getElement("a:minorFont")
//         ?.getElement("a:latin")
//         ?.getAttribute("typeface");
//   }
// }
//
//
