import 'dart:io';
import 'package:archive/archive.dart';
import 'package:golden_shamela/wordToHTML/FootNote.dart';
import 'package:golden_shamela/wordToHTML/Paragraph.dart';
import 'package:golden_shamela/Models/WordDocument.dart';
import 'package:golden_shamela/Models/WordPage.dart';
import 'package:xml/xml.dart';

import '../Utils/ArchiveToXml.dart';

const WORD_FOOTNOTES = "word/footnotes.xml";

Map<String, FootNote> addFootNotes(
  ArchiveFile? archiveFile,
  WordDocument wordDocument,
) {
  if (archiveFile == null) return {};
  // تحويل ArchiveFile إلى XmlDocument
  Map<String, FootNote> docFootNotes = {};

  XmlDocument document = ArchiveToXml(archiveFile);

  // استعراض جميع العناصر داخل المستند
  document.getElement("w:footnotes")?.childElements.forEach((fn) {
    String id = fn.getAttribute("w:id")!;
    WordPage wordPage = WordPage(wordDocument);

    // جمع **جميع** فقرات الحاشية وليس الأولى فقط
    List<Paragraph> paragraphs = [];
    // خريطة تقسيم الصفحات من bookmarks المحقونة
    Map<int, int> pageBreaks = {};

    int paraIndex = 0;
    for (var xmlPar in fn.findElements("w:p")) {
      // البحث عن TheLibraryFN_* bookmarks في هذه الفقرة
      for (var child in xmlPar.childElements) {
        if (child.name.local == "bookmarkStart") {
          String? bmName = child.getAttribute("w:name");
          if (bmName != null && bmName.startsWith("TheLibraryFN_")) {
            // TheLibraryFN_{index}_P{page} → استخراج رقم الصفحة
            int pageNum = _parsePageFromBookmark(bmName);
            if (pageNum > 0) {
              pageBreaks[pageNum] = paraIndex;
            }
          }
        }
      }

      Paragraph paragraph = Paragraph(wordPage).fromXml(xmlPar);
      paragraph.sectionType = 'footnote';
      paragraphs.add(paragraph);
      paraIndex++;
    }

    if (paragraphs.isNotEmpty) {
      FootNote footNote = FootNote(paragraphs, id);
      footNote.pageBreaks = pageBreaks;
      if (pageBreaks.length > 1) {
        print("📌 FN#$id has ${pageBreaks.length} page breaks: $pageBreaks");
      }
      docFootNotes[id] = footNote;
    }
  });

  // إحصائية debug
  int multiPageCount = docFootNotes.values
      .where((fn) => fn.pageBreaks.length > 1)
      .length;
  if (multiPageCount > 0) {
    print("📌 Total multi-page footnotes found: $multiPageCount");
  } else {
    print("📌 No multi-page footnote bookmarks found in XML");
  }

  return docFootNotes;
}

/// استخراج رقم الصفحة من اسم bookmark بصيغة TheLibraryFN_{index}_P{page}
int _parsePageFromBookmark(String bmName) {
  // TheLibraryFN_9_P7 → 7
  int pIdx = bmName.lastIndexOf('_P');
  if (pIdx == -1) return 0;
  return int.tryParse(bmName.substring(pIdx + 2)) ?? 0;
}

/// تفريغ ملف footnotes.xml الخام من الأرشيف لملف debug (للبحث عن علامات تقسيم)
void debugDumpFootnotesXml(ArchiveFile? archiveFile, {String? footNoteId}) {
  if (archiveFile == null) {
    print("DEBUG: No footnotes.xml file found in archive.");
    return;
  }

  try {
    XmlDocument document = ArchiveToXml(archiveFile);
    StringBuffer buffer = StringBuffer();
    buffer.writeln("=== FOOTNOTES.XML RAW DEBUG ===");
    buffer.writeln("Looking for: ${footNoteId ?? 'ALL'}");
    buffer.writeln("");

    if (footNoteId != null) {
      // طباعة حاشية واحدة فقط
      var footnotes = document.getElement("w:footnotes")?.childElements;
      if (footnotes != null) {
        for (var fn in footnotes) {
          if (fn.getAttribute("w:id") == footNoteId) {
            buffer.writeln("--- Footnote ID: $footNoteId ---");
            buffer.writeln(fn.toXmlString(pretty: true));
            buffer.writeln("");

            // البحث عن أي علامات تقسيم
            var breaks = fn.findAllElements("w:lastRenderedPageBreak");
            buffer.writeln("lastRenderedPageBreak count: ${breaks.length}");
            var contSep = fn.findAllElements("w:continuationSeparator");
            buffer.writeln("continuationSeparator count: ${contSep.length}");
            var brElements = fn.findAllElements("w:br");
            buffer.writeln("w:br count: ${brElements.length}");
            for (var br in brElements) {
              buffer.writeln("  br type: ${br.getAttribute('w:type')}");
            }
            break;
          }
        }
      }
    } else {
      // طباعة كل الحواشي
      buffer.writeln(document.toXmlString(pretty: true));
    }

    buffer.writeln("═══════════════════════════════════════");

    // حفظ في ملف
    final file = File(
      'd:/ImportantProjects/golden_shamela/footnotes_debug.xml',
    );
    file.writeAsStringSync(buffer.toString());
    print("DEBUG: Footnotes XML saved to ${file.path}");
  } catch (e) {
    print("DEBUG: Error dumping footnotes XML: $e");
  }
}
