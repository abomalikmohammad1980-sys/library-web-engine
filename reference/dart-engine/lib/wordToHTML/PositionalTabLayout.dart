import 'package:flutter/material.dart';

/// Represents one text segment positioned by a WordprocessingML `w:ptab`.
class PositionalTabSegment {
  final List<InlineSpan> spans;
  final String alignment;

  const PositionalTabSegment({
    required this.spans,
    required this.alignment,
  });
}

/// Helper methods for the supported `w:ptab` layout subset.
class PositionalTabLayoutResolver {
  static String resolveDefaultAlignment({
    required TextAlign paragraphTextAlign,
    required TextDirection paragraphDirection,
    required String? firstPositionalTabAlignment,
  }) {
    // Word header/footer positional tabs behave like classic left/center/right
    // header zones: text before the first center/right ptab stays in the left
    // zone instead of inheriting RTL paragraph start.
    if (firstPositionalTabAlignment == 'center' ||
        firstPositionalTabAlignment == 'right') {
      return 'left';
    }

    switch (paragraphTextAlign) {
      case TextAlign.left:
        return 'left';
      case TextAlign.right:
        return 'right';
      case TextAlign.center:
        return 'center';
      case TextAlign.end:
        return paragraphDirection == TextDirection.rtl ? 'left' : 'right';
      case TextAlign.start:
      case TextAlign.justify:
      default:
        return paragraphDirection == TextDirection.rtl ? 'right' : 'left';
    }
  }

  static String normalizeAlignment(
    String? alignment, {
    required String fallbackAlignment,
  }) {
    switch (alignment) {
      case 'left':
      case 'center':
      case 'right':
        return alignment!;
      default:
        return fallbackAlignment;
    }
  }

  static Alignment toFlutterAlignment(String alignment) {
    switch (alignment) {
      case 'left':
        return Alignment.centerLeft;
      case 'center':
        return Alignment.center;
      case 'right':
        return Alignment.centerRight;
      default:
        return Alignment.centerRight;
    }
  }

  static TextAlign toTextAlign(String alignment) {
    switch (alignment) {
      case 'left':
        return TextAlign.left;
      case 'center':
        return TextAlign.center;
      case 'right':
        return TextAlign.right;
      default:
        return TextAlign.right;
    }
  }
}

/// Renders margin-relative left/center/right positional-tab segments.
class PositionalTabLayout extends StatelessWidget {
  final List<PositionalTabSegment> segments;
  final TextDirection textDirection;

  const PositionalTabLayout({
    super.key,
    required this.segments,
    required this.textDirection,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        return SizedBox(
          width: constraints.maxWidth,
          child: Stack(
            children: segments.map((segment) {
              return Align(
                alignment: PositionalTabLayoutResolver.toFlutterAlignment(
                  segment.alignment,
                ),
                child: RichText(
                  textDirection: textDirection,
                  textAlign: PositionalTabLayoutResolver.toTextAlign(
                    segment.alignment,
                  ),
                  text: TextSpan(children: segment.spans),
                ),
              );
            }).toList(),
          ),
        );
      },
    );
  }
}
