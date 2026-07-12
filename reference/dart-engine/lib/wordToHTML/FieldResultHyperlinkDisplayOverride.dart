import 'package:flutter/material.dart';

import 'package:golden_shamela/wordToHTML/runT.dart';

class FieldResultHyperlinkDisplayOverride {
  const FieldResultHyperlinkDisplayOverride._();

  static const _hyperlinkStyleIds = {
    'hyperlink',
    'followedhyperlink',
  };

  static TextStyle apply({
    required runT run,
    required TextStyle runStyle,
    required TextStyle paragraphStyle,
  }) {
    if (!_shouldOverride(run)) return runStyle;

    return runStyle.copyWith(
      color: paragraphStyle.color,
      decoration: paragraphStyle.decoration,
      decorationColor: paragraphStyle.decorationColor,
      decorationStyle: paragraphStyle.decorationStyle,
      decorationThickness: paragraphStyle.decorationThickness,
    );
  }

  static bool _shouldOverride(runT run) {
    final paragraph = run.parent;
    if (!paragraph.suppressHyperlinkStyleInheritance) return false;

    final styleId = run.rpr?.rStyle?.toLowerCase();
    if (styleId == null || !_hyperlinkStyleIds.contains(styleId)) {
      return false;
    }

    return !_hasDirectColor(run) && !_hasDirectUnderline(run);
  }

  static bool _hasDirectColor(runT run) {
    final directRpr = run.xmlRun?.getElement('w:rPr');
    return directRpr?.getElement('w:color') != null;
  }

  static bool _hasDirectUnderline(runT run) {
    final directRpr = run.xmlRun?.getElement('w:rPr');
    return directRpr?.getElement('w:u') != null;
  }
}
