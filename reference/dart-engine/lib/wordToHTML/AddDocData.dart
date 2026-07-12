import 'package:archive/archive.dart';
import 'package:golden_shamela/Utils/ArchiveToXml.dart';
import 'package:golden_shamela/Models/WordDocument.dart';
import 'package:golden_shamela/Models/WordPage.dart'; // Import WordPage

import '../Utils/TxtUtils.dart';
import 'DocFonts.dart';
import 'DocumentSettingsParser.dart';
import 'DocFootNotes.dart';
import 'DocNumbering.dart';
import 'DocPages.dart';
import 'DocRelations.dart';
import 'DocTheme.dart';
import 'DocumentDefaults.dart';
import 'DocumentStyles.dart';
import 'ExtractWordImages.dart';
import 'ReferencedRunFontsCollector.dart';

Future<List<WordPage>> AddDocData(
  Archive archive,
  WordDocument wordDocument, {
  Function(int current, int total)? onProgress,
}) async {
  // print("AddDocData: Starting...");
  Map<String, ArchiveFile> archiveMap = archive.toMap();
  // print("AddDocData: Extracted archive map.");
  wordDocument.docImages = await extractImagesFromDocx(archiveMap);
  // print("AddDocData: Extracted images.");
  wordDocument.relIdList = addDocRelations(archiveMap);
  // print("AddDocData: Added relations.");
  final declaredFonts = addDocFonts(archiveMap[WORD_FONTS_TABLE]);
  final referencedFonts = collectReferencedRunFonts(archiveMap);
  wordDocument.fontsList = {
    ...declaredFonts,
    ...referencedFonts,
  }.toList();
  // print("AddDocData: Added fonts.");
  addDefaults(archiveMap[WORD_STYLES], wordDocument);
  // print("AddDocData: Added defaults.");
  addTheme1(archiveMap[WORD_THEME1], wordDocument);
  // print("AddDocData: Added theme.");
  List<Map?> numberingMap = addNumbering(archiveMap[WORD_NUMBERING], wordDocument: wordDocument);
  // print("AddDocData: Added numbering.");
  wordDocument.abstractNumMap = numberingMap[0]!.cast();
  wordDocument.numsMap = numberingMap[1]!.cast();
  // print("AddDocData: Populated abstractNumMap and numsMap.");
  wordDocument.documentStyles = addStyles(archiveMap[WORD_STYLES]);
  // print("AddDocData: Added styles.");
  wordDocument.docFootNotes = addFootNotes(
    archiveMap[WORD_FOOTNOTES],
    wordDocument,
  );
  // print("AddDocData: Added footnotes.");

  final settingsSnapshot = DocumentSettingsParser.parse(
    archiveMap["word/settings.xml"],
  );
  wordDocument.evenAndOddHeaders = settingsSnapshot.evenAndOddHeaders;
  wordDocument.adjustLineHeightInTable =
      settingsSnapshot.adjustLineHeightInTable;

  List<WordPage> pages = await addWordPages(
    archiveMap[WORD_DOCUMENT]!,
    wordDocument,
    onProgress: onProgress,
  );
  // print("AddDocData: Added word pages.");

  // Fix: Recalculate firstRange and lastRange for all sectPr elements
  // Each section's lastRange is the page where its sectPr was found (already set correctly)
  // Each section's firstRange should be (previous section's lastRange + 1), except first section starts at 0
  int totalPages = pages.length;
  int numSections = wordDocument.sectPrList.length;

  if (numSections > 0) {
    // print("DEBUG: Recalculating section ranges. Total pages: $totalPages, Sections: $numSections");

    // Print current state before fix
    // for (int i = 0; i < numSections; i++) {
    //   var sect = wordDocument.sectPrList[i];
    //   print("DEBUG: Before fix - Section $i: firstRange=${sect.firstRange}, lastRange=${sect.lastRange}");
    // }

    // Recalculate ranges properly
    // lastRange was set to the page number where sectPr was found (0-indexed)
    // firstRange should be calculated as: previous section's lastRange + 1
    for (int i = 0; i < numSections; i++) {
      var sect = wordDocument.sectPrList[i];

      if (i == 0) {
        // First section always starts at page 0
        sect.firstRange = 0;
      } else {
        // This section starts after the previous section ends
        var prevSect = wordDocument.sectPrList[i - 1];
        sect.firstRange = prevSect.lastRange + 1;
      }

      // If this is the last section, extend lastRange to cover all remaining pages
      if (i == numSections - 1) {
        sect.lastRange = totalPages - 1;
      }
      // Otherwise, lastRange is already correctly set to the page where sectPr was found

      // print("DEBUG: After fix - Section $i: firstRange=${sect.firstRange}, lastRange=${sect.lastRange}");
    }
  }

  // كشف لغة الكتاب تلقائياً وتعيين القيمة الافتراضية لـ useArabicNumerals
  // نأخذ عينة من نص أول 3 صفحات لتحديد اللغة السائدة
  if (pages.isNotEmpty) {
    String sampleText = pages
        .take(3)
        .expand((p) => p.ps)
        .take(20)
        .map((p) => p.text)
        .join(' ');
    wordDocument.useArabicNumerals = isArabicText(sampleText);
  }

  return pages;
}
