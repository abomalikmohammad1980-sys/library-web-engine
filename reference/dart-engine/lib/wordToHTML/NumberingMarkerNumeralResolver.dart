import 'package:golden_shamela/Utils/TxtUtils.dart';
import 'package:golden_shamela/wordToHTML/GlyphEncodedDigitFonts.dart';

/// Numbering markers are generated in the paragraph-numbering pipeline, not
/// through normal runs. Because of that, they do not automatically pass through
/// `runT.checkDiacritics()`, which is where regular text respects the
/// Arabic/English numeral toggle.
///
/// This helper keeps that decision isolated and conservative:
/// - If the document is configured to use Arabic numerals, convert only the
///   Western digits inside the generated marker text.
/// - If the marker relies on a glyph-encoded font, preserve Western digits to
///   avoid breaking symbol fonts that map digits to special glyphs.
String resolveNumberingMarkerNumerals({
  required String displayNumber,
  required bool useArabicNumerals,
  required Iterable<String?> fontCandidates,
}) {
  if (!useArabicNumerals) {
    return displayNumber;
  }

  for (final fontFamily in fontCandidates) {
    if (shouldPreserveWesternDigitsForFontFamily(fontFamily)) {
      return displayNumber;
    }
  }

  return toArabicNumbers(displayNumber);
}
