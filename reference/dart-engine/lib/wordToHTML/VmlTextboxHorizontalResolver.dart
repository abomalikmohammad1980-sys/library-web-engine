import 'package:golden_shamela/Utils/ImageParser.dart';

class VmlTextboxHorizontalResolver {
  const VmlTextboxHorizontalResolver._();

  static double? resolveBodyLeadingOffset({
    required ImageData image,
    required bool isHeaderParagraph,
    required double leftMargin,
  }) {
    if (isHeaderParagraph) return null;
    if (image.vmlShapeData?.textBoxElement == null) return null;
    if (image.posX != 0) return null;
    if (image.alignH != 'left') return null;
    if (image.relativeFromH != 'margin') return null;

    // In this layout tree, body paragraphs are not globally inset by section
    // margins. A margin-relative VML textbox with zero horizontal offset should
    // therefore start from the text area leading edge rather than the physical
    // page edge.
    return leftMargin;
  }
}
