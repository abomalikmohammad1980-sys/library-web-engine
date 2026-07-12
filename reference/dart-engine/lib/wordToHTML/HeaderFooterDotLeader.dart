import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'package:golden_shamela/wordToHTML/runT.dart';

/// Represents a header/footer paragraph where a literal dot run acts as a
/// visual leader between the content pinned to the right edge and the content
/// pinned to the left edge of the text area.
///
/// This is intentionally scoped to header/footer paragraphs only. Regular body
/// paragraphs should keep their normal WordprocessingML layout path.
class HeaderFooterDotLeaderParts {
  final List<InlineSpan> rightSpans;
  final List<InlineSpan> leftSpans;
  final TextStyle leaderStyle;
  final String leaderText;

  const HeaderFooterDotLeaderParts({
    required this.rightSpans,
    required this.leftSpans,
    required this.leaderStyle,
    required this.leaderText,
  });
}

/// Fallback resolver for header/footer paragraphs that encode leader dots as
/// literal text runs instead of `w:tab` + `w:leader`.
///
/// Word documents can express leader visuals in more than one way. The primary
/// OOXML path is tab stops with a leader attribute, which should keep using the
/// normal tab-processing pipeline. This resolver is only for the narrower case
/// where the authoring tool emitted actual dot text inside a header/footer run.
class HeaderFooterDotLeaderResolver {
  static final RegExp _leaderPattern = RegExp(r'^(.*?)(\.[\.\s]{2,})(.*)$');

  static HeaderFooterDotLeaderParts? tryExtract({
    required bool isHeaderParagraph,
    required bool hasFramePr,
    required bool hasExplicitLineBreaks,
    required List<runT> textRuns,
  }) {
    if (!isHeaderParagraph) return null;
    if (hasFramePr) return null;
    if (hasExplicitLineBreaks) return null;
    if (textRuns.any((run) => run.hasTab)) return null;

    final visibleRuns = textRuns.where(_isRenderableTextRun).toList();
    if (visibleRuns.length < 2) return null;

    for (int leaderRunIndex = 0; leaderRunIndex < visibleRuns.length; leaderRunIndex++) {
      final run = visibleRuns[leaderRunIndex];
      final text = run.text ?? '';
      if (text.trim().isEmpty) continue;

      final match = _leaderPattern.firstMatch(text);
      if (match == null) continue;

      final beforeSpans = <InlineSpan>[
        ...visibleRuns.take(leaderRunIndex).map((r) => r.toWidget()),
      ];
      final runPrefix = match.group(1) ?? '';
      if (runPrefix.isNotEmpty) {
        beforeSpans.add(
          TextSpan(text: runPrefix, style: run.getEffectiveTextStyle()),
        );
      }

      final afterSpans = <InlineSpan>[];
      final runSuffix = match.group(3) ?? '';
      if (runSuffix.isNotEmpty) {
        afterSpans.add(
          TextSpan(text: runSuffix, style: run.getEffectiveTextStyle()),
        );
      }
      afterSpans.addAll(
        visibleRuns.sublist(leaderRunIndex + 1).map((r) => r.toWidget()),
      );

      final hasBefore = _spansContainVisibleText(beforeSpans);
      final hasAfter = _spansContainVisibleText(afterSpans);
      if (!hasBefore && !hasAfter) continue;

      final List<InlineSpan> rightSpans;
      final List<InlineSpan> leftSpans;

      if (hasBefore && hasAfter) {
        rightSpans = beforeSpans;
        leftSpans = afterSpans;
      } else if (hasBefore) {
        rightSpans = beforeSpans;
        leftSpans = const <InlineSpan>[];
      } else {
        rightSpans = const <InlineSpan>[];
        leftSpans = afterSpans;
      }

      return HeaderFooterDotLeaderParts(
        rightSpans: rightSpans,
        leftSpans: leftSpans,
        leaderStyle: run.getEffectiveTextStyle(),
        leaderText: match.group(2) ?? '.',
      );
    }

    return null;
  }

  static bool _isRenderableTextRun(runT run) {
    if (run.image != null) return false;
    if (run.rpr?.vanish == true) return false;
    return (run.text ?? '').trim().isNotEmpty;
  }

  static bool _spansContainVisibleText(List<InlineSpan> spans) {
    final buffer = StringBuffer();
    _collectSpanText(spans, buffer);
    return buffer.toString().trim().isNotEmpty;
  }

  static void _collectSpanText(List<InlineSpan> spans, StringBuffer buffer) {
    for (final span in spans) {
      if (span is TextSpan) {
        if (span.text != null) buffer.write(span.text);
        if (span.children != null) {
          _collectSpanText(span.children!, buffer);
        }
      }
    }
  }
}

/// Renders the extracted leader paragraph by measuring both edge texts first,
/// then painting the dot leader only inside the remaining gap.
class HeaderFooterDotLeaderLine extends StatelessWidget {
  final HeaderFooterDotLeaderParts parts;
  final TextStyle? paragraphStyle;

