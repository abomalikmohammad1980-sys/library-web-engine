import 'package:flutter/painting.dart';
import 'package:golden_shamela/wordToHTML/PPr.dart';
import 'package:golden_shamela/wordToHTML/RPr.dart';
import 'package:golden_shamela/wordToHTML/SectPr.dart';
import 'package:golden_shamela/wordToHTML/runT.dart';

class ParagraphStrutConfig {
  final double lineHeight;
  final TextStyle paragraphTextStyle;
  final TextStyle strutBaseStyle;
  final double strutFontSize;
  final double? strutLeading;
  final bool forceStrutHeight;

  const ParagraphStrutConfig({
    required this.lineHeight,
    required this.paragraphTextStyle,
    required this.strutBaseStyle,
    required this.strutFontSize,
    required this.strutLeading,
    required this.forceStrutHeight,
  });
}

class ParagraphStrutResolver {
  static const String _fallbackSampleText = 'العربية Ay 123';

  static ParagraphStrutConfig resolve({
    required PPr? pPr,
    required RPr? prPr,
    required List<runT> textRuns,
    required bool isTableCellParagraph,
    required bool adjustLineHeightInTable,
    required SectPr sectPr,
  }) {
    final paragraphTextStyle =
        prPr?.getTextStyle() ??
        const TextStyle(fontSize: 14, fontFamily: 'Traditional Arabic');

    final strutBaseStyle = _resolveTallestRunStyle(
      textRuns: textRuns,
      fallback: paragraphTextStyle,
    );
    final strutFontSize = strutBaseStyle.fontSize ?? 14.0;
    final usesMeasuredSingleLineMetrics = _usesMeasuredSingleLineMetrics(pPr);

    double effectiveLineHeight = pPr?.lineHeight ?? 1.15;
    if (usesMeasuredSingleLineMetrics) {
      final measuredSingleLineMultiplier = _measureSingleLineMultiplier(
        style: strutBaseStyle,
        sampleText: _buildSampleText(textRuns),
      );
      final lineMultiple = pPr?.lineMultiple ?? _deriveLineMultiple(pPr);
      if (measuredSingleLineMultiplier != null &&
          measuredSingleLineMultiplier > 0) {
        effectiveLineHeight = lineMultiple * measuredSingleLineMultiplier;
      }
    }

    final paragraphDisablesLineGrid = _paragraphDisablesLineGrid(pPr);
    final applyDocumentGridLinePitch =
        !paragraphDisablesLineGrid &&
        strutFontSize > 0 &&
        (!isTableCellParagraph || adjustLineHeightInTable);
    if (applyDocumentGridLinePitch) {
      final docGridLinePitchPx = sectPr.docGridLinePitchPx;
      if (docGridLinePitchPx != null && docGridLinePitchPx > 0) {
        final docGridHeight = docGridLinePitchPx / strutFontSize;
        if (docGridHeight > effectiveLineHeight) {
          effectiveLineHeight = docGridHeight;
        }
      }
    }

    final hasInlineImages = textRuns.any((run) => run.image != null);
    final forceStrutHeight = !hasInlineImages &&
        !usesMeasuredSingleLineMetrics &&
        (pPr?.forceStrutHeight ?? true);

    return ParagraphStrutConfig(
      lineHeight: effectiveLineHeight,
      paragraphTextStyle: paragraphTextStyle,
      strutBaseStyle: strutBaseStyle,
      strutFontSize: strutFontSize,
      // Measured line metrics already include the font's own leading.
      // Leaving StrutStyle.leading as the default would reapply that leading.
      strutLeading: usesMeasuredSingleLineMetrics ? 0.0 : null,
      forceStrutHeight: forceStrutHeight,
    );
  }

  static TextStyle _resolveTallestRunStyle({
    required List<runT> textRuns,
    required TextStyle fallback,
  }) {
    final visibleTextRuns = textRuns.where((run) {
      if (run.rpr?.vanish == true) {
        return false;
      }
      if (run.image != null) {
        return false;
      }
      final text = (run.text ?? '').trim();
      return text.isNotEmpty;
    }).toList();

    if (visibleTextRuns.isEmpty) {
      return fallback;
    }

    TextStyle tallestStyle = visibleTextRuns.first.getEffectiveTextStyle();
    double maxFontSize = tallestStyle.fontSize ?? fallback.fontSize ?? 14.0;

    for (final run in visibleTextRuns) {
      final runStyle = run.getEffectiveTextStyle();
      final runFontSize = runStyle.fontSize ?? fallback.fontSize ?? 14.0;
      if (runFontSize > maxFontSize) {
        maxFontSize = runFontSize;
        tallestStyle = runStyle;
      }
    }

    return tallestStyle;
  }

  static bool _usesMeasuredSingleLineMetrics(PPr? pPr) {
    final source = pPr?.lineHeightSource;
    if (source == 'default' || source == 'auto') {
      return true;
    }

    if (source == null) {
      if (pPr?.forceStrutHeight == false) {
        return true;
      }

      final lineHeight = pPr?.lineHeight;
      if (lineHeight != null &&
          (lineHeight - PPr.kArabicLineSpacingFactor).abs() < 0.001) {
        return true;
      }
    }

    return false;
  }

  static bool _paragraphDisablesLineGrid(PPr? pPr) {
    final snapToGridVal =
        pPr?.xmlpPr?.getElement('w:snapToGrid')?.getAttribute('w:val');
    return snapToGridVal == '0' ||
        snapToGridVal == 'false' ||
        snapToGridVal == 'off';
  }

  static double? _measureSingleLineMultiplier({
    required TextStyle style,
    required String sampleText,
  }) {
    final fontSize = style.fontSize ?? 14.0;
    if (fontSize <= 0) {
      return null;
    }

    final painter = TextPainter(
      text: TextSpan(text: sampleText, style: style),
      textDirection: TextDirection.rtl,
      maxLines: 1,
    )..layout();

    final metrics = painter.computeLineMetrics();
    if (metrics.isEmpty) {
      return null;
    }

    final singleLineHeight = metrics.first.height;
    if (singleLineHeight <= 0) {
      return null;
    }

    return singleLineHeight / fontSize;
  }

  static double _deriveLineMultiple(PPr? pPr) {
    final lineHeight = pPr?.lineHeight;
    if (lineHeight == null || PPr.kArabicLineSpacingFactor == 0) {
      return 1.0;
    }

    final derived = lineHeight / PPr.kArabicLineSpacingFactor;
    if (derived <= 0) {
      return 1.0;
    }

    return derived;
  }

  static String _buildSampleText(List<runT> textRuns) {
    final buffer = StringBuffer();
    for (final run in textRuns) {
      if (run.rpr?.vanish == true) {
        continue;
      }
      final text = (run.text ?? '').replaceAll('\n', ' ').trim();
      if (text.isEmpty) {
        continue;
      }

      if (buffer.isNotEmpty) {
        buffer.write(' ');
      }
      buffer.write(text);

      if (buffer.length >= 48) {
        break;
      }
    }

    final sample = buffer.toString().trim();
    return sample.isNotEmpty ? sample : _fallbackSampleText;
  }
}
