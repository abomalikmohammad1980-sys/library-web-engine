part of 'Paragraph.dart';

/// Immutable description of one paragraph border side parsed from `w:pBdr`.
///
/// This stays close to OOXML terms: [style] is `w:val`, [width] is the
/// rendered Flutter width, and [space] is the Word border gap.
class ParagraphBorderSideSpec {
  final String style;
  final double width;
  final double space;
  final Color color;

  const ParagraphBorderSideSpec({
    required this.style,
    required this.width,
    required this.space,
    required this.color,
  });
}

/// Full paragraph border model used to merge consecutive bordered paragraphs.
///
/// [signature] preserves the original `w:pBdr` XML so grouping can stay exact:
/// two paragraphs are grouped only when Word gave them the same border markup.
class ParagraphBorderSpec {
  final String signature;
  final ParagraphBorderSideSpec? top;
  final ParagraphBorderSideSpec? bottom;
  final ParagraphBorderSideSpec? left;
  final ParagraphBorderSideSpec? right;
  final ParagraphBorderSideSpec? between;

  const ParagraphBorderSpec({
    required this.signature,
    this.top,
    this.bottom,
    this.left,
    this.right,
    this.between,
  });
}