  const HeaderFooterDotLeaderLine({
    super.key,
    required this.parts,
    required this.paragraphStyle,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        if (!constraints.hasBoundedWidth || constraints.maxWidth <= 0) {
          return const SizedBox.shrink();
        }

        final rightText = TextSpan(
          style: paragraphStyle,
          children: parts.rightSpans,
        );
        final leftText = TextSpan(
          style: paragraphStyle,
          children: parts.leftSpans,
        );
        final rightSize = _measureInlineSpanSize(
          rightText,
          textDirection: TextDirection.rtl,
        );
        final leftSize = _measureInlineSpanSize(
          leftText,
          textDirection: TextDirection.rtl,
        );
        final dotUnit = _getLeaderDotUnit(parts.leaderText);
        final leaderSize = _measureInlineSpanSize(
          TextSpan(text: dotUnit, style: parts.leaderStyle),
          textDirection: TextDirection.ltr,
        );

        final lineHeight = math.max(
          math.max(rightSize.height, leftSize.height),
          leaderSize.height,
        );

        final leaderRight = rightSize.width;
        final leaderLeft = leftSize.width;
        final availableLeaderWidth =
            constraints.maxWidth - leaderRight - leaderLeft;

        return SizedBox(
          width: constraints.maxWidth,
          height: lineHeight > 0 ? lineHeight : null,
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (availableLeaderWidth > 0)
                Positioned(
                  right: leaderRight,
                  left: leaderLeft,
                  top: lineHeight > leaderSize.height
                      ? (lineHeight - leaderSize.height) / 2
                      : 0,
                  height: leaderSize.height > 0 ? leaderSize.height : null,
                  child: _HeaderFooterLeaderDots(
                    leaderText: parts.leaderText,
                    style: parts.leaderStyle,
                  ),
                ),
              Align(
                alignment: Alignment.centerRight,
                child: RichText(
                  textDirection: TextDirection.rtl,
                  maxLines: 1,
                  overflow: TextOverflow.clip,
                  text: rightText,
                ),
              ),
              if (parts.leftSpans.isNotEmpty)
                Align(
                  alignment: Alignment.centerLeft,
                  child: RichText(
                    textDirection: TextDirection.rtl,
                    maxLines: 1,
                    overflow: TextOverflow.visible,
                    text: leftText,
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}

class _HeaderFooterLeaderDots extends StatelessWidget {
  final String leaderText;
  final TextStyle style;

  const _HeaderFooterLeaderDots({
    required this.leaderText,
    required this.style,
  });

  @override
  Widget build(BuildContext context) {
    final dotUnit = _getLeaderDotUnit(leaderText);

    return LayoutBuilder(
      builder: (context, constraints) {
        if (!constraints.hasBoundedWidth || constraints.maxWidth <= 0) {
          return const SizedBox.shrink();
        }

        final painter = TextPainter(
          text: TextSpan(text: dotUnit, style: style),
          textDirection: TextDirection.ltr,
          maxLines: 1,
        )..layout();

        if (painter.width <= 0 || painter.height <= 0) {
          return const SizedBox.shrink();
        }

        return SizedBox(
          width: constraints.maxWidth,
          height: painter.height,
          child: CustomPaint(
            painter: _HeaderFooterLeaderPainter(dotUnit: dotUnit, style: style),
          ),
        );
      },
    );
  }
}

class _HeaderFooterLeaderPainter extends CustomPainter {
  final String dotUnit;
  final TextStyle style;

  const _HeaderFooterLeaderPainter({
    required this.dotUnit,
    required this.style,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (size.width <= 0 || size.height <= 0) return;

    final dotPainter = TextPainter(
      text: TextSpan(text: dotUnit, style: style),
      textDirection: TextDirection.ltr,
      maxLines: 1,
    )..layout();

    final dotWidth = dotPainter.width;
    final dotHeight = dotPainter.height;
    if (dotWidth <= 0 || dotHeight <= 0) return;

    int dotCount = (size.width / dotWidth).ceil();
    if (dotCount < 2) dotCount = 2;

    final step = dotCount > 1
        ? (size.width - dotWidth) / (dotCount - 1)
        : 0.0;
    final dy = (size.height - dotHeight) / 2;

    for (int i = 0; i < dotCount; i++) {
      dotPainter.paint(canvas, Offset(step * i, dy));
    }
  }

  @override
  bool shouldRepaint(covariant _HeaderFooterLeaderPainter oldDelegate) {
    return oldDelegate.dotUnit != dotUnit || oldDelegate.style != style;
  }
}

String _getLeaderDotUnit(String leaderText) {
  final compactDots = leaderText.replaceAll(' ', '');
  return compactDots.isEmpty ? '.' : compactDots[0];
}

Size _measureInlineSpanSize(
  InlineSpan span, {
  TextDirection textDirection = TextDirection.rtl,
}) {
  try {
    final painter = TextPainter(
      text: span,
      textDirection: textDirection,
      maxLines: 1,
    )..layout();
    return painter.size;
  } catch (_) {
    return Size.zero;
  }
}
