import 'package:xml/xml.dart';

/// Marks fldChar-based TOC paragraphs with isSdtRow="True" and
/// isLastPageLine="true", same as w:sdt-based TOCs get in
/// XmlParagraphExtractor.getIndexParagrphXmls.
///
/// In Word XML, a TOC can be represented either as:
/// 1. w:sdt (structured document tag) — handled by getIndexParagrphXmls
/// 2. w:fldChar fields — a begin fldChar with instrText containing "TOC",
///    followed by paragraphs, ending with an end fldChar at the outermost level
///
/// This function handles case 2 by scanning all paragraphs for the TOC field
/// boundary and marking the contained paragraphs.
///
/// Nested fields (e.g. PAGEREF inside each TOC entry) are tracked via depth
/// counting so we only exit when the outermost TOC field ends.
void markFldCharTocParagraphs(List<XmlElement> allPs) {
  int fieldDepth = 0;
  bool insideTocField = false;

  for (int i = 0; i < allPs.length; i++) {
    final p = allPs[i];
    if (p.name.local != "p") continue;

    // Check if already marked (from w:sdt path) — skip if so
    if (p.getAttribute("isSdtRow") == "True") continue;

    final fldChars = p.findAllElements("w:fldChar");

    // Count field begins and ends in this paragraph
    int begins = 0;
    int ends = 0;
    for (var fc in fldChars) {
      final type = fc.getAttribute("w:fldCharType");
      if (type == "begin") begins++;
      if (type == "end") ends++;
    }

    if (!insideTocField) {
      // Look for TOC field begin
      if (begins > 0) {
        final instrTexts = p.findAllElements("w:instrText");
        bool hasTocInstr = instrTexts.any((it) => it.text.contains("TOC"));

        // Also check subsequent paragraphs for instrText (Word may split
        // the field begin and instrText across paragraphs)
        if (!hasTocInstr) {
          for (int j = i + 1; j < i + 3 && j < allPs.length; j++) {
            final aheadInstrTexts = allPs[j].findAllElements("w:instrText");
            if (aheadInstrTexts.any((it) => it.text.contains("TOC"))) {
              hasTocInstr = true;
              break;
            }
          }
        }

        if (hasTocInstr) {
          insideTocField = true;
          fieldDepth = begins - ends;
          p.setAttribute("isSdtRow", "True");

          // If depth dropped to 0, the TOC field ended in the same paragraph
          if (fieldDepth <= 0) {
            p.setAttribute("isLastPageLine", "true");
            insideTocField = false;
            fieldDepth = 0;
          }
          continue;
        }
      }
    }

    if (insideTocField) {
      fieldDepth += begins - ends;
      p.setAttribute("isSdtRow", "True");

      if (fieldDepth <= 0) {
        // Outermost TOC field has ended
        p.setAttribute("isLastPageLine", "true");
        insideTocField = false;
        fieldDepth = 0;
      }
    }
  }
}
