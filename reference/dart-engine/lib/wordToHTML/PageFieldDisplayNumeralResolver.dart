import 'package:golden_shamela/Utils/TxtUtils.dart';
import 'package:golden_shamela/wordToHTML/GlyphEncodedDigitFonts.dart';

/// Resolves how PAGE field results should be displayed when a text box is
/// rendered through a plain Text fallback instead of the full run pipeline.
///
/// Important: this operates only on the already-resolved PAGE field result
/// string (for example "21"). It must never be used on raw XML field codes,
/// symbol hex values like F072, or any glyph-encoded source data.
String resolvePageFieldDisplayNumerals({
  required String pageNumber,
  required bool useArabicNumerals,
  String? fontFamily,
}) {
  if (!useArabicNumerals) {
    return pageNumber;
  }

  if (shouldPreserveWesternDigitsForFontFamily(fontFamily)) {
    return pageNumber;
  }

  return toArabicNumbers(pageNumber);
}
