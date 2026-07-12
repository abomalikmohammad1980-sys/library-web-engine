const Set<String> glyphEncodedDigitFonts = {
  'QCF_BSML',
};

bool shouldPreserveWesternDigitsForFontFamily(String? fontFamily) {
  if (fontFamily == null) return false;
  return glyphEncodedDigitFonts.contains(fontFamily.trim().toUpperCase());
}
