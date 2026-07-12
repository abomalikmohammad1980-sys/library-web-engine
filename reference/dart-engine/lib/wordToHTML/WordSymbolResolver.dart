class ResolvedWordSymbol {
  final String text;
  final String? fontFamily;

  const ResolvedWordSymbol({
    required this.text,
    required this.fontFamily,
  });
}

const Map<String, String> _wordSymbolFontAliases = {
  // Flutter uses pubspec family aliases for bundled fonts, not the raw Word
  // face names. The modern bundled AGA font exposes these honorific glyphs in
  // the Unicode private-use area and is registered in the app as "aga".
  'aga arabesque': 'aga',
  'aga-arabesque': 'aga',
  'aga_old': 'aga',
};

const Set<String> _privateUseAreaSymbolFonts = {
  // Legacy AGA Arabesque encodes symbols at 0x20-0xFF, while the bundled OTF
  // exposes the same glyphs at U+F020-U+F0FF. Word may still write values like
  // 0065 in w:sym, so we remap them into the font's Unicode private-use range.
  'aga arabesque',
  'aga-arabesque',
};

ResolvedWordSymbol? resolveWordSymbol({
  required String? fontName,
  required String? charHex,
}) {
  if (charHex == null || charHex.isEmpty) {
    return null;
  }

  final rawCodePoint = int.tryParse(charHex, radix: 16);
  if (rawCodePoint == null) {
    return null;
  }

  final resolvedFontFamily = _resolveWordSymbolFontFamily(fontName);
  final resolvedCodePoint = _resolveWordSymbolCodePoint(
    rawCodePoint: rawCodePoint,
    normalizedFontName: fontName?.trim().toLowerCase(),
    resolvedFontFamily: resolvedFontFamily,
  );

  return ResolvedWordSymbol(
    text: String.fromCharCode(resolvedCodePoint),
    fontFamily: resolvedFontFamily,
  );
}

ResolvedWordSymbol? resolveCachedWordSymbol({
  required String? fontName,
  required String? text,
}) {
  if (text == null || text.runes.length != 1) {
    return null;
  }

  final rawCodePoint = text.runes.first;
  final resolvedFontFamily = _resolveWordSymbolFontFamily(fontName);
  final resolvedCodePoint = _resolveWordSymbolCodePoint(
    rawCodePoint: rawCodePoint,
    normalizedFontName: fontName?.trim().toLowerCase(),
    resolvedFontFamily: resolvedFontFamily,
  );

  if (resolvedCodePoint == rawCodePoint &&
      resolvedFontFamily == (fontName?.trim())) {
    return null;
  }

  return ResolvedWordSymbol(
    text: String.fromCharCode(resolvedCodePoint),
    fontFamily: resolvedFontFamily,
  );
}

String? _resolveWordSymbolFontFamily(String? fontName) {
  if (fontName == null || fontName.trim().isEmpty) {
    return fontName;
  }

  final normalized = fontName.trim().toLowerCase();
  return _wordSymbolFontAliases[normalized] ?? fontName.trim();
}

int _resolveWordSymbolCodePoint({
  required int rawCodePoint,
  required String? normalizedFontName,
  required String? resolvedFontFamily,
}) {
  if (resolvedFontFamily == 'aga') {
    return rawCodePoint >= 0xF000 ? rawCodePoint : 0xF000 + rawCodePoint;
  }

  if (rawCodePoint >= 0xF000) {
    return rawCodePoint;
  }

  if (normalizedFontName != null &&
      _privateUseAreaSymbolFonts.contains(normalizedFontName)) {
    return 0xF000 + rawCodePoint;
  }

  return rawCodePoint;
}
