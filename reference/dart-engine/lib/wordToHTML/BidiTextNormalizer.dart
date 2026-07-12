class BidiTextNormalizer {
  static const Map<String, String> _alwaysMirroredPairs = {};

  static const Map<String, String> _neutralInheritedRunPairs = {
    '(': ')',
    ')': '(',
    '[': ']',
    ']': '[',
    '{': '}',
    '}': '{',
    '<': '>',
    '>': '<',
    '«': '»',
    '»': '«',
    '‹': '›',
    '›': '‹',
  };

  static final RegExp _strongLtrRegex = RegExp(r'[A-Za-z]');
  static final RegExp _strongRtlRegex = RegExp(
    r'[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]',
  );
  static final RegExp _neutralMirroringCandidateRegex = RegExp(
    r'^[\s0-9\u0660-\u0669\(\)\[\]\{\}<>«»‹›]+$',
  );

  static String normalizeForDisplay(
    String text, {
    required bool effectiveRtl,
    required bool hasExplicitRunDirection,
  }) {
    if (!effectiveRtl || text.isEmpty) {
      return text;
    }

    final mirroredPairs = hasExplicitRunDirection
        ? _alwaysMirroredPairs
        : {
            ..._alwaysMirroredPairs,
            ..._neutralInheritedRunPairs,
          };

    // Word does not treat all punctuation runs equally. Neutral runs that only
    // inherit paragraph RTL often need visual mirroring, while runs that carry
    // an explicit direction must remain logical and rely on the BiDi engine.
    if (!_isNeutralMirroringCandidate(text, mirroredPairs)) {
      return text;
    }

    final buffer = StringBuffer();
    for (final rune in text.runes) {
      final char = String.fromCharCode(rune);
      buffer.write(mirroredPairs[char] ?? char);
    }
    return buffer.toString();
  }

  static bool _isNeutralMirroringCandidate(
    String text,
    Map<String, String> mirroredPairs,
  ) {
    if (!_neutralMirroringCandidateRegex.hasMatch(text)) {
      return false;
    }

    if (_strongLtrRegex.hasMatch(text) || _strongRtlRegex.hasMatch(text)) {
      return false;
    }

    return text.runes.any(
      (rune) => mirroredPairs.containsKey(String.fromCharCode(rune)),
    );
  }
}
